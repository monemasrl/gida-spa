import { defineEnvVars } from '@sveltejs/kit/env';

const optional = (value: string | undefined) => value || undefined;

/** Variabili d'ambiente lato server (Vercel → Settings → Environment Variables). */
export const variables = defineEnvVars({
	PROCMAIL_API_URL: {
		description: 'Base URL API procmail.sh',
		schema: (v) => v || 'https://api-eu.procmail.sh'
	},
	PROCMAIL_API_KEY: { description: 'Chiave API procmail.sh (secret)', schema: optional },
	FORM_FROM: { description: 'Mittente delle email dei form (dominio abilitato su procmail)', schema: optional },
	FORM_TO: {
		description: 'Destinatari dei form, separati da virgola',
		schema: (v) => (v || 'gida@gida-spa.it').split(',').map((s) => s.trim()).filter(Boolean)
	},
	GITHUB_OAUTH_CLIENT_ID: { description: 'Client ID della GitHub OAuth App del CMS', schema: optional },
	GITHUB_OAUTH_CLIENT_SECRET: { description: 'Client secret della GitHub OAuth App del CMS (secret)', schema: optional },
	CMS_ALLOWED_ORIGINS: {
		description:
			'Origin da cui il CMS può ricevere il token OAuth, separate da virgola (`*` = un\'etichetta DNS). Default in #lib/server/cms-auth.ts',
		schema: (v) => (v ? v.split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean) : undefined)
	},
	CAP_SECRET: {
		description: 'Segreto HMAC per firmare challenge e token Cap (es. openssl rand -hex 32)',
		schema: (v) => {
			if (v && v.length < 32) throw new Error('CAP_SECRET deve avere almeno 32 caratteri');
			return v || undefined;
		}
	}
});
