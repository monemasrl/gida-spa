import fs from 'node:fs';
import { imageSize } from 'image-size';
import { MEDIA_URL, encodeMediaUrl, mediaPath } from './media.ts';
import type { Dims } from './render.ts';

type Size = { width: number; height: number };

// nomi di file anche con spazi: il percorso finisce alla prima estensione d'immagine, mai oltre le virgolette
const IMAGE_RE = new RegExp(
	`(?:${MEDIA_URL.replace(/[.]/g, '\\.')})?/sites/default/files/[^"'\\\\<>\\n]+?\\.(?:jpe?g|png|gif|webp|svg)`,
	'gi'
);

const safeDecode = (s: string) => {
	try {
		return decodeURI(s);
	} catch {
		return s;
	}
};

/** Chiave comune per lo stesso file, relativo o su R2, con o senza %20. */
const keyOf = (src: string) => safeDecode(mediaPath(src) ?? src);

function local(key: string): Size | undefined {
	try {
		const { width, height } = imageSize(fs.readFileSync(`static${key}`));
		return { width, height };
	} catch {
		return undefined;
	}
}

async function remote(key: string, attempts = 3): Promise<Size | undefined> {
	for (let i = 0; i < attempts; i++) {
		try {
			const res = await fetch(encodeMediaUrl(MEDIA_URL + key), { signal: AbortSignal.timeout(15_000) });
			if (res.status === 404) return undefined;
			if (res.ok) {
				const { width, height } = imageSize(new Uint8Array(await res.arrayBuffer()));
				return { width, height };
			}
		} catch {
			// rete o immagine non leggibile: riprova
		}
	}
	console.warn('Dimensioni non disponibili:', key);
	return undefined;
}

/**
 * Dimensioni delle immagini citate nei contenuti, per `width`/`height` nel markup.
 * Legge il file in static/ se c'è (immagini del tema), altrimenti lo scarica da R2 (media.gida-spa.it).
 * Da usare solo in build/sviluppo: scarica le immagini.
 */
export async function loadDims(raw: unknown): Promise<Dims> {
	const keys = new Set([...JSON.stringify(raw).matchAll(IMAGE_RE)].map((m) => keyOf(m[0])));
	const sizes = new Map<string, Size | undefined>();
	const queue = [...keys];
	await Promise.all(
		Array.from({ length: 8 }, async () => {
			for (let key; (key = queue.shift()); ) sizes.set(key, local(key) ?? (await remote(key)));
		})
	);
	return (src) => {
		const key = keyOf(src);
		if (!sizes.has(key)) sizes.set(key, local(key));
		return sizes.get(key);
	};
}
