/**
 * Rende i contenuti strutturati con lo stesso markup di Drupal (tema italiagov), così il CSS
 * originale continua a funzionare. Funzioni pure: usate dal sito in prerender e da
 * scripts/check-parity.mjs per confrontare il risultato con l'HTML originale.
 */
import type { Block, Certificazione, Documento, Faq, FormEntry, Home, Img, Impianto, Lang, News, Pagina, Sezione, Tassonomie } from './model.ts';
import { url } from './media.ts';

export type Dims = (src: string) => { width: number; height: number } | undefined;

/** Dati di una lingua necessari agli elenchi generati. */
export type SiteData = {
	lang: Lang;
	dims: Dims;
	tassonomie: Tassonomie;
	forms: Record<string, FormEntry>;
	impianti: Impianto[];
	certificazioni: Certificazione[];
	documenti: Documento[];
	faq: Faq[];
};

// ---------------------------------------------------------------------------------------------
// Utilità
// ---------------------------------------------------------------------------------------------
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Percorso così come lo salva il CMS (non codificato) → URL. */
export { url };
const home = (lang: Lang) => (lang === 'en' ? '/en' : '/');

function img(site: SiteData, i: Img, attrs: Record<string, string> = {}) {
	const d = site.dims(i.src);
	const size = d ? ` width="${d.width}" height="${d.height}"` : '';
	return `<img loading="lazy" src="${esc(url(i.src))}"${size} alt="${esc(i.alt ?? '')}"${Object.entries(attrs).map(([k, v]) => ` ${k}="${esc(v)}"`).join('')}>`;
}
/** Immagine inserita nel testo (blocchi della home): attributi nell'ordine di CKEditor. */
function inlineImg(site: SiteData, i: Img, cls?: string) {
	const d = site.dims(i.src);
	return `<img alt="${esc(i.alt ?? '')}"${cls ? ` class="${cls}"` : ''} src="${esc(url(i.src))}"${d ? ` width="${d.width}" height="${d.height}"` : ''} loading="lazy">`;
}
/** Media Drupal di tipo immagine. */
function media(site: SiteData, i: Img, mode: 'full' | 'default', extra = '') {
	return `<article class="${extra}media media--type-image media--view-mode-${mode}"><div class="field field--name-field-media-image field--type-image field--label-visually_hidden"><div class="field__label visually-hidden">Image</div><div class="field__item"> ${img(site, i, { class: 'img-fluid' })}</div></div> </article>`;
}

const MIME: Record<string, [string, string]> = {
	pdf: ['application/pdf', 'file--mime-application-pdf file--application-pdf'],
	xml: ['application/xml', 'file--mime-application-xml file--general'],
	xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'file--mime-application-vnd-openxmlformats-officedocument-spreadsheetml-sheet file--x-office-spreadsheet'],
	docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'file--mime-application-vnd-openxmlformats-officedocument-wordprocessingml-document file--x-office-document']
};
/** Link a un file con l'icona del tipo (testo: nome del file). */
export function fileLink(path: string) {
	const ext = path.split('.').pop()!.toLowerCase();
	const [type, cls] = MIME[ext] ?? ['application/octet-stream', 'file--general'];
	return `<span class="file ${cls}"> <a href="${esc(url(path))}" type="${type}">${esc(path.split('/').pop()!)}</a></span>`;
}

const textField = (html: string) => `<div class="clearfix text-formatted field field--name-body field--type-text-with-summary field--label-hidden field__item">${html}</div>`;
const lb = (cls: string, inner: string) => `<div class="block block-layout-builder ${cls}" id="it-">${inner}</div>`;

function mainWrap(inner: string) {
	return `<main><div role="main" class="container main-container"><div class="row"><div class="col"></div></div><div class="row"><div class="col"><div class="it-content__wrapper"><div id="it-region-content" class="region content"><div id="it-block-italiagov-content" class="block block-system block-system-main-block">${inner}</div></div></div></div></div></div> </main>`;
}
function node(type: string, inner: string, promoted = false) {
	return ` <article role="article" class="node node--type-${type}${promoted ? ' node--promoted' : ''} node--view-mode-full"><div class="node__content">${inner}</div></article>`;
}
const layout = (inner: string) => `<div class="layout layout--onecol"><div class="layout__region layout__region--content">${inner}</div></div>`;

