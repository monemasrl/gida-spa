import { error } from '@sveltejs/kit';
import { getPage, pages } from '#lib/content.server.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () =>
	[...pages.keys()].map((p) => ({ path: p === '/' ? '' : p.slice(1) }));

export const load: PageServerLoad = ({ params }) => {
	const page = getPage('/' + params.path);
	if (!page) error(404, 'Pagina non trovata');
	return { page };
};
