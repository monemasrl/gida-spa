/**
 * Testata, menu e footer: documenti singoli del CMS in src/content/layout/<parte>/<lingua>.json.
 */
export type Lang = 'it' | 'en';
export type MenuLink = { label: string; href: string | null; children?: MenuLink[] };
export type Link = { label: string; href: string; newTab?: boolean };
export type Img = { src: string; alt?: string };

export type Testata = { logo: string; contatti: { label: string; text: string; href?: string }[] };
export type Valore = { label: string; value: string };
export type Footer = {
	cruscotto: { title: string; items: Valore[]; totale: Valore };
	dati: { logo?: Img; righe: { testo?: string; links?: Link[] }[] };
	menu: Link[];
	certificazioni: { loghi: { image: Img; href: string; newTab?: boolean }[]; links: Link[] };
};
export type LayoutData = { testata: Testata; topMenu: MenuLink[]; mainMenu: MenuLink[]; footer: Footer };

const files = import.meta.glob('/src/content/layout/*/*.json', { eager: true, import: 'default' });
const part = <T>(name: string, lang: Lang) => files[`/src/content/layout/${name}/${lang}.json`] as T;

export const layouts = Object.fromEntries(
	(['it', 'en'] as Lang[]).map((lang) => [
		lang,
		{
			testata: part<Testata>('testata', lang),
			topMenu: part<{ items: MenuLink[] }>('menu-superiore', lang).items,
			mainMenu: part<{ items: MenuLink[] }>('menu-principale', lang).items,
			footer: part<Footer>('footer', lang)
		}
	])
) as Record<Lang, LayoutData>;

export const langOf = (path: string): Lang => (path === '/en' || path.startsWith('/en/') ? 'en' : 'it');
export const homeOf = (lang: Lang) => (lang === 'en' ? '/en' : '/');
