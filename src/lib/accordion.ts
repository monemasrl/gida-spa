/**
 * Comportamento delle FAQ come jQuery UI Accordion su Drupal (impostazioni di faqfield: una risposta
 * aperta alla volta, richiudibile, apertura al click, animazione lineare di 200 ms), senza jQuery.
 * Il markup con le classi di jQuery UI è generato in render.ts (faqItem).
 */
const DURATION = 200;

function slide(panel: HTMLElement, open: boolean) {
	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	panel.style.display = '';
	const full = panel.scrollHeight;
	if (reduce || !panel.animate) {
		if (!open) panel.style.display = 'none';
		return;
	}
	panel.style.overflow = 'hidden';
	const anim = panel.animate(
		[{ height: `${open ? 0 : full}px` }, { height: `${open ? full : 0}px` }],
		{ duration: DURATION, easing: 'linear' }
	);
	anim.onfinish = anim.oncancel = () => {
		panel.style.overflow = '';
		if (!open) panel.style.display = 'none';
	};
}

function setState(header: HTMLElement, panel: HTMLElement, open: boolean) {
	header.classList.toggle('ui-accordion-header-active', open);
	header.classList.toggle('ui-state-active', open);
	header.classList.toggle('ui-accordion-header-collapsed', !open);
	header.classList.toggle('ui-corner-all', !open);
	header.setAttribute('aria-selected', String(open));
	header.setAttribute('aria-expanded', String(open));
	const icon = header.querySelector('.ui-accordion-header-icon');
	icon?.classList.toggle('ui-icon-triangle-1-s', open);
	icon?.classList.toggle('ui-icon-triangle-1-e', !open);
	panel.classList.toggle('ui-accordion-content-active', open);
	panel.setAttribute('aria-hidden', String(!open));
	slide(panel, open);
}

/** Attiva le fisarmoniche dentro `root`; restituisce la funzione che rimuove i listener. */
export function enhanceAccordions(root: HTMLElement): () => void {
	const off: (() => void)[] = [];
	for (const acc of root.querySelectorAll<HTMLElement>('.ui-accordion[role="tablist"]')) {
		const headers = [...acc.querySelectorAll<HTMLElement>(':scope > .ui-accordion-header')];
		const panelOf = (h: HTMLElement) => document.getElementById(h.getAttribute('aria-controls') ?? '') as HTMLElement | null;

		const toggle = (h: HTMLElement) => {
			const panel = panelOf(h);
			if (!panel) return;
			const open = h.getAttribute('aria-expanded') !== 'true';
			for (const other of headers) {
				const p = panelOf(other);
				if (other !== h && p && other.getAttribute('aria-expanded') === 'true') setState(other, p, false);
			}
			setState(h, panel, open);
			for (const other of headers) other.tabIndex = other === h ? 0 : -1;
		};

		const focusAt = (i: number) => {
			const h = headers[(i + headers.length) % headers.length];
			for (const other of headers) other.tabIndex = other === h ? 0 : -1;
			h.focus();
		};

		for (const [i, h] of headers.entries()) {
			const on = <K extends keyof HTMLElementEventMap>(type: K, fn: (e: HTMLElementEventMap[K]) => void) => {
				h.addEventListener(type, fn);
				off.push(() => h.removeEventListener(type, fn));
			};
			on('click', () => toggle(h));
			on('keydown', (e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					toggle(h);
				} else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
					e.preventDefault();
					focusAt(i + 1);
				} else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
					e.preventDefault();
					focusAt(i - 1);
				} else if (e.key === 'Home') {
					e.preventDefault();
					focusAt(0);
				} else if (e.key === 'End') {
					e.preventDefault();
					focusAt(headers.length - 1);
				}
			});
			// stati hover/focus come jQuery UI (colori del tema)
			on('mouseenter', () => h.classList.add('ui-state-hover'));
			on('mouseleave', () => h.classList.remove('ui-state-hover'));
			on('focus', () => h.classList.add('ui-state-focus'));
			on('blur', () => h.classList.remove('ui-state-focus'));
		}
	}
	return () => off.forEach((fn) => fn());
}
