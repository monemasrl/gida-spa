import fs from 'node:fs';
import { imageSize } from 'image-size';
import { buildSite, type RawContent } from './site.ts';
import type { Page } from './types.ts';

/** Tutti i contenuti strutturati (src/content/**), indicizzati per percorso relativo. */
const modules = import.meta.glob(['/src/content/**/*.json', '!/src/content/layout.json'], { eager: true, import: 'default' });
const raw: RawContent = Object.fromEntries(Object.entries(modules).map(([k, v]) => [k.replace('/src/content/', ''), v]));

/** Dimensioni delle immagini lette dai file in static/ (solo in build/prerender). */
const sizes = new Map<string, { width: number; height: number } | undefined>();
function dims(src: string) {
	if (!sizes.has(src)) {
		try {
			const { width, height } = imageSize(fs.readFileSync(`static${src}`));
			sizes.set(src, { width, height });
		} catch {
			sizes.set(src, undefined);
		}
	}
	return sizes.get(src);
}

let site: ReturnType<typeof buildSite> | undefined;
const get = () => (site ??= buildSite(raw, dims));

export const getPages = (): Map<string, Page> => get().pages;
export const getPage = (path: string) => getPages().get(path === '' ? '/' : path.replace(/\/$/, '') || '/');
