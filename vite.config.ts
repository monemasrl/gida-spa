import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// Vercel: tutte le pagine sono prerenderizzate (statiche); solo /api/* gira come Function
			adapter: adapter({ runtime: 'nodejs24.x' }),
			prerender: {
				entries: ['*'],
				handleHttpError: ({ path, message }) => {
					// PDF/immagini referenziati ma non presenti nel mirror: avvisa senza bloccare la build
					if (path.startsWith('/sites/')) return console.warn('Asset mancante:', path);
					throw new Error(message);
				},
				handleMissingId: 'warn'
			}
		})
	]
});
