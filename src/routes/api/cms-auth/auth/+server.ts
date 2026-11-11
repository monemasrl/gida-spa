import { randomBytes } from 'node:crypto';
import { GITHUB_OAUTH_CLIENT_ID, GITHUB_OAUTH_CLIENT_SECRET } from '$app/env/private';
import { COOKIE_PATH, PROVIDER, STATE_COOKIE, popupResponse } from '#lib/server/cms-auth.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

const SCOPES = new Set(['repo', 'public_repo']);

/** GET /api/cms-auth/auth?provider=github&site_id=…&scope=repo — aperta dal CMS nel popup. */
export const GET: RequestHandler = ({ url, cookies }) => {
	if (url.searchParams.get('provider') !== PROVIDER) {
		return popupResponse(url.origin, { error: 'Provider non supportato' }, 400);
	}
	if (!GITHUB_OAUTH_CLIENT_ID || !GITHUB_OAUTH_CLIENT_SECRET) {
		return popupResponse(url.origin, { error: 'OAuth GitHub non configurato sul server', errorCode: 'MISCONFIGURED_CLIENT' }, 503);
	}
	const scope = url.searchParams.get('scope') ?? 'repo';
	const state = randomBytes(24).toString('base64url');
	cookies.set(STATE_COOKIE, state, { path: COOKIE_PATH, httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600 });

	const authorize = new URL('https://github.com/login/oauth/authorize');
	authorize.search = new URLSearchParams({
		client_id: GITHUB_OAUTH_CLIENT_ID,
		redirect_uri: `${url.origin}${COOKIE_PATH}/callback`,
		scope: SCOPES.has(scope) ? scope : 'repo',
		state
	}).toString();
	return new Response(null, { status: 302, headers: { location: authorize.href, 'cache-control': 'no-store' } });
};