/** Contenuto aggiuntivo sotto la pagina (regioni after_content). */
function afterContent(cols: { col: string; region: string; html: string }[]) {
	if (!cols.length) return '';
	return `<div class="after-content__wrapper"><div class="after-content container"><div class="row">${cols
		.map((c) => `<div class="col after-content__col after-content__${c.col}"><div id="it-region-${c.region.replace(/_/g, '-')}" class="region ${c.region}">${c.html}</div></div>`)
		.join('')}</div></div></div>`;
}

// ---------------------------------------------------------------------------------------------
// Pagine
// ---------------------------------------------------------------------------------------------
export function renderPagina(p: Pagina, site: SiteData) {
	let html = '';
	if (p.hero) html += lb('block-field-blocknodepagefield-immagine-principale', `<div class="field field--name-field-immagine-principale field--type-entity-reference field--label-hidden field__item">${media(site, p.hero, 'full')}</div>`);
	html += `<div class="block block-system block-system-breadcrumb-block" id="it-"> <nav class="breadcrumb-container" aria-label="breadcrumb"><ol class="breadcrumb"><li class="breadcrumb-item"> <a href="${home(site.lang)}">Home</a><span class="separator">/</span></li><li class="breadcrumb-item active" aria-current="page">${esc(p.title)}</li></ol></nav></div>`;
	html += lb('block-extra-field-blocknodepagelinks', '');
	if (p.icon) html += lb('block-field-blocknodepagefield-icona', `<div class="field field--name-field-icona field--type-entity-reference field--label-hidden field__item">${media(site, p.icon, 'default')}</div>`);
	html += lb('block-field-blocknodepagetitle', ` <span class="field field--name-title field--type-string field--label-above">${esc(p.title)}</span>`);
	const body = text(p) + (p.sezioni ?? []).map((s) => renderSezione(s, site)).join('');
	if (body) html += lb('block-field-blocknodepagebody', textField(body));
	if (p.faq && site.faq.length) {
		const items = [...site.faq].sort(byOrder).map((f) => `<h3 class="faqfield-question">${f.title}</h3><div class="faqfield-answer">${f.answer}</div>`).join('');
		html += lb('block-field-blocknodepagefield-campo-faq', `<div class="field field--name-field-campo-faq field--type-faqfield field--label-hidden field__items"><div class="field__item"><div id="faqfield_field_campo_faq">${items}</div></div></div>`);
	}
	const blocks = p.blocks ?? [];
	const first = blocks.filter((b) => b.type !== 'trasparenza').map((b) => renderBlock(b, site)).join('');
	const cols = [];
	if (first) cols.push({ col: 'first', region: 'after_content_first', html: first });
	if (blocks.some((b) => b.type === 'trasparenza')) cols.push({ col: 'fourth', region: 'societa_trasparente', html: renderTrasparenza(site) });
	return mainWrap(node('page', layout(html))) + afterContent(cols);
}

/** Aggiunge un attributo ai tag di apertura indicati (solo a quelli senza attributi). */
const withAttr = (html: string, tags: string, attr: string) => html.replace(new RegExp(`<(${tags})>`, 'g'), `<$1 ${attr}>`);
const LABELS = { it: { nomina: 'Nomina', compenso: 'Compenso' }, en: { nomina: 'Nomination', compenso: 'Compensation' } };

/** Allegato come media Drupal di tipo documento. */
const allegato = (f: string) =>
	`<article class="align-center media media--type-document media--view-mode-default"><div class="field field--name-field-media-document field--type-file field--label-visually_hidden"><div class="field__label visually-hidden">Document</div><div class="field__item">${fileLink(f)}</div></div> </article>`;

