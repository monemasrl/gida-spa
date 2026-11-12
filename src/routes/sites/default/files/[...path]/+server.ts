import { MEDIA_URL } from '#lib/media.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

/**
 * /sites/default/files/* che non è (più) in static/ → stesso file sul bucket R2 (media.gida-spa.it).
 * Vercel serve prima i file statici, quindi questa Function scatta solo per i file mancanti:
 * i link esistenti continuano a funzionare anche dopo aver tolto i documenti dal repository.
 */
// url.pathname è già codificato (spazi, accenti) come lo vuole l'header Location
export const GET: RequestHandler = ({ url }) =>
	new Response(null, {
		status: 302,
		headers: {
			location: `${MEDIA_URL}${url.pathname}${url.search}`,
			'cache-control': 'public, max-age=3600'
		}
	});
