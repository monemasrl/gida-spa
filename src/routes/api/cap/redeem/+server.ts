import { json } from '@sveltejs/kit';
import { redeemChallenge } from '#lib/server/cap.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	const result = redeemChallenge(body?.token, body?.solutions);
	return json(result, { status: result.success ? 200 : 400, headers: { 'Cache-Control': 'no-store' } });
};
