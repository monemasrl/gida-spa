import type { Handle } from '@sveltejs/kit/hooks';
import { getPage } from '#lib/content.server.ts';
import { langOf } from '#lib/layout.ts';

/** Imposta lang e classi del <body> come faceva il tema Drupal (il CSS ne dipende). */
export const handle: Handle = async ({ event, resolve }) => {
	// le Function /api e il redirect dei file verso R2 non rendono pagine: niente contenuti da caricare
	const { pathname } = event.url;
	const page = pathname.startsWith('/api/') || pathname.startsWith('/sites/') ? undefined : getPage(pathname);
	const lang = page?.lang ?? langOf(pathname);
	const bodyClass = page?.bodyClass ?? 'path-node';
	return resolve(event, {
		transformPageChunk: ({ html }) =>
			html.replace('%gida.lang%', lang).replace('%gida.bodyclass%', bodyClass)
	});
};
