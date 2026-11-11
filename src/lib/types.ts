export type FormField = {
	name: string;
	type: string;
	label: string;
	required: boolean;
	description?: string;
};
export type FormDef = { id: string; fields: FormField[]; submit: string };
export type Page = {
	path: string;
	lang: 'it' | 'en';
	title: string;
	description: string;
	bodyClass: string;
	wrapperId: string;
	alternates: Partial<Record<'it' | 'en', string>>;
	forms: FormDef[];
	html: string;
};
