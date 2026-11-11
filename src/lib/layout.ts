import layout from '../content/layout.json';

export type Lang = 'it' | 'en';
export type MenuLink = { label: string; href: string | null; children?: MenuLink[] };
export type LayoutData = {
	topInfo: string;
	topMenu: MenuLink[];
	logo: string;
	mainMenu: MenuLink[];
	footer: string;
};

export const layouts = layout as Record<Lang, LayoutData>;
export const langOf = (path: string): Lang => (path === '/en' || path.startsWith('/en/') ? 'en' : 'it');
export const homeOf = (lang: Lang) => (lang === 'en' ? '/en' : '/');
