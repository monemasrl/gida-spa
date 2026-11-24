/**
 * Costruisce le pagine del sito (percorso → HTML, metadati, traduzioni) dai contenuti strutturati.
 * Funzione pura: la usano sia SvelteKit (content.server.ts) sia scripts/check-parity.mjs.
 */
import type { Certificazione, CollectionName, Documento, FormEntry, Home, Impianto, Lang, News, Pagina, Tassonomie, Termine, Faq } from './model.ts';
import type { Page } from './types.ts';
import { anniArchivio, archivePath, renderArchivio, renderCertificazione, renderDocumento, renderHome, renderImpianto, renderNews, renderPagina, type Dims, type SiteData } from './render.ts';

/** File di contenuto: percorso relativo a src/content (es. `pagine/it/chi-siamo.json`) → dati. */
export type RawContent = Record<string, unknown>;

const BODY_CLASS: Record<CollectionName, string> = {
	pagine: 'page-node-typepage',
	news: 'page-node-typenews',
	impianti: 'page-node-typeimpianti',
	certificazioni: 'page-node-typecertificazioni',
	trasparenza: 'page-node-typesocieta-trasparente-documenti'
};

type Item = { collection: CollectionName; lang: Lang; key: string; data: { path: string; title: string; description?: string } };

/** Percorso della pagina: quello indicato o, per le voci nuove, `/<chiave>` (`/en/<chiave>`). */
const defaultPath = (lang: Lang, key: string) => (lang === 'en' ? `/en/${key}` : `/${key}`);

export function buildSite(raw: RawContent, dims: Dims) {
	// Configurazioni del CMS: anni di Società trasparente e categorie/tipi (id + nome IT/EN)
	const anni = raw['configurazioni/anni.json'] as Pick<Tassonomie['trasparenza'], 'annoCorrente' | 'anni'>;
	const categorie = raw['configurazioni/categorie.json'] as { trasparenza: Termine[]; certificazioni: Termine[] };
	const tassonomie: Tassonomie = { trasparenza: { ...anni, categorie: categorie.trasparenza }, certificazioni: { tipi: categorie.certificazioni } };
	const forms = raw['forms.json'] as Record<string, FormEntry>;
	const items: Item[] = [];
	const homes: Partial<Record<Lang, Home>> = {};
	const faq: Partial<Record<Lang, Faq[]>> = {};
	for (const [file, data] of Object.entries(raw)) {
		const m = file.match(/^(pagine|news|impianti|certificazioni|trasparenza)\/(it|en)\/(.+)\.json$/);
		if (m) {
			const d = data as Item['data'];
			// Società trasparente: i documenti stanno in una cartella per anno (trasparenza/<lingua>/<anno>/<chiave>.json)
			const year = m[1] === 'trasparenza' ? m[3].match(/^(\d{4})\//)?.[1] : undefined;
			const name = m[3].split('/').pop()!;
			items.push({ collection: m[1] as CollectionName, lang: m[2] as Lang, key: m[3], data: { ...d, ...(year ? { anno: year } : {}), path: d.path || defaultPath(m[2] as Lang, name) } });
		}
		const q = file.match(/^faq\/(it|en)\/.+\.json$/);
		if (q) (faq[q[1] as Lang] ??= []).push(data as Faq);
		const h = file.match(/^home\/(it|en)\.json$/);
		if (h) homes[h[1] as Lang] = data as Home;
	}
	const of = <T>(c: CollectionName, lang: Lang) => items.filter((i) => i.collection === c && i.lang === lang).map((i) => i.data as T);
	const sites: Record<Lang, SiteData> = Object.fromEntries(
		(['it', 'en'] as Lang[]).map((lang) => [
			lang,
			{
				lang,
				dims,
				tassonomie,
				forms,
				impianti: of<Impianto>('impianti', lang),
				certificazioni: of<Certificazione>('certificazioni', lang),
				documenti: of<Documento>('trasparenza', lang),
				faq: faq[lang] ?? [],
				// dalla più recente; a parità di data (o senza data, in fondo) per titolo
				news: of<News>('news', lang).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.title.localeCompare(b.title)),
				newsPage: of<Pagina>('pagine', lang).find((p) => p.news)
			}
		])
	) as Record<Lang, SiteData>;

	const pages = new Map<string, Page>();
	const add = (p: Page) => pages.set(p.path, p);
	const formsOf = (html: string, lang: Lang) =>
		[...html.matchAll(/data-gida-form="([^"]+)"/g)].map((m) => forms[`${m[1]}.${lang}`]?.def).filter((d) => !!d);

	// Traduzioni: stessa collezione e stessa chiave
	const alternatesOf = (i: Item) => {
		const alt: Page['alternates'] = {};
		for (const o of items) if (o.collection === i.collection && o.key === i.key) alt[o.lang] = o.data.path;
		return alt;
	};

	for (const i of items) {
		const site = sites[i.lang];
		const d = i.data;
		const html =
			i.collection === 'pagine'
				? renderPagina(d as Pagina, site)
				: i.collection === 'news'
					? renderNews(d as News, site)
					: i.collection === 'impianti'
						? renderImpianto(d as Impianto, site)
						: i.collection === 'certificazioni'
							? renderCertificazione(d as Certificazione, site)
							: renderDocumento(d as Documento, site);
		add({
			path: d.path,
			lang: i.lang,
			title: d.title,
			description: d.description ?? '',
			bodyClass: `path-node ${BODY_CLASS[i.collection]}`,
			wrapperId: 'page-default',
			alternates: alternatesOf(i),
			forms: formsOf(html, i.lang),
			html
		});
	}

	for (const lang of ['it', 'en'] as Lang[]) {
		const h = homes[lang];
		if (h)
			add({
				path: lang === 'en' ? '/en' : '/',
				lang,
				title: h.title,
				description: h.description ?? '',
				bodyClass: 'path-frontpage',
				wrapperId: 'page-front',
				alternates: Object.fromEntries((Object.keys(homes) as Lang[]).map((l) => [l, l === 'en' ? '/en' : '/'])),
				forms: [],
				html: renderHome(h, sites[lang])
			});
		// Archivi annuali di Società trasparente
		for (const year of anniArchivio(sites[lang])) {
			const path = archivePath(lang, year);
			add({
				path,
				lang,
				title: lang === 'en' ? 'Transparent company' : 'Società trasparente',
				description: '',
				bodyClass: lang === 'en' ? 'path-trasparent-company' : 'path-societa-trasparente',
				wrapperId: 'page-default',
				alternates: { it: archivePath('it', year), en: archivePath('en', year) },
				forms: [],
				html: renderArchivio(year, sites[lang])
			});
		}
	}
	return { pages, forms, tassonomie };
}
