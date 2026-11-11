import { timingSafeEqual } from 'node:crypto';
import { GITHUB_OAUTH_CLIENT_ID, GITHUB_OAUTH_CLIENT_SECRET } from '$app/env/private';
import { COOKIE_PATH, STATE_COOKIE, popupResponse } from '#lib/server/cms-auth.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

const sameState = (a: string, b: string) =>
	a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** GET /api/cms-auth/callback?code=…&state=… — GitHub torna qui dopo l'autorizzazione. */
export const GET: RequestHandler = async ({ url, cookies, fetch }) => {
	const self = url.origin;
	const expected = cookies.get(STATE_COOKIE);
	cookies.delete(STATE_COOKIE, { path: COOKIE_PATH });

	const ghError = url.searchParams.get('error');
	if (ghError) return popupResponse(self, { error: url.searchParams.get('error_description') ?? ghError }, 400);

	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state') ?? '';
	if (!code || !expected || !sameState(state, expected)) {
		return popupResponse(self, { error: 'Richiesta non valida o scaduta, riprova', errorCode: 'CSRF_DETECTED' }, 400);
	}
	if (!GITHUB_OAUTH_CLIENT_ID || !GITHUB_OAUTH_CLIENT_SECRET) {
		return popupResponse(self, { error: 'OAuth GitHub non configurato sul server', errorCode: 'MISCONFIGURED_CLIENT' }, 503);
	}

	let token: string | undefined;
	let error = 'Scambio del codice non riuscito';
	try {
		const res = await fetch('https://github.com/login/oauth/access_token', {
			method: 'POST',
			headers: { accept: 'application/json', 'content-type': 'application/json' },
			body: JSON.stringify({
				client_id: GITHUB_OAUTH_CLIENT_ID,
				client_secret: GITHUB_OAUTH_CLIENT_SECRET,
				code,
				redirect_uri: `${self}${COOKIE_PATH}/callback`
			})
		});
		const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
		token = data.access_token;
		if (data.error) error = data.error_description ?? data.error;
	} catch {
		// rete o JSON non valido: messaggio generico
	}
	if (!token) return popupResponse(self, { error, errorCode: 'TOKEN_REQUEST_FAILED' }, 502);
	return popupResponse(self, { token });
};
