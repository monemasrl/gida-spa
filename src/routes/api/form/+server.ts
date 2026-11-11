import { json } from '@sveltejs/kit';
import { PROCMAIL_API_URL, PROCMAIL_API_KEY, FORM_FROM, FORM_TO } from '$app/env/private';
import { validateToken } from '#lib/server/cap.ts';
import { pages } from '#lib/content.server.ts';
import type { FormDef } from '#lib/types.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

/**
 * POST /api/form — riceve i form del sito, verifica Cap e invia l'email tramite procmail.sh.
 *
 * Variabili d'ambiente (Vercel → Settings → Environment Variables):
 *   PROCMAIL_API_KEY   chiave API procmail (secret)
 *   PROCMAIL_API_URL   default https://api-eu.procmail.sh
 *   FORM_FROM          mittente su un dominio abilitato all'invio su procmail
 *   FORM_TO            destinatari, separati da virgola (default gida@gida-spa.it)
 */

// Definizioni dei form ricavate dai contenuti importati (le etichette italiane vanno nell'email)
const FORMS = new Map<string, FormDef>();
for (const p of [...pages.values()].sort((a) => (a.lang === 'it' ? -1 : 1))) {
	for (const f of p.forms) if (!FORMS.has(f.id)) FORMS.set(f.id, f);
}

const SUBJECTS: Record<string, string> = {
	'form-contatti': 'Nuovo messaggio dal sito — Contatti',
	scuole: 'Richiesta visita guidata — GIDA nelle scuole'
};

const MAX_LEN = { textarea: 5000, default: 255 } as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MSG = {
	it: { required: 'Campo obbligatorio', email: 'Indirizzo email non valido', long: 'Testo troppo lungo', cap: 'Verifica anti-spam non riuscita, riprova' },
	en: { required: 'Required field', email: 'Invalid email address', long: 'Text too long', cap: 'Anti-spam check failed, please retry' }
};

const escapeHtml = (s: string) =>
	s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const POST: RequestHandler = async ({ request, url }) => {
	let data: FormData;
	try {
		data = await request.formData();
	} catch {
		return json({ ok: false, error: 'invalid_body' }, { status: 400 });
	}
	const lang = data.get('_lang') === 'en' ? 'en' : 'it';
	const t = MSG[lang];

	const def = FORMS.get(String(data.get('_form') ?? ''));
	if (!def) return json({ ok: false, error: 'unknown_form' }, { status: 400 });

	// 1. Cap: token firmato e non scaduto (vedi #lib/server/cap.ts)
	const capToken = String(data.get('cap-token') ?? '');
	if (!validateToken(capToken)) {
		return json({ ok: false, error: 'captcha', errors: { 'cap-token': t.cap } }, { status: 403 });
	}

	// 2. Validazione campi
	const errors: Record<string, string> = {};
	const rows: [string, string][] = [];
	let replyTo: string | undefined;
	for (const f of def.fields) {
		const raw = data.get(f.name);
		const v = typeof raw === 'string' ? raw.trim() : '';
		if (f.type === 'checkbox') {
			if (f.required && v !== 'true') errors[f.name] = t.required;
			continue;
		}
		if (f.required && !v) errors[f.name] = t.required;
		else if (v.length > (f.type === 'textarea' ? MAX_LEN.textarea : MAX_LEN.default)) errors[f.name] = t.long;
		else if (f.type === 'email' && v && !EMAIL_RE.test(v)) errors[f.name] = t.email;
		if (f.type === 'email' && v) replyTo = v;
		rows.push([f.label, v]);
	}
	if (Object.keys(errors).length) return json({ ok: false, errors }, { status: 422 });

	// 3. Invio tramite procmail
	if (!PROCMAIL_API_KEY || !FORM_FROM) {
		console.error('[form] PROCMAIL_API_KEY o FORM_FROM non configurati');
		return json({ ok: false, error: 'not_configured' }, { status: 503 });
	}
	const page = String(data.get('_page') ?? '').slice(0, 300);
	const source = new URL(page || '/', url.origin).href;
	const text = rows.map(([k, v]) => `${k}:\n${v}`).join('\n\n') + `\n\n—\nInviato dal modulo ${source}`;
	const html =
		`<table cellpadding="8" style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse">` +
		rows
			.map(([k, v]) => `<tr><th align="left" valign="top" style="border-bottom:1px solid #eee">${escapeHtml(k)}</th><td style="border-bottom:1px solid #eee">${escapeHtml(v).replace(/\n/g, '<br>')}</td></tr>`)
			.join('') +
		`</table><p style="color:#888;font-size:12px;font-family:Arial,sans-serif">Inviato dal modulo <a href="${escapeHtml(source)}">${escapeHtml(source)}</a></p>`;

	const api = PROCMAIL_API_URL.replace(/\/+$/, '');
	const res = await fetch(`${api}/v1/emails`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${PROCMAIL_API_KEY}`,
			'Content-Type': 'application/json',
			...(request.headers.get('Idempotency-Key') ? { 'Idempotency-Key': request.headers.get('Idempotency-Key')! } : {})
		},
		body: JSON.stringify({
			from: FORM_FROM,
			to: FORM_TO,
			...(replyTo ? { reply_to: replyTo } : {}),
			subject: SUBJECTS[def.id] ?? `Nuovo messaggio dal sito (${def.id})`,
			text,
			html,
			headers: { 'X-Gida-Form': def.id }
		})
	});
	if (!res.ok) {
		console.error('[form] procmail', res.status, (await res.text()).slice(0, 500));
		return json({ ok: false, error: 'send_failed' }, { status: 502 });
	}
	return json({ ok: true });
};
