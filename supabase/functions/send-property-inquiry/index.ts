/**
 * send-property-inquiry – Supabase Edge Function
 *
 * Flow: validate auth → insert into `message` table (mandatory) → send email via Resend (secondary)
 *
 * Database insert is mandatory and happens first. If it fails, the entire action fails.
 * Email delivery is secondary. If it fails after insert, returns a partial result.
 *
 * Required secrets (set via `supabase secrets set`):
 *   RESEND_API_KEY    – Resend API key
 *   RESEND_FROM_EMAIL – Verified sender address (e.g. noreply@kvadrato.hr)
 *
 * Request body:
 *   { listingId: string, content: string }
 *
 * Buyer contact data (phone, WhatsApp, Messenger, etc.) is resolved from the DB
 * on the server side — not supplied by the frontend. This ensures accuracy and
 * respects the buyer's share preferences.
 *
 * Response shape:
 *   Full success:  { status: 'success', stored: true, emailSent: true }
 *   Partial:       { status: 'partial', stored: true, emailSent: false, warning: '...' }
 *   Full failure:  { status: 'error',   stored: false, emailSent: false, error: '...' }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM = Deno.env.get("RESEND_FROM_EMAIL") ?? "noreply@kvadrato.hr";

// ── Shared CORS headers ────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // ── CORS preflight ──────────────────────────────────────────────────────
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ status: "error", stored: false, emailSent: false, error: "Nedostaje autorizacija." }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return jsonResponse({ status: "error", stored: false, emailSent: false, error: "Neautorizirani pristup." }, 401);
    }

    // ── Verify caller is a buyer + fetch contact preferences ────────────
    const { data: profile } = await supabase
      .from("user")
      .select(`
        first_name, last_name,
        whatsapp_contact, messenger_contact, other_contact_label, other_contact_value,
        share_whatsapp, share_messenger, share_other,
        role(role_code),
        phone_number(phone_country_code, phone_number)
      `)
      .eq("user_id", user.id)
      .single();

    if (profile?.role?.role_code !== "BUYER") {
      return jsonResponse({ status: "error", stored: false, emailSent: false, error: "Samo kupci mogu slati upite." }, 403);
    }

    // Resolve buyer's phone from phone_number table
    const phoneRow = Array.isArray(profile.phone_number)
      ? profile.phone_number[0]
      : profile.phone_number;
    const buyerPhone = phoneRow
      ? `${phoneRow.phone_country_code ?? ""} ${phoneRow.phone_number ?? ""}`.trim()
      : null;

    // Build opted-in extra contacts
    const extraContacts: Array<{ label: string; value: string }> = [];
    if (profile.share_whatsapp && profile.whatsapp_contact) {
      extraContacts.push({ label: "WhatsApp", value: profile.whatsapp_contact });
    }
    if (profile.share_messenger && profile.messenger_contact) {
      extraContacts.push({ label: "Messenger", value: profile.messenger_contact });
    }
    if (
      profile.share_other &&
      profile.other_contact_label &&
      profile.other_contact_value
    ) {
      extraContacts.push({
        label: profile.other_contact_label,
        value: profile.other_contact_value,
      });
    }

    // ── Parse body ──────────────────────────────────────────────────────
    const { listingId, content } = await req.json();

    if (!listingId || !content?.trim()) {
      return jsonResponse({ status: "error", stored: false, emailSent: false, error: "listingId i content su obavezni." }, 400);
    }

    // ── Fetch listing + seller context ──────────────────────────────────
    const { data: listing, error: listErr } = await supabase
      .from("listing")
      .select(
        `listing_id, seller_id, property(title, location(city, state_region))`
      )
      .eq("listing_id", listingId)
      .single();

    if (listErr || !listing) {
      return jsonResponse({ status: "error", stored: false, emailSent: false, error: "Oglas nije pronađen." }, 404);
    }

    // Self-contact guard
    if (listing.seller_id === user.id) {
      return jsonResponse({ status: "error", stored: false, emailSent: false, error: "Ne možete slati upit za vlastiti oglas." }, 403);
    }

    // ── Resolve seller email + name from public.user ────────────────────
    const { data: sellerProfile } = await supabase
      .from("user")
      .select("email, first_name, last_name")
      .eq("user_id", listing.seller_id)
      .single();

    const sellerEmail = sellerProfile?.email;
    const sellerName = [sellerProfile?.first_name, sellerProfile?.last_name]
      .filter(Boolean)
      .join(" ");

    if (!sellerEmail) {
      return jsonResponse({ status: "error", stored: false, emailSent: false, error: "Email prodavača nije dostupan." }, 500);
    }

    // ── Build contact snapshot ─────────────────────────────────────────
    const buyerName =
      [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
      "Kupac";
    const buyerEmail = user.email;
    const propTitle = listing.property?.title ?? "Nekretnina";
    const propLocation = [
      listing.property?.location?.city,
      listing.property?.location?.state_region,
    ]
      .filter(Boolean)
      .join(", ");

    const contactSnapshot = {
      buyerName,
      buyerEmail,
      buyerPhone,
      extraContacts: extraContacts.length > 0 ? extraContacts : null,
      sellerName,
      sellerEmail,
      listingTitle: propTitle,
      sentAt: new Date().toISOString(),
    };

    // ── STEP 1: Insert into message table (MANDATORY) ─────────────────
    // Database persistence happens FIRST. If this fails, the entire action fails.
    const { error: insertErr } = await supabase.from("message").insert({
      buyer_id: user.id,
      seller_id: listing.seller_id,
      listing_id: listing.listing_id,
      content: content.trim(),
      notes: JSON.stringify(contactSnapshot),
    });

    if (insertErr) {
      console.error("[send-property-inquiry] Message insert failed:", insertErr.message);
      return jsonResponse({
        status: "error",
        stored: false,
        emailSent: false,
        error: "Spremanje poruke nije uspjelo. Pokušajte ponovo.",
      }, 500);
    }

    // ── STEP 2: Send email via Resend (SECONDARY) ─────────────────────
    // Email delivery is attempted after successful insert.
    // Failure here results in partial success, not full failure.
    let emailSent = false;
    let emailWarning: string | null = null;

    if (!RESEND_API_KEY) {
      console.warn("[send-property-inquiry] RESEND_API_KEY not set — skipping email");
      emailWarning = "Email nije konfiguriran. Poruka je spremljena.";
    } else {
      const emailHtml = buildEmailHtml({
        sellerName,
        buyerName,
        buyerEmail,
        buyerPhone,
        extraContacts,
        propTitle,
        propLocation,
        content: content.trim(),
      });

      try {
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: RESEND_FROM,
            to: sellerEmail,
            reply_to: buyerEmail,
            subject: `Upit za: ${propTitle}`,
            html: emailHtml,
          }),
        });

        if (resendRes.ok) {
          emailSent = true;
        } else {
          const errBody = await resendRes.text();
          console.error("[send-property-inquiry] Resend error:", resendRes.status, errBody);
          // Surface the provider error so the client/developer can diagnose
          emailWarning = `Email nije poslan (${resendRes.status}): ${errBody}`;
        }
      } catch (fetchErr) {
        console.error("[send-property-inquiry] Resend fetch error:", fetchErr);
        emailWarning = "Slanje emaila nije uspjelo. Poruka je spremljena.";
      }
    }

    // ── Response ──────────────────────────────────────────────────────
    if (emailSent) {
      return jsonResponse({ status: "success", stored: true, emailSent: true }, 200);
    } else {
      return jsonResponse({
        status: "partial",
        stored: true,
        emailSent: false,
        warning: emailWarning,
      }, 200);
    }
  } catch (err) {
    console.error("[send-property-inquiry] Unhandled error:", err);
    return jsonResponse({
      status: "error",
      stored: false,
      emailSent: false,
      error: "Interna greška poslužitelja.",
    }, 500);
  }
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildEmailHtml({
  sellerName,
  buyerName,
  buyerEmail,
  buyerPhone,
  extraContacts,
  propTitle,
  propLocation,
  content,
}: {
  sellerName: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string | null;
  extraContacts: Array<{ label: string; value: string }>;
  propTitle: string;
  propLocation: string;
  content: string;
}) {
  const extraContactsHtml = extraContacts
    .map((c) => `<li><strong>${c.label}:</strong> ${c.value}</li>`)
    .join("");

  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #111;">Novi upit za nekretninu</h2>
      <p>Poštovani ${sellerName || "prodavač"},</p>
      <p><strong>${buyerName}</strong> je zainteresiran/a za Vaš oglas:</p>
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <strong>${propTitle}</strong>
        ${propLocation ? `<br/><span style="color: #6b7280;">${propLocation}</span>` : ""}
      </div>
      <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0; white-space: pre-line;">${content}</p>
      </div>
      <h3 style="color: #111; font-size: 14px;">Kontakt podaci kupca</h3>
      <ul style="padding-left: 20px; color: #374151;">
        <li><strong>Ime:</strong> ${buyerName}</li>
        <li><strong>Email:</strong> <a href="mailto:${buyerEmail}">${buyerEmail}</a></li>
        ${buyerPhone ? `<li><strong>Telefon:</strong> ${buyerPhone}</li>` : ""}
        ${extraContactsHtml}
      </ul>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">
        Ovaj email je poslan putem Kvadrato platforme. Odgovorite izravno kupcu koristeći podatke iznad.
      </p>
    </div>
  `;
}
