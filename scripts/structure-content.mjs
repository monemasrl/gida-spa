#!/usr/bin/env node
/**
 * Converte le pagine importate da Drupal (HTML completo, una per lingua) in contenuti strutturati
 * per tipo, con le traduzioni affiancate come in Sveltia CMS (`i18n.structure: multiple_folders`):
 *
 *   src/content/<collezione>/<lingua>/<chiave>.json
 *
 * La chiave è condivisa fra le traduzioni (slug italiano, o inglese per le pagine solo in inglese).
 * Le parti generate da Drupal (breadcrumb, elenchi di certificazioni/impianti, Società trasparente,
 * archivi annuali) non vengono salvate: le ricostruisce il sito a partire dai dati.
 *
 * Uso: node scripts/structure-content.mjs <dir pagine importate> <dir src/content>
 */
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

const [srcDir = 'src/content/pages', outDir = 'src/content'] = process.argv.slice(2);
const pages = fs.readdirSync(srcDir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(srcDir, f), 'utf8')));
const byPath = new Map(pages.map((p) => [p.path, p]));

const warnings = [];
const warn = (p, msg) => warnings.push(`${p.path}: ${msg}`);
const clean = (s) => s.replace(/\s+/g, ' ').trim();
const decode = (href) => {
	try {
		return decodeURI(href);
	} catch {
		return href;
	}
};

/** Immagine Drupal → { src, alt } (le dimensioni le legge il sito dal file). */
function image($, el) {
	const img = $(el).is('img') ? $(el) : $(el).find('img').first();
	if (!img.length) return undefined;
	return { src: decode(img.attr('src')), alt: img.attr('alt') ?? '' };
}
/** Link a un file → percorso (decodificato, come lo salva Sveltia). */
const fileHref = ($, a) => decode($(a).attr('href'));
/** HTML interno di un campo testo, così com'è. */
const inner = ($, el) => ($(el).length ? $(el).html().trim() : undefined);

function typeOf(p) {
	const m = p.bodyClass.match(/page-node-type(\S+)/);
	if (m) return m[1];
	if (p.bodyClass.includes('path-frontpage')) return 'home';
	return 'archivio';
}

// ---------------------------------------------------------------------------------------------
// Tassonomie ricavate dalle pagine
// ---------------------------------------------------------------------------------------------
const taxonomy = {
	trasparenza: { annoCorrente: '', anni: [], categorie: [] },
	certificazioni: { tipi: [] }
};

// Categorie di Società trasparente (con genitore e ordine) dall'elenco della pagina principale e
// degli archivi: l'ordine di prima apparizione è quello di Drupal.
const catIndex = new Map(); // nome it|en → categoria
function addCategory(lang, name, parent) {
	const key = `${lang}|${name}`;
	if (catIndex.has(key)) return catIndex.get(key);
	const c = { lang, name, parent };
	catIndex.set(key, c);
	return c;
}

// ---------------------------------------------------------------------------------------------
// Estrattori per tipo
// ---------------------------------------------------------------------------------------------
const forms = {};

