<script lang="ts">
	import { page } from '$app/state';
	import { homeOf, type Lang, type LayoutData } from '#lib/layout.ts';
	import { url } from '#lib/media.ts';

	let { layout, lang }: { layout: LayoutData; lang: Lang } = $props();

	let menuOpen = $state(false);
	let openDropdown = $state<number | null>(null);
	let langOpen = $state(false);
	let sticky = $state(false);
	let headerEl: HTMLElement;
	let threshold = 0;

	// Header "sticky" di Bootstrap Italia: oltre la top-bar la navbar diventa fissa
	function onScroll() {
		const nav = headerEl.querySelector<HTMLElement>('.it-nav-wrapper');
		if (!nav) return;
		if (!sticky) threshold = nav.offsetTop;
		const next = headerEl.nextElementSibling as HTMLElement | null;
		if (window.scrollY > threshold && !sticky) {
			const h = nav.offsetHeight;
			sticky = true;
			if (next) next.style.paddingTop = h + 'px';
		} else if (window.scrollY <= threshold && sticky) {
			sticky = false;
			if (next) next.style.paddingTop = '';
		}
	}

	const path = $derived(page.url.pathname);
	const alternates = $derived(page.data.page?.alternates ?? {});
	const other: Lang = $derived(lang === 'it' ? 'en' : 'it');
	const otherHref = $derived(alternates[other] ?? homeOf(other));

	const isActive = (href: string | null) => !!href && (path === href || path.startsWith(href + '/'));

	// chiude menu e tendine a ogni cambio pagina
	$effect(() => {
		path;
		menuOpen = false;
		openDropdown = null;
		langOpen = false;
	});
</script>

<svelte:window onscroll={onScroll} onclick={(e) => { const t = e.target as HTMLElement; if (!t.closest('.dropdown')) openDropdown = null; if (!t.closest('.dropbutton-wrapper')) langOpen = false; }} />

<header class="it-header-wrapper it-header-sticky" class:is-sticky={sticky} bind:this={headerEl}>
	<div class="wrapper-top">
		<div id="it-region-header-top" class="region header_top">
			<div id="it-block-topmenuinfo" class="block block-block-content">
				<div class="clearfix text-formatted field field--name-body field--type-text-with-summary field--label-hidden field__item">
					<ul class="top-menu-info">
						{#each layout.testata.contatti as c}
							<li><strong>{c.label}</strong> {#if c.href}<a href={c.href}>{c.text}</a>{:else}{c.text}{/if}</li>
						{/each}
					</ul>
				</div>
			</div>
			<nav aria-label="topMenu" id="block-topmenu-2" class="block block-menu navigation menu--topmenu">
				<ul class="menu">
					{#each layout.topMenu as item}
						<li class="menu-item" class:menu-item--active-trail={isActive(item.href)}>
							<a href={item.href} class:is-active={isActive(item.href)}>{item.label}</a>
						</li>
					{/each}
				</ul>
			</nav>
			<div id="it-block-dropdownlanguage" class="block block-dropdown-language block-dropdown-languagelanguage-interface">
				<div class="dropbutton-wrapper dropbutton-multiple" class:open={langOpen}>
					<div class="dropbutton-widget">
						<ul class="dropdown-language-item dropbutton">
							<li class="{lang} dropbutton-action">
								<span class="language-link active-language">{lang.toUpperCase()}</span>
							</li>
							<li class="dropbutton-toggle">
								<button type="button" aria-expanded={langOpen} onclick={() => (langOpen = !langOpen)}>
									<span class="dropbutton-arrow"><span class="visually-hidden">{lang === 'en' ? 'Other languages' : 'Altre lingue'}</span></span>
								</button>
							</li>
							<li class="{other} dropbutton-action secondary-action">
								<a href={otherHref} class="language-link" hreflang={other}>{other.toUpperCase()}</a>
							</li>
						</ul>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div class="it-nav-wrapper">
		<div class="it-header-center-wrapper theme-light">
			<div class="container"><div class="row"><div class="col-12"><div class="it-header-center-content-wrapper"><div class="it-right-zone"></div></div></div></div></div>
		</div>
		<div class="it-header-navbar-wrapper">
			<div class="container">
				<div class="row">
					<div class="col-12">
						<div class="wrapper-header">
							<div id="it-region-logo-header" class="region logo_header">
								<div id="it-block-brandingdelsito" class="block block-system block-system-branding-block">
									<a href={homeOf(lang)} title="Home" rel="home">
										<img src={url(layout.testata.logo)} alt="Home" class="icon img-fluid" />
										<div class="it-brand-text"></div>
									</a>
								</div>
							</div>
							<div id="it-region-header-nav" class="region header_nav">
								<nav aria-labelledby="main-menu-title" class="navbar navbar-expand-lg has-megamenu">
									<button
										class="custom-navbar-toggler"
										type="button"
										aria-controls="main-menu"
										aria-expanded={menuOpen}
										aria-label="Toggle navigation"
										onclick={() => (menuOpen = true)}
									>
										<svg class="icon"><use href="/themes/custom/italiagov/assets/icons/sprite.svg#it-burger"></use></svg>
									</button>
									<div class="navbar-collapsable" class:expanded={menuOpen} id="main-menu" style:display={menuOpen ? 'block' : null}>
										<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
										<div class="overlay" style:display={menuOpen ? 'block' : 'none'} onclick={() => (menuOpen = false)}></div>
										<div class="close-div">
											<a href={homeOf(lang)}><img src={url(layout.testata.logo)} alt="Home" /></a>
											<button class="btn close-menu" type="button" aria-label="Chiudi menu" onclick={() => (menuOpen = false)}>
												<svg class="icon"><use href="/themes/custom/italiagov/assets/icons/sprite.svg#it-close"></use></svg>
											</button>
										</div>
										<h2 id="main-menu-title" class="visually-hidden">Main Menu</h2>
										<div class="menu-wrapper">
											<ul class="navbar-nav">
												{#each layout.mainMenu as item, i}
													{#if item.children?.length}
														<li class="nav-item dropdown" class:show={openDropdown === i}>
															<a
																class="nav-link dropdown-toggle"
																class:active={item.children.some((c) => isActive(c.href))}
																href="#main-menu"
																role="button"
																aria-expanded={openDropdown === i}
																onclick={(e) => {
																	e.preventDefault();
																	openDropdown = openDropdown === i ? null : i;
																}}
															>
																<span>{item.label}</span>
																<svg class="icon icon-xs"><use href="/themes/custom/italiagov/assets/icons/sprite.svg#it-expand"></use></svg>
															</a>
															<div class="dropdown-menu" class:show={openDropdown === i}>
																<div class="link-list-wrapper">
																	<ul class="link-list">
																		{#each item.children as child}
																			<li>
																				<a class="list-item large" class:active={isActive(child.href)} href={child.href}><span>{child.label}</span></a>
																			</li>
																		{/each}
																	</ul>
																</div>
															</div>
														</li>
													{:else}
														<li class="nav-item">
															<a class="nav-link" class:active={isActive(item.href)} href={item.href}><span>{item.label}</span></a>
														</li>
													{/if}
												{/each}
											</ul>
										</div>
									</div>
								</nav>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</header>
