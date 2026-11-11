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
scripts/mirror-pages.py      scarica le pagine HTML (dalla sitemap)
scripts/mirror-assets.py     scarica PDF/immagini/CSS/font mantenendo gli stessi URL
scripts/import-drupal.mjs    HTML Drupal → src/content/pages/*.json + layout.json + static/css/drupal.css
scripts/check-links.mjs      verifica che tutti i link interni del build esistano
```

- `src/routes/[...path=page]` è un'unica route catch-all che prerenderizza ogni pagina presente in `src/content/pages/`.
- Header (menu, lingua, header sticky) è un componente Svelte; footer e contenuti sono l'HTML originale ripulito.
- Gli URL sono **identici** a quelli di Drupal (anche `/sites/default/files/...`), così SEO e link esterni restano validi.
- Pulizia in import: email Cloudflare decodificate, link `/node/N` risolti, link alla tassonomia trasformati in testo, link rotti dell'originale corretti.
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

Re-import da Drupal (finché il vecchio sito è online):

```bash
python3 scripts/mirror-pages.py urls.txt .drupal-mirror/pages
python3 scripts/mirror-assets.py files.txt .drupal-mirror/assets
npm run import -- .drupal-mirror
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

## Deploy (Vercel)

`@sveltejs/adapter-vercel` (Node 24): le 589 pagine sono prerenderizzate come statiche, solo `/api/*` è una Function.

```bash
vercel link
openssl rand -hex 32 | vercel env add CAP_SECRET production
vercel env add PROCMAIL_API_KEY
vercel env add FORM_FROM
vercel deploy
```
