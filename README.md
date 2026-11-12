# GIDA S.p.A. — sito statico (SvelteKit)

Migrazione di [www.gida-spa.it](https://www.gida-spa.it) da Drupal 9 a un sito statico generato con SvelteKit 3 + `adapter-static`.

## Analisi del sito Drupal di partenza

| Voce | Dettaglio |
|---|---|
| CMS | Drupal 9, PHP 8.0, dietro Cloudflare |
| Tema | `italiagov` (Bootstrap Italia) + CSS custom, font Poppins |
| Lingue | IT (default) ed EN (`/en/...`) |
| Pagine | 589 URL (sitemap + archivi annuali) |
| Tipi di contenuto | `societa_trasparente_documenti` (~480: un PDF ciascuno), `certificazioni` (47), `page` (32), `impianti` (6), `news` (5) |
| Archivi | `/societa-trasparente/{anno}` e `/en/trasparent-company/{anno}` (2018–2026) |
| File | ~360 file (287 PDF, immagini, 2 xlsx), circa 300 MB |
| Funzioni dinamiche | 2 form (Contatti, Visite scuole), selettore lingua, banner cookie |

Le uniche parti davvero dinamiche erano i due form, quindi il sito si presta bene a diventare statico.

## Come funziona

```
scripts/mirror-pages.py        scarica le pagine HTML (dalla sitemap)
scripts/mirror-assets.py       scarica PDF/immagini/CSS/font mantenendo gli stessi URL
scripts/import-drupal.mjs      HTML Drupal → .drupal-mirror/import/{pages/*.json,layout.json} + CSS
scripts/structure-content.mjs  pagine importate → contenuti strutturati in src/content/
scripts/check-parity.mjs       confronta le pagine rigenerate con l'HTML originale
scripts/check-links.mjs        verifica che tutti i link interni del build esistano
```

Contenuti strutturati (modificabili da Sveltia CMS), una cartella per lingua con lo **stesso nome di file**
per le traduzioni:

| Cartella | Contenuto |
|---|---|
| `src/content/pagine/{it,en}/` | pagine: immagine di testata, icona, testo, FAQ, blocchi (form, elenchi, …) |
| `src/content/news/…`, `impianti/…` | news e impianti |
| `src/content/certificazioni/…` | certificazioni e autorizzazioni (file + tipo) |
| `src/content/trasparenza/<lingua>/<anno>/…` | documenti di Società trasparente (categoria, testo, file); l'anno è la cartella |
| `src/content/home/{it,en}.json` | blocchi della home |
| `src/content/faq/<lingua>/…` | domande frequenti (domanda, risposta, ordine), elencate nelle pagine con "Mostra le FAQ" |
| `src/content/configurazioni/anni.json` | anno corrente e anni d'archivio di Società trasparente (si aggiungono anche quelli che hanno documenti) |
| `src/content/configurazioni/categorie.json` | categorie di Società trasparente e tipi di certificazione (id + nome IT/EN) |
| `src/content/forms.json` | markup dei form |
| `src/content/layout/{testata,menu-superiore,menu-principale,footer}/<lingua>.json` | logo e contatti in alto; menu; footer a blocchi (cruscotto energia, dati societari, menu, loghi e pulsanti delle certificazioni) |

- `src/lib/render.ts` rigenera da questi dati **lo stesso markup di Drupal** (il CSS originale continua a funzionare),
  compresi gli elenchi che Drupal generava: certificazioni per tipo, impianti con menu di ancore, Società trasparente
  per categoria (pagina principale = anno corrente) e archivi annuali. `npm run check-parity` verifica che 584/589
  pagine siano identiche all'originale (le 2 differenze sono un'etichetta EN incoerente già in Drupal: "AIT Resolution"
  sulla pagina del documento, "Delibera AIT" nell'elenco).
- Collegamenti tra traduzioni (`hreflang`, selettore lingua) calcolati dalla chiave condivisa.
- Una pagina senza `path` usa `/<nome-file>` (`/en/<nome-file>`): le voci nuove create dal CMS non devono indicarlo.
- `src/routes/[...path=page]` è un'unica route catch-all che prerenderizza tutte le pagine.
- Header (menu, lingua, header sticky) è un componente Svelte; footer dall'HTML originale ripulito.
- Gli URL sono **identici** a quelli di Drupal (anche `/sites/default/files/...`), così SEO e link esterni restano validi.
- Il JS di Bootstrap Italia (≈500 KB) è sostituito da poche righe Svelte (collapse, dropdown, menu mobile, header sticky, torna-su).

## Comandi

```bash
nvm use            # Node 24 (vedi .nvmrc)
npm install
npm run dev        # sviluppo
npm run build      # genera .vercel/output (pagine statiche + Function /api)
npm run check-links
npm run preview
```

Re-import da Drupal (finché il vecchio sito è online). **Sovrascrive i contenuti modificati dal CMS**:

```bash
python3 scripts/mirror-pages.py urls.txt .drupal-mirror/pages
python3 scripts/mirror-assets.py files.txt .drupal-mirror/assets
npm run import -- .drupal-mirror
npm run structure
npm run check-parity
```

## Form (procmail.sh + Cap)

I form Contatti e Visite scuole (IT/EN) inviano a `POST /api/form`, una Vercel Function:

1. **Cap** ([trycap.dev](https://trycap.dev)) — anti-spam proof-of-work, senza cookie né servizi terzi.
   Verificatore **stateless** in `src/lib/server/cap.ts`, compatibile con `@cap.js/widget`: challenge e token sono
   firmati con HMAC (`CAP_SECRET`) e contengono la scadenza (5 minuti), quindi non serve storage condiviso.
   Limite: un token valido potrebbe essere riusato fino alla scadenza su un'altra istanza della Function
   (ogni istanza ricorda comunque i token già usati). Il widget usa il WASM servito da `/cap/`.
2. Validazione dei campi (definiti dai form importati da Drupal).
3. Invio con l'API procmail `POST {PROCMAIL_API_URL}/v1/emails` (Bearer `PROCMAIL_API_KEY`), `reply_to` = email dell'utente.

Variabili (vedi `.env.example` e `src/env.ts`): `PROCMAIL_API_KEY`, `PROCMAIL_API_URL`, `FORM_FROM`, `FORM_TO`, `CAP_SECRET`.

## CMS (Sveltia CMS)

[Sveltia CMS](https://sveltiacms.app) è in `static/admin/` (pagina `/admin/index.html`, configurazione `/admin/config.yml`).

- **Traduzioni affiancate** (`i18n.structure: multiple_folders`): ogni voce ha le versioni IT ed EN nello stesso
  editor; le voci nuove partono in italiano e la traduzione si attiva quando serve.
- **Campi strutturati** per tipo: titolo, descrizione, URL, immagini (con testo alternativo), testo, "Mostra le FAQ", blocchi
  sotto la pagina; categorie e tipi scelti da elenco (collezione "Configurazioni" → "Categorie"; l'anno corrente in "Configurazioni" → "Anni"). Nella barra laterale, dopo i contenuti: "Home page";
  "Menu" (Menu superiore, Menu principale); "Configurazioni" (Testata, Footer, Anni, Categorie).
- **Testo** usa l'editor visuale (HTML). Le pagine con impaginazione particolare usano **Contenuto a sezioni**,
  mostrate in ordine dopo il Testo: Testo (anche centrato), Allegati (file, anche come elenco puntato), Galleria di
  immagini, Immagine con link, Riquadro evidenziato (es. orari), Organi societari (gruppi di persone con ruolo,
  email, nomina e compenso; ancora `#cda`), Avviso "in aggiornamento" e HTML libero. Usate in Chi siamo, Contatti,
  Recupero, Trattamento rifiuti, MOG 231, Info GDPR, Lavora con noi, Società trasparente, Gida per le scuole.
- Società trasparente: i documenti sono divisi in cartelle per anno, che compaiono come sottocartelle nella barra
  laterale; l'anno si cambia con "Cartella superiore" (sposta il file in tutte le lingue). Per un anno nuovo:
  "Nuova cartella" nel selettore mentre si crea il documento.
- Elenchi generati: un nuovo documento di Società trasparente compare nella pagina principale se il suo anno è
  l'anno corrente, altrimenti nell'archivio del suo anno; una certificazione compare negli elenchi del suo tipo.
  "Ordine negli elenchi" e "Nascondi negli elenchi" controllano posizione e visibilità.
- **Online**: `/admin/index.html` → "Accedi con GitHub" (serve un account GitHub con accesso in scrittura a
  `monemasrl/gida-spa`; vedi *Accesso con GitHub (OAuth)* sotto).
  Con `publish_mode: editorial_workflow` ogni modifica apre una pull request (con anteprima Vercel);
  va in produzione solo quando la si pubblica dal CMS (merge su `main`).
- **In locale**: `npm run dev`, apri `http://localhost:5173/admin/index.html` in Chrome/Edge →
  "Lavora con Repository Locale" e scegli la cartella del progetto. Le modifiche vengono scritte sui file.

### Accesso con GitHub (OAuth)

Il client OAuth è nel sito stesso (al posto di sveltia-cms-auth su Cloudflare): `src/routes/api/cms-auth/`
(`auth` → GitHub → `callback`) e `src/lib/server/cms-auth.ts`. Il CMS lo raggiunge da `backend.base_url` +
`auth_endpoint` in `static/admin/config.yml`, sempre sull'host di produzione perché la OAuth App ammette un solo
callback URL. Anche il CMS delle anteprime Vercel (`gida-sito-*-monema-5f86ca5f.vercel.app`) accede da lì: il
token viene consegnato solo alle origin ammesse (`CMS_ALLOWED_ORIGINS`, default in `cms-auth.ts`).

Configurazione (una volta):

1. GitHub → organizzazione `monemasrl` → Settings → Developer settings → **OAuth Apps** → New OAuth App:
   *Homepage URL* `https://gida-sito.vercel.app`, *Authorization callback URL*
   `https://gida-sito.vercel.app/api/cms-auth/callback`. Poi "Generate a new client secret".
2. Vercel → progetto `gida-sito` → Settings → Environment Variables (Production e Preview):
   `GITHUB_OAUTH_CLIENT_ID` e `GITHUB_OAUTH_CLIENT_SECRET` (*Sensitive*), quindi un nuovo deploy.
3. Col dominio definitivo: cambiare `base_url` in `config.yml` e il callback URL nella OAuth App.

Gli editor accedono con il proprio account GitHub, che deve avere accesso in scrittura al repository.

### File e immagini (Cloudflare R2)

I file caricati dal CMS vanno sul bucket R2 `gida-media` (account Cloudflare di GIDA, giurisdizione EU) e sono
pubblici su `https://media.gida-spa.it/sites/default/files/...`; nei contenuti viene salvato l'URL completo.
Configurazione in `static/admin/config.yml` → `media_libraries.cloudflare_r2` (lo storage nel repository è
disattivato, `default: false`).

- **Editor, primo accesso alla libreria file**: il CMS chiede la *Secret Access Key* del token R2
  `gida-cms-editor` (Object Read & Write solo sul bucket `gida-media`), da prendere in 1Password. Resta salvata nel
  browser. Se il token viene rigenerato, ognuno reinserisce la nuova chiave.
- **CORS del bucket**: deve ammettere l'origin del CMS (`https://gida-sito.vercel.app`, poi `https://www.gida-spa.it`;
  `http://localhost:5173` in sviluppo). Il CMS delle anteprime Vercel non può caricare file finché la sua origin non
  è aggiunta.
- **File esistenti**: `static/sites/default/files/**` è copiato su R2 con le stesse chiavi da
  `node scripts/upload-r2.mjs` (dopo `npx wrangler login`; salta i file già presenti). Se un file non è più in
  `static/`, `src/routes/sites/default/files/[...path]` reindirizza allo stesso percorso su `media.gida-spa.it`,
  quindi i vecchi link funzionano anche dopo aver tolto i documenti dal repository.
- Le immagini su R2 non hanno `width`/`height` calcolati in build (si leggono solo dai file in `static/`).

## Deploy (Vercel)

`@sveltejs/adapter-vercel` (Node 24): le 589 pagine sono prerenderizzate come statiche, solo `/api/*` è una Function.

```bash
vercel link
openssl rand -hex 32 | vercel env add CAP_SECRET production
vercel env add PROCMAIL_API_KEY
vercel env add FORM_FROM
vercel deploy
```
