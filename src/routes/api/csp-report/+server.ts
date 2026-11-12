import type { RequestHandler } from './$types';

export const prerender = false;

const MAX_BODY = 16_384;

type Report = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v.slice(0, 300) : v);

/** Formato vecchio (report-uri: {"csp-report": {...}}) e nuovo (report-to: [{type, body}]) → campi essenziali. */
function normalize(payload: unknown): Report[] {
	const items = Array.isArray(payload) ? payload : [payload];
	return items.flatMap((item) => {
		if (!item || typeof item !== 'object') return [];
		const o = item as Record<string, any>;
		const r = o['csp-report'] ?? (o.type === 'csp-violation' ? o.body : undefined);
		if (!r || typeof r !== 'object') return [];
		return [
			{
				page: str(r['document-uri'] ?? r.documentURL),
				directive: str(r['effective-directive'] ?? r.effectiveDirective ?? r['violated-directive']),
				blocked: str(r['blocked-uri'] ?? r.blockedURL),
				source: str(r['source-file'] ?? r.sourceFile),
				line: r['line-number'] ?? r.lineNumber,
				sample: str(r['script-sample'] ?? r.sample),
				disposition: r.disposition
			}
		];
	});
}

/**
 * POST /api/csp-report — riceve le violazioni della Content-Security-Policy(-Report-Only) dichiarata in
 * vercel.json e le scrive nei log della Function (Vercel → Logs, filtro "[csp]").
 */
export const POST: RequestHandler = async ({ request }) => {
	const text = (await request.text().catch(() => '')).slice(0, MAX_BODY);
	let payload: unknown;
	try {
		payload = JSON.parse(text);
	} catch {
		return new Response(null, { status: 400 });
	}
	for (const report of normalize(payload)) console.warn('[csp]', JSON.stringify(report));
	return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
};