function blocksOf(p, $) {
	const blocks = [];
	let menu;
	$('#it-region-after-content-first > .block').each((_, b) => {
		const id = $(b).attr('id') ?? '';
		const $b = $(b);
		if ($b.hasClass('block-contact-block')) {
			const form = $b.find('form[data-gida-form]').attr('data-gida-form');
			forms[`${form}.${p.lang}`] = { html: $.html(b), def: p.forms.find((f) => f.id === form) };
			blocks.push({ type: 'form', form });
		} else if (id.startsWith('it-block-views-block-certificazioni-vista-')) {
			const tipi = $b.find('.view > h3').map((_, h) => clean($(h).text())).get();
			blocks.push({ type: 'certificazioni', view: id.replace('it-block-views-block-certificazioni-vista-', ''), tipi });
		} else if (id === 'it-block-impiantimenuancore') {
			// menu di ancore verso gli impianti (scritto a mano in Drupal): resta nel blocco impianti
			menu = $b.find('a').map((_, a) => ({ title: clean($(a).text()), href: $(a).attr('href') })).get();
		} else if (id === 'it-block-views-block-depurazione-impianti-block-1') {
			blocks.push({ type: 'impianti', ...(menu ? { menu } : {}) });
		} else if (id.startsWith('it-block-views-block-pubblicazioni-scientifiche') || id.startsWith('it-block-views-block-progetti-ricerca')) {
			const link = (a) => ({ title: clean($(a).text()), href: decode($(a).attr('href')) });
			const pubbl = id.includes('pubblicazioni');
			const items = $b.find('.views-row').map((_, r) => {
				if (pubbl) return link($(r).find('a').get(0));
				const doc = $(r).find('.views-field-field-documento a').get(0);
				const links = $(r).find('.views-field-field-link-a-documento a').map((_, a) => link(a)).get();
				return { ...(doc ? { document: link(doc) } : {}), ...(links.length ? { links } : {}) };
			}).get();
			blocks.push({ type: pubbl ? 'pubblicazioni' : 'progetti', title: clean($b.children('h2').text()), items });
		} else {
			warn(p, `blocco non gestito ${id}`);
			blocks.push({ type: 'html', html: $.html(b) });
		}
	});
	if ($('#it-region-societa-trasparente').length) blocks.push({ type: 'trasparenza' });
	return blocks;
}

function extractPage(p, $) {
	const region = $('.layout__region--content');
	const known = new Set();
	const take = (sel) => {
		const el = region.children(sel);
		el.each((_, e) => known.add(e));
		return el;
	};
	const data = {};
	const hero = take('.block-field-blocknodepagefield-immagine-principale');
	if (hero.length) data.hero = image($, hero);
	take('.block-system-breadcrumb-block');
	take('.block-extra-field-blocknodepagelinks');
	const icon = take('.block-field-blocknodepagefield-icona');
	if (icon.length) data.icon = image($, icon);
	const title = take('.block-field-blocknodepagetitle');
	if (clean(title.text()) !== clean(p.title)) warn(p, `titolo diverso: ${clean(title.text())}`);
	const body = take('.block-field-blocknodepagebody');
	if (body.length) data.body = inner($, body.find('.field--name-body'));
	const faq = take('.block-field-blocknodepagefield-campo-faq');
	if (faq.length) {
		data.faq = faq.find('.faqfield-question').map((_, q) => ({ question: $(q).html().trim(), answer: $(q).next('.faqfield-answer').html().trim() })).get();
	}
	region.children().each((_, e) => {
		if (!known.has(e)) warn(p, `elemento non gestito ${$(e).attr('class')}`);
	});
	const blocks = blocksOf(p, $);
	if (blocks.length) data.blocks = blocks;
	return data;
}

function extractNews(p, $) {
	const data = {};
	const img = $('.block-field-blocknodenewsfield-immagine-news');
	if (img.length) data.image = image($, img);
	data.body = inner($, $('.block-field-blocknodenewsbody .field--name-body'));
	return data;
}

function extractImpianto(p, $) {
	return {
		body: inner($, $('.node__content > .field--name-body')),
		image: image($, $('.field--name-field-imamgine'))
	};
}

function extractCertificazione(p, $) {
	const tipo = clean($('.field--name-field-tipo-di-certificazione .field__item').text());
	return { file: fileHref($, $('.field--name-field-documento-certificazione a')), tipo };
}

function extractDocumento(p, $) {
	const data = {};
	const body = $('.node__content > .field--name-body');
	if (body.length) data.body = inner($, body);
	const files = $('.field--name-field-documento-societa-traspare a').map((_, a) => fileHref($, a)).get();
	if (files.length) data.files = files;
	data.tipo = clean($('.field--name-field-societa-trasparente-tipo-d .field__item').text());
	data.anno = clean($('.field--name-field-anno-documentazione .field__item').text());
	if (!data.tipo) warn(p, 'documento senza tipo');
	return data;
}

