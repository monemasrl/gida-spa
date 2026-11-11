<script lang="ts">
	import { mount, unmount } from 'svelte';
	import Form from '#lib/components/Form.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const p = $derived(data.page);
	const origin = 'https://www.gida-spa.it';

	let root = $state<HTMLElement>();

	// I form sono segnaposto <div data-gida-form="id"> dentro l'HTML importato: il componente
	// viene montato lì lato client (l'HTML non va spezzato, altrimenti l'idratazione non combacia).
	$effect(() => {
		const page = p;
		if (!root) return;
		const mounted = [...root.querySelectorAll<HTMLElement>('[data-gida-form]')].flatMap((target) => {
			const def = page.forms.find((f) => f.id === target.dataset.gidaForm);
			return def ? [mount(Form, { target, props: { def, lang: page.lang } })] : [];
		});
		return () => mounted.forEach((c) => unmount(c));
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
