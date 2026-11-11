<script lang="ts">
	import { page } from '$app/state';
	import { langOf, homeOf } from '#lib/layout.ts';
	const lang = $derived(langOf(page.url.pathname));
</script>

<svelte:head><title>{page.status} | gida</title></svelte:head>

<main>
	<div class="container main-container py-5">
		<h1>{page.status === 404 ? (lang === 'en' ? 'Page not found' : 'Pagina non trovata') : 'Errore'}</h1>
		<p><a href={homeOf(lang)}>{lang === 'en' ? 'Back to home' : 'Torna alla home'}</a></p>
	</div>
</main>
