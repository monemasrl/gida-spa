#!/usr/bin/env node
/**
 * Importa il mirror HTML del sito Drupal (www.gida-spa.it) e genera i contenuti
 * statici usati da SvelteKit.
 *
 *   node scripts/import-drupal.mjs <mirror-dir>
 *
 * <mirror-dir> deve contenere:
 *   pages/   un file .html per pagina (nome = path con "/" → "__", home = "_index")
 *   assets/  copia di /sites/default/files e /themes/... (stessa struttura degli URL)
 *
 * Output:
 *   <mirror-dir>/import/pages/*.json   una pagina per file (metadati + HTML del contenuto),
 *                                     da convertire con scripts/structure-content.mjs
 *   src/content/layout.json    menu, footer e top-bar per lingua
 *   static/css/drupal.css      unione (deduplicata) dei bundle CSS di Drupal
 */
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import postcss from 'postcss';

const mirror = process.argv[2];
if (!mirror) {
	console.error('Uso: node scripts/import-drupal.mjs <mirror-dir>');
	process.exit(1);
}
const ROOT = path.resolve(import.meta.dirname, '..');
// HTML ripulito di ogni pagina: è l'input di scripts/structure-content.mjs (non va nel repo)
const OUT_PAGES = path.join(mirror, 'import/pages');
const ORIGIN = 'https://www.gida-spa.it';

// ---------------------------------------------------------------- helpers

const fileToPath = (f) => {
	const base = f.replace(/\.html$/, '');
	return base === '_index' ? '/' : '/' + base.split('__').join('/');
};
const pathToSlug = (p) => (p === '/' ? '_index' : p.slice(1).split('/').join('__'));
const langOf = (p) => (p === '/en' || p.startsWith('/en/') ? 'en' : 'it');

/** Decodifica gli indirizzi offuscati da Cloudflare (data-cfemail / #hex). */
function cfDecode(hex) {
	const key = parseInt(hex.slice(0, 2), 16);
	let out = '';
	for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
	try {
		return decodeURIComponent(escape(out));
	} catch {
		return out;
	}
}

// ---------------------------------------------------------------- pass 1: indice

const pageFiles = fs.readdirSync(path.join(mirror, 'pages')).filter((f) => f.endsWith('.html'));
const docs = new Map(); // path -> cheerio
const nodeIdToPath = { it: {}, en: {} };

for (const f of pageFiles) {
	const p = fileToPath(f);
	const html = fs.readFileSync(path.join(mirror, 'pages', f), 'utf8');
	// pagine non trovate / vuote
	if (html.length < 1000 || /(^|\/)node(\/\d+)?$/.test(p)) continue;
	const $ = cheerio.load(html);
	docs.set(p, $);
	const nid = $('#it-block-italiagov-content article[data-history-node-id]').first().attr('data-history-node-id');
	if (nid) nodeIdToPath[langOf(p)][nid] = p;
}
nodeIdToPath.it['1'] ??= '/';
const known = new Set(docs.keys());

/** Link interni da correggere (404 su Drupal o percorsi di sistema). */
const linkFixes = {
	'/home': '/',
	'/node': '/',
	'/en/node': '/en',
	'/purification': '/depurazione',
	// link rotti già sul sito originale
	'/en/liquid-waste-treatment-rubber': '/en/liquid-waste-treatment-road',
	'/en/trasparent-company': '/en/transparent-company'
};

function fixHref(href, lang) {
	if (!href) return href;
	if (href.startsWith(ORIGIN)) href = href.slice(ORIGIN.length) || '/';
	if (!href.startsWith('/') || href.startsWith('//')) return href;
	if (href.startsWith('/sites/') || href.startsWith('/themes/')) return href;
	const [p, hash] = href.split('#');
	if (linkFixes[p]) return linkFixes[p] + (hash ? '#' + hash : '');
	const m = p.match(/^(\/en)?\/node\/(\d+)$/);
	if (m) {
		const l = m[1] ? 'en' : 'it';
		return nodeIdToPath[l][m[2]] ?? nodeIdToPath[lang][m[2]] ?? (l === 'en' ? '/en' : '/');
	}
	return href;
}