function extractHome(p, $) {
	const block = (id) => $(`#it-block-${id} > .field--name-body`);
	const mission = block('homemission');
	const settori = block('homesettori');
	const percorso = block('homepercorsoacqua');
	const ricerca = block('homericerca');
	const scuole = block('homescuole');
	return {
		hero: image($, block('jumbohome')),
		mission: mission.html().trim(),
		settori: {
			title: clean(settori.find('h3').first().text()),
			items: settori.find('.settore').map((_, s) => ({
				icon: image($, $(s).children('img').first()),
				title: clean($(s).find('h4').text()),
				text: $(s).find('p').html()?.trim() ?? '',
				link: $(s).children('a').attr('href')
			})).get()
		},
		percorso: {
			background: image($, percorso.find('.back-percorso')),
			icon: image($, percorso.find('.percorso-icona img')),
			text: clean(percorso.find('.percorso-testo a').text()),
			file: decode(percorso.find('.percorso-testo a').attr('href'))
		},
		ricerca: {
			title: clean(ricerca.find('h2').text()),
			text: ricerca.find('.testo-ricerca > p').html()?.trim() ?? '',
			link: ricerca.find('.testo-ricerca a').attr('href'),
			image: image($, ricerca.find('.home-ricerca'))
		},
		scuole: {
			title: clean(scuole.find('h2').text()),
			linkText: clean(scuole.find('h3 a').text()),
			link: scuole.find('h3 a').attr('href'),
			mascotte: image($, scuole.find('.mascotte')),
			background: image($, scuole.find('.back-scuola'))
		}
	};
}

/**
 * Pagina di Società trasparente o archivio annuale: albero delle categorie, ordine delle categorie
 * e dei documenti. Un nuovo nome viene inserito subito dopo quello che lo precede nell'elenco, così
 * l'ordine resta quello di Drupal anche unendo elenchi diversi.
 */
const docOrder = new Map(); // lang|file → posizione
const docCategory = new Map(); // lang|file → categoria nell'elenco
function readTransparencyListing(p, $) {
	const year = p.path.match(/\/(\d{4})$/)?.[1] ?? 'corrente';
	let prev = null;
	const seen = (name, parent) => {
		const c = addCategory(p.lang, name, parent);
		const list = catOrder[p.lang];
		if (!list.includes(c)) list.splice(prev ? list.indexOf(prev) + 1 : list.length, 0, c);
		prev = c;
	};
	$('.wrapper-societa-single').each((_, w) => {
		const g = $(w).children('.genitore');
		const root = g.length ? clean(g.text()) : null;
		if (root) seen(root, null);
		// testi dei documenti della categoria principale, fuori dai box
		$(w).children('.field--name-body').each((_, el) => {
			const k = `${p.lang}|${year}|body|${$(el).html().trim()}`;
			if (!docOrder.has(k)) docOrder.set(k, docOrder.size + 1);
			docCategory.set(k, root);
		});
		$(w).find('.box-categoria-societa').each((_, box) => {
			const h = $(box).children('h3');
			const name = clean(h.text());
			const outer = $(box).parent().closest('.box-categoria-societa');
			const parent = h.find('.no-genitore').length ? null : outer.length ? clean(outer.children('h3').text()) : root;
			seen(name, parent);
			// posizione di ogni documento: dal suo primo file o dal suo testo
			$(box).find('a[type], .field--name-body').each((i, el) => {
				const k = $(el).is('a') ? `${p.lang}|${year}|${fileHref($, el)}` : `${p.lang}|${year}|body|${$(el).html().trim()}`;
				if (!docOrder.has(k)) docOrder.set(k, docOrder.size + 1);
				// la categoria che compare negli elenchi (a volte diversa dall'etichetta sulla pagina)
				if ($(el).closest('.box-categoria-societa').is(box)) docCategory.set(k, name);
			});
		});
	});
}
const catOrder = { it: [], en: [] };

// ---------------------------------------------------------------------------------------------
// Conversione
// ---------------------------------------------------------------------------------------------
const COLLECTIONS = {
	page: 'pagine',
	news: 'news',
	impianti: 'impianti',
	certificazioni: 'certificazioni',
	'societa-trasparente-documenti': 'trasparenza'
};
const EXTRACT = {
	page: extractPage,
	news: extractNews,
	impianti: extractImpianto,
	certificazioni: extractCertificazione,
	'societa-trasparente-documenti': extractDocumento
};

