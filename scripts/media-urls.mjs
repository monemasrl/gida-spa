#!/usr/bin/env node
/**
 * Riscrive nei contenuti (src/content/**.json) i percorsi /sites/default/files/... con l'URL dei file
 * su Cloudflare R2 (https://media.gida-spa.it/sites/default/files/...), anche dentro l'HTML dei testi.
 * Da rilanciare dopo un re-import da Drupal (`npm run import` / `npm run structure`), che produce
 * percorsi relativi. Idempotente.
 *
 *   node scripts/media-urls.mjs [dir contenuti=src/content]
 */
import fs from 'node:fs';
import path from 'node:path';

const MEDIA_URL = 'https://media.gida-spa.it';
const dir = process.argv[2] ?? 'src/content';

// "/sites/default/files/" non preceduto da un host o da altro percorso
const RE = /(?<![\w.:/-])\/sites\/default\/files\//g;

let files = 0;
let refs = 0;
(function walk(d) {
	for (const e of fs.readdirSync(d, { withFileTypes: true })) {
		const p = path.join(d, e.name);
		if (e.isDirectory()) walk(p);
		else if (e.name.endsWith('.json')) {
			const text = fs.readFileSync(p, 'utf8');
			const n = text.match(RE)?.length ?? 0;
			if (!n) continue;
			fs.writeFileSync(p, text.replace(RE, `${MEDIA_URL}/sites/default/files/`));
			files++;
			refs += n;
		}
	}
})(dir);
console.log(`${refs} percorsi riscritti in ${files} file`);