function renderSezione(s: Sezione, site: SiteData): string {
	switch (s.type) {
		case 'testo':
			return s.centrato ? withAttr(s.body, 'p|h[1-6]', 'style="text-align: center"') : s.body;
		case 'riquadro':
			return withAttr(s.body, 'p', 'class="orari_impianto"');
		case 'allegati':
			return s.elenco ? `<ul>${s.files.map((f) => `<li>${allegato(f)}</li>`).join('')}</ul>` : s.files.map(allegato).join('');
		case 'galleria':
			return `<div class="cke-ig">${s.images.map((i) => inlineImg(site, i)).join('')}</div>`;
		case 'immagine': {
			const m = media(site, s.image, 'default', 'align-center ');
			return `<div class="mappa-contatti">${s.link ? `<a href="${esc(url(s.link))}">${m}</a>` : m}</div>`;
		}
		case 'organi': {
			const L = LABELS[site.lang];
			const li = (label: string, v?: string) => (v ? `<li>${label}: ${esc(v)}</li>` : '');
			const scheda = (m: (typeof s.groups)[number]['members'][number]) =>
				`<ul class="lista_chi_siamo"><li><strong>${esc(m.name)}</strong></li>${m.role ? `<li>${esc(m.role)}</li>` : ''}${m.email ? `<li>email: <a href="mailto:${esc(m.email)}">${esc(m.email)}</a></li>` : ''}${li(L.nomina, m.nomina)}${li(L.compenso, m.compenso)}</ul>`;
			const groups = s.groups
				.map((g) => {
					const inner = g.compatto
						? `<ul class="lista_chi_siamo collegio">${g.members.map((m) => `<li><strong>${esc(m.name)}</strong>${m.role ? ` (${esc(m.role)})` : ''}</li>`).join('')}</ul>`
						: g.members.map(scheda).join('');
					return `<h2 class="titolo_cdm">${esc(g.title)}</h2>${g.riquadri ? `<div class="box_chi_siamo">${inner}</div>` : inner}`;
				})
				.join('');
			return `${s.anchor ? `<div class="anchor-offset" id="${esc(s.anchor)}">&nbsp;</div>` : ''}<h2>${esc(s.title)}</h2>${groups}`;
		}
		case 'avviso':
			return `<div class="wrapper-under-construction"${s.visibile ? '' : ' style="display: none"'}><div class="under-construction">${esc(s.text)}</div></div>`;
		case 'html':
			return s.html;
	}
}

const viewDom = (s: string) => `js-view-dom-id-${s}`;

function renderBlock(b: Block, site: SiteData): string {
	switch (b.type) {
		case 'form':
			return site.forms[`${b.form}.${site.lang}`]?.html ?? '';
		case 'html':
			return b.html;
		case 'certificazioni': {
			const rows = b.tipi
				.map((tipo) => {
					const items = site.certificazioni.filter((c) => c.tipo === tipo && !c.unlisted).sort(byOrder);
					const label = site.tassonomie.certificazioni.tipi.find((t) => t.id === tipo)?.[site.lang] ?? tipo;
					return `<h3>${esc(label)}</h3>` + items.map((c) => `<div class="views-row"><div class="views-field views-field-field-documento-certificazione"><div class="field-content">${fileLink(c.file)}</div></div></div>`).join('');
				})
				.join('');
			const id = `certificazioni-vista-${b.view}`;
			return `<div class="views-element-container block block-views block-views-block${id}" id="it-block-views-block-${id}"><div><div class="view view-certificazioni-vista view-id-certificazioni_vista view-display-id-${b.view.replace('-', '_')} ${viewDom(id)}">${rows}</div></div></div>`;
		}
		case 'impianti': {
			const items = [...site.impianti].sort(byOrder);
			const anchor = (i: Impianto) => plain(i.title).toLowerCase();
			const menu = (b.menu ?? items.map((i) => ({ title: anchor(i), href: `#${anchor(i)}` }))).map((l) => `<a href="${esc(l.href)}">${esc(l.title)}</a>`).join(' ');
			const rows = items
				.map(
					(i) =>
						`<div class="views-row"><div class="wrapper_single_impianto"><div class="anchor" id="${esc(anchor(i))}"></div><div class="box_image"> ${i.image ? media(site, i.image, 'full') : ''}</div><div class="box_text"><div class="box_text_title"> ${esc(plain(i.title))}</div>${text(i)}</div></div></div>`
				)
				.join('');
			return (
				`<div id="it-block-impiantimenuancore" class="block block-block-content block-block-contentbcd2535c-c413-454d-ab98-b61ff0fa0ba9">${textField(`<div class="wrapper_ancore_depurazione">${menu}</div>`)}</div>` +
				`<div class="views-element-container block block-views block-views-blockdepurazione-impianti-block-1" id="it-block-views-block-depurazione-impianti-block-1"><div><div class="view view-depurazione-impianti view-id-depurazione_impianti view-display-id-block_1 ${viewDom('impianti')}"><div class="view-header"></div>${rows}</div></div></div>`
			);
		}
		case 'pubblicazioni': {
			const rows = b.items.map((l) => `<div class="views-row"><div class="views-field views-field-title"><span class="field-content"><a href="${esc(url(l.href))}">${esc(l.title)}</a></span></div></div>`).join('');
			return `<div class="views-element-container block block-views block-views-blockpubblicazioni-scientifiche-block-1" id="it-block-views-block-pubblicazioni-scientifiche-block-1"><h2>${esc(b.title)}</h2><div><div class="view view-pubblicazioni-scientifiche view-id-pubblicazioni_scientifiche view-display-id-block_1 ${viewDom('pubblicazioni')}">${rows}</div></div></div>`;
		}
		case 'progetti': {
			const a = (l: { title: string; href: string }) => `<a href="${esc(url(l.href))}">${esc(l.title)}</a>`;
			const rows = b.items
				.map(
					(i) =>
						`<div class="views-row"><div class="views-field views-field-field-documento"><div class="field-content">${i.document ? a(i.document) : ''}</div></div><div class="views-field views-field-field-link-a-documento"><div class="field-content">${(i.links ?? []).map(a).join(', ')}</div></div></div>`
				)
				.join('');
			return `<div class="views-element-container block block-views block-views-blockprogetti-ricerca-block-1" id="it-block-views-block-progetti-ricerca-block-1"><h2>${esc(b.title)}</h2><div><div class="view view-progetti-ricerca view-id-progetti_ricerca view-display-id-block_1 ${viewDom('progetti')}">${rows}</div></div></div>`;
		}
		case 'trasparenza':
			return renderTrasparenza(site);
	}
}