const slugOf = (p) => p.path.replace(/^\/en(\/|$)/, '/').replace(/^\//, '') || 'home';
const keys = new Map(); // path → chiave condivisa
for (const p of pages) {
	if (keys.has(p.path)) continue;
	const it = p.lang === 'it' ? p : byPath.get(p.alternates.it);
	const en = p.lang === 'en' ? p : byPath.get(p.alternates.en);
	const key = slugOf(it ?? p);
	for (const x of [it, en]) if (x && (x === p || x.alternates[p.lang] === p.path)) keys.set(x.path, key);
	keys.set(p.path, key);
}

const out = new Map(); // file → dati
const order = { certificazioni: new Map(), impianti: new Map() };

// Ordine degli elementi negli elenchi generati (certificazioni e impianti)
for (const p of pages) {
	const $ = cheerio.load(p.html, null, false);
	$('.view-certificazioni-vista a').each((i, a) => order.certificazioni.set(`${p.lang}|${fileHref($, a)}`, i + 1));
	$('.view-depurazione-impianti .box_text_title').each((i, t) => order.impianti.set(`${p.lang}|${clean($(t).text())}`, i + 1));
	if (/path-societa-trasparente|path-trasparent-company/.test(p.bodyClass) || $('#it-region-societa-trasparente').length) readTransparencyListing(p, $);
	if (p.path === '/societa-trasparente') {
		taxonomy.trasparenza.archivio = $('.archivio-anni-wrapper a').map((_, a) => clean($(a).text())).get();
	}
	if (/path-societa-trasparente/.test(p.bodyClass)) taxonomy.trasparenza.anni.push(p.path.split('/').pop());
}

for (const p of pages) {
	const type = typeOf(p);
	const $ = cheerio.load(p.html, null, false);
	if (type === 'archivio') continue; // generati dai documenti
	if (type === 'home') {
		out.set(`home/${p.lang}.json`, { title: p.title, description: p.description || undefined, ...extractHome(p, $) });
		continue;
	}
	const coll = COLLECTIONS[type];
	if (!coll) {
		warn(p, `tipo sconosciuto ${type}`);
		continue;
	}
	const data = { path: p.path, title: p.title };
	if (p.description) data.description = p.description;
	Object.assign(data, EXTRACT[type](p, $));
	if (type === 'societa-trasparente-documenti') {
		// posizione del primo file; per i documenti senza file, quella del testo
		let pos = (data.files ?? []).map((f) => docOrder.get(`${p.lang}|${data.anno}|${f}`)).filter(Boolean);
		if (!pos.length) pos = [docOrder.get(`${p.lang}|${data.anno}|body|${data.body}`)].filter(Boolean);
		data.order = pos.length ? Math.min(...pos) : 9999;
		const listed = [...(data.files ?? []).map((f) => `${p.lang}|${data.anno}|${f}`), `${p.lang}|${data.anno}|body|${data.body}`].map((k) => docCategory.get(k)).find(Boolean);
		// l'etichetta della pagina vale se è una categoria degli elenchi, altrimenti quella dell'elenco
		if (listed && !catIndex.has(`${p.lang}|${data.tipo}`)) data.tipo = listed;
		if (!listed) data.unlisted = true; // non compare negli elenchi di Società trasparente
	}
	if (type === 'certificazioni') {
		data.order = order.certificazioni.get(`${p.lang}|${data.file}`) ?? 999;
		if (data.order === 999) data.unlisted = true;
	}
	if (type === 'impianti') {
		const t = clean($('<div>').html(p.title).text());
		data.order = order.impianti.get(`${p.lang}|${t}`) ?? 999;
	}
	const file = `${coll}/${p.lang}/${keys.get(p.path)}.json`;
	if (out.has(file)) warn(p, `chiave duplicata ${file}`);
	out.set(file, data);
}

// Tassonomie
taxonomy.trasparenza.anni.sort();
taxonomy.trasparenza.annoCorrente = '2025';
// categorie usate da documenti ma assenti dagli elenchi: in coda, senza genitore
for (const [file, d] of out) {
	if (!file.startsWith('trasparenza/') || !d.tipo) continue;
	const lang = file.split('/')[1];
	if (!catIndex.has(`${lang}|${d.tipo}`)) catOrder[lang].push(addCategory(lang, d.tipo, null));
}
// Categorie con un id e le etichette nelle due lingue: le coppie IT/EN si ricavano dai documenti
// tradotti (stessa chiave), i genitori senza documenti dalla coppia dei figli.
// ---------------------------------------------------------------------------------------------
// Testi complessi → sezioni
// ---------------------------------------------------------------------------------------------
const isEmpty = ($, el) => !$(el).find('img,article,a,hr,br').length && !$(el).text().replace(/[\s ]/g, '');

/** Ripulisce un testo come lo salverebbe l'editor visuale: niente stili, classi, font o span vuoti. */
function cleanText(html) {
	const $ = cheerio.load(html, null, false);
	$('font, span').each((_, e) => {
		$(e).replaceWith($(e).contents());
	});
	$('[style]').removeAttr('style');
	$('[class]').removeAttr('class');
	$('p, h1, h2, h3, h4, h5, h6').each((_, e) => {
		if (isEmpty($, e)) $(e).remove();
	});
	// testo sciolto (es. &nbsp;) fuori dai paragrafi
	$.root().contents().each((_, n) => {
		if (n.type === 'text' && !n.data.replace(/[\s ]/g, '')) $(n).remove();
	});
	return $.html().replace(/(&nbsp;| )+</g, '<').replace(/>(&nbsp;| )+/g, '>').trim();
}

const after = (s) => clean(s.slice(s.indexOf(':') + 1)).replace(/^ | $/g, '').trim();

function organiGroup($, h, box) {
	const lists = box ? $(box).children('ul') : $(h).next('ul');
	const compatto = lists.length === 1 && (lists.hasClass('collegio') || lists.children('li').length === 1);
	let members;
	if (compatto) {
		members = lists.children('li').map((_, li) => {
			const t = clean($(li).text());
			const m = t.match(/^(.*?)\s*\(([^)]*)\)$/);
			return m ? { name: m[1], role: m[2] } : { name: t };
		}).get();
	} else {
		members = lists.map((_, ul) => {
			const m = {};
			$(ul).children('li').each((i, li) => {
				const t = clean($(li).text());
				if (i === 0) m.name = t;
				else if (/^email/i.test(t)) m.email = $(li).find('a').text().trim();
				else if (/^(nomina|nomination)/i.test(t)) m.nomina = after(t);
				else if (/^(compenso|compensation)/i.test(t)) m.compenso = after(t);
				else m.role = t;
			});
			return m;
		}).get();
	}
	return { title: clean($(h).text()), ...(box ? { riquadri: true } : {}), ...(compatto ? { compatto: true } : {}), members };
}

