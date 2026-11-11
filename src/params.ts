import { defineParams } from '@sveltejs/kit/params';

export const params = defineParams({
	/** Esclude file statici (PDF, immagini, CSS…) così i link a quei file non passano dal router. */
	page: (param: string) =>
		!/^(sites|themes|css)(\/|$)/.test(param) && !/\.[a-z0-9]{2,5}$/i.test(param) ? param : undefined
});
