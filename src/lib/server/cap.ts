import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { CAP_SECRET } from '$app/env/private';
import { dev } from '$app/env';

/**
 * Cap (https://trycap.dev) in versione *stateless*, compatibile con il widget @cap.js/widget.
 *
 * Il protocollo di Cap:
 *   1. POST /challenge → { challenge: {c, s, d}, token, expires }
 *      Il browser ricava salt e target di ogni sotto-challenge da prng(token + i), quindi il
 *      token è l'unico "stato" della challenge.
 *   2. POST /redeem { token, solutions[] } → verifica sha256(salt + solution).startsWith(target)
 *      e restituisce un token di verifica, che il form invia al server.
 *
 * Invece di salvare token e challenge (Redis), qui i token sono firmati con HMAC e contengono
 * la scadenza: il server li verifica senza memorizzare nulla.
 * Limite noto: un token valido può essere riusato fino alla scadenza (TTL brevi qui sotto).
 * Come attenuazione, ogni istanza ricorda i token già usati (le Function Vercel riusano le istanze).
 */

const CHALLENGE = { c: 50, s: 32, d: 4 } as const; // 50 sotto-challenge, salt 32 hex, target 4 hex
const CHALLENGE_TTL = 5 * 60_000;
const TOKEN_TTL = 5 * 60_000;

// In sviluppo, senza CAP_SECRET, si usa un segreto casuale per processo
const secret = CAP_SECRET ?? (dev ? randomBytes(32).toString('hex') : undefined);

function sign(kind: 'c' | 't', payload: string): string {
	if (!secret) throw new Error('CAP_SECRET non configurato');
	return createHmac('sha256', secret).update(`${kind}|${payload}`).digest('base64url');
}

function verifySig(kind: 'c' | 't', payload: string, sig: string): boolean {
	const expected = Buffer.from(sign(kind, payload));
	const given = Buffer.from(sig);
	return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Token firmato: `<expires>.<nonce>.<firma>` */
function issue(kind: 'c' | 't', ttl: number) {
	const expires = Date.now() + ttl;
	const payload = `${expires}.${randomBytes(12).toString('hex')}`;
	return { token: `${payload}.${sign(kind, payload)}`, expires };
}

function check(kind: 'c' | 't', token: unknown): boolean {
	if (typeof token !== 'string' || token.length > 200) return false;
	const parts = token.split('.');
	if (parts.length !== 3) return false;
	const [exp, nonce, sig] = parts;
	const expires = Number(exp);
	if (!Number.isFinite(expires) || expires < Date.now()) return false;
	return verifySig(kind, `${exp}.${nonce}`, sig);
}

/** PRNG deterministico di Cap (FNV-1a + xorshift), identico a @cap.js/server e al widget. */
function prng(seed: string, length: number): string {
	let hash = 2166136261;
	for (let i = 0; i < seed.length; i++) {
		hash ^= seed.charCodeAt(i);
		hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
	}
	let state = hash >>> 0;
	let out = '';
	while (out.length < length) {
		state ^= state << 13;
		state ^= state >>> 17;
		state ^= state << 5;
		out += (state >>> 0).toString(16).padStart(8, '0');
	}
	return out.substring(0, length);
}

// Token già usati in questa istanza (best effort, si svuota con le scadenze)
const used = new Map<string, number>();
function markUsed(token: string): boolean {
	const now = Date.now();
	for (const [k, exp] of used) if (exp < now) used.delete(k);
	if (used.has(token)) return false;
	used.set(token, Number(token.split('.')[0]));
	return true;
}

export function createChallenge() {
	const { token, expires } = issue('c', CHALLENGE_TTL);
	return { challenge: { ...CHALLENGE }, token, expires };
}

export function redeemChallenge(token: unknown, solutions: unknown) {
	if (!Array.isArray(solutions) || solutions.length !== CHALLENGE.c || solutions.some((s) => typeof s !== 'number' || !Number.isSafeInteger(s))) {
		return { success: false, message: 'Invalid body' };
	}
	if (!check('c', token) || !markUsed(token as string)) {
		return { success: false, message: 'Challenge invalid or expired' };
	}
	for (let i = 1; i <= CHALLENGE.c; i++) {
		const salt = prng(`${token}${i}`, CHALLENGE.s);
		const target = prng(`${token}${i}d`, CHALLENGE.d);
		const hash = createHash('sha256').update(salt + solutions[i - 1]).digest('hex');
		if (!hash.startsWith(target)) return { success: false, message: 'Invalid solution' };
	}
	return { success: true, ...issue('t', TOKEN_TTL) };
}

/** Verifica il token inviato col form e lo "consuma" (per questa istanza). */
export function validateToken(token: unknown): boolean {
	return check('t', token) && markUsed(token as string);
}