function toSezioni(html, lang) {
	const $ = cheerio.load(html, null, false);
	const out = [];
	let text = [];
	const flush = () => {
		const body = cleanText(text.join(''));
		if (body) {
			const centered = text.every((h) => /text-align:\s*center/.test(h) || !h.trim() || /^(&nbsp;|\s)*$/.test(cheerio.load(h, null, false).root().text()));
			out.push({ type: 'testo', body, ...(centered ? { centrato: true } : {}) });
		}
		text = [];
	};
	const push = (s) => {
		flush();
		const last = out.at(-1);
		if (s.type === 'allegati' && last?.type === 'allegati' && !!last.elenco === !!s.elenco) last.files.push(...s.files);
		else out.push(s);
	};
	const docs = (el) => $(el).find('article.media--type-document a').map((_, a) => fileHref($, a)).get();
	const nodes = $.root().contents().toArray();
	for (let i = 0; i < nodes.length; i++) {
		const n = nodes[i];
		const $n = $(n);
		if (n.type === 'tag' && isEmpty($, n) && !$n.is('hr,div.anchor-offset')) continue;
		if ($n.is('article.media--type-document')) push({ type: 'allegati', files: docs(n) });
		else if ($n.is('ul') && $n.find('article.media--type-document').length && $n.children('li').toArray().every((li) => $(li).find('article').length || isEmpty($, li)))
			push({ type: 'allegati', elenco: true, files: docs(n) });
		else if ($n.is('div.cke-ig')) push({ type: 'galleria', images: $n.find('img').map((_, im) => ({ src: decode($(im).attr('src')), ...($(im).attr('alt') ? { alt: $(im).attr('alt') } : {}) })).get() });
		else if ($n.is('div.mappa-contatti')) {
			const im = $n.find('img');
			const href = $n.children('a').attr('href');
			push({ type: 'immagine', image: { src: decode(im.attr('src')), ...(im.attr('alt') ? { alt: im.attr('alt') } : {}) }, ...(href ? { link: href } : {}) });
		} else if ($n.is('p.orari_impianto')) {
			$n.removeAttr('class');
			push({ type: 'riquadro', body: cleanText($.html(n)) });
		} else if ($n.is('div.wrapper-under-construction')) {
			push({ type: 'avviso', text: clean($n.text()), ...(/display:\s*none/.test($n.attr('style') ?? '') ? {} : { visibile: true }) });
		} else if ($n.is('div.anchor-offset')) {
			// organi societari: ancora, titolo, poi gruppi "h2.titolo_cdm" + schede
			const s = { type: 'organi', anchor: $n.attr('id'), title: '', groups: [] };
			let j = i + 1;
			if ($(nodes[j]).is('h2:not(.titolo_cdm)')) s.title = clean($(nodes[j++]).text());
			while ($(nodes[j]).is('h2.titolo_cdm')) {
				const h = nodes[j++];
				const box = $(nodes[j]).is('div.box_chi_siamo') ? nodes[j++] : null;
				if (!box) while ($(nodes[j]).is('ul.lista_chi_siamo')) j++;
				s.groups.push(organiGroup($, h, box));
			}
			push(s);
			i = j - 1;
		} else text.push(n.type === 'tag' || n.type === 'text' ? $.html(n) : '');
	}
	flush();
	return out;
}