/** Testo da mostrare: l'HTML avanzato se presente, altrimenti quello dell'editor visuale. */
const text = (t: { body?: string; bodyHtml?: string }) => t.bodyHtml || t.body || '';
const byOrder = (a: { order?: number }, b: { order?: number }) => (a.order ?? 0) - (b.order ?? 0);
const plain = (s: string) => s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

// ---------------------------------------------------------------------------------------------
// Altri tipi
// ---------------------------------------------------------------------------------------------
export function renderNews(n: News, site: SiteData) {
	const image = (label: boolean) =>
		n.image
			? lb(
					'block-field-blocknodenewsfield-immagine-news',
					label
						? `<div class="field field--name-field-immagine-news field--type-image field--label-above"><div class="field__label">Immagine-news</div><div class="field__item"> ${img(site, n.image, { class: 'img-fluid' })}</div></div>`
						: `<div class="field field--name-field-immagine-news field--type-image field--label-hidden field__item"> ${img(site, n.image, { class: 'img-fluid' })}</div>`
				)
			: '';
	let html = image(false);
	html += lb('block-field-blocknodenewstitle', ` <span class="field field--name-title field--type-string field--label-hidden">${esc(n.title)}</span>`);
	if (text(n)) html += lb('block-field-blocknodenewsbody', textField(text(n)));
	html += image(true);
	return mainWrap(node('news', layout(html), true).trimStart());
}

export function renderImpianto(i: Impianto, site: SiteData) {
	let html = text(i) ? textField(text(i)) : '';
	if (i.image) html += `<div class="field field--name-field-imamgine field--type-entity-reference field--label-hidden field__item">${media(site, i.image, 'default')}</div>`;
	return mainWrap(node('impianti', html, true));
}

const labelled = (name: string, type: string, label: string, item: string) =>
	`<div class="field field--name-${name} field--type-${type} field--label-above"><div class="field__label">${label}</div><div class="field__item">${item}</div></div>`;
const term = (t: string) => `<span class="taxonomy-term">${esc(t)}</span>`;

export function renderCertificazione(c: Certificazione, site: SiteData) {
	const tipo = site.tassonomie.certificazioni.tipi.find((t) => t.id === c.tipo)?.[site.lang] ?? c.tipo;
	return mainWrap(
		node(
			'certificazioni',
			labelled('field-documento-certificazione', 'file', 'documento certificazione', fileLink(c.file)) +
				labelled('field-tipo-di-certificazione', 'entity-reference', 'tipo di certificazione', term(tipo))
		).trimStart()
	);
}

