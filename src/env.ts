import { defineEnvVars } from '@sveltejs/kit/env';

const optional = (value: string | undefined) => value || undefined;

/** Variabili d'ambiente lato server (Vercel → Settings → Environment Variables). */
export const variables = defineEnvVars({
	PROCMAIL_API_URL: {
		description: 'Base URL API procmail.sh',
		schema: (v) => v || 'https://api-eu.procmail.sh'
	},
	PROCMAIL_API_KEY: { description: 'Chiave API procmail.sh (secret)', schema: optional },
	FORM_FROM: {
		description: 'Mittente delle email dei form (dominio abilitato su procmail), anche con nome: "Form Contatti" <sito@gida-spa.it>',
		schema: optional
	},
	FORM_TO: {
		description: 'Destinatari dei form, separati da virgola, anche con nome: "GIDA" <gida@gida-spa.it>',
		// le virgole dentro un nome tra virgolette ("Rossi, Mario" <…>) non dividono gli indirizzi
		schema: (v) => (v || 'gida@gida-spa.it').split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((s) => s.trim()).filter(Boolean)
	},
	CAP_SECRET: {
		description: 'Segreto HMAC per firmare challenge e token Cap (es. openssl rand -hex 32)',
		schema: (v) => {
			if (v && v.length < 32) throw new Error('CAP_SECRET deve avere almeno 32 caratteri');
			return v || undefined;
		}
	}
});