const slugify = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function unify(lists, collection, field, parentOf) {
	const votes = new Map(); // en → Map(it → n)
	const byKey = new Map();
	for (const [file, d] of out) {
		const [coll, lang, key] = file.split('/');
		if (coll !== collection || !d[field]) continue;
		byKey.set(key, { ...byKey.get(key), [lang]: d[field] });
	}
	for (const v of byKey.values()) {
		if (!v.it || !v.en) continue;
		const m = votes.get(v.en) ?? new Map();
		m.set(v.it, (m.get(v.it) ?? 0) + 1);
		votes.set(v.en, m);
	}
	const enToIt = new Map([...votes].map(([en, m]) => [en, [...m].sort((a, b) => b[1] - a[1])[0][0]]));
	if (parentOf) {
		for (let changed = true; changed; ) {
			changed = false;
			for (const c of lists.en) {
				const it = enToIt.get(c.name);
				const itParent = it && parentOf.it.get(it);
				if (c.parent && itParent && !enToIt.has(c.parent)) {
					enToIt.set(c.parent, itParent);
					changed = true;
				}
			}
		}
	}
	const itToEn = new Map([...enToIt].map(([en, it]) => [it, en]));
	const items = [];
	const id = { it: new Map(), en: new Map() };
	for (const c of lists.it) {
		const item = { id: slugify(c.name), it: c.name, ...(itToEn.has(c.name) ? { en: itToEn.get(c.name) } : {}) };
		items.push(item);
		id.it.set(c.name, item.id);
		if (item.en) id.en.set(item.en, item.id);
	}
	for (const c of lists.en) {
		if (id.en.has(c.name)) continue;
		const item = { id: slugify(c.name), en: c.name };
		items.push(item);
		id.en.set(c.name, item.id);
	}
	if (parentOf) {
		for (const item of items) {
			const lang = item.it ? 'it' : 'en';
			const parent = parentOf[lang].get(item[lang]);
			if (parent) item.parent = id[lang].get(parent);
		}
	}
	return { items, id };
}

