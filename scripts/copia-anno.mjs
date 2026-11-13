#!/usr/bin/env node
/**
 * Copia i documenti di Società trasparente da un anno a un altro, in tutte le lingue:
 *   node scripts/copia-anno.mjs 2025 2026
 *
 * Per ogni documento in src/content/trasparenza/<lingua>/<da>/ crea <lingua>/<a>/<nome>.json:
 * - nome del file, `path` e titolo: l'anno <da> diventa <a>; se il nome o il percorso non contengono l'anno,
 *   gli si aggiunge `-<a>` (i percorsi devono restare unici in tutto il sito);
 * - testo, categoria, ordine, visibilità e file restano identici (i file vanno poi sostituiti dal CMS).
 * I documenti già presenti nell'anno di destinazione non vengono toccati.
 * Usato dalla GitHub Action "Copia anno di Società trasparente" (.github/workflows/copia-anno.yml).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CONTENT = 'src/content';
const BASE = join(CONTENT, 'trasparenza');
const [da, a] = process.argv.slice(2);

const fail = (msg) => {
	console.error(`Errore: ${msg}`);
	process.exit(1);
};
if (!/^\d{4}$/.test(da ?? '') || !/^\d{4}$/.test(a ?? '')) fail('uso: node scripts/copia-anno.mjs <anno-da> <anno-a> (anni a quattro cifre)');
if (da === a) fail("l'anno di partenza e quello nuovo coincidono");

const langs = readdirSync(BASE).filter((l) => existsSync(join(BASE, l, da)));
if (!langs.length) fail(`nessun documento per il ${da}`);

const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));
const listJson = (dir) =>
	readdirSync(dir, { recursive: true, withFileTypes: true })
		.filter((d) => d.isFile() && d.name.endsWith('.json'))
		.map((d) => join(d.parentPath, d.name));

// Percorsi già usati nel sito (pagine, news, impianti, certificazioni, trasparenza), come li calcola src/lib/site.ts
const defaultPath = (lang, name) => (lang === 'en' ? `/en/${name}` : `/${name}`);
const used = new Set();
for (const coll of ['pagine', 'news', 'impianti', 'certificazioni', 'trasparenza']) {
	const dir = join(CONTENT, coll);
	if (!existsSync(dir)) continue;
	for (const lang of readdirSync(dir)) {
		for (const f of listJson(join(dir, lang))) {
			const name = f.split('/').pop().replace(/\.json$/, '');
			used.add(readJson(f).path || defaultPath(lang, name));
		}
	}
}

/** Sostituisce l'anno, o aggiunge `-<a>` in fondo se non c'è. */
const withYear = (s) => (s.includes(da) ? s.replaceAll(da, a) : `${s}-${a}`);

// Prima si calcola tutto, poi si scrive: se c'è un conflitto non si crea nessun file
const plan = [];
const skipped = [];
const errors = [];
for (const lang of langs) {
	for (const file of readdirSync(join(BASE, lang, da)).filter((f) => f.endsWith('.json'))) {
		const name = file.replace(/\.json$/, '');
		const newName = withYear(name);
		const target = join(BASE, lang, a, `${newName}.json`);
		if (existsSync(target)) {
			skipped.push(`${lang}/${a}/${newName}`);
			continue;
		}
		const doc = readJson(join(BASE, lang, da, file));
		const copy = { ...doc, title: doc.title.replaceAll(da, a) };
		// Senza `path` il percorso è quello del nome del file, che cambia già da solo
		if (doc.path) copy.path = withYear(doc.path);
		const path = copy.path || defaultPath(lang, newName);
		if (used.has(path)) errors.push(`${lang}/${da}/${name}: il percorso ${path} esiste già`);
		used.add(path);
		plan.push({ target, copy, label: `${lang}/${da}/${name} → ${lang}/${a}/${newName} (${path})` });
	}
}
if (errors.length) fail(`nessun file creato, percorsi in conflitto:\n  ${errors.join('\n  ')}`);

for (const { target, copy, label } of plan) {
	mkdirSync(join(target, '..'), { recursive: true });
	writeFileSync(target, JSON.stringify(copy, null, '\t') + '\n');
	console.log(label);
}
if (skipped.length) console.log(`Già presenti, non toccati: ${skipped.join(', ')}`);
console.log(`Copiati ${plan.length} documenti dal ${da} al ${a}.`);
