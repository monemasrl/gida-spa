<script lang="ts">
	import type { Footer, Link } from '#lib/layout.ts';
	import { url } from '#lib/media.ts';
	import { svgDx, svgSx } from './cruscotto-svg.ts';

	let { footer }: { footer: Footer } = $props();

	const c = $derived(footer.cruscotto);
</script>

{#snippet link(l: Link, cls?: string)}
	<a href={url(l.href)} class={cls} target={l.newTab ? '_blank' : undefined}>{l.label}</a>
{/snippet}

<footer class="it-footer">
	<div class="it-footer-main">
		<div id="it-region-cruscotto-energia" class="region cruscotto_energia">
			<div id="it-block-footercruscottoenergia-2" class="block block-block-content">
				<div class="clearfix text-formatted field field--name-body field--type-text-with-summary field--label-hidden field__item">
					<div class="wrapper-cruscotto">
						<div class="box-cruscotto">
							<div class="img-sx">{@html svgSx}</div>
							<div class="wrapper-testo">
								<h2>{c.title}</h2>
								<div class="testo-cruscotto">
									<ul>
										{#each c.items as v}<li>{v.label} <span>{v.value}</span></li>{/each}
									</ul>
									<div class="totale"><h3>{c.totale.label} <span>{c.totale.value}</span></h3></div>
								</div>
							</div>
							<div class="img-dx">{@html svgDx}</div>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="container">
			<section class="py-3">
				<div class="row">
					<div class="col-md-4 col-lg-4 pb-2">
						<div id="it-region-footer-first" class="region footer_first">
							<div id="it-block-footerdati" class="block block-block-content">
								<div class="clearfix text-formatted field field--name-body field--type-text-with-summary field--label-hidden field__item">
									<div class="dati_footer">
										{#if footer.dati.logo}<img alt={footer.dati.logo.alt ?? ''} src={url(footer.dati.logo.src)} loading="lazy" />{/if}
										<ul>
											{#each footer.dati.righe as r}
												<li>
													{r.testo ?? ''}{#if r.testo && r.links?.length}{' '}{/if}{#each r.links ?? [] as l, i}{#if i > 0}{' | '}{/if}{@render link(l)}{/each}
												</li>
											{/each}
										</ul>
									</div>
								</div>
							</div>
						</div>
					</div>
					<div class="col-md-4 col-lg-4 pb-2">
						<div id="it-region-footer-second" class="region footer_second">
							<nav aria-labelledby="block-italiagov-footer-menu" id="block-italiagov-footer" class="block block-menu navigation menu--footer">
								<h2 class="visually-hidden" id="block-italiagov-footer-menu">Footer menu</h2>
								<div class="row">
									{#each footer.menu as l}
										<div class="col-lg-12"><h4>{@render link(l)}</h4><div class="link-list-wrapper"></div></div>
									{/each}
								</div>
							</nav>
						</div>
					</div>
					<div class="col-md-4 col-lg-4 pb-2">
						<div id="it-region-footer-third" class="region footer_third">
							<div id="it-block-footercertificazioni" class="block block-block-content">
								<div class="clearfix text-formatted field field--name-body field--type-text-with-summary field--label-hidden field__item">
									<div class="footer-certificati-logo">
										{#each footer.certificazioni.loghi as g}
											<a href={url(g.href)} target={g.newTab ? '_blank' : undefined}>
												<article class="align-center media media--type-image media--view-mode-default">
													<div class="field field--name-field-media-image field--type-image field--label-visually_hidden">
														<div class="field__label visually-hidden">Image</div>
														<div class="field__item"><img loading="lazy" src={url(g.image.src)} alt={g.image.alt ?? ''} class="img-fluid" /></div>
													</div>
												</article>
											</a>
										{/each}
									</div>
									{#each footer.certificazioni.links as l}<p>{@render link(l, 'footer-link-certificazioni')}</p>{/each}
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>
		</div>
	</div>
	<div class="it-footer-small-prints clearfix"><div class="container"><div class="row"><div class="col"></div></div></div></div>
</footer>
