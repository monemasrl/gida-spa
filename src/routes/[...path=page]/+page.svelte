<script lang="ts">
	import { mount, unmount } from 'svelte';
	import Form from '#lib/components/Form.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const p = $derived(data.page);
	const origin = 'https://www.gida-spa.it';

	let root = $state<HTMLElement>();

	// I form originali di Drupal sono nell'HTML importato (form[data-gida-form]): qui li si potenzia
	// montando, prima del pulsante di invio, il componente con Cap e la gestione dell'invio.
	$effect(() => {
		const page = p;
		if (!root) return;
		const mounted = [...root.querySelectorAll<HTMLFormElement>('form[data-gida-form]')].flatMap((form) => {
			const def = page.forms.find((f) => f.id === form.dataset.gidaForm);
			if (!def) return [];
			const slot = document.createElement('div');
			slot.className = 'gida-form-extras';
			const actions = form.querySelector('.form-actions');
			if (actions) actions.before(slot);
			else form.append(slot);
			return [{ slot, component: mount(Form, { target: slot, props: { form, def, lang: page.lang } }) }];
		});
		return () =>
			mounted.forEach(({ slot, component }) => {
				unmount(component);
				slot.remove();
			});
	});
</script>

<svelte:head>
	<title>{p.title} | gida</title>
	{#if p.description}<meta name="description" content={p.description} />{/if}
	<link rel="canonical" href={origin + p.path} />
	{#each Object.entries(p.alternates) as [hl, href]}
		<link rel="alternate" hreflang={hl} href={origin + href} />
	{/each}
</svelte:head>

<div bind:this={root} style="display: contents">
	{#key p.path}
		{@html p.html}
	{/key}
</div>
