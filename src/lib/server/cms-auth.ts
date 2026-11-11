import { CMS_ALLOWED_ORIGINS } from '$app/env/private';

/**
 * Client OAuth per "Accedi con GitHub" di Sveltia CMS (authorization code flow), al posto di
 * sveltia-cms-auth su Cloudflare: gira come Function Vercel nello stesso progetto del sito.
 *
 *   /api/cms-auth/auth      il CMS apre qui il popup → redirect a GitHub con `state` (cookie)
 *   /api/cms-auth/callback  GitHub torna qui con `code` → scambio con il token (client secret)
 *                           → pagina che consegna il token alla finestra del CMS (postMessage)
 *
 * Protocollo del popup (lo stesso di Netlify/Decap CMS e sveltia-cms-auth):
 *   popup → opener  "authorizing:github"
 *   opener → popup  "authorizing:github"  (l'origin di questo messaggio è quella del CMS)
 *   popup → opener  "authorization:github:success:{token}" solo verso quell'origin, se ammessa.
 */

export const PROVIDER = 'github';
export const STATE_COOKIE = 'cms_oauth_state';
export const COOKIE_PATH = '/api/cms-auth';

/** Origin ammesse di default: produzione, anteprime Vercel del progetto, dominio definitivo. */
const DEFAULT_ORIGINS = [
	'https://gida-sito.vercel.app',
	'https://gida-sito-*-monema-5f86ca5f.vercel.app',
	'https://gida-spa.it',
	'https://www.gida-spa.it'
];

/** Pattern di origin → RegExp; `*` vale un'etichetta DNS (lettere, cifre, trattini) o una porta. */
function originPatterns(self: string): string[] {
	const list = CMS_ALLOWED_ORIGINS ?? DEFAULT_ORIGINS;
	const escape = (s: string) => s.replace(/[.+?^${}()|[\]\\/]/g, '\\$&');
	return [self, ...list].map((p) => `^${escape(p).replaceAll('*', '[a-z0-9-]+')}$`);
}

const escapeHtml = (s: string) =>
	s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** JSON sicuro dentro <script>. */
const scriptJson = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');

type Result = { token: string } | { error: string; errorCode?: string };

/**
 * Pagina del popup che consegna il risultato al CMS. Il token viaggia solo verso una finestra
 * opener la cui origin è tra quelle ammesse.
 */
export function popupResponse(self: string, result: Result, status = 200): Response {
	const ok = 'token' in result;
	const message = `authorization:${PROVIDER}:${ok ? 'success' : 'error'}:${JSON.stringify({ provider: PROVIDER, ...result })}`;
	const note = ok ? 'Accesso riuscito, puoi chiudere questa finestra.' : `Accesso non riuscito: ${result.error}`;
	const html = `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>GIDA CMS</title></head>
<body><p>${escapeHtml(note)}</p>
<script>
(() => {
  const message = ${scriptJson(message)};
  const allowed = ${scriptJson(originPatterns(self))}.map((p) => new RegExp(p));
  const handshake = ${scriptJson(`authorizing:${PROVIDER}`)};
  if (!window.opener) return;
  window.addEventListener('message', (e) => {
    if (e.source !== window.opener || e.data !== handshake) return;
    if (!allowed.some((re) => re.test(e.origin))) {
      document.body.textContent = 'Origine del CMS non ammessa: ' + e.origin;
      return;
    }
    window.opener.postMessage(message, e.origin);
  });
  window.opener.postMessage(handshake, '*');
})();
</script></body></html>`;
	return new Response(html, {
		status,
		headers: {
			'content-type': 'text/html; charset=utf-8',
			'cache-control': 'no-store',
			'referrer-policy': 'no-referrer',
			'x-robots-tag': 'noindex'
		}
	});
}
