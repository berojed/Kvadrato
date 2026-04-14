import shutil
import struct
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
}
PKG_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships'
W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
WP_NS = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'
A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main'
PIC_NS = 'http://schemas.openxmlformats.org/drawingml/2006/picture'
CT_NS = 'http://schemas.openxmlformats.org/package/2006/content-types'
XML_NS = 'http://www.w3.org/XML/1998/namespace'

for prefix, uri in [('w', W_NS), ('r', R_NS), ('wp', WP_NS), ('a', A_NS), ('pic', PIC_NS)]:
    ET.register_namespace(prefix, uri)
ET.register_namespace('', PKG_REL_NS)

BASE_DOCS = Path('/Users/bernard/Desktop/Kvadrato/Dokumentacija')
ZAVRSNI = BASE_DOCS / 'Zavrsni.docx'
SUPABASE = BASE_DOCS / 'Supabase_implementacija.docx'
TEMPLATE = Path('/tmp/test_kvadrato.docx')
OUT_DOCX = Path('/tmp/Podatkovni_sloj_platforme_za_nekretnine_reworked.docx')
MEDIA_DIR = Path('/tmp/kvadrato_supabase_media')
MEDIA_DIR.mkdir(parents=True, exist_ok=True)


def qn(ns, tag):
    return '{%s}%s' % (ns, tag)


def get_text(el):
    return ''.join(t.text or '' for t in el.findall('.//w:t', NS)).strip()


def extract_section_tables():
    with zipfile.ZipFile(ZAVRSNI) as z:
        root = ET.fromstring(z.read('word/document.xml'))
    body = root.find('w:body', NS)
    inside = False
    tables = []
    for child in body:
        tag = child.tag.split('}')[-1]
        text = get_text(child) if tag == 'p' else ''
        if tag == 'p' and text == 'Podatkovni sloj platforme za nekretnine':
            inside = True
        if not inside:
            continue
        if tag == 'p' and text == 'Arhitektura sustava i korištene tehnologije':
            break
        if tag == 'tbl':
            rows = []
            for tr in child.findall('w:tr', NS):
                rows.append([get_text(tc) for tc in tr.findall('w:tc', NS)])
            tables.append(rows)
    return tables


def extract_images():
    with zipfile.ZipFile(SUPABASE) as z:
        rel_root = ET.fromstring(z.read('word/_rels/document.xml.rels'))
        rels = {r.attrib['Id']: r.attrib['Target'] for r in rel_root}
        doc_root = ET.fromstring(z.read('word/document.xml'))
        body = doc_root.find('w:body', NS)
        ordered = []
        pending = None
        for child in body:
            tag = child.tag.split('}')[-1]
            if tag == 'p':
                blips = child.findall('.//a:blip', NS)
                if blips:
                    r_id = blips[0].attrib.get('{%s}embed' % NS['r'])
                    pending = rels[r_id]
                else:
                    text = get_text(child)
                    if text.startswith('Slika') and pending:
                        ordered.append(pending)
                        pending = None
        out = []
        for idx, target in enumerate(ordered, start=1):
            src = 'word/' + target
            ext = Path(target).suffix
            dest = MEDIA_DIR / f'image{idx}{ext}'
            dest.write_bytes(z.read(src))
            out.append(dest)
        return out


def png_size(path: Path):
    with open(path, 'rb') as f:
        sig = f.read(8)
        if sig != b'\x89PNG\r\n\x1a\n':
            raise ValueError(f'Unsupported PNG: {path}')
        f.read(4)
        if f.read(4) != b'IHDR':
            raise ValueError('Missing IHDR')
        width, height = struct.unpack('>II', f.read(8))
        return width, height


def append_run(par, text, *, bold=False, italic=False, size=24):
    r = ET.SubElement(par, qn(W_NS, 'r'))
    rpr = ET.SubElement(r, qn(W_NS, 'rPr'))
    fonts = ET.SubElement(rpr, qn(W_NS, 'rFonts'))
    fonts.set(qn(W_NS, 'ascii'), 'Times New Roman')
    fonts.set(qn(W_NS, 'hAnsi'), 'Times New Roman')
    fonts.set(qn(W_NS, 'cs'), 'Times New Roman')
    if bold:
        ET.SubElement(rpr, qn(W_NS, 'b'))
    if italic:
        ET.SubElement(rpr, qn(W_NS, 'i'))
    sz = ET.SubElement(rpr, qn(W_NS, 'sz'))
    sz.set(qn(W_NS, 'val'), str(size))
    szcs = ET.SubElement(rpr, qn(W_NS, 'szCs'))
    szcs.set(qn(W_NS, 'val'), str(size))
    t = ET.SubElement(r, qn(W_NS, 't'))
    if text.startswith(' ') or text.endswith(' ') or '  ' in text:
        t.set(qn(XML_NS, 'space'), 'preserve')
    t.text = text


def add_paragraph(body, text, *, kind='body', align='left', spacing_after=120):
    p = ET.SubElement(body, qn(W_NS, 'p'))
    ppr = ET.SubElement(p, qn(W_NS, 'pPr'))
    if align != 'left':
        jc = ET.SubElement(ppr, qn(W_NS, 'jc'))
        jc.set(qn(W_NS, 'val'), 'center' if align == 'center' else align)
    sp = ET.SubElement(ppr, qn(W_NS, 'spacing'))
    sp.set(qn(W_NS, 'after'), str(spacing_after))
    if kind == 'title':
        append_run(p, text, bold=True, size=32)
    elif kind == 'h1':
        append_run(p, text, bold=True, size=28)
    elif kind == 'h2':
        append_run(p, text, bold=True, size=24)
    elif kind == 'smallhead':
        append_run(p, text, bold=True, size=22)
    elif kind == 'caption':
        append_run(p, text, italic=True, size=21)
    else:
        append_run(p, text, size=24)
    return p


