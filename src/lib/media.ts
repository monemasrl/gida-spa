/** Dominio pubblico del bucket Cloudflare R2 `gida-media` (stesso valore di `public_url` in static/admin/config.yml). */
export const MEDIA_URL = 'https://media.gida-spa.it';

/** Percorso dei file sul bucket (e un tempo in static/): /sites/default/files/... */
export const MEDIA_PATH = '/sites/default/files/';

/** URL di un file su R2 → percorso relativo (/sites/default/files/...), altrimenti undefined. */
export const mediaPath = (src: string) => (src.startsWith(MEDIA_URL + '/') ? src.slice(MEDIA_URL.length) : undefined);

const safeDecode = (s: string) => {
	try {
		return decodeURI(s);
	} catch {
		return s;
	}
};

/** URL di R2 con il percorso codificato una sola volta (i valori salvati possono avere spazi o %20). */
export const encodeMediaUrl = (src: string) => {
	const p = mediaPath(src);
	return p === undefined ? src : MEDIA_URL + encodeURI(safeDecode(p));
};

/** href/src per il markup: R2 codificato una volta, percorsi locali con encodeURI, URL e #ancore invariati. */
export const url = (p: string) =>
	p.startsWith(MEDIA_URL + '/') ? encodeMediaUrl(p) : /^[a-z]+:/i.test(p) || p.startsWith('#') ? p : encodeURI(p);
