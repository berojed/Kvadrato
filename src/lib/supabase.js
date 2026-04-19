import { createClient } from '@supabase/supabase-js'

// --- Lock override ---
// supabase-js v2 uses navigator.locks to serialize auth operations across tabs.
// That lock implementation force-steals a held lock after a short timeout, which
// throws `AbortError: Lock broken by another request with the 'steal' option.`
// inside whatever call was holding it (e.g. getSession → fetchProfile on reload).
// Once that error surfaces, the auth subsystem leaves its initialization promise
// permanently rejected, every subsequent call hangs, and the app sits in a
// half-authenticated state where user is null-ish and no REST requests ever fire.
//
// Replace it with a simple in-memory mutex. This keeps operations on the same
// client instance serialized (which is all supabase-js actually needs) without
// the cross-tab steal behavior. localStorage itself already synchronizes the
// session payload across tabs, so disabling the cross-tab lock is safe for a
// standard SPA — worst case two tabs independently refresh the same token,
// which Supabase's refresh endpoint handles idempotently.
let authChain = Promise.resolve()
const inMemoryLock = (_name, _acquireTimeout, fn) => {
  const next = authChain.then(() => fn())
  // Swallow errors on the chain itself so one failed operation can't poison
  // every subsequent one. The caller still receives the original rejection.
  authChain = next.catch(() => {})
  return next
}

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      lock: inMemoryLock,
    },
  }
)

export { supabase }