// ---------------------------------------------------------------- pulizia HTML

function clean($, $root, lang) {
	$root.find('script, noscript, #simple-translate, .simple-translate-light-theme').remove();
	$root.find('.rdf-meta, footer.node__meta, .it-local-tasks_wrapper, .it-help__wrapper, .it-notification__wrapper').remove();
	$root.find('[data-drupal-messages-fallback]').remove();
	// "Torna su": lo gestisce il layout
	$root.find('[data-attribute="back-to-top"]').remove();

	// email offuscate da Cloudflare
	$root.find('[data-cfemail]').each((_, el) => {
		const email = cfDecode($(el).attr('data-cfemail'));
		const $el = $(el);
		if (el.tagName === 'a') {
			$el.attr('href', 'mailto:' + email).removeAttr('data-cfemail').removeClass('__cf_email__').text(email);
		} else {
			$el.replaceWith(email);
		}
	});
	$root.find('a[href^="/cdn-cgi/l/email-protection"]').each((_, el) => {
		const href = $(el).attr('href');
		const hex = href.split('#')[1];
		if (hex) $(el).attr('href', 'mailto:' + cfDecode(hex));
		else {
			const t = $(el).text().trim();
			if (t.includes('@')) $(el).attr('href', 'mailto:' + t);
		}
	});

	// termini di tassonomia: in Drupal sono pagine di elenco generiche, qui testo semplice
	$root.find('a[href*="/taxonomy/term/"]').each((_, el) => {
		$(el).replaceWith(`<span class="taxonomy-term">${$(el).html()}</span>`);
	});

	$root.find('a[href]').each((_, el) => {
		$(el).attr('href', fixHref($(el).attr('href'), lang));
	});

	// attributi specifici di Drupal / RDF
	$root.find('*').each((_, el) => {
		for (const a of Object.keys(el.attribs ?? {})) {
			if (/^data-(drupal|history|entity|quickedit|off-canvas)/.test(a) || ['about', 'typeof', 'property', 'datatype', 'block', 'hreflang'].includes(a)) {
				$(el).removeAttr(a);
			}
		}
	});
	$root.find('.js-quickedit-main-content').removeClass('js-quickedit-main-content');
	return $root;
}

/**
 * Mantiene il markup originale dei form Drupal (classi/id da cui dipende il CSS di Bootstrap Italia),
 * ma lo rende indipendente da Drupal: niente campi nascosti, nomi dei campi semplificati,
 * invio a /api/form. Ne estrae anche la definizione usata dal server per validare.
 */
