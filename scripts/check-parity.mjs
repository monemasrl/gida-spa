#!/usr/bin/env node
/**
 * Confronta le pagine rigenerate dai contenuti strutturati con l'HTML originale importato da Drupal.
 * Uso: node scripts/check-parity.mjs <dir pagine originali> [dir contenuti=src/content] [--verbose]
 */
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { imageSize } from 'image-size';
import { buildSite } from '../src/lib/site.ts';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const verbose = process.argv.includes('--verbose');
const [origDir, contentDir = 'src/content'] = args;

const raw = {};
(function walk(dir) {
	for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, f.name);
		if (f.isDirectory()) walk(full);
		else if (f.name.endsWith('.json')) raw[path.relative(contentDir, full)] = JSON.parse(fs.readFileSync(full, 'utf8'));
	}
})(contentDir);
const dims = (src) => {
	try {
		const { width, height } = imageSize(fs.readFileSync(path.join('static', src)));
		return { width, height };
	} catch {
		return undefined;
	}
};
const { pages } = buildSite(raw, dims);

/** Forma canonica: spazi normalizzati, URL decodificati, id variabili rimossi. */
function canon(html) {
	const $ = cheerio.load(html, null, false);
	$('[class*="js-view-dom-id-"]').each((_, e) => $(e).attr('class', $(e).attr('class').replace(/js-view-dom-id-\S+/, 'js-view-dom-id')));
	$('[id^="faqfield_"]').attr('id', 'faqfield');
	$('[href],[src]').each((_, e) => {
		for (const a of ['href', 'src']) {
			let v = $(e).attr(a);
			if (v == null) continue;
			try {
				v = decodeURI(v);
			} catch {}
			$(e).attr(a, v.replace(/freccia_\d\.png$/, 'freccia.png'));
		}
	});
	const out = [];
	const walk = (nodes, depth) => {
		for (const n of nodes) {
			if (n.type === 'text') {
				const t = n.data.replace(/\s+/g, ' ').trim();
				if (t) out.push('  '.repeat(depth) + JSON.stringify(t.replace(/ /g, ' ')));
			} else if (n.type === 'tag') {
				const attrs = Object.entries(n.attribs).sort().map(([k, v]) => `${k}=${JSON.stringify(v.replace(/\s+/g, ' ').trim())}`).join(' ');
				out.push('  '.repeat(depth) + `<${n.name} ${attrs}>`);
				walk(n.children, depth + 1);
			}
		}
	};
	walk($.root().children().toArray().length ? $.root()[0].children : [], 0);
	return out;
}

let ok = 0;
const failures = [];
const orig = fs.readdirSync(origDir).map((f) => JSON.parse(fs.readFileSync(path.join(origDir, f), 'utf8')));
for (const o of orig) {
	const p = pages.get(o.path);
	if (!p) {
		failures.push({ path: o.path, msg: 'pagina mancante' });
		continue;
	}
	const issues = [];
	for (const k of ['title', 'description', 'bodyClass', 'wrapperId', 'lang']) if ((p[k] ?? '') !== (o[k] ?? '')) issues.push(`${k}: ${JSON.stringify(o[k])} → ${JSON.stringify(p[k])}`);
	for (const [l, h] of Object.entries(o.alternates)) if (p.alternates[l] !== h) issues.push(`alternates.${l}: ${h} → ${p.alternates[l]}`);
	if (JSON.stringify(o.forms.map((f) => f.id)) !== JSON.stringify(p.forms.map((f) => f.id))) issues.push('forms');
	const a = canon(o.html), b = canon(p.html);
	const i = a.findIndex((x, j) => x !== b[j]);
	if (i >= 0 || a.length !== b.length) {
		const at = i >= 0 ? i : Math.min(a.length, b.length);
		issues.push(`html differente alla riga ${at}:\n      originale: ${a.slice(Math.max(0, at - 2), at + 3).join('\n                 ')}\n      generato:  ${b.slice(Math.max(0, at - 2), at + 3).join('\n                 ')}`);
	}
	if (issues.length) failures.push({ path: o.path, msg: issues.join('\n    ') });
	else ok++;
}
const extra = [...pages.keys()].filter((k) => !orig.some((o) => o.path === k));
console.log(`${ok}/${orig.length} pagine identiche, ${failures.length} diverse, ${extra.length} in più${extra.length ? ': ' + extra.join(' ') : ''}`);
for (const f of verbose ? failures : failures.slice(0, 8)) console.log(`\n✗ ${f.path}\n    ${f.msg}`);
process.exitCode = failures.length ? 1 : 0;
