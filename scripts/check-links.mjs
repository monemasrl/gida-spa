#!/usr/bin/env node
// Verifica che ogni link/risorsa interna delle pagine HTML e ogni url() dei CSS esista nell'output.
import fs from 'node:fs';
import path from 'node:path';
const dir = path.resolve(process.argv[2] ?? 'build');
const htmlFiles = [];
const cssFiles = [];
(function walk(d) {
	for (const e of fs.readdirSync(d, { withFileTypes: true })) {
		const p = path.join(d, e.name);
		if (e.isDirectory()) walk(p);
		else if (e.name.endsWith('.html')) htmlFiles.push(p);
		else if (e.name.endsWith('.css') && !p.includes(`${path.sep}_app${path.sep}`)) cssFiles.push(p);
	}
})(dir);
const exists = (u) => {
	let p = decodeURIComponent(u.split('#')[0].split('?')[0]);
	if (p === '/') p = '/index';
	const f = path.join(dir, p);
	return fs.existsSync(f) && fs.statSync(f).isFile() || fs.existsSync(f + '.html');
};
const missing = new Map();
for (const f of htmlFiles) {
	const html = fs.readFileSync(f, 'utf8');
	for (const [, u] of html.matchAll(/(?:href|src)="(\/[^"/][^"]*|\/)"/g)) {
		if (u.startsWith('/_app/') || u.startsWith('//')) continue;
		if (!exists(u.replaceAll('&amp;', '&'))) {
			if (!missing.has(u)) missing.set(u, new Set());
			missing.get(u).add('/' + path.relative(dir, f).replace(/\.html$/, ''));
		}
	}
}
for (const f of cssFiles) {
	const css = fs.readFileSync(f, 'utf8');
	for (const [, u] of css.matchAll(/url\(\s*["']?(\/[^"')\s]+)["']?\s*\)/g)) {
		if (!exists(u)) {
			if (!missing.has(u)) missing.set(u, new Set());
			missing.get(u).add('/' + path.relative(dir, f));
		}
	}
}
console.log(`${htmlFiles.length} pagine, ${cssFiles.length} CSS, ${missing.size} link interni non risolti`);
for (const [u, from] of missing) console.log(' ', u, '←', [...from].slice(0, 3).join(', '), from.size > 3 ? `(+${from.size - 3})` : '');
process.exitCode = missing.size ? 1 : 0;
