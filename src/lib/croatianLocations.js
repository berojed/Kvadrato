// Croatian counties -> major cities/towns. Static reference data used by
// PropertyFilters and anywhere else the county/city relationship is needed.
export const CROATIAN_LOCATIONS = {
  'Grad Zagreb': ['Zagreb'],
  'Zagrebačka': ['Samobor', 'Zaprešić', 'Velika Gorica', 'Dugo Selo', 'Sveta Nedelja', 'Jastrebarsko', 'Vrbovec', 'Sv. Ivan Zelina'],
  'Splitsko-dalmatinska': ['Split', 'Kaštela', 'Solin', 'Sinj', 'Trogir', 'Makarska', 'Omiš', 'Imotski', 'Hvar', 'Supetar', 'Vis'],
  'Primorsko-goranska': ['Rijeka', 'Opatija', 'Crikvenica', 'Krk', 'Mali Lošinj', 'Novi Vinodolski', 'Čabar'],
  'Istarska': ['Pula', 'Rovinj', 'Poreč', 'Umag', 'Pazin', 'Labin', 'Novigrad', 'Buje'],
  'Osječko-baranjska': ['Osijek', 'Đakovo', 'Beli Manastir', 'Belišće', 'Donji Miholjac', 'Valpovo', 'Našice'],
  'Varaždinska': ['Varaždin', 'Ludbreg', 'Ivanec', 'Lepoglava', 'Novi Marof', 'Varaždinske Toplice'],
  'Karlovačka': ['Karlovac', 'Ogulin', 'Duga Resa', 'Slunj', 'Ozalj', 'Vojnić'],
  'Sisačko-moslavačka': ['Sisak', 'Petrinja', 'Kutina', 'Novska', 'Glina', 'Hrvatska Kostajnica'],
  'Zadarska': ['Zadar', 'Biograd na Moru', 'Benkovac', 'Obrovac', 'Nin', 'Pag'],
  'Šibensko-kninska': ['Šibenik', 'Knin', 'Drniš', 'Vodice', 'Skradin'],
  'Dubrovačko-neretvanska': ['Dubrovnik', 'Metković', 'Korčula', 'Ploče', 'Opuzen', 'Cavtat'],
  'Vukovarsko-srijemska': ['Vinkovci', 'Vukovar', 'Županja', 'Ilok', 'Otok'],
  'Brodsko-posavska': ['Slavonski Brod', 'Nova Gradiška', 'Okučani', 'Pleternica'],
  'Požeško-slavonska': ['Požega', 'Pakrac', 'Pleternica', 'Kutjevo'],
  'Virovitičko-podravska': ['Virovitica', 'Slatina', 'Orahovica', 'Pitomača'],
  'Koprivničko-križevačka': ['Koprivnica', 'Križevci', 'Đurđevac'],
  'Bjelovarsko-bilogorska': ['Bjelovar', 'Čazma', 'Daruvar', 'Garešnica', 'Grubišno Polje'],
  'Krapinsko-zagorska': ['Krapina', 'Zabok', 'Zlatar', 'Pregrada', 'Donja Stubica', 'Oroslavje'],
  'Međimurska': ['Čakovec', 'Prelog', 'Mursko Središće'],
  'Ličko-senjska': ['Gospić', 'Otočac', 'Senj', 'Novalja', 'Gračac'],
}

// County dropdown options with Grad Zagreb pinned to the top.
export const STATE_OPTIONS = ['', ...Object.keys(CROATIAN_LOCATIONS).sort((a, b) => {
  if (a === 'Grad Zagreb') return -1
  if (b === 'Grad Zagreb') return 1
  return a.localeCompare(b, 'hr')
})]
