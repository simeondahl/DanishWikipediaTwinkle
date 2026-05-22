// <nowiki>

(function() {

/*
 ****************************************
 *** twinklebatchdelete.js: Massesletningsmodul (kun administratorer)
 ****************************************
 * Mode of invocation:     Tab ("M-slet")
 * Active on:              Existing non-articles, and Special:PrefixIndex
 */

Twinkle.batchdelete = function twinklebatchdelete() {
	if (
		Morebits.userIsSysop && (
			(mw.config.get('wgCurRevisionId') && mw.config.get('wgNamespaceNumber') > 0) ||
			mw.config.get('wgCanonicalSpecialPageName') === 'Prefixindex'
		)
	) {
		Twinkle.addPortletLink(Twinkle.batchdelete.callback, 'M-slet', 'tw-batch', 'Slet sider fundet i denne kategori/på denne side');
	}
};

Twinkle.batchdelete.unlinkCache = {};

// Has the subpages list been loaded?
let subpagesLoaded;

Twinkle.batchdelete.callback = function twinklebatchdeleteCallback() {
	subpagesLoaded = false;
	const Window = new Morebits.SimpleWindow(600, 400);
	Window.setTitle('Massesletning');
	Window.setScriptName('Twinkle');

	const form = new Morebits.QuickForm(Twinkle.batchdelete.callback.evaluate);
	form.append({
		type: 'checkbox',
		list: [
			{
				label: 'Slet sider',
				name: 'delete_page',
				value: 'delete',
				checked: true,
				subgroup: {
					type: 'checkbox',
					list: [
						{
							label: 'Slet tilknyttede diskussionssider (undtagen brugerdiskussionssider)',
							name: 'delete_talk',
							value: 'delete_talk',
							checked: true
						},
						{
							label: 'Slet omdirigeringer til slettede sider',
							name: 'delete_redirects',
							value: 'delete_redirects',
							checked: true
						},
						{
							label: 'Slet undersider til slettede sider',
							name: 'delete_subpages',
							value: 'delete_subpages',
							checked: false,
							event: Twinkle.batchdelete.callback.toggleSubpages,
							subgroup: {
								type: 'checkbox',
								list: [
									{
										label: 'Slet diskussionssider til slettede undersider',
										name: 'delete_subpage_talks',
										value: 'delete_subpage_talks'
									},
									{
										label: 'Slet omdirigeringer til slettede undersider',
										name: 'delete_subpage_redirects',
										value: 'delete_subpage_redirects'
									},
									{
										label: 'Fjern links til hver slettet underside (kun i Artikel- og Portalnavnerum)',
										name: 'unlink_subpages',
										value: 'unlink_subpages'
									}
								]
							}
						}
					]
				}
			},
			{
				label: 'Fjern links til hver side (kun i Artikel- og Portalnavnerum)',
				name: 'unlink_page',
				value: 'unlink',
				checked: false
			},
			{
				label: 'Fjern brug af hver fil (i alle navnerum)',
				name: 'unlink_file',
				value: 'unlink_file',
				checked: true
			}
		]
	});
	form.append({
		type: 'input',
		name: 'reason',
		label: 'Begrundelse:',
		size: 60
	});

	const query = {
		action: 'query',
		prop: 'revisions|info|imageinfo',
		inprop: 'protection',
		rvprop: 'size|user',
		format: 'json'
	};

	// On categories
	if (mw.config.get('wgNamespaceNumber') === 14) {
		query.generator = 'categorymembers';
		query.gcmtitle = mw.config.get('wgPageName');
		query.gcmlimit = Twinkle.getPref('batchMax');

	// On Special:PrefixIndex
	} else if (mw.config.get('wgCanonicalSpecialPageName') === 'Prefixindex') {

		query.generator = 'allpages';
		query.gaplimit = Twinkle.getPref('batchMax');
		if (mw.util.getParamValue('prefix')) {
			query.gapnamespace = mw.util.getParamValue('namespace');
			query.gapprefix = mw.util.getParamValue('prefix');
		} else {
			let pathSplit = decodeURIComponent(location.pathname).split('/');
			if (pathSplit.length < 3 || pathSplit[2] !== 'Special:PrefixIndex') {
				return;
			}
			const titleSplit = pathSplit[3].split(':');
			query.gapnamespace = mw.config.get('wgNamespaceIds')[titleSplit[0].toLowerCase()];
			if (titleSplit.length < 2 || typeof query.gapnamespace === 'undefined') {
				query.gapnamespace = 0; // article namespace
				query.gapprefix = pathSplit.splice(3).join('/');
			} else {
				pathSplit = pathSplit.splice(4);
				pathSplit.splice(0, 0, titleSplit.splice(1).join(':'));
				query.gapprefix = pathSplit.join('/');
			}
		}

	// On normal pages
	} else {
		query.generator = 'links';
		query.titles = mw.config.get('wgPageName');
		query.gpllimit = Twinkle.getPref('batchMax');
	}

	const statusdiv = document.createElement('div');
	statusdiv.style.padding = '15px'; // just so it doesn't look broken
	Window.setContent(statusdiv);
	Morebits.Status.init(statusdiv);
	Window.display();

	Twinkle.batchdelete.pages = {};

	const statelem = new Morebits.Status('Henter liste over sider');
	const wikipediaApi = new Morebits.wiki.Api('indlæser...', query, ((apiobj) => {
		const response = apiobj.getResponse();
		let pages = (response.query && response.query.pages) || [];
		pages = pages.filter((page) => !page.missing && page.imagerepository !== 'shared');
		pages.sort(Twinkle.sortByNamespace);
		pages.forEach((page) => {
			const metadata = [];
			if (page.redirect) {
				metadata.push('omdirigering');
			}

			const editProt = page.protection.filter((pr) => pr.type === 'edit' && pr.level === 'sysop').pop();
			if (editProt) {
				metadata.push('fuldt beskyttet' +
				(editProt.expiry === 'infinity' ? ' på ubestemt tid' : ', udløber ' + new Morebits.Date(editProt.expiry).calendar('utc') + ' (UTC)'));
			}

			if (page.ns === 6) {
				metadata.push('oploader: ' + page.imageinfo[0].user);
				metadata.push('seneste redigering fra: ' + page.revisions[0].user);
			} else {
				metadata.push(mw.language.convertNumber(page.revisions[0].size) + ' byte');
			}

			const title = page.title;
			Twinkle.batchdelete.pages[title] = {
				label: title + (metadata.length ? ' (' + metadata.join('; ') + ')' : ''),
				value: title,
				checked: true,
				style: editProt ? 'color:red' : ''
			};
		});

		const form = apiobj.params.form;
		form.append({ type: 'header', label: 'Sider at slette' });
		form.append({
			type: 'button',
			label: 'Vælg alle',
			event: function dBatchSelectAll() {
				$(result).find('input[name=pages]:not(:checked)').each((_, e) => {
					e.click(); // check it, and invoke click event so that subgroup can be shown
				});

				// Check any unchecked subpages too
				$('input[name="pages.subpages"]').prop('checked', true);
			}
		});
		form.append({
			type: 'button',
			label: 'Fravælg alle',
			event: function dBatchDeselectAll() {
				$(result).find('input[name=pages]:checked').each((_, e) => {
					e.click(); // uncheck it, and invoke click event so that subgroup can be hidden
				});
			}
		});
		form.append({
			type: 'checkbox',
			name: 'pages',
			id: 'tw-dbatch-pages',
			shiftClickSupport: true,
			list: $.map(Twinkle.batchdelete.pages, (e) => e)
		});
		form.append({ type: 'submit' });

		var result = form.render();
		apiobj.params.Window.setContent(result);

		Morebits.QuickForm.getElements(result, 'pages').forEach(Twinkle.generateArrowLinks);

	}), statelem);

	wikipediaApi.params = { form: form, Window: Window };
	wikipediaApi.post();
};

Twinkle.batchdelete.generateNewPageList = function(form) {

	// Update the list of checked pages in Twinkle.batchdelete.pages object
	const elements = form.elements.pages;
	if (elements instanceof NodeList) { // if there are multiple pages
		for (let i = 0; i < elements.length; ++i) {
			Twinkle.batchdelete.pages[elements[i].value].checked = elements[i].checked;
		}
	} else if (elements instanceof HTMLInputElement) { // if there is just one page
		Twinkle.batchdelete.pages[elements.value].checked = elements.checked;
	}

	return new Morebits.QuickForm.Element({
		type: 'checkbox',
		name: 'pages',
		id: 'tw-dbatch-pages',
		shiftClickSupport: true,
		list: $.map(Twinkle.batchdelete.pages, (e) => e)
	}).render();
};

Twinkle.batchdelete.callback.toggleSubpages = function twDbatchToggleSubpages(e) {

	const form = e.target.form;
	let newPageList;

	if (e.target.checked) {

		form.delete_subpage_redirects.checked = form.delete_redirects.checked;
		form.delete_subpage_talks.checked = form.delete_talk.checked;
		form.unlink_subpages.checked = form.unlink_page.checked;

		// If lists of subpages were already loaded once, they are
		// available without use of any API calls
		if (subpagesLoaded) {

			$.each(Twinkle.batchdelete.pages, (i, el) => {
				// Get back the subgroup from subgroupBeforeDeletion, where we saved it
				if (el.subgroup === null && el.subgroupBeforeDeletion) {
					el.subgroup = el.subgroupBeforeDeletion;
				}
			});

			newPageList = Twinkle.batchdelete.generateNewPageList(form);
			$('#tw-dbatch-pages').replaceWith(newPageList);

			Morebits.QuickForm.getElements(newPageList, 'pages').forEach(Twinkle.generateArrowLinks);
			Morebits.QuickForm.getElements(newPageList, 'pages.subpages').forEach(Twinkle.generateArrowLinks);

			return;
		}

		// Proceed with API calls to get list of subpages
		const loadingText = '<strong id="dbatch-subpage-loading">Indlæser... </strong>';
		$(e.target).after(loadingText);

		const pages = $(form.pages).map((i, el) => el.value).get();

		const subpageLister = new Morebits.BatchOperation();
		subpageLister.setOption('chunkSize', Twinkle.getPref('batchChunks'));
		subpageLister.setPageList(pages);
		subpageLister.run((pageName) => {
			const pageTitle = mw.Title.newFromText(pageName);

			// No need to look for subpages in main/file/mediawiki space
			if ([0, 6, 8].includes(pageTitle.namespace)) {
				subpageLister.workerSuccess();
				return;
			}

			const wikipediaApi = new Morebits.wiki.Api('Henter liste over undersider til ' + pageName, {
				action: 'query',
				prop: 'revisions|info|imageinfo',
				generator: 'allpages',
				rvprop: 'size',
				inprop: 'protection',
				gapprefix: pageTitle.title + '/',
				gapnamespace: pageTitle.namespace,
				gaplimit: 'max', // 500 is max for normal users, 5000 for bots and sysops
				format: 'json'
			}, ((apiobj) => {
				const response = apiobj.getResponse();
				const pages = (response.query && response.query.pages) || [];
				const subpageList = [];
				pages.sort(Twinkle.sortByNamespace);
				pages.forEach((page) => {
					const metadata = [];
					if (page.redirect) {
						metadata.push('omdirigering');
					}

					const editProt = page.protection.filter((pr) => pr.type === 'edit' && pr.level === 'sysop').pop();
					if (editProt) {
						metadata.push('fuldt beskyttet' +
						(editProt.expiry === 'infinity' ? ' på ubestemt tid' : ', udløber ' + new Morebits.Date(editProt.expiry).calendar('utc') + ' (UTC)'));
					}
					if (page.ns === 6) {
						metadata.push('oploader: ' + page.imageinfo[0].user);
						metadata.push('seneste redigering fra: ' + page.revisions[0].user);
					} else {
						metadata.push(mw.language.convertNumber(page.revisions[0].size) + ' byte');
					}

					const title = page.title;
					subpageList.push({
						label: title + (metadata.length ? ' (' + metadata.join('; ') + ')' : ''),
						value: title,
						checked: true,
						style: editProt ? 'color:red' : ''
					});
				});
				if (subpageList.length) {
					const pageName = apiobj.params.pageNameFull;
					Twinkle.batchdelete.pages[pageName].subgroup = {
						type: 'checkbox',
						name: 'subpages',
						className: 'dbatch-subpages',
						shiftClickSupport: true,
						list: subpageList
					};
				}
				subpageLister.workerSuccess();
			}), null /* statusElement */, (() => {
				subpageLister.workerFailure();
			}));
			wikipediaApi.params = { pageNameFull: pageName }; // Used in onSuccess()
			wikipediaApi.post();

		}, () => {
			// List 'em on the interface

			newPageList = Twinkle.batchdelete.generateNewPageList(form);
			$('#tw-dbatch-pages').replaceWith(newPageList);

			Morebits.QuickForm.getElements(newPageList, 'pages').forEach(Twinkle.generateArrowLinks);
			Morebits.QuickForm.getElements(newPageList, 'pages.subpages').forEach(Twinkle.generateArrowLinks);

			subpagesLoaded = true;

			// Remove "Loading... " text
			$('#dbatch-subpage-loading').remove();

		});

	} else if (!e.target.checked) {

		$.each(Twinkle.batchdelete.pages, (i, el) => {
			if (el.subgroup) {
				// Remove subgroup after saving its contents in subgroupBeforeDeletion
				// so that it can be retrieved easily if user decides to
				// delete the subpages again
				el.subgroupBeforeDeletion = el.subgroup;
				el.subgroup = null;
			}
		});

		newPageList = Twinkle.batchdelete.generateNewPageList(form);
		$('#tw-dbatch-pages').replaceWith(newPageList);

		Morebits.QuickForm.getElements(newPageList, 'pages').forEach(Twinkle.generateArrowLinks);
	}
};

Twinkle.batchdelete.callback.evaluate = function twinklebatchdeleteCallbackEvaluate(event) {
	Morebits.wiki.actionCompleted.notice = 'Massesletning er nu fuldført';

	const form = event.target;

	const numProtected = $(Morebits.QuickForm.getElements(form, 'pages')).filter((index, element) => element.checked && element.nextElementSibling.style.color === 'red').length;
	if (numProtected > 0 && !confirm('Du er ved at slette ' + mw.language.convertNumber(numProtected) + ' fuldt beskyttet(e) side(r). Er du sikker?')) {
		return;
	}

	const input = Morebits.QuickForm.getInputData(form);

	if (!input.reason) {
		alert('Du skal angive en begrundelse!');
		return;
	}
	Morebits.SimpleWindow.setButtonsEnabled(false);
	Morebits.Status.init(form);
	if (!input.pages || input.pages.length === 0) { // undefined if there are no pages linked from the page
		Morebits.Status.error('Fejl', 'intet at slette, afbryder');
		return;
	}

	const pageDeleter = new Morebits.BatchOperation(input.delete_page ? 'Sletter sider' : 'Starter anmodede opgaver');
	pageDeleter.setOption('chunkSize', Twinkle.getPref('batchChunks'));
	// we only need the initial status lines if we're deleting the pages in the pages array
	pageDeleter.setOption('preserveIndividualStatusLines', input.delete_page);
	pageDeleter.setPageList(input.pages);
	pageDeleter.run((pageName) => {
		const params = {
			page: pageName,
			delete_page: input.delete_page,
			delete_talk: input.delete_talk,
			delete_redirects: input.delete_redirects,
			unlink_page: input.unlink_page,
			unlink_file: input.unlink_file && new RegExp('^' + Morebits.namespaceRegex(6) + ':', 'i').test(pageName),
			reason: input.reason,
			pageDeleter: pageDeleter
		};

		const wikipediaPage = new Morebits.wiki.Page(pageName, 'Sletter side ' + pageName);
		wikipediaPage.setCallbackParameters(params);
		if (input.delete_page) {
			wikipediaPage.setEditSummary(input.reason);
			wikipediaPage.setChangeTags(Twinkle.changeTags);
			wikipediaPage.suppressProtectWarning();
			wikipediaPage.deletePage(Twinkle.batchdelete.callbacks.doExtras, pageDeleter.workerFailure);
		} else {
			Twinkle.batchdelete.callbacks.doExtras(wikipediaPage);
		}
	}, () => {
		if (input.delete_subpages && input.subpages) {
			const subpageDeleter = new Morebits.BatchOperation('Sletter undersider');
			subpageDeleter.setOption('chunkSize', Twinkle.getPref('batchChunks'));
			subpageDeleter.setOption('preserveIndividualStatusLines', true);
			subpageDeleter.setPageList(input.subpages);
			subpageDeleter.run((pageName) => {
				const params = {
					page: pageName,
					delete_page: true,
					delete_talk: input.delete_subpage_talks,
					delete_redirects: input.delete_subpage_redirects,
					unlink_page: input.unlink_subpages,
					unlink_file: false,
					reason: input.reason,
					pageDeleter: subpageDeleter
				};

				const wikipediaPage = new Morebits.wiki.Page(pageName, 'Sletter underside ' + pageName);
				wikipediaPage.setCallbackParameters(params);
				wikipediaPage.setEditSummary(input.reason);
				wikipediaPage.setChangeTags(Twinkle.changeTags);
				wikipediaPage.suppressProtectWarning();
				wikipediaPage.deletePage(Twinkle.batchdelete.callbacks.doExtras, pageDeleter.workerFailure);
			});
		}
	});
};

Twinkle.batchdelete.callbacks = {
	// this stupid parameter name is a temporary thing until I implement an overhaul
	// of Morebits.wiki.* callback parameters
	doExtras: function(thingWithParameters) {
		const params = thingWithParameters.parent ? thingWithParameters.parent.getCallbackParameters() :
			thingWithParameters.getCallbackParameters();
		// the initial batch operation's job is to delete the page, and that has
		// succeeded by now
		params.pageDeleter.workerSuccess(thingWithParameters);

		let query, wikipediaApi;

		if (params.unlink_page) {
			Twinkle.batchdelete.unlinkCache = {};
			query = {
				action: 'query',
				list: 'backlinks',
				blfilterredir: 'nonredirects',
				blnamespace: [0, 100], // main space and portal space only
				bltitle: params.page,
				bllimit: 'max', // 500 is max for normal users, 5000 for bots and sysops
				format: 'json'
			};
			wikipediaApi = new Morebits.wiki.Api('Henter bagudlinks', query, Twinkle.batchdelete.callbacks.unlinkBacklinksMain);
			wikipediaApi.params = params;
			wikipediaApi.post();
		}

		if (params.unlink_file) {
			query = {
				action: 'query',
				list: 'imageusage',
				iutitle: params.page,
				iulimit: 'max', // 500 is max for normal users, 5000 for bots and sysops
				format: 'json'
			};
			wikipediaApi = new Morebits.wiki.Api('Henter fillinks', query, Twinkle.batchdelete.callbacks.unlinkImageInstancesMain);
			wikipediaApi.params = params;
			wikipediaApi.post();
		}

		if (params.delete_page) {
			if (params.delete_redirects) {
				query = {
					action: 'query',
					titles: params.page,
					prop: 'redirects',
					rdlimit: 'max', // 500 is max for normal users, 5000 for bots and sysops
					format: 'json'
				};
				wikipediaApi = new Morebits.wiki.Api('Henter omdirigeringer', query, Twinkle.batchdelete.callbacks.deleteRedirectsMain);
				wikipediaApi.params = params;
				wikipediaApi.post();
			}
			if (params.delete_talk) {
				const pageTitle = mw.Title.newFromText(params.page);
				if (pageTitle && pageTitle.namespace % 2 === 0 && pageTitle.namespace !== 2) {
					pageTitle.namespace++; // now pageTitle is the talk page title!
					query = {
						action: 'query',
						titles: pageTitle.toText(),
						format: 'json'
					};
					wikipediaApi = new Morebits.wiki.Api('Kontrollerer om diskussionssiden eksisterer', query, Twinkle.batchdelete.callbacks.deleteTalk);
					wikipediaApi.params = params;
					wikipediaApi.params.talkPage = pageTitle.toText();
					wikipediaApi.post();
				}
			}
		}
	},
	deleteRedirectsMain: function(apiobj) {
		const response = apiobj.getResponse();
		let pages = response.query.pages[0].redirects || [];
		pages = pages.map((redirect) => redirect.title);
		if (!pages.length) {
			return;
		}

		const redirectDeleter = new Morebits.BatchOperation('Sletter omdirigeringer til ' + apiobj.params.page);
		redirectDeleter.setOption('chunkSize', Twinkle.getPref('batchChunks'));
		redirectDeleter.setPageList(pages);
		redirectDeleter.run((pageName) => {
			const wikipediaPage = new Morebits.wiki.Page(pageName, 'Sletter ' + pageName);
			wikipediaPage.setEditSummary('[[WP:CSD#G8|G8]]: Redirect to deleted page [[' + apiobj.params.page + ']]');
			wikipediaPage.setChangeTags(Twinkle.changeTags);
			wikipediaPage.deletePage(redirectDeleter.workerSuccess, redirectDeleter.workerFailure);
		});
	},
	deleteTalk: function(apiobj) {
		const response = apiobj.getResponse();

		// no talk page; forget about it
		if (response.query.pages[0].missing) {
			return;
		}

		const page = new Morebits.wiki.Page(apiobj.params.talkPage, 'Sletter diskussionssiden for siden ' + apiobj.params.page);
		page.setEditSummary('[[WP:CSD#G8|G8]]: [[Help:Talk page|Talk page]] of deleted page [[' + apiobj.params.page + ']]');
		page.setChangeTags(Twinkle.changeTags);
		page.deletePage();
	},
	unlinkBacklinksMain: function(apiobj) {
		const response = apiobj.getResponse();
		let pages = response.query.backlinks || [];
		pages = pages.map((page) => page.title);
		if (!pages.length) {
			return;
		}

		const unlinker = new Morebits.BatchOperation('Fjerner links til ' + apiobj.params.page);
		unlinker.setOption('chunkSize', Twinkle.getPref('batchChunks'));
		unlinker.setPageList(pages);
		unlinker.run((pageName) => {
			const wikipediaPage = new Morebits.wiki.Page(pageName, 'Fjerner links på ' + pageName);
			const params = $.extend({}, apiobj.params);
			params.title = pageName;
			params.unlinker = unlinker;
			wikipediaPage.setCallbackParameters(params);
			wikipediaPage.load(Twinkle.batchdelete.callbacks.unlinkBacklinks);
		});
	},
	unlinkBacklinks: function(pageobj) {
		const params = pageobj.getCallbackParameters();
		if (!pageobj.exists()) {
			// we probably just deleted it, as a recursive backlink
			params.unlinker.workerSuccess(pageobj);
			return;
		}

		let text;
		if (params.title in Twinkle.batchdelete.unlinkCache) {
			text = Twinkle.batchdelete.unlinkCache[params.title];
		} else {
			text = pageobj.getPageText();
		}
		const oldText = text;
		const wikiPage = new Morebits.wikitext.Page(text);
		text = wikiPage.removeLink(params.page).getText();

		Twinkle.batchdelete.unlinkCache[params.title] = text;
		if (text === oldText) {
			// Nothing to do, return
			params.unlinker.workerSuccess(pageobj);
			return;
		}
		pageobj.setEditSummary('Fjerner link(s) til slettet side ' + params.page);
		pageobj.setChangeTags(Twinkle.changeTags);
		pageobj.setPageText(text);
		pageobj.setCreateOption('nocreate');
		pageobj.setMaxConflictRetries(10);
		pageobj.save(params.unlinker.workerSuccess, params.unlinker.workerFailure);
	},
	unlinkImageInstancesMain: function(apiobj) {
		const response = apiobj.getResponse();
		let pages = response.query.imageusage || [];
		pages = pages.map((page) => page.title);
		if (!pages.length) {
			return;
		}

		const unlinker = new Morebits.BatchOperation('Fjerner links til ' + apiobj.params.page);
		unlinker.setOption('chunkSize', Twinkle.getPref('batchChunks'));
		unlinker.setPageList(pages);
		unlinker.run((pageName) => {
			const wikipediaPage = new Morebits.wiki.Page(pageName, 'Fjerner filbrug på ' + pageName);
			const params = $.extend({}, apiobj.params);
			params.title = pageName;
			params.unlinker = unlinker;
			wikipediaPage.setCallbackParameters(params);
			wikipediaPage.load(Twinkle.batchdelete.callbacks.unlinkImageInstances);
		});
	},
	unlinkImageInstances: function(pageobj) {
		const params = pageobj.getCallbackParameters();
		if (!pageobj.exists()) {
			// we probably just deleted it, as a recursive backlink
			params.unlinker.workerSuccess(pageobj);
			return;
		}

		const image = params.page.replace(new RegExp('^' + Morebits.namespaceRegex(6) + ':'), '');
		let text;
		if (params.title in Twinkle.batchdelete.unlinkCache) {
			text = Twinkle.batchdelete.unlinkCache[params.title];
		} else {
			text = pageobj.getPageText();
		}
		const oldText = text;
		const wikiPage = new Morebits.wikitext.Page(text);
		text = wikiPage.commentOutImage(image, 'Commented out because image was deleted').getText();

		Twinkle.batchdelete.unlinkCache[params.title] = text;
		if (text === oldText) {
			pageobj.getStatusElement().error('failed to unlink image ' + image + ' from ' + pageobj.getPageName());
			params.unlinker.workerFailure(pageobj);
			return;
		}
		pageobj.setEditSummary('Removing instance of file ' + image + ' that has been deleted because "' + params.reason + '")');
		pageobj.setChangeTags(Twinkle.changeTags);
		pageobj.setPageText(text);
		pageobj.setCreateOption('nocreate');
		pageobj.setMaxConflictRetries(10);
		pageobj.save(params.unlinker.workerSuccess, params.unlinker.workerFailure);
	}
};

Twinkle.addInitCallback(Twinkle.batchdelete, 'batchdelete');
}());

// </nowiki>
