import { building, dev } from '$app/env';
import { loadDims } from './image-dims.ts';
import { buildSite, type RawContent } from './site.ts';
import type { Page } from './types.ts';

/** Tutti i contenuti strutturati (src/content/**), indicizzati per percorso relativo. */
const modules = import.meta.glob(['/src/content/**/*.json', '!/src/content/layout/**'], { eager: true, import: 'default' });
const raw: RawContent = Object.fromEntries(Object.entries(modules).map(([k, v]) => [k.replace('/src/content/', ''), v]));

/**
 * Dimensioni delle immagini (file in static/ o su R2), solo in build/prerender e in sviluppo:
 * le Function /api non rendono pagine e non devono scaricare immagini all'avvio.
 */
const dims = building || dev ? await loadDims(raw) : () => undefined;

let site: ReturnType<typeof buildSite> | undefined;
const get = () => (site ??= buildSite(raw, dims));

export const getPages = (): Map<string, Page> => get().pages;
export const getPage = (path: string) => getPages().get(path === '' ? '/' : path.replace(/\/$/, '') || '/');
