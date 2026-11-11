import type { Page } from './types';

const modules = import.meta.glob<Page>('/src/content/pages/*.json', { eager: true, import: 'default' });

export const pages = new Map<string, Page>(Object.values(modules).map((p) => [p.path, p]));

export const getPage = (path: string) => pages.get(path === '' ? '/' : path.replace(/\/$/, '') || '/');
