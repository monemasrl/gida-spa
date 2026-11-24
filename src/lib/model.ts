/**
 * Modello dei contenuti strutturati (src/content/<collezione>/<lingua>/<chiave>.json).
 * Le traduzioni condividono la chiave (nome del file), come in Sveltia CMS con
 * `i18n.structure: multiple_folders`.
 */
export type Lang = 'it' | 'en';
export const LANGS: Lang[] = ['it', 'en'];

/** Immagine: percorso pubblico e testo alternativo (le dimensioni si leggono dal file). */
export type Img = { src: string; alt?: string };
export type Link = { title: string; href: string };

/** `path` assente: `/<chiave>` (o `/en/<chiave>`), con chiave = nome del file. */
type Base = { path?: string; title: string; description?: string };
/** `bodyHtml` (HTML modificato come codice) sostituisce `body` (editor visuale) se presente. */
type Text = { body?: string; bodyHtml?: string };

export type Block =
	| { type: 'form'; form: string }
	| { type: 'certificazioni'; view: string; tipi: string[] }
	| { type: 'impianti'; menu?: Link[] }
	| { type: 'pubblicazioni'; title: string; items: Link[] }
	| { type: 'progetti'; title: string; items: { document?: Link; links?: Link[] }[] }
	| { type: 'trasparenza' }
	| { type: 'html'; html: string };

/** Membro di un organo societario. */
export type Membro = { name: string; role?: string; email?: string; nomina?: string; compenso?: string };
/** Sezioni del contenuto della pagina, rese in ordine dopo il testo. */
export type Sezione =
	| { type: 'testo'; body: string; centrato?: boolean }
	| { type: 'allegati'; files: string[]; elenco?: boolean }
	| { type: 'galleria'; images: Img[] }
	| { type: 'immagine'; image: Img; link?: string }
	| { type: 'riquadro'; body: string }
	| { type: 'organi'; title: string; anchor?: string; groups: { title: string; riquadri?: boolean; compatto?: boolean; members: Membro[] }[] }
	| { type: 'avviso'; text: string; visibile?: boolean }
	| { type: 'html'; html: string };

export type Pagina = Base & Text & {
	hero?: Img;
	icon?: Img;
	sezioni?: Sezione[];
	/** mostra l'elenco delle FAQ (collezione `faq`) */
	faq?: boolean;
	/** pagina delle news: mostra la news più recente, l'indice delle altre e la navigazione */
	news?: boolean;
	blocks?: Block[];
};
/** `date`: data di pubblicazione (AAAA-MM-GG), ordina le news dalla più recente. */
export type News = Base & Text & { image?: Img; date?: string };
/** Domanda frequente: il titolo è la domanda. */
export type Faq = { title: string; answer: string; order?: number };
export type Impianto = Base & Text & { image?: Img; order?: number };
/** `unlisted`: la pagina esiste ma non compare negli elenchi generati. */
export type Certificazione = Base & { file: string; tipo: string; order?: number; unlisted?: boolean };
export type Documento = Base & Text & { files?: string[]; tipo: string; anno: string; order?: number; unlisted?: boolean };

export type Home = {
	title: string;
	description?: string;
	hero: Img;
	mission: string;
	settori: { title: string; items: { icon: Img; title: string; text: string; link: string }[] };
	percorso: { background: Img; icon: Img; text: string; file: string };
	ricerca: { title: string; text: string; link: string; image: Img };
	scuole: { title: string; linkText: string; link: string; mascotte: Img; background: Img };
};

/** Voce di tassonomia: id stabile ed etichetta per lingua (assente = non usata in quella lingua). */
export type Termine = { id: string; it?: string; en?: string; parent?: string };
export type Tassonomie = {
	trasparenza: {
		/** anno mostrato nella pagina principale; gli anni precedenti vanno nell'elenco "Archivio" */
		annoCorrente: string;
		/** anni con una pagina d'archivio */
		anni: string[];
		categorie: Termine[];
	};
	certificazioni: { tipi: Termine[] };
};

export type Collections = {
	pagine: Pagina;
	news: News;
	impianti: Impianto;
	certificazioni: Certificazione;
	trasparenza: Documento;
};
export type CollectionName = keyof Collections;

/** Una voce con le sue traduzioni. */
export type Entry<C extends CollectionName = CollectionName> = {
	collection: C;
	key: string;
	locales: Partial<Record<Lang, Collections[C]>>;
};

export type FormEntry = { html: string; def: import('./types.ts').FormDef };
