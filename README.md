# Kadeřnictví NICCOL

Statický prezentační web kadeřnictví. Aplikace nepoužívá framework ani backend:
Vite a TypeScript připravují optimalizované statické soubory, zatímco galerie,
rozvrh a rezervační UI se načítají až při potřebě.

## Vývoj a kontroly

Požadavky: Node.js 22.12+ a npm.

Pokud síť vyžaduje odchozí proxy, nastavte ji ve svém prostředí nebo npm
konfiguraci před instalací závislostí (`HTTP_PROXY`/`HTTPS_PROXY`). Web při
běhu žádnou aplikační proxy nepotřebuje. Pokud proxy provádí TLS inspekci,
použijte její důvěryhodný certifikát z úložiště Windows; Node.js podporující
`--use-system-ca` jej načte po nastavení `$env:NODE_OPTIONS = '--use-system-ca'`.
Nevypínejte ověřování TLS. Proxy přihlašovací údaje neukládejte do repozitáře
ani do `.env.example`.

```powershell
npm ci
npm run dev
```

Příkazy projektu:

```powershell
npm run build       # TypeScript kontrola a optimalizovaný dist/
npm run preview     # lokální náhled produkčního buildu
npm test            # Vitest + Playwright (Chromium)
npm run test:unit   # pouze jednotkové testy
npm run test:e2e    # pouze browser scénáře
npm run lint        # ESLint
npm run typecheck   # TypeScript
npm run format      # Prettier
```

Při prvním spuštění Playwright testů nainstalujte prohlížeč:

```powershell
npx playwright install chromium
```

`.env.example` je pouze informativní: web momentálně nepotřebuje žádné
proměnné prostředí ani tajné klíče.

## Rezervace a kontakt

Stránka nemá rezervační API. Záznamy z kalendáře se ukládají jen do
`localStorage` právě používaného prohlížeče; salon je neobdrží, nepotvrdí
a neuvidí je z jiného zařízení. Přehled v rezervační sekci není chráněná
administrace. Zákazníkům proto stránka výslovně doporučuje telefonické
objednání a neoznačuje lokální uložení za potvrzenou rezervaci.

Kontaktní formulář otevře předvyplněnou zprávu v e-mailové aplikaci. Návštěvník
musí zprávu v této aplikaci sám odeslat. Provozovna je na webu nadále označena
jako dočasně uzavřená; před zveřejněním je potřeba ověřit aktuální stav
a otevírací dobu.

## Galerie a Windows nástroje

Fotografie zůstávají ve složce `gallery/`, jejich pořadí v `data/gallery.json`.
Web preferuje WebP variantu se stejným názvem bez přípony. Otevírací doba
je v `data/hours.json`; rezervační sloty se odvozují z ověřeného rozvrhu po
30 minutách.

Po změně fotografií lze seznam znovu sestavit:

```powershell
.\tools\update-gallery.ps1
```

Stávající Windows editor, převod obrázků a GitHub uploader zůstávají dostupné.
Editor lze otevřít přes `WebNiccolApp.lnk`; regresní test editoru a lokálního
publikačního workflow:

```powershell
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File .\tests\gallery.Tests.ps1
```

Uploader publikuje změny Git repozitáře. Zkontrolujte proto obsah repozitáře
před publikací; nepatří do něj přihlašovací údaje ani neveřejné soubory.
GitHub token se čte z Windows Credential Manageru (`github_token_hair`) nebo
z proměnné `GITHUB_TOKEN_HAIR`. Token nikdy nevkládejte do zdrojového kódu ani
`.env.example`.

## Publikace

Workflow `.github/workflows/pages.yml` spustí typecheck, lint, Vitest,
Playwright a produkční build při změně větve `main`, následně nasadí `dist/`
na GitHub Pages. V nastavení repozitáře vyberte **Settings → Pages → Build
and deployment → Source: GitHub Actions**. Ruční Windows uploader nadále
odesílá změny do GitHubu; po přijetí změn do `main` proběhne publikace
automaticky. Build používá relativní cesty, takže funguje i na projektové
adrese GitHub Pages.

Další podrobnosti o současném stavu, cílovém návrhu a známých omezeních jsou
v [ARCHITECTURE.md](./ARCHITECTURE.md).
