#!/usr/bin/env node
/**
 * Copia static/sites/default/files/** sul bucket R2 `gida-media` (giurisdizione EU) con le stesse chiavi
 * (sites/default/files/<percorso>), così i file restano raggiungibili su https://media.gida-spa.it/...
 *
 * Usa Wrangler con il login Cloudflare del browser (`npx wrangler login`): nessuna chiave nel terminale.
 * Salta i file già presenti con la stessa dimensione (controllo HEAD sul dominio pubblico), quindi si
 * può rilanciare senza ricaricare tutto.
 *
 *   node scripts/upload-r2.mjs            # carica
 *   node scripts/upload-r2.mjs --dry-run  # mostra cosa caricherebbe
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const BUCKET = 'gida-media';
const JURISDICTION = 'eu';
const PUBLIC_URL = 'https://media.gida-spa.it';
const ROOT = 'static';
const DIR = 'sites/default/files';
const CONCURRENCY = 4;
const dryRun = process.argv.includes('--dry-run');

const TYPES = {
	pdf: 'application/pdf',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
	gif: 'image/gif',
	webp: 'image/webp',
	svg: 'image/svg+xml',
	ico: 'image/x-icon',
	xml: 'application/xml',
	xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	xls: 'application/vnd.ms-excel',
	docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	doc: 'application/msword',
	zip: 'application/zip',
	txt: 'text/plain; charset=utf-8'
};

const walk = (dir) =>
	fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const p = path.join(dir, e.name);
		return e.isDirectory() ? walk(p) : e.isFile() && !e.name.startsWith('.') ? [p] : [];
	});

const keyOf = (file) => path.relative(ROOT, file).split(path.sep).join('/');
const publicUrl = (key) => `${PUBLIC_URL}/${key.split('/').map(encodeURIComponent).join('/')}`;

async function alreadyThere(key, size) {
	try {
		const res = await fetch(publicUrl(key), { method: 'HEAD' });
		return res.ok && Number(res.headers.get('content-length')) === size;
	} catch {
		return false;
	}
}

function put(file, key) {
	const ext = path.extname(file).slice(1).toLowerCase();
	const args = ['wrangler@4', 'r2', 'object', 'put', `${BUCKET}/${key}`, '--file', file, '--remote', '--jurisdiction', JURISDICTION];
	if (TYPES[ext]) args.push('--content-type', TYPES[ext]);
	return new Promise((resolve) => {
		const child = spawn('npx', ['-y', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
		let err = '';
		child.stderr.on('data', (d) => (err += d));
		child.on('close', (code) => resolve(code === 0 ? null : err.trim().split('\n').slice(-3).join(' ')));
	});
}

const files = walk(path.join(ROOT, DIR));
let done = 0, skipped = 0;
const failed = [];
const queue = [...files];

async function worker() {
	for (let file; (file = queue.shift()); ) {
		const key = keyOf(file);
		const { size } = fs.statSync(file);
		if (await alreadyThere(key, size)) {
			skipped++;
			continue;
		}
		if (dryRun) {
			console.log('da caricare:', key);
			continue;
		}
		const error = await put(file, key);
		if (error) failed.push(`${key}: ${error}`);
		else console.log(`[${++done}] ${key}`);
	}
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`\nFile: ${files.length}, caricati: ${done}, già presenti: ${skipped}, errori: ${failed.length}`);
for (const f of failed) console.error('ERRORE', f);
process.exit(failed.length ? 1 : 0);