def add_table(body, rows):
    tbl = ET.SubElement(body, qn(W_NS, 'tbl'))
    tbl_pr = ET.SubElement(tbl, qn(W_NS, 'tblPr'))
    tbl_w = ET.SubElement(tbl_pr, qn(W_NS, 'tblW'))
    tbl_w.set(qn(W_NS, 'w'), '0')
    tbl_w.set(qn(W_NS, 'type'), 'auto')
    borders = ET.SubElement(tbl_pr, qn(W_NS, 'tblBorders'))
    for edge in ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']:
        e = ET.SubElement(borders, qn(W_NS, edge))
        e.set(qn(W_NS, 'val'), 'single')
        e.set(qn(W_NS, 'sz'), '8')
        e.set(qn(W_NS, 'space'), '0')
        e.set(qn(W_NS, 'color'), 'auto')
    max_cols = max(len(r) for r in rows)
    grid = ET.SubElement(tbl, qn(W_NS, 'tblGrid'))
    for _ in range(max_cols):
        gc = ET.SubElement(grid, qn(W_NS, 'gridCol'))
        gc.set(qn(W_NS, 'w'), str(9000 // max_cols))
    for r_idx, row in enumerate(rows):
        tr = ET.SubElement(tbl, qn(W_NS, 'tr'))
        for cell in row:
            tc = ET.SubElement(tr, qn(W_NS, 'tc'))
            tcpr = ET.SubElement(tc, qn(W_NS, 'tcPr'))
            tcw = ET.SubElement(tcpr, qn(W_NS, 'tcW'))
            tcw.set(qn(W_NS, 'w'), str(9000 // max_cols))
            tcw.set(qn(W_NS, 'type'), 'dxa')
            p = ET.SubElement(tc, qn(W_NS, 'p'))
            ppr = ET.SubElement(p, qn(W_NS, 'pPr'))
            sp = ET.SubElement(ppr, qn(W_NS, 'spacing'))
            sp.set(qn(W_NS, 'after'), '60')
            append_run(p, cell, bold=(r_idx == 0), size=21)
    add_paragraph(body, '', spacing_after=60)


def add_image(body, path: Path, rel_id: str, docpr_id: int):
    width_px, height_px = png_size(path)
    max_width_emu = 5_900_000
    cx = width_px * 9525
    cy = height_px * 9525
    if cx > max_width_emu:
        scale = max_width_emu / cx
        cx = int(cx * scale)
        cy = int(cy * scale)
    p = ET.SubElement(body, qn(W_NS, 'p'))
    ppr = ET.SubElement(p, qn(W_NS, 'pPr'))
    jc = ET.SubElement(ppr, qn(W_NS, 'jc'))
    jc.set(qn(W_NS, 'val'), 'center')
    r = ET.SubElement(p, qn(W_NS, 'r'))
    drawing = ET.SubElement(r, qn(W_NS, 'drawing'))
    inline = ET.SubElement(drawing, qn(WP_NS, 'inline'))
    inline.set('distT', '0')
    inline.set('distB', '0')
    inline.set('distL', '0')
    inline.set('distR', '0')
    extent = ET.SubElement(inline, qn(WP_NS, 'extent'))
    extent.set('cx', str(cx))
    extent.set('cy', str(cy))
    ET.SubElement(inline, qn(WP_NS, 'docPr'), id=str(docpr_id), name=f'Picture {docpr_id}')
    c_nv = ET.SubElement(inline, qn(WP_NS, 'cNvGraphicFramePr'))
    gf = ET.SubElement(c_nv, qn(A_NS, 'graphicFrameLocks'))
    gf.set('noChangeAspect', '1')
    graphic = ET.SubElement(inline, qn(A_NS, 'graphic'))
    graphic_data = ET.SubElement(graphic, qn(A_NS, 'graphicData'))
    graphic_data.set('uri', 'http://schemas.openxmlformats.org/drawingml/2006/picture')
    pic = ET.SubElement(graphic_data, qn(PIC_NS, 'pic'))
    nv = ET.SubElement(pic, qn(PIC_NS, 'nvPicPr'))
    ET.SubElement(nv, qn(PIC_NS, 'cNvPr'), id='0', name=path.name)
    ET.SubElement(nv, qn(PIC_NS, 'cNvPicPr'))
    blip_fill = ET.SubElement(pic, qn(PIC_NS, 'blipFill'))
    blip = ET.SubElement(blip_fill, qn(A_NS, 'blip'))
    blip.set(qn(R_NS, 'embed'), rel_id)
    stretch = ET.SubElement(blip_fill, qn(A_NS, 'stretch'))
    ET.SubElement(stretch, qn(A_NS, 'fillRect'))
    sppr = ET.SubElement(pic, qn(PIC_NS, 'spPr'))
    xfrm = ET.SubElement(sppr, qn(A_NS, 'xfrm'))
    ET.SubElement(xfrm, qn(A_NS, 'off'), x='0', y='0')
    ET.SubElement(xfrm, qn(A_NS, 'ext'), cx=str(cx), cy=str(cy))
    prst = ET.SubElement(sppr, qn(A_NS, 'prstGeom'))
    prst.set('prst', 'rect')
    ET.SubElement(prst, qn(A_NS, 'avLst'))


def add_image_block(body, image_path, rel_id, docpr_id, caption, desc):
    add_image(body, image_path, rel_id, docpr_id)
    add_paragraph(body, caption, kind='caption', align='center', spacing_after=60)
    add_paragraph(body, desc, spacing_after=180)


def build_document_xml(tables, images):
    document = ET.Element(qn(W_NS, 'document'))
    document.set(qn('http://schemas.openxmlformats.org/markup-compatibility/2006', 'Ignorable'), 'w14 wp14')
    body = ET.SubElement(document, qn(W_NS, 'body'))
    img = {i + 1: images[i] for i in range(len(images))}
    rel_ids = {1: 'rId3', 2: 'rId4', 3: 'rId5', 4: 'rId6', 5: 'rId7'}

    def p(text, **kwargs):
        add_paragraph(body, text, **kwargs)

    p('Podatkovni sloj platforme za nekretnine', kind='title', align='center', spacing_after=240)
    p('1. Uvod u bazu podataka', kind='h1')
    p('Podatkovni sloj aplikacije općenito predstavlja skup modela, pravila i mehanizama koji omogućuju trajnu pohranu podataka te njihovu dosljednu razmjenu s ostalim slojevima sustava. U platformama za nekretnine taj sloj mora istodobno obuhvatiti opis nekretnina, tržišne oglase, korisničke profile, interakcije među korisnicima i povezane medijske sadržaje, uz očuvanje cjelovitosti i pouzdanosti podataka.')
    p('U projektu Kvadrato taj je sloj implementiran na relacijskoj bazi podataka PostgreSQL unutar Supabase platforme. Takav odabir ne mijenja opća načela modeliranja podatkovnog sloja, nego ih konkretizira kroz gotovu infrastrukturu za pohranu, autentifikaciju, sigurnosna pravila i pristup datotekama.')
    p('Svrha ovog dokumenta jest objediniti konceptualni opis podatkovnog sloja i njegovu stvarnu implementaciju u projektu, ali uz zadržavanje fokusa na ulozi baze podataka i povezanih mehanizama u cjelokupnom sustavu. Zbog toga se Supabase u nastavku obrađuje kao implementacijski okvir, a ne kao središnja tema samog poglavlja.')

    p('2. Supabase arhitektura', kind='h1')
    p('Na općoj razini, suvremeni podatkovni sloj web aplikacije uključuje relacijsku bazu podataka, mehanizam autentifikacije, kontrolu pristupa, pohranu nestrukturiranih datoteka i programsko sučelje preko kojega aplikacija pristupa podacima. U tradicionalnoj arhitekturi ti se elementi često implementiraju kroz odvojene servise i vlastiti backend poslužitelj, dok BaaS pristup iste funkcije objedinjuje u jednoj platformi.')
    p('Kvadrato koristi upravo takav objedinjeni pristup: PostgreSQL služi kao glavni izvor istine za strukturirane podatke, Supabase Auth upravlja identitetom i sesijama korisnika, Storage služi za medijske datoteke, a pristup tablicama ostvaruje se putem automatski generiranog API sloja. Time je podatkovni sloj tehnički pojednostavljen, ali i dalje zadržava relacijsku logiku i jasnu podjelu odgovornosti među entitetima.')
    p('2.1. Komunikacijski model', kind='h2')
    p('U općem smislu, komunikacijski model podatkovnog sloja određuje na koji način klijentska aplikacija dohvaća, umeće i ažurira podatke, te na kojem se mjestu provode autorizacijska pravila. U sustavima koji izlažu bazu preko standardiziranog API-ja ključno je da aplikacija ne pristupa podacima ad hoc, nego kroz jasno definiran servisni sloj.')
    p('U Kvadratu React klijent inicijalizira jedinstveni Supabase klijent u datoteci src/lib/supabase.js, dok su svi podatkovni pozivi smješteni u datotekama unutar direktorija src/services/. Time je klijentski sloj rasterećen izravnog rada s bazom, a autorizacija se oslanja na JWT sesiju i Row Level Security pravila na razini baze.')
    add_image_block(body, img[1], rel_ids[1], 1, 'Slika 1. Automatski generirana API dokumentacija s popisom tablica podatkovnog sloja aplikacije', 'Prikaz potvrđuje da je podatkovni sloj projekta organiziran kroz relacijsku shemu iz koje se automatski generira pristupni API. U kontekstu ovog rada važna je činjenica da API nije zasebno pisan ručno, nego proizlazi iz strukture baze podataka i njezinih relacija.')

    p('3. Organizacija sheme', kind='h1')
    p('Organizacija sheme u relacijskoj bazi podataka služi razdvajanju različitih vrsta podataka prema njihovoj ulozi i razini odgovornosti. Takva podjela pojednostavljuje održavanje sustava, jasnije razdvaja podatke kojima upravlja aplikacija od onih kojima upravlja infrastrukturna platforma te olakšava definiranje pravila pristupa.')
    p('U Kvadratu je podatkovni sloj raspoređen kroz tri osnovne sheme: public, auth i storage. Shema public sadrži domenske tablice tržišta nekretnina, auth sadrži identitetske zapise kojima upravlja Supabase Auth, dok storage pohranjuje metapodatke o datotekama u bucketima. Evolucija cijele strukture prati se migracijskim datotekama, čime je omogućena reprodukcija baze u svakom okruženju.')
    p('3.1. Shema public', kind='h2')
    p('Shema public predstavlja poslovnu jezgru sustava. U njoj se nalaze tablice vezane uz nekretnine, oglase, profile korisnika, favorite, zahtjeve za razgledavanje, poruke, slike i 3D podatke. Za platformu poput Kvadrata upravo je ova shema nositelj poslovne logike i osnova za sve funkcionalne tokove aplikacije.')
    p('3.2. Shema auth', kind='h2')
    p('Shema auth u općem smislu služi odvajanju identitetskih podataka od aplikacijskih profila. U Kvadratu se tablica auth.users koristi kao izvor identiteta i sesije, dok se aplikacijski podaci korisnika, uključujući ulogu, drže u tablici public.user povezanoj preko korisničkog identifikatora.')
    p('3.3. Shema storage', kind='h2')
    p('Shema storage podržava pohranu binarnih objekata i pravila pristupa tim objektima. U ovom projektu ona nadopunjuje relacijski model tako da slike, 3D modeli i avatari ostaju fizički odvojeni od tabličnih podataka, ali su s njima povezani putem strukturiranih putanja i javnih URL-ova.')
    p('3.4. Migracijski sustav', kind='h2')
    p('Migracijski sustav važan je dio podatkovnog sloja jer omogućuje kontroliranu evoluciju sheme. U Kvadratu su SQL migracije korištene za kreiranje tablica, nadogradnju sigurnosnih pravila, stvaranje bucketâ i postupno usklađivanje modela sa stvarnim funkcionalnim zahtjevima aplikacije.')

    p('4. Opis tablica', kind='h1')
    p('Opis tablica u nastavku zadržava izvorni pregled strukture podatkovnog modela, jer upravo te tablice predstavljaju operativnu osnovu sustava. Umjesto izdvajanja Supabase kao zasebne teme, naglasak je stavljen na to kako su poslovni podaci organizirani i kako pojedine tablice sudjeluju u korisničkim tokovima platforme.')
    p('4.1. Tablice nekretnina', kind='h2')
    p('Temeljna domenska skupina obuhvaća fizički opis nekretnine i njezina svojstva. Općenito, podatkovni model ovog tipa mora razdvojiti osnovni zapis o nekretnini od njezine adrese, lokacije, tehničkih detalja i klasifikacije, kako bi se izbjegla redundancija i olakšalo ponovno korištenje referentnih podataka.')
    p('U Kvadratu tu ulogu nose tablice property, property_type, property_details, property_address i location. Takva podjela omogućuje da se naslov, opis i površina vode u središnjem zapisu nekretnine, dok se adresni, lokacijski i tehnički atributi drže u pomoćnim tablicama koje se mogu neovisno validirati i dohvaćati.')
    p('property', kind='smallhead', spacing_after=60)
    p('Središnja tablica koja pohranjuje osnovne podatke o nekretnini i povezuje je s adresom, lokacijom i tipom.')
    add_table(body, tables[0])
    p('CHECK ograničenje nad koordinatama osigurava da su geografski podatci potpuni ili potpuno odsutni, čime se izbjegavaju parcijalni i neupotrebljivi zapisi.')
    p('property_type', kind='smallhead', spacing_after=60)
    p('Referentna tablica tipova nekretnina služi standardiziranju kategorija i uklanjanju slobodnog tekstualnog unosa u oglasima.')
    add_table(body, tables[1])
    p('property_details', kind='smallhead', spacing_after=60)
    p('Tablica s detaljima nekretnine u odnosu 1:1 dopunjuje osnovni zapis tehničkim atributima koji nisu jednako nužni u svakom pregledu podataka.')
    add_table(body, tables[2])
    p('property_address', kind='smallhead', spacing_after=60)
    p('Adresni podatci izdvojeni su kako bi fizička adresa ostala odvojena od opisnih obilježja nekretnine.')
    add_table(body, tables[3])
    p('location', kind='smallhead', spacing_after=60)
    p('Lokacija je zasebna tablica zato što igra važnu ulogu u filtriranju, pretraživanju i kartografskom prikazu ponude.')
    add_table(body, tables[4])

    p('4.2. Tablice oglasa', kind='h2')
    p('U sustavima za tržište nekretnina potrebno je razlikovati fizičku nekretninu od tržišnog oglasa. Nekretnina opisuje objekt, dok oglas nosi poslovni kontekst, poput tipa transakcije, cijene, statusa i vlasništva nad ponudom.')
    p('Kvadrato slijedi upravo taj model: tablica listing povezuje nekretninu i prodavatelja, dok pomoćne tablice listing_status i currency standardiziraju vrijednosti koje se često ponavljaju u oglasima.')
    p('listing', kind='smallhead', spacing_after=60)
    p('Glavni poslovni entitet platforme koji određuje kako je nekretnina ponuđena na tržištu i tko njome upravlja.')
    add_table(body, tables[5])
    add_image_block(body, img[2], rel_ids[2], 2, 'Slika 2. Tablica listing u Supabase Table Editoru', 'Prikaz tablice listing potvrđuje da je oglas modeliran kao zaseban poslovni entitet povezan s nekretninom i prodavateljem. U kontekstu podatkovnog sloja to je ključno jer se na toj tablici temelje filtriranje, statusi ponude i većina interakcija kupaca.')
    p('listing_status', kind='smallhead', spacing_after=60)
    p('Referentna tablica statusa omogućuje standardiziranu kontrolu životnog ciklusa oglasa.')
    add_table(body, tables[6])
    p('currency', kind='smallhead', spacing_after=60)
    p('Valute su izdvojene u zasebnu tablicu kako bi se cjenovni podatci vodili konzistentno i bez slobodnog tekstualnog unosa.')
    add_table(body, tables[7])

    p('4.3. Tablice medijskog sadržaja', kind='h2')
    p('Medijski sloj proširuje tekstualni opis nekretnine i ima važnu ulogu u odluci korisnika. U dobro projektiranom podatkovnom modelu mediji se vode u zasebnim tablicama, kako bi se broj datoteka, njihovi URL-ovi i redoslijed prikaza mogli upravljati neovisno o glavnom zapisu nekretnine.')
    p('U Kvadratu su fotografije, 3D modeli i spremljene kamerne pozicije modelirani odvojeno. Time su slike i modeli povezani s nekretninom, a ne izravno s korisničkim sučeljem, što omogućuje da isti podatci budu dostupni različitim prikazima aplikacije.')
    p('image', kind='smallhead', spacing_after=60)
    p('Tablica fotografija određuje redoslijed i primarnu sliku za svaku nekretninu.')
    add_table(body, tables[8])
    p('model3d', kind='smallhead', spacing_after=60)
    p('Tablica 3D modela osigurava kanonski zapis o tome postoji li trodimenzionalni prikaz za određenu nekretninu.')
    add_table(body, tables[9])
    p('property_3d_room', kind='smallhead', spacing_after=60)
    p('Ova tablica pohranjuje unaprijed definirane poglede unutar 3D modela, što je specifična funkcionalnost projekta Kvadrato.')
    add_table(body, tables[10])
    p('UNIQUE(property_id, room_name) zadržan je kao važna mjera integriteta jer sprječava dvostruke nazive prostorija unutar iste nekretnine.')

    p('4.4. Tablice korisnika i uloga', kind='h2')
    p('Korisnički dio podatkovnog sloja općenito mora razlikovati identitet korisnika od aplikacijskog profila i poslovne uloge. Takvo razdvajanje smanjuje rizik nekonzistentnosti i omogućuje da autentifikacijski podaci ostanu pod kontrolom specijaliziranog sustava.')
    p('U Kvadratu je identitet pohranjen u auth.users, dok aplikacijski profil i uloga pripadaju tablicama public.user, role i phone_number. Time se uloge BUYER i SELLER rješavaju unutar domenskog modela, a ne samo u autentifikacijskom sloju.')
    p('user (public)', kind='smallhead', spacing_after=60)
    p('Profilna tablica dopunjuje autentifikacijski zapis podacima potrebnima za rad aplikacije, uključujući ime, prezime, avatar i ulogu.')
    add_table(body, tables[11])
    add_image_block(body, img[3], rel_ids[3], 3, 'Slika 3. Tablica public.user s profilnim podatcima korisnika', 'Snimka pokazuje odvajanje aplikacijskog profila od autentifikacijskog zapisa u auth.users. To je važno za podatkovni sloj jer omogućuje da se poslovni atributi korisnika, poput uloge i avatara, vode odvojeno od samog mehanizma prijave.')
    p('role', kind='smallhead', spacing_after=60)
    p('Referentna tablica uloga definira autorizacijski okvir sustava na aplikacijskoj razini.')
    add_table(body, tables[12])
    p('phone_number', kind='smallhead', spacing_after=60)
    p('Telefonski podatci izdvojeni su u zasebnu tablicu radi fleksibilnijeg modeliranja kontakata korisnika.')
    add_table(body, tables[13])

    p('4.5. Tablice interakcija', kind='h2')
    p('Interakcijske tablice prate aktivno sudjelovanje korisnika na platformi i zbog toga su izravno vezane uz poslovne tokove sustava. U tržištu nekretnina takvi zapisi moraju sačuvati kontekst oglasa, korisničku ulogu i vremenski slijed radnje.')
    p('Kvadrato korisničke interakcije modelira kroz favorite, visit_request i message. Time su favorit, zakazivanje razgledavanja i kontaktiranje prodavatelja evidentirani kao samostalni relacijski zapisi, što olakšava autorizaciju, reviziju i naknadne poslovne obrade.')
    p('favorite', kind='smallhead', spacing_after=60)
    p('Tablica favorita modelira vezu mnogo-na-mnogo između kupca i oglasa.')
    add_table(body, tables[14])
    p('Kompozitni primarni ključ zadržan je jer sprječava višestruko spremanje istog oglasa u favorite istog korisnika.')
    p('visit_request', kind='smallhead', spacing_after=60)
    p('Zahtjevi za razgledavanje nose i poslovni status procesa, zbog čega predstavljaju važan dio operativnog sloja aplikacije.')
    add_table(body, tables[15])
    p("UNIQUE INDEX(buyer_id, listing_id) WHERE status IN ('PENDING', 'CONFIRMED')) osigurava da kupac ne može imati više istodobno aktivnih zahtjeva za isti oglas.")
    p('message', kind='smallhead', spacing_after=60)
    p('Tablica poruka čuva tekst upita i kontekst oglasa, a u projektu se puni preko Edge Function mehanizma radi sigurnijeg toka obrade.')
    add_table(body, tables[16])
    p('CHECK ograničenje buyer_id ≠ seller_id sprječava nelogično samokontaktiranje unutar sustava.')

    p('4.6. Referentne tablice', kind='h2')
    p('Referentne tablice služe standardizaciji vrijednosti koje se često ponavljaju i koje ne treba voditi kao slobodni tekst. Takav pristup poboljšava kvalitetu podataka, pojednostavljuje validaciju i omogućuje lakšu lokalizaciju prikaznih naziva.')
    p('U Kvadratu referentne tablice obuhvaćaju pogodnosti, stanja nekretnine, tip grijanja, namještenost i mjerne jedinice. Time je podatkovni model dovoljno fleksibilan za proširenje bez promjene osnovnih poslovnih tablica.')
    p('amenity / property_amenity', kind='smallhead', spacing_after=60)
    p('Pogodnosti su modelirane kao zaseban katalog i vezna tablica, čime je podržana struktura mnogo-na-mnogo.')
    add_table(body, tables[17])
    add_table(body, tables[18])
    p('Kompozitni primarni ključ na veznoj tablici sprječava duplo pridruživanje iste pogodnosti istoj nekretnini.')
    p('furnishing_type, heating_type, property_condition', kind='smallhead', spacing_after=60)
    p('Ove tri tablice standardiziraju tehničke i opisne karakteristike nekretnine koje se često koriste pri filtriranju i prikazu detalja.')
    add_table(body, tables[19])
    p('unit', kind='smallhead', spacing_after=60)
    p('Tablica mjernih jedinica omogućuje konzistentno vođenje površine nekretnina.')
    add_table(body, tables[20])

    p('5. Odnosi među tablicama', kind='h1')
    p('Relacije među tablicama čine središnji mehanizam kojim podatkovni sloj održava cjelovitost poslovnog modela. U relacijskim sustavima takve veze ne služe samo povezivanju zapisa, nego i sprječavanju nelogičnih stanja, poput siročastih medijskih zapisa, nepovezanih zahtjeva ili oglasa bez pripadne nekretnine.')
    p('U projektu Kvadrato relacije su posebno važne zato što se većina korisničkih funkcionalnosti oslanja na višestruke povezane entitete. Pregled jednoga oglasa, primjerice, ne uključuje samo oglas, nego i povezanu nekretninu, lokaciju, slike, detalje, status i potencijalne korisničke interakcije.')
    p('5.1. Lanac oglas → nekretnina → lokacija', kind='h2')
    p('Opći model tržišta nekretnina zahtijeva jasan lanac od tržišne ponude prema fizičkom objektu i njegovu prostornom kontekstu. U Kvadratu je taj lanac ostvaren relacijom listing → property → location / image / property_details, pri čemu oglas ostaje poslovni ulaz u podatke, a nekretnina nosi većinu opisnih atributa.')
    p('5.2. Vlasništvo nad nekretninom', kind='h2')
    p('Važna projektna odluka jest da vlasništvo nije zapisano u tablici property, nego u tablici listing kroz stupac seller_id. Time je očuvana razlika između same nekretnine kao objekta i oglasa kao poslovnog zapisa koji tu nekretninu stavlja na tržište.')
    p('5.3. Veza mnogo-na-mnogo: pogodnosti', kind='h2')
    p('Pogodnosti su implementirane kao M:N odnos između property i amenity, jer jedna nekretnina može imati više pogodnosti, a ista pogodnost može se pojaviti kod mnogo nekretnina. Takav obrazac je tipičan za dobro normalizirane relacijske modele.')
    p('5.4. Odnos 1:1 za 3D modele', kind='h2')
    p('Odnos 1:1 između property i model3d zadržava jedinstven trodimenzionalni prikaz po nekretnini, dok property_3d_room proširuje isti objekt presetima kamere. Ovo je dobar primjer kako se specifična funkcionalnost može dodati bez narušavanja osnovne sheme.')
    p('5.5. Korisničke interakcije', kind='h2')
    p('Favorite, visit_request i message tablice povezuju korisnike s oglasima kroz različite oblike interakcije. Time podatkovni sloj podržava tri odvojena toka: spremanje interesa, organizaciju razgledavanja i komunikaciju s prodavateljem.')
    p('5.6. Referentne tablice', kind='h2')
    p('Korištenje referentnih tablica omogućuje da se vrijednosti poput statusa, tipova i stanja ne kodiraju u aplikaciji kao fiksni nizovi. U Kvadratu to olakšava proširenje sustava i održava dosljednost između korisničkog sučelja i baze podataka.')

    p('6. Tokovi podataka', kind='h1')
    p('Tokovi podataka opisuju kako se zapisi stvaraju, povezuju i mijenjaju tijekom uporabe sustava. U podatkovnom sloju to je važno zato što poslovni procesi rijetko ovise o jednoj tablici; najčešće se radi o koordiniranom radu više povezanih entiteta i pomoćnih mehanizama poput validacije, kompenzacijskog brisanja ili serverskih funkcija.')
    p('U Kvadratu su najvažniji tokovi vezani uz kreiranje oglasa, javni pregled aktivne ponude, kontaktiranje prodavatelja, zakazivanje razgledavanja i upravljanje favoritima. U svim tim slučajevima relacijski model određuje kojim se redoslijedom podaci stvaraju i koje se provjere moraju zadovoljiti prije nego što zapis postane valjan dio sustava.')
    p('6.1. Kreiranje nekretnine i oglasa', kind='h2')
    p('Kreiranje oglasa nije jedna operacija, nego koordiniran slijed koraka: stvaranje adrese, razrješavanje lokacije, umetanje nekretnine, stvaranje oglasa, upis tehničkih detalja, spremanje pogodnosti i pohrana slika. U Kvadratu je taj tok implementiran kroz servisni sloj, a ne kroz direktni rad komponenti nad bazom.')
    p('6.2. Pregledavanje oglasa', kind='h2')
    p('Pregledavanje ponude oslanja se na dohvat samo aktivnih oglasa i povezivanje oglasa s pripadnim podatcima nekretnine. Time korisnik na jednom mjestu dobiva naslov, lokaciju, slike, detalje i cjenovne podatke bez potrebe za višestrukim nepovezanim upitima.')
    p('6.3. Upit kupca prodavaču', kind='h2')
    p('Kontaktni tok kombinira podatkovni i serverski sloj: poruka se ne upisuje izravno iz klijenta, nego se šalje preko Edge Function koja validira korisnika, dohvaća potrebne kontaktne podatke i bilježi poruku u tablici message. Time je sačuvan trag komunikacije, a osjetljivi dijelovi obrade ostaju izvan preglednika.')
    p('6.4. Zahtjev za posjet nekretnini', kind='h2')
    p('Zahtjev za razgledavanje uključuje provjeru vlasništva, provjeru postojećeg aktivnog zahtjeva i upis statusa procesa. Kvadrato ovdje kombinira servisnu validaciju i ograničenja baze podataka kako bi se spriječili duplikati i nelogične radnje.')
    p('6.5. Upravljanje favoritima', kind='h2')
    p('Favoriti su implementirani kao jednostavan toggle nad veznom tablicom između korisnika i oglasa. Iako je riječ o relativno jednostavnoj funkciji, ona je važna jer pokazuje kako i male korisničke akcije u dobro projektiranom sustavu imaju jasan i integritetom zaštićen zapis u bazi.')

    p('7. Pohrana datoteka (Storage)', kind='h1')
    p('Podatkovni sloj ne obuhvaća samo strukturirane tablične podatke, nego i nestrukturirane objekte koji se moraju povezati s poslovnim zapisima. U sustavima za nekretnine to su prvenstveno fotografije, avatari i, u slučaju Kvadrata, trodimenzionalni modeli.')
    p('Kvadrato za to koristi Supabase Storage, ali je logika i dalje podatkovno orijentirana: svaka datoteka pripada jasno definiranom bucketu, ima strogo određenu putanju i povezana je s korisnikom ili nekretninom preko identifikatora. Zbog toga se Storage u ovom radu promatra kao proširenje podatkovnog sloja, a ne kao odvojeni infrastrukturni dodatak.')
    add_image_block(body, img[5], rel_ids[5], 5, 'Slika 4. Pregled Storage bucketâ korištenih u podatkovnom sloju sustava', 'Snimka prikazuje razdvajanje datoteka po funkcionalnim cjelinama, što je važno za preglednost i kontrolu pristupa. U Kvadratu su slike nekretnina, 3D modeli i avatari odvojeni u zasebne buckete kako bi se pojednostavnilo upravljanje pravilima pisanja i čitanja.')
    p('7.1. Bucket: property-pictures', kind='h2')
    add_table(body, tables[21])
    p('7.2. Bucket: property-models', kind='h2')
    add_table(body, tables[22])
    p('7.3. Bucket: profile-images', kind='h2')
    add_table(body, tables[23])
    p('Sva tri bucketa koriste vlasnički model pisanja, dok su putanje organizirane prema identifikatoru nekretnine ili korisnika. Takav pristup omogućuje da se datoteke pouzdano vežu uz relacijske zapise, a istodobno ostaju fizički odvojene od tablica u kojima se drže URL-ovi i dodatni metapodatci.')

    p('8. Autentifikacija i upravljanje korisnicima', kind='h1')
    p('Autentifikacija predstavlja most između identitetskog i podatkovnog sloja. Na općoj razini, sustav mora znati tko je korisnik, koju ulogu ima i kojim zapisima smije pristupiti. U dobro oblikovanom rješenju ti se podaci ne smiju voditi proizvoljno u aplikacijskom kodu, nego moraju imati uporište u bazi i mehanizmu sesije.')
    p('U Kvadratu tu zadaću preuzima Supabase Auth, dok aplikacijski model dodatno koristi public.user i role za razrješavanje razlike između kupca i prodavatelja. Time se identitet, profil i ovlasti povezuju, ali ostaju konceptualno razdvojeni.')
    p('8.1. Registracija', kind='h2')
    p('Registracijom se stvara autentifikacijski zapis u auth.users te pripadni aplikacijski profil u public.user. Ovakav dvostruki zapis potreban je jer sama autentifikacija nije dovoljna za vođenje poslovne logike tržišta nekretnina.')
    p('8.2. Prijava', kind='h2')
    p('Prijava dohvaća sesiju i potom profil korisnika s njegovom ulogom. U Kvadratu se uloga provjerava odmah nakon prijave kako bi kupac i prodavatelj bili usmjereni u odgovarajući funkcionalni tok.')
    p('8.3. Upravljanje sesijom', kind='h2')
    p('Sesija se održava kroz JWT i refresh mehanizam, a klijentska aplikacija reaktivno prati promjene stanja prijave. To je važno jer pristup podatcima i sigurnosna pravila izravno ovise o identitetu korisnika.')
    p('8.4. Promjena podataka', kind='h2')
    p('Promjena e-pošte i lozinke odvija se u autentifikacijskom sloju, dok se ostali profilni podatci ažuriraju kroz aplikacijske tablice. Ovim odvajanjem Kvadrato izbjegava dupliciranje identitetskih podataka i održava konzistentnost profila.')
    p('8.5. Korisničke uloge', kind='h2')
    p('Uloge BUYER i SELLER određuju koje tablice i tokovi dolaze u fokus pojedinog korisnika. U podatkovnom sloju to znači da isti mehanizam autentifikacije podržava dva različita poslovna modela rada nad istim skupom temeljnih entiteta.')

    p('9. Sigurnost na razini redaka (Row Level Security)', kind='h1')
    p('Row Level Security je opći PostgreSQL mehanizam koji autorizaciju spušta na razinu pojedinog retka. U kontekstu podatkovnog sloja to znači da pristup nije određen samo time koju je tablicu aplikacija upitala, nego i time zadovoljava li svaki pojedini zapis uvjete vidljivosti ili izmjene.')
    p('Takav pristup posebno je važan kada klijentska aplikacija komunicira izravno s podatkovnom platformom. U Kvadratu RLS služi kao konačni zaštitni sloj za oglase, zahtjeve za razgledavanje, poruke i 3D konfiguracije, dok se ista pravila dodatno odražavaju u servisnom i prezentacijskom sloju.')
    p('9.1. Politike tablice listing', kind='h2')
    p('Tablica oglasa mora ostati javno čitljiva radi pregledavanja ponude, ali operacije pisanja i brisanja moraju ostati ograničene na vlasnika oglasa.')
    add_table(body, tables[24])
    add_image_block(body, img[4], rel_ids[4], 4, 'Slika 5. Primjer RLS politika nad tablicom listing', 'Prikazane politike potvrđuju da se kontrola pristupa ne oslanja samo na logiku korisničkog sučelja. U podatkovnom sloju Kvadrata iste politike određuju tko smije čitati, umetati, ažurirati i brisati oglase.')
    p('9.2. Politike tablice visit_request', kind='h2')
    p('Zahtjevi za razgledavanje traže finiju podjelu prava jer u istom procesu sudjeluju i kupac i prodavatelj.')
    add_table(body, tables[25])
    p('9.3. Politike tablice message', kind='h2')
    p('Poruke su privatne interakcije i zato pristup mora biti ograničen samo na uključene strane.')
    add_table(body, tables[26])
    p('9.4. Politike tablice property_3d_room', kind='h2')
    p('Podaci o 3D presetima javno su čitljivi radi kupčevog pregleda, ali ih smije uređivati samo prodavatelj koji upravlja konkretnim oglasom.')
    add_table(body, tables[27])
    p('9.5. Model sigurnosti u tri sloja', kind='h2')
    p('U Kvadratu se sigurnost ostvaruje na tri povezane razine: korisničko sučelje skriva nedopuštene radnje, servisni sloj provodi poslovne provjere, a RLS osigurava da baza odbije i one zahtjeve koji bi eventualno prošli kroz više slojeve. Takva višeslojna obrana prikladna je za sustav u kojemu kupci i prodavatelji rade nad istim domenskim modelom, ali s različitim ovlastima.')

    p('10. API i obrasci upita', kind='h1')
    p('Pristup podatkovnom sloju u suvremenoj web aplikaciji ne svodi se samo na postojanje baze podataka, nego i na način na koji se podaci dohvaćaju i obrađuju. Zato je uz opis tablica potrebno objasniti i obrasce upita, način organizacije servisnog sloja te tipične operacije koje povezuju klijentsku aplikaciju s bazom.')
    p('U Kvadratu se pristup podacima ostvaruje preko Supabase JavaScript SDK-a, ali su svi pozivi centralizirani u servisnim modulima. Time je očuvana arhitekturna disciplina: React komponente ne znaju detalje upita, nego rade s već oblikovanim funkcijama podatkovnog sloja.')
    p('10.1. Arhitektura servisnog sloja', kind='h2')
    p('Servisni sloj grupira upite prema poslovnoj domeni i time odvaja prikaz od pristupa podacima.')
    add_table(body, tables[28])
    p('10.2. Ugniježđeni upiti (Nested Selects)', kind='h2')
    p('Ugniježđeni upiti omogućuju dohvat povezanih tablica u jednom pozivu, što je posebno korisno kod oglasa koji ovise o više pomoćnih entiteta. U Kvadratu taj obrazac omogućuje da jedan dohvat oglasa odmah uključi podatke o nekretnini, lokaciji, slikama, detaljima i statusu.')
    p('10.3. Inner join za filtriranje (!inner)', kind='h2')
    p('Filtriranje po povezanoj tablici zahtijeva eksplicitan inner join kako bi se iz rezultata uklonili zapisi bez podudaranja. Ovaj obrazac u projektu je važan za pouzdano izdvajanje aktivnih oglasa i drugih relacijski uvjetovanih skupova podataka.')
    p('10.4. Upsert obrazac', kind='h2')
    p('Upsert je koristan kada podatkovni model predviđa odnos 1:1 ili situacije u kojima zapis može biti i novi i postojeći. U Kvadratu se takav pristup koristi kod dopunskih zapisa poput property_details, čime se izbjegava nepotrebno grananje logike između umetanja i ažuriranja.')
    p('10.5. Razlika između .single() i .maybeSingle()', kind='h2')
    p('Razlika između obveznog i opcionalnog pojedinačnog rezultata važna je za stabilnost aplikacije. Kvadrato koristi stroži obrazac kada je zapis očekivan dio modela, a blaži kada odsutnost retka nije greška, nego regularno stanje procesa.')
    p('10.6. Edge Function poziv', kind='h2')
    p('Za operacije koje nadilaze čisti CRUD pristup koristi se Edge Function poziv. U Kvadratu je to osobito vidljivo kod slanja upita prodavatelju, gdje je potrebno spojiti validaciju identiteta, upis poruke i eventualno slanje e-pošte.')
    p('10.7. Obrada grešaka', kind='h2')
    p('Strukturirana obrada grešaka sastavni je dio podatkovnog sloja jer korisničko sučelje mora razlikovati neuspjeh upita, neuspjeh poslovne validacije i djelomično uspješne operacije. U Kvadratu se zato povratne vrijednosti iz servisnog sloja standardiziraju kako bi viši slojevi sustava mogli dosljedno reagirati na svaku situaciju.')
    p('Zadržavanjem relacijskog modela, svih postojećih tablica i jasno definiranih obrazaca pristupa podacima, podatkovni sloj projekta ostaje pregledan i akademski objašnjiv, dok Supabase u tom okviru služi kao konkretna implementacijska platforma, a ne kao jedina tema odjeljka.')

    sect = ET.SubElement(body, qn(W_NS, 'sectPr'))
    ET.SubElement(sect, qn(W_NS, 'pgSz'), {qn(W_NS, 'w'): '12240', qn(W_NS, 'h'): '15840'})
    ET.SubElement(sect, qn(W_NS, 'pgMar'), {qn(W_NS, 'top'): '1440', qn(W_NS, 'right'): '1800', qn(W_NS, 'bottom'): '1440', qn(W_NS, 'left'): '1800'})
    return ET.tostring(document, encoding='utf-8', xml_declaration=True)


def build_rels_xml():
    root = ET.Element(qn(PKG_REL_NS, 'Relationships'))
    ET.SubElement(root, qn(PKG_REL_NS, 'Relationship'), Id='rId1', Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXml', Target='../docProps/meta.xml')
    ET.SubElement(root, qn(PKG_REL_NS, 'Relationship'), Id='rId2', Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme', Target='theme/theme1.xml')
    for idx in range(1, 6):
        ET.SubElement(root, qn(PKG_REL_NS, 'Relationship'), Id=f'rId{idx+2}', Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/image', Target=f'media/image{idx}.png')
    return ET.tostring(root, encoding='utf-8', xml_declaration=True)


def build_content_types_xml():
    root = ET.Element(qn(CT_NS, 'Types'))
    ET.SubElement(root, qn(CT_NS, 'Default'), Extension='rels', ContentType='application/vnd.openxmlformats-package.relationships+xml')
    ET.SubElement(root, qn(CT_NS, 'Default'), Extension='xml', ContentType='application/xml')
    ET.SubElement(root, qn(CT_NS, 'Default'), Extension='png', ContentType='image/png')
    ET.SubElement(root, qn(CT_NS, 'Override'), PartName='/word/document.xml', ContentType='application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml')
    ET.SubElement(root, qn(CT_NS, 'Override'), PartName='/word/theme/theme1.xml', ContentType='application/vnd.openxmlformats-officedocument.theme+xml')
    ET.SubElement(root, qn(CT_NS, 'Override'), PartName='/docProps/core.xml', ContentType='application/vnd.openxmlformats-package.core-properties+xml')
    ET.SubElement(root, qn(CT_NS, 'Override'), PartName='/docProps/app.xml', ContentType='application/vnd.openxmlformats-officedocument.extended-properties+xml')
    ET.SubElement(root, qn(CT_NS, 'Override'), PartName='/docProps/meta.xml', ContentType='application/xml')
    return ET.tostring(root, encoding='utf-8', xml_declaration=True)


def build_docx(tables, images):
    with zipfile.ZipFile(TEMPLATE) as zin, zipfile.ZipFile(OUT_DOCX, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
        passthrough = ['_rels/.rels', 'word/theme/theme1.xml', 'docProps/core.xml', 'docProps/app.xml', 'docProps/meta.xml']
        for name in passthrough:
            zout.writestr(name, zin.read(name))
        zout.writestr('[Content_Types].xml', build_content_types_xml())
        zout.writestr('word/document.xml', build_document_xml(tables, images))
        zout.writestr('word/_rels/document.xml.rels', build_rels_xml())
        for idx, img in enumerate(images, start=1):
            zout.writestr(f'word/media/image{idx}.png', img.read_bytes())


def main():
    if not TEMPLATE.exists():
        raise SystemExit('Template docx missing: /tmp/test_kvadrato.docx')
    tables = extract_section_tables()
    images = extract_images()
    assert len(tables) == 29, len(tables)
    assert len(images) == 5, len(images)
    build_docx(tables, images)
    print(OUT_DOCX)

if __name__ == '__main__':
    main()
