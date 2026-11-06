# Architektura Kadeřnictví NICCOL

## Současný stav

- Jedna dlouhá stránka `index.html` obsahuje prezentaci, galerii, otevírací dobu,
  tříkrokový rezervační formulář, lokální „správu“ a kontaktní formulář.
- UI a logika jsou rozdělené do šesti nativních JavaScriptových modulů v `js/`.
  CSS je v jednom souboru a kombinuje vlastní styly s utilitními třídami
  načítanými z externího Tailwind CDN.
- `data/gallery.json` a `data/hours.json` se načítají za běhu. Fotografie jsou
  v `gallery/`; PowerShell nástroje udržují pořadí, převádějí obrázky a poskytují
  Windows editor a GitHub uploader.
- Neexistuje backend, autentizace, veřejné API ani skutečné ukládání rezervací
  na straně salonu. „Potvrzené“ rezervace jsou jen v `localStorage` daného
  prohlížeče; veřejně dostupný administrační panel vidí pouze tato lokální data.
- Kontaktní formulář neodesílá zprávu a pouze zobrazuje falešné potvrzení.
  Galerie a otevírací doba při chybě načtení neposkytují uživateli spolehlivý
  stav. Data otevírací doby navíc uvádějí v pondělí 23:00, zatímco zbytek webu
  a rezervační kalendář končí v 18:00.
- Stránka používá externí Google Fonts, Tailwind CDN, obrázky Unsplash a mapu
  Google. Vstupy rezervace a načtená data jsou v několika místech vkládána
  přes `innerHTML`; chybí důsledná validace dat, viditelné popisky polí,
  klávesnicové ovládání kalendáře, řízení fokusu a podpora omezení pohybu.

## Cílová architektura

### Zvolený stack

- **Sémantické HTML a vlastní CSS** zůstávají prezentačním základem. Pro jednu
  statickou stránku není frameworková komponentová vrstva přínosem.
- **TypeScript + Vite** zajišťují kontrolu typů, lokální vývojový server,
  minifikaci, otiskované assety, produkční build a náhled buildu.
- **Nativní DOM API**, bez runtime knihoven. Funkce galerie, otevírací doby
  a rezervací se načítají až při přiblížení k dané části stránky.
- **Vitest** pokrývá pravidla rozvrhu, validaci dat a úložiště. **Playwright**
  ověřuje hlavní uživatelský scénář v reálném prohlížeči.
- ESLint a Prettier hlídají TypeScript/JavaScript a formátování. Externí
  framework, CSS utility framework, databáze ani API klient se nepřidávají.

### Hranice odpovědnosti

- `src/main.ts`: start stránky, globální stavy sítě a lazy loading funkcí.
- `src/domain/`: typy, rozvrh a čistá pravidla dostupnosti/validace.
- `src/services/`: načítání a validace statických dat a přístup k lokálnímu
  úložišti; chyby se vracejí UI, nikoli tiše převádějí na prázdná data.
- `src/features/`: UI galerie, lightboxu, otevírací doby a rezervačního toku.
- `styles/`: vlastní design tokens, responzivní layouty, stavové styly
  a přístupné ovládací prvky; žádné CSS načítané z CDN.
- `data/`, `gallery/`, `images/`: zůstávají na místech očekávaných Windows
  nástroji. Vite je zabalí jako statické assety bez změny workflow editoru.

## Uživatelské scénáře a datové toky

1. Návštěvník prochází služby, galerii, kontaktní údaje a otevírací dobu.
   Galerie používá validovaný manifest a pouze soubory z lokální složky
   `gallery/`; lightbox podporuje tlačítka, klávesnici i dotyk.
2. Návštěvník vybírá datum a půlhodinový slot, vyplní údaje a uloží záznam
   lokálně. Kolize, neplatná nebo poškozená data a nedostupné úložiště se
   oznámí bez falešného potvrzení od salonu. Lokální přehled zůstává pouze
   pomůckou v daném prohlížeči, nikoli administrací salonu.
3. Kontaktní formulář připraví zprávu v e-mailové aplikaci návštěvníka.
   Stránka netvrdí, že zpráva byla odeslána; alternativou zůstává telefon.
4. Prohlížení dostupných informací nevyžaduje API. Obsah a aplikace se
   zkompilují do statických souborů; odpojení sítě se oznámí a při chybě
   načtení galerie/obrázku se nabídne srozumitelný stav a opakování.

## Migrační postup

1. Zaznamenat současné stránky, moduly, data, externí integrace, pravidla
   rozvrhu, Windows galerijní workflow a limity lokální rezervace.
2. Zavést Vite/TypeScript a oddělit doménová pravidla a úložiště od UI.
   Zachovat cestu a formát dat galerie pro stávající PowerShell nástroje.
3. Přepsat bezpečnostně citlivé vykreslování na DOM API, validovat data,
   zpřístupnit formuláře/kalendář/lightbox a doplnit stavy chyb/offline.
4. Nahradit externí CSS CDN vlastními styly, přidat automatické kontroly,
   aktualizovat dokumentaci a nakonfigurovat sestavení statického webu pro
   GitHub Pages.
5. Ověřit TypeScript, lint, testy, produkční build, Playwright scénář i stávající
   Windows testy galerie; teprve poté odstranit staré JS moduly.

## Rizika a vědomá omezení

- **Rezervace nejsou skutečně online.** Bez backendu nebo poskytovatele nelze
  synchronizovat kalendář mezi návštěvníky, doručit rezervaci salonu ani
  zabezpečit administraci. Lokální úložiště může sdílet zařízení a může být
  vymazáno. Skutečné potvrzování vyžaduje samostatné rozhodnutí o API,
  autentizaci, ochraně osobních údajů a provozu.
- Provozovna je podle stránky dočasně uzavřená od 18. 9. 2023. Dokud majitel
  nepotvrdí nové datum otevření a rozvrh, publikovaný rozvrh je pouze převzatá
  informace, nikoli příslib dostupného termínu.
- Google Maps zůstává externím embedem a při blokaci třetích stran nebo offline
  režimu nemusí být dostupná; textová adresa a odkaz na mapu zůstávají náhradou.
- GitHub Pages musí být nastaven na **GitHub Actions**. Stávající Windows
  uploader nadále publikuje změny do větve; nové workflow z nich vytvoří web.
- Pro lokální vývoj a kontroly je potřeba podporovaná verze Node.js a npm.
