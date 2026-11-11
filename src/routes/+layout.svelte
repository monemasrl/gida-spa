<script lang="ts">
	import { page } from '$app/state';
	import Footer from '#lib/components/Footer.svelte';
	import Header from '#lib/components/Header.svelte';
	import { layouts, langOf } from '#lib/layout.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const lang = $derived(langOf(page.url.pathname));
	const layout = $derived(layouts[lang]);
	const wrapperId = $derived(page.data.page?.wrapperId ?? 'page-default');
	let showTop = $state(false);

	// Sostituisce i comportamenti JS di Bootstrap Italia usati nei contenuti (collapse/accordion)
	function onDocumentClick(e: MouseEvent) {
		const toggle = (e.target as HTMLElement).closest<HTMLElement>('[data-toggle="collapse"]');
		if (!toggle) return;
		const sel = toggle.getAttribute('data-target') ?? toggle.getAttribute('href');
		if (!sel || !sel.startsWith('#')) return;
		const target = document.getElementById(decodeURIComponent(sel.slice(1)));
		if (!target) return;
		e.preventDefault();
		const open = target.classList.toggle('show');
		toggle.classList.toggle('collapsed', !open);
		toggle.setAttribute('aria-expanded', String(open));
	}

	$effect(() => {
		// classi del body allineate anche durante la navigazione client-side
		const cls = page.data.page?.bodyClass;
		if (cls !== undefined) document.body.className = cls;
		document.documentElement.lang = lang;
	});
</script>

<svelte:document onclick={onDocumentClick} />
<svelte:window onscroll={() => (showTop = window.scrollY > 300)} />

<a href="#main-content" class="visually-hidden focusable">
	{lang === 'en' ? 'Skip to main content' : 'Salta al contenuto principale'}
</a>
<div class="dialog-off-canvas-main-canvas">
	<div id={wrapperId}>
		<a
			href="#top"
			aria-hidden="true"
			title="Back To Top"
			class="back-to-top"
			class:back-to-top-show={showTop}
			onclick={(e) => {
				e.preventDefault();
				window.scrollTo({ top: 0, behavior: 'smooth' });
			}}
		>
			<svg class="icon icon-light"><use href="/themes/custom/italiagov/assets/icons/sprite.svg#it-arrow-up"></use></svg>
		</a>
		<Header {layout} {lang} />
		<div id="main-content">
			{@render children()}
		</div>
		<Footer footer={layout.footer} />
	</div>
</div>
