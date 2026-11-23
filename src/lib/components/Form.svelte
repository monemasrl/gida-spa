<script lang="ts">
	import { onMount } from 'svelte';
	import type { FormDef } from '#lib/types.ts';

	/**
	 * Potenzia il form originale di Drupal (markup e classi invariati, presenti nell'HTML importato):
	 * aggiunge il widget Cap e i messaggi di esito, e invia a /api/form via fetch.
	 * Il componente è montato dentro il form, subito prima di `.form-actions`.
	 */
	let { form, def, lang }: { form: HTMLFormElement; def: FormDef; lang: 'it' | 'en' } = $props();

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
	let capReady = $state(false);
	let capEl = $state<HTMLElement & { reset?: () => void }>();
	let idemKey = crypto.randomUUID();

	// "Invia" resta disabilitato finché le caselle obbligatorie (informativa) non sono spuntate
	// e la verifica Cap non è riuscita.
	let capSolved = $state(false);
	let checksOk = $state(false);
	const button = $derived(form.querySelector<HTMLInputElement>('[type="submit"]'));
	const updateChecks = () =>
		(checksOk = [...form.querySelectorAll<HTMLInputElement>('input[type="checkbox"][required]')].every((c) => c.checked));

	$effect(() => {
		if (button) button.disabled = status === 'sending' || !capSolved || !checksOk;
	});

	$effect(() => {
		updateChecks();
		// dopo form.reset() i valori cambiano solo al termine dell'evento
		const onReset = () => setTimeout(updateChecks);
		form.addEventListener('change', updateChecks);
		form.addEventListener('reset', onReset);
		return () => {
			form.removeEventListener('change', updateChecks);
			form.removeEventListener('reset', onReset);
		};
	});

	$effect(() => {
		if (!capEl) return;
		const solved = () => (capSolved = true);
		const unsolved = () => (capSolved = false);
		capEl.addEventListener('solve', solved);
		for (const ev of ['reset', 'error', 'progress']) capEl.addEventListener(ev, unsolved);
		return () => {
			capEl!.removeEventListener('solve', solved);
			for (const ev of ['reset', 'error', 'progress']) capEl!.removeEventListener(ev, unsolved);
		};
	});

	onMount(async () => {
		// WASM servito dal sito: nessuna richiesta a CDN di terze parti
		(window as unknown as { CAP_CUSTOM_WASM_URL: string }).CAP_CUSTOM_WASM_URL = '/cap/cap_wasm_bg.wasm';
		await import('@cap.js/widget');
		capReady = true;
	});

	/** Errori per campo, con le classi di validazione di Bootstrap Italia. */
	function clearFieldErrors() {
		form.querySelectorAll('.gida-invalid-feedback').forEach((el) => el.remove());
		form.querySelectorAll('.is-invalid').forEach((el) => el.classList.remove('is-invalid'));
	}
	function showFieldError(name: string, msg: string) {
		const field = form.elements.namedItem(name);
		if (!(field instanceof HTMLElement)) return false;
		field.classList.add('is-invalid');
		const fb = document.createElement('div');
		fb.className = 'invalid-feedback d-block gida-invalid-feedback';
		fb.setAttribute('role', 'alert');
		fb.textContent = msg;
		(field.closest('.form-item') ?? field.parentElement)?.append(fb);
		return true;
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		clearFieldErrors();
		formError = '';
		status = 'idle';
		if (!form.reportValidity()) return;
		const data = new FormData(form);
		if (!data.get('cap-token')) {
			formError = t.captcha;
			return;
		}
		data.set('_form', def.id);
		data.set('_lang', lang);
		data.set('_page', location.pathname);

		const label = button?.value;
		status = 'sending';
		if (button) button.value = t.sending;
		try {
			const res = await fetch(form.action, { method: 'POST', body: data, headers: { 'Idempotency-Key': idemKey } });
			const body = await res.json().catch(() => ({}));
			if (res.ok && body.ok) {
				status = 'ok';
				idemKey = crypto.randomUUID();
				form.reset();
			} else {
				status = 'error';
				const globals: string[] = [];
				for (const [k, msg] of Object.entries((body.errors ?? {}) as Record<string, string>)) {
					if (!showFieldError(k, msg)) globals.push(msg);
				}
				formError = globals.join(' ') || (body.errors ? '' : t.generic + mailTo);
			}
		} catch {
			status = 'error';
			formError = t.generic + mailTo;
		} finally {
			// il token Cap è monouso: serve una nuova verifica per il prossimo invio
			capEl?.reset?.();
			capSolved = false;
			if (status === 'sending') status = 'idle';
			if (button && label) button.value = label;
		}
	}

	$effect(() => {
		form.addEventListener('submit', submit);
		return () => form.removeEventListener('submit', submit);
	});
</script>

<div class="form-item form-group gida-cap">
	{#if capReady}
		<cap-widget bind:this={capEl} data-cap-api-endpoint="/api/cap/" data-cap-lang={lang} {...lang === 'it' ? CAP_IT : {}}></cap-widget>
	{/if}
</div>
{#if status === 'ok'}<div class="alert alert-success gida-form-status" role="status">{t.ok}</div>{/if}
{#if formError}<div class="alert alert-danger gida-form-status" role="alert">{formError}</div>{/if}