function extractForms($, $root) {
	const forms = [];
	$root.find('form').each((i, form) => {
		const $f = $(form);
		const fields = [];
		$f.find('input[type="hidden"]').remove();
		$f.find('input, textarea, select').each((_, el) => {
			const $el = $(el);
			const type = el.tagName === 'textarea' ? 'textarea' : ($el.attr('type') ?? 'text');
			const name = $el.attr('name');
			if (type === 'submit') {
				$el.removeAttr('name');
				return;
			}
			if (!name) return;
			const simple = name.replace(/^field_/, '').replace(/\[.*$/, '');
			$el.attr('name', simple);
			if (type === 'checkbox') $el.attr('value', 'true');
			const id = $el.attr('id');
			const $label = $f.find(`label[for="${id}"]`);
			const desc = $f.find(`#${id}--description`).html()?.trim();
			fields.push({
				name: simple,
				type,
				label: $label.text().trim(),
				required: $el.is('[required]'),
				...(desc ? { description: desc } : {})
			});
		});
		const submit = $f.find('[type="submit"]').first().attr('value') ?? 'Invia';
		const id = ($f.attr('id') ?? `form-${i}`).replace(/^contact-message-/, '').replace(/-form$/, '');
		forms.push({ id, fields, submit });
		$f.attr({ action: '/api/form', method: 'post', 'data-gida-form': id });
	});
	return forms;
}

// ---------------------------------------------------------------- pass 2: pagine

fs.rmSync(OUT_PAGES, { recursive: true, force: true });
fs.mkdirSync(OUT_PAGES, { recursive: true });

const layout = { it: null, en: null };
let count = 0;

for (const [p, $] of docs) {
	const lang = langOf(p);
	const $header = $('header.it-header-wrapper').first();
	const $footer = $('footer.it-footer').first();

	// contenuto = tutto ciò che sta fra header e footer
	const $content = $('<div></div>');
	$header.nextUntil('footer.it-footer').each((_, el) => $content.append($(el).clone()));
	clean($, $content, lang);
	const forms = extractForms($, $content);

	const alternates = {};
	$('link[rel="alternate"][hreflang]').each((_, el) => {
		const h = $(el).attr('href').replace(ORIGIN, '') || '/';
		if (known.has(h)) alternates[$(el).attr('hreflang')] = h;
	});
	if (!alternates.it && !alternates.en) {
		// fallback: link del selettore di lingua
		const sw = $('.dropdown-language-item a.language-link').attr('href');
		const target = sw && fixHref(sw, lang);
		if (target && known.has(target)) alternates[langOf(target)] = target;
		alternates[lang] = p;
	}

	const title = $('title').text().replace(/\s*\|\s*gida\s*$/i, '').trim();
	const page = {
		path: p,
		lang,
		title,
		description: $('meta[name="description"]').attr('content') ?? '',
		bodyClass: ($('body').attr('class') ?? '').replace(/\buser-anonymous\b/, '').trim(),
		wrapperId: $('#page-front').length ? 'page-front' : 'page-default',
		alternates,
		forms,
		html: $content.html().replace(/\s{2,}/g, ' ').trim()
	};
	fs.writeFileSync(path.join(OUT_PAGES, pathToSlug(p) + '.json'), JSON.stringify(page, null, '\t'));
	count++;

	// layout (header/footer) preso dalla home di ciascuna lingua
	if ((p === '/' || p === '/en') && !layout[lang]) {
		const $h = $header.clone();
		const $ft = $footer.clone();
		clean($, $h, lang);
		clean($, $ft, lang);
		const link = (el) => ({ label: $(el).text().trim(), href: $(el).attr('href') });
		layout[lang] = {
			topInfo: $h.find('#it-block-topmenuinfo .field__item').html()?.trim() ?? '',
			topMenu: $h.find('.menu--topmenu a').map((_, el) => link(el)).get(),
			logo: $h.find('.block-system-branding-block img').attr('src'),
			mainMenu: $h
				.find('.navbar-nav > li')
				.map((_, li) => {
					const $a = $(li).children('a');
					const children = $(li).find('.dropdown-menu a').map((_, el) => link(el)).get();
					return { label: $a.text().trim(), href: $a.attr('href') || null, children };
				})
				.get(),
			footer: $.html($ft).replace(/\s{2,}/g, ' ').trim()
		};
	}
}
fs.writeFileSync(path.join(ROOT, 'src/content/layout.json'), JSON.stringify(layout, null, '\t'));
console.log(`Pagine importate: ${count}`);

// ---------------------------------------------------------------- CSS

const cssDir = path.join(mirror, 'assets/sites/default/files/css');
if (fs.existsSync(cssDir)) {
	// ordine: bundle più usati prima (core Drupal, poi tema), poi le varianti
	const usage = {};
	for (const [, $] of docs)
		$('link[rel="stylesheet"][href*="/files/css/"]').each((i, el) => {
			const f = path.basename($(el).attr('href').split('?')[0]);
			usage[f] ??= { n: 0, pos: i };
			usage[f].n++;
		});
	const files = Object.keys(usage).sort((a, b) => usage[a].pos - usage[b].pos || usage[b].n - usage[a].n);
	const seen = new Set();
	const out = postcss.root();
	for (const f of files) {
		const root = postcss.parse(fs.readFileSync(path.join(cssDir, f), 'utf8'));
		root.each((node) => {
			const key = node.toString();
			if (seen.has(key)) return;
			seen.add(key);
			out.append(node.clone());
		});
	}
	fs.mkdirSync(path.join(ROOT, 'static/css'), { recursive: true });
	fs.writeFileSync(path.join(ROOT, 'static/css/drupal.css'), out.toString());
	console.log(`CSS: ${files.length} bundle → static/css/drupal.css (${(out.toString().length / 1024).toFixed(0)} KB)`);
}
