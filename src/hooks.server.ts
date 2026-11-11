import type { Handle } from '@sveltejs/kit/hooks';
import { getPage } from '#lib/content.server.ts';
import { langOf } from '#lib/layout.ts';

/** Imposta lang e classi del <body> come faceva il tema Drupal (il CSS ne dipende). */
export const handle: Handle = async ({ event, resolve }) => {
	const page = getPage(event.url.pathname);
	const lang = page?.lang ?? langOf(event.url.pathname);
	const bodyClass = page?.bodyClass ?? 'path-node';
	return resolve(event, {
		transformPageChunk: ({ html }) =>
			html.replace('%gida.lang%', lang).replace('%gida.bodyclass%', bodyClass)
	});
};
