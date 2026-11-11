<script lang="ts">
	import { onMount } from 'svelte';
	import type { FormDef } from '#lib/types.ts';

	let { def, lang }: { def: FormDef; lang: 'it' | 'en' } = $props();

	/**
	 * Invio a /api/form (SvelteKit su Vercel) che verifica Cap e spedisce l'email via procmail.sh.
	 * Il widget Cap calcola una proof-of-work nel browser e scrive il token nel campo "cap-token".
	 */
	const mailTo = 'gida@gida-spa.it';
	const t = $derived(
		{
			it: {
				sending: 'Invio in corso…',
				ok: 'Messaggio inviato, grazie! Ti ricontatteremo al più presto.',
				generic: 'Invio non riuscito, riprova o scrivi a ',
				captcha: 'Completa la verifica anti-spam prima di inviare.'
			},
			en: {
				sending: 'Sending…',
				ok: 'Message sent, thank you! We will get back to you soon.',
				generic: 'Sending failed, please retry or write to ',
				captcha: 'Please complete the anti-spam check before sending.'
			}
		}[lang]
	);

	// Il widget compilato non include l'italiano: testi passati come attributi data-cap-i18n-*
	const CAP_IT: Record<string, string> = {
		'data-cap-i18n-initial-state': 'Verifica di essere umano',
		'data-cap-i18n-verifying-label': 'Verifica in corso...',
		'data-cap-i18n-solved-label': 'Sei umano',
		'data-cap-i18n-error-label': 'Errore. Riprova.',
		'data-cap-i18n-required-label': 'Verifica di essere umano',
		'data-cap-i18n-troubleshooting-label': 'Risoluzione dei problemi',
		'data-cap-i18n-group-aria-label': 'Verifica Cap',
		'data-cap-i18n-verify-aria-label': 'Clicca per verificare di essere umano',
		'data-cap-i18n-verifying-aria-label': 'Verifica che sei umano, attendi',
		'data-cap-i18n-verified-aria-label': 'Abbiamo verificato che sei umano, puoi continuare',
		'data-cap-i18n-error-aria-label': 'Si è verificato un errore, riprova'
	};

	let status = $state<'idle' | 'sending' | 'ok' | 'error'>('idle');
	let formError = $state('');
	let fieldErrors = $state<Record<string, string>>({});
	let capReady = $state(false);
	let capEl = $state<HTMLElement & { reset?: () => void }>();
	let idemKey = crypto.randomUUID();

	onMount(async () => {
		// WASM servito dal sito: nessuna richiesta a CDN di terze parti
		(window as unknown as { CAP_CUSTOM_WASM_URL: string }).CAP_CUSTOM_WASM_URL = '/cap/cap_wasm_bg.wasm';
		await import('@cap.js/widget');
		capReady = true;
	});

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		const form = e.currentTarget as HTMLFormElement;
		fieldErrors = {};
		formError = '';
		if (!form.reportValidity()) return;
		const data = new FormData(form);
		if (!data.get('cap-token')) {
			formError = t.captcha;
			return;
		}
		data.set('_form', def.id);
		data.set('_lang', lang);
		data.set('_page', location.pathname);

		status = 'sending';
		try {
			const res = await fetch('/api/form', { method: 'POST', body: data, headers: { 'Idempotency-Key': idemKey } });
			const body = await res.json().catch(() => ({}));
			if (res.ok && body.ok) {
				status = 'ok';
				idemKey = crypto.randomUUID();
				form.reset();
				capEl?.reset?.();
				return;
			}
			status = 'error';
			// il token Cap è monouso: dopo un tentativo fallito serve una nuova verifica
			capEl?.reset?.();
			if (body.errors) {
				const known = new Set(def.fields.map((f) => f.name));
				const globals: string[] = [];
				for (const [k, msg] of Object.entries(body.errors as Record<string, string>)) {
					if (known.has(k)) fieldErrors[k] = msg;
					else globals.push(msg);
				}
				formError = globals.join(' ');
			} else {
				formError = t.generic + mailTo;
			}
		} catch {
			status = 'error';
			capEl?.reset?.();
			formError = t.generic + mailTo;
		}
	}
</script>

<form class="needs-validation" novalidate onsubmit={submit} id={def.id}>
	{#each def.fields as f}
		{@const id = `${def.id}-${f.name}`}
		{#if f.type === 'checkbox'}
			<div class="form-item form-check">
				<input type="checkbox" {id} name={f.name} value="true" required={f.required} class="form-checkbox form-control" aria-invalid={fieldErrors[f.name] ? 'true' : undefined} />
				<label class="form-check-label option" class:form-required={f.required} for={id}><span>{f.label}</span></label>
				{#if f.description}<small class="description form-text text-muted">{@html f.description}</small>{/if}
				{#if fieldErrors[f.name]}<p class="gida-form-status error" role="alert">{fieldErrors[f.name]}</p>{/if}
			</div>
		{:else if f.type === 'textarea'}
			<div class="form-item form-group">
				<label for={id} class="active" class:form-required={f.required}>{f.label}</label>
				<div class="form-textarea-wrapper">
					<textarea {id} name={f.name} rows="5" maxlength="5000" required={f.required} class="form-textarea resize-vertical" aria-invalid={fieldErrors[f.name] ? 'true' : undefined}></textarea>
				</div>
				{#if fieldErrors[f.name]}<p class="gida-form-status error" role="alert">{fieldErrors[f.name]}</p>{/if}
			</div>
		{:else}
			<div class="form-item form-group">
				<label for={id} class="active" class:form-required={f.required}>{f.label}</label>
				<input {id} type={f.type} name={f.name} maxlength="255" required={f.required} class="form-control" aria-invalid={fieldErrors[f.name] ? 'true' : undefined} />
				{#if fieldErrors[f.name]}<p class="gida-form-status error" role="alert">{fieldErrors[f.name]}</p>{/if}
			</div>
		{/if}
	{/each}
	<div class="form-item form-group gida-cap">
		{#if capReady}
			<cap-widget bind:this={capEl} data-cap-api-endpoint="/api/cap/" data-cap-lang={lang} {...lang === 'it' ? CAP_IT : {}}></cap-widget>
		{/if}
	</div>
	<div class="form-actions">
		<button type="submit" class="button button--primary btn btn-primary" disabled={status === 'sending'}>
			{status === 'sending' ? t.sending : def.submit}
		</button>
	</div>
	{#if status === 'ok'}<p class="gida-form-status ok" role="status">{t.ok}</p>{/if}
	{#if formError}<p class="gida-form-status error" role="alert">{formError}</p>{/if}
</form>