const catLists = { it: catOrder.it.map((c) => ({ name: c.name, parent: c.parent })), en: catOrder.en.map((c) => ({ name: c.name, parent: c.parent })) };
const parentOf = { it: new Map(catLists.it.map((c) => [c.name, c.parent])), en: new Map(catLists.en.map((c) => [c.name, c.parent])) };
const trasp = unify(catLists, 'trasparenza', 'tipo', parentOf);
taxonomy.trasparenza.categorie = trasp.items;

const tipiCert = { it: [], en: [] };
for (const p of pages.filter((p) => typeOf(p) === 'page')) {
	const $ = cheerio.load(p.html, null, false);
	$('.view-certificazioni-vista > h3').each((_, h) => {
		const n = clean($(h).text());
		if (!tipiCert[p.lang].some((t) => t.name === n)) tipiCert[p.lang].push({ name: n });
	});
}
// tipi usati solo da certificazioni non elencate
for (const [file, d] of out) {
	const [coll, lang] = file.split('/');
	if (coll === 'certificazioni' && !tipiCert[lang].some((t) => t.name === d.tipo)) tipiCert[lang].push({ name: d.tipo });
}
const cert = unify(tipiCert, 'certificazioni', 'tipo');
taxonomy.certificazioni.tipi = cert.items;

// Nei contenuti, i tipi diventano id
for (const [file, d] of out) {
	const [coll, lang] = file.split('/');
	if (coll === 'trasparenza' && d.tipo) d.tipo = trasp.id[lang].get(d.tipo);
	if (coll === 'certificazioni') d.tipo = cert.id[lang].get(d.tipo);
	for (const b of d.blocks ?? []) if (b.type === 'certificazioni') b.tipi = b.tipi.map((t) => cert.id[lang].get(t));
}
delete taxonomy.trasparenza.archivio; // anni prima dell'anno corrente

// I testi con markup che l'editor visuale non conserva (classi CSS, box, media, immagini, stili):
// nelle pagine diventano sezioni strutturate (allegati, galleria, organi societari...), negli altri
// contenuti si ripulisce il markup superfluo. Quello che resta non riconosciuto va in `bodyHtml`.
const COMPLEX = /class="|<div|style="|<article|<table|<iframe|<img|<font/;
for (const [file, d] of out) {
	if (typeof d.body !== 'string' || !COMPLEX.test(d.body)) continue;
	const [coll, lang] = file.split('/');
	if (coll === 'pagine') {
		d.sezioni = toSezioni(d.body, lang);
		delete d.body;
	} else d.body = cleanText(d.body);
	if (COMPLEX.test(d.body ?? '')) {
		warnings.push(`${file}: markup non strutturato, resta in bodyHtml`);
		d.bodyHtml = d.body;
		delete d.body;
	}
}

// Scrittura
for (const [file, data] of out) {
	const f = path.join(outDir, file);
	fs.mkdirSync(path.dirname(f), { recursive: true });
	// chiavi nell'ordine dei campi del CMS, così il primo salvataggio non riordina il file
	const { title, description, path: p, ...rest } = data;
	const ordered = { title, ...(description ? { description } : {}), ...(p ? { path: p } : {}), ...rest };
	fs.writeFileSync(f, JSON.stringify(ordered, null, '\t') + '\n');
}
fs.writeFileSync(path.join(outDir, 'tassonomie.json'), JSON.stringify(taxonomy, null, '\t') + '\n');
fs.writeFileSync(path.join(outDir, 'forms.json'), JSON.stringify(forms, null, '\t') + '\n');

const counts = {};
for (const f of out.keys()) counts[f.split('/')[0]] = (counts[f.split('/')[0]] ?? 0) + 1;
console.log('scritti', out.size, 'file', counts);
if (warnings.length) console.log('avvisi:\n  ' + warnings.join('\n  '));