const docFile = (f: string) => `<div class="field field--name-field-documento-societa-traspare field--type-file field--label-hidden field__item">${fileLink(f)}</div>`;

export function renderDocumento(d: Documento, site: SiteData) {
	const tipo = d.tipo && (site.tassonomie.trasparenza.categorie.find((c) => c.id === d.tipo)?.[site.lang] ?? d.tipo);
	let html = text(d) ? textField(text(d)) : '';
	html += (d.files ?? []).map(docFile).join('');
	if (tipo) html += labelled('field-societa-trasparente-tipo-d', 'entity-reference', 'societa trasparente tipo di documento', term(tipo));
	html += labelled('field-anno-documentazione', 'entity-reference', 'anno documentazione', term(d.anno));
	return mainWrap(node('societa-trasparente-documenti', html));
}

// ---------------------------------------------------------------------------------------------
// Società trasparente: elenco per categorie (pagina principale e archivi annuali)
// ---------------------------------------------------------------------------------------------
/** id della categoria come lo genera Drupal (usato dal collapse). */
export const catId = (name: string) =>
	name
		.toLowerCase()
		.replace(/[,'.()]/g, '')
		.replace(/[\s/]/g, '-');

const TR = {
	it: { year: 'Documenti per anno', archive: 'Archivio', years: 'consulta la documentazione relativa agli anni:', base: '/societa-trasparente', archiveBase: '/societa-trasparente' },
	en: { year: 'Document for year', archive: 'Archive', years: 'consult the documentation relating to the years:', base: '/en/transparent-company', archiveBase: '/en/trasparent-company' }
};
/** Anni con una pagina d'archivio: quelli indicati nelle impostazioni più quelli che hanno documenti. */
export const anniArchivio = (site: SiteData) => [...new Set([...site.tassonomie.trasparenza.anni, ...site.documenti.map((d) => d.anno)])].sort();
export const archivePath = (lang: Lang, year: string) => `${TR[lang].archiveBase}/${year}`;

function transparencyListing(site: SiteData, year: string) {
	const lang = site.lang;
	const cats = site.tassonomie.trasparenza.categorie.filter((c) => c[lang]);
	const label = (id: string) => cats.find((c) => c.id === id)?.[lang] ?? id;
	const docs = site.documenti.filter((d) => d.anno === year && !d.unlisted).sort(byOrder);
	const own = (id: string) => docs.filter((d) => d.tipo === id);
	const children = (id: string) => cats.filter((c) => c.parent === id);
	const hasContent = (id: string): boolean => own(id).length > 0 || children(id).some((c) => hasContent(c.id));
	const content = (list: Documento[]) => list.map((d) => (text(d) ? textField(text(d)) : '') + (d.files ?? []).map(docFile).join('')).join('');
	const box = (id: string): string => {
		const anchor = catId(label(id));
		const nested = children(id).filter((c) => hasContent(c.id)).map((c) => box(c.id)).join('');
		return `<div class="box-categoria-societa"><h3><a data-toggle="collapse" data-target="#${esc(anchor)}" class="" aria-expanded="true"><div>${esc(label(id))}</div></a></h3><div id="${esc(anchor)}" class="collapse child">${content(own(id))}${nested}</div></div>`;
	};
	let html = '';
	for (const root of cats.filter((c) => !c.parent)) {
		const kids = children(root.id).filter((c) => hasContent(c.id));
		if (kids.length) html += `<div class="wrapper-societa-single"><div class="genitore">${esc(label(root.id))}</div>${content(own(root.id))}${kids.map((c) => box(c.id)).join('')}</div>`;
		else if (own(root.id).length) html += `<div class="wrapper-societa-single"><div class="box-categoria-societa"><h3><div class="no-genitore">${esc(label(root.id))}</div></h3>${content(own(root.id))}</div></div>`;
	}
	return html;
}

function renderTrasparenza(site: SiteData) {
	const t = TR[site.lang];
	const { annoCorrente } = site.tassonomie.trasparenza;
	const years = anniArchivio(site).filter((y) => y < annoCorrente).map((y) => `<div><a href="${archivePath(site.lang, y)}">${y}</a></div>`).join('');
	return (
		`<div id="it-block-documentisocietatrasparente" class="block block-gida-base block-societa-trasparente-documents-block">${transparencyListing(site, site.tassonomie.trasparenza.annoCorrente)}</div>` +
		`<div id="it-block-anniarchivisocietatrasparente" class="block block-gida-base block-societa-trasparente-years-block"><div class="archivio-anni-container"><h2>${t.archive}</h2><div class="archivio-anni-wrapper"><div class="archivio-anni-wrapper-title">${t.years}</div>${years}</div></div></div>`
	);
}

export function renderArchivio(year: string, site: SiteData) {
	const t = TR[site.lang];
	return mainWrap(`<div class="blocco-societa-trasparente"><div class="title-wrapper"><a href="${t.base}" class="back-societa-trasparente">BACK</a><h2>${t.year}: ${year}</h2></div>${transparencyListing(site, year)}</div>`);
}

// ---------------------------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------------------------
const ARROW = { src: '/sites/default/files/inline-images/freccia.png', alt: 'freccia' };

export function renderHome(h: Home, site: SiteData) {
	const region = (name: string, inner: string, container: string | null) => {
		const id = name.replace(/_/g, '-');
		const reg = `<div id="it-region-${id}" class="region ${name}">${inner}</div>`;
		const cls = name.replace(/_/g, '-').replace(/-first$/, '');
		return container
			? `<div class="${cls}__wrapper"><div class="${cls} container"><div class="row"><div class="col ${cls}__col ${cls}__first">${reg}</div></div></div></div>`
			: `<div class="${cls}__wrapper">${reg}</div>`;
	};
	const block = (id: string, uuid: string, inner: string) => `<div id="it-block-${id}" class="block block-block-content block-block-content${uuid}">${textField(inner)}</div>`;
	const s = h.settori;
	const settori = `<div class="container"><div class="wrapper-settore"><h3>${esc(s.title)}</h3>${s.items
		.map((i) => `<div class="settore">${inlineImg(site, i.icon, 'icona-settore')}<h4>${esc(i.title)}</h4><p>${i.text}</p><a href="${esc(i.link)}">${inlineImg(site, ARROW)}</a></div>`)
		.join('')}</div></div>`;
	const p = h.percorso;
	const percorso = `<div class="wrapper-percorso">${media(site, p.background, 'default', 'back-percorso align-center ')}<div class="pulsante-percorso"><div class="percorso-icona">${inlineImg(site, p.icon)}</div><div class="percorso-testo"><a href="${esc(url(p.file))}" target="_blank">${esc(p.text)}</a></div><div class="percorso-freccia">${inlineImg(site, { src: '/sites/default/files/inline-images/freccia-down.png', alt: 'freccia down' })}</div></div></div>`;
	const r = h.ricerca;
	const ricerca = `<div class="wrapper-ricerca"><div class="testo-ricerca"><h2>${esc(r.title)}</h2><p>${r.text}</p><a href="${esc(r.link)}">${media(site, { src: '/sites/default/files/2021-12/freccia.png', alt: 'freccia' }, 'default', 'freccia align-center ')}</a></div>${media(site, r.image, 'default', 'home-ricerca align-center ')}</div>`;
	const c = h.scuole;
	const scuole = `<div class="wrapper-scuola"><div class="box-scuola"><div class="testo-scuola"><h2>${esc(c.title)}</h2><h3><a href="${esc(c.link)}">${esc(c.linkText)}</a></h3><p>&nbsp;</p></div>${media(site, c.mascotte, 'default', 'mascotte align-center ')}</div>${media(site, c.background, 'default', 'back-scuola align-center ')}</div>`;
	return (
		region('home_first_row_full_width', block('jumbohome', '754329e6-786a-4b74-894e-32daa796cc31', media(site, h.hero, 'default', 'align-center ')), null) +
		region('home_first_row_first', block('homemission', '7c7caa75-db9a-4e57-88a8-db1b2b7f4bdb', h.mission), 'container') +
		region('home_second_row_full_width', block('homesettori', '0c1791ab-7095-4a75-a175-41a00b410602', settori), null) +
		region('home_third_row_full_width', block('homepercorsoacqua', '4dfe11dd-5410-4144-baef-859d34fdc217', percorso), null) +
		region('home_third_row_first', block('homericerca', 'a18ca575-2879-4f80-a385-00419a4e60b1', ricerca), 'container') +
		region('home_last_row_full_width', block('homescuole', '10924e2f-8c0f-4784-8843-82f4ad2cf374', scuole), null)
	);
}
