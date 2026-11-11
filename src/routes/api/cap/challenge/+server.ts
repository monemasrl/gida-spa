import { json } from '@sveltejs/kit';
import { createChallenge } from '#lib/server/cap.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const POST: RequestHandler = () =>
	json(createChallenge(), { headers: { 'Cache-Control': 'no-store' } });
