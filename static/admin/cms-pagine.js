// Pagine aggiuntive del CMS (caricato da index.html dopo Sveltia CMS).

// "Copia anno": apre su GitHub l'azione che copia i documenti di Società trasparente da un anno al nuovo
// (.github/workflows/copia-anno.yml). Serve essere entrati su github.com con il permesso di scrittura sul repository.
CMS.registerCustomPage({
	id: 'copia-anno',
	label: 'Copia anno di Società trasparente',
	icon: 'content_copy',
	url: 'https://github.com/monemasrl/gida-spa/actions/workflows/copia-anno.yml',
	newTab: true
});
