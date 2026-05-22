// <nowiki>

(function() {

/*
 ****************************************
 *** twinklebatchundelete.js: Masse-gensletningsmodul
 ****************************************
 * Mode of invocation:     Tab ("M-gendan")
 * Active on:              Existing user and project pages
 */

Twinkle.batchundelete = function twinklebatchundelete() {
	if (!Morebits.userIsSysop || !mw.config.get('wgArticleId') || (
		mw.config.get('wgNamespaceNumber') !== mw.config.get('wgNamespaceIds').user &&
		mw.config.get('wgNamespaceNumber') !== mw.config.get('wgNamespaceIds').project)) {
		return;
	}
	Twinkle.addPortletLink(Twinkle.batchundelete.callback, 'M-gendan', 'tw-batch-undel', 'Gendan dem alle');
};

Twinkle.batchundelete.callback = function twinklebatchundeleteCallback() {
	const Window = new Morebits.SimpleWindow(600, 400);
	Window.setScriptName('Twinkle');
	Window.setTitle('Masse-gendannelse');

	const form = new Morebits.QuickForm(Twinkle.batchundelete.callback.evaluate);
	form.append({
		type: 'checkbox',
		list: [
			{
				label: 'Gendan diskussionssider for gendannede sider, hvis de eksisterede',
				name: 'undel_talk',
				value: 'undel_talk',
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

	const statusdiv = document.createElement('div');
	statusdiv.style.padding = '15px'; // just so it doesn't look broken
	Window.setContent(statusdiv);
	Morebits.Status.init(statusdiv);
	Window.display();

	const query = {
		action: 'query',
		generator: 'links',
		prop: 'info',
		inprop: 'protection',
		titles: mw.config.get('wgPageName'),
		gpllimit: Twinkle.getPref('batchMax'),
		format: 'json'
	};
	const statelem = new Morebits.Status('Henter liste over sider');
	const wikipediaApi = new Morebits.wiki.Api('indlæser...', query, ((apiobj) => {
		const response = apiobj.getResponse();
		let pages = (response.query && response.query.pages) || [];
		pages = pages.filter((page) => page.missing);
		const list = [];
		pages.sort(Twinkle.sortByNamespace);
		pages.forEach((page) => {
			const editProt = page.protection.filter((pr) => pr.type === 'create' && pr.level === 'sysop').pop();

			const title = page.title;
			list.push({
				label: title + (editProt ? ' (fuldt oprettelsesbeskyttet' +
					(editProt.expiry === 'infinity' ? ' på ubestemt tid' : ', udløber ' + new Morebits.Date(editProt.expiry).calendar('utc') + ' (UTC)') + ')' : ''),
				value: title,
				checked: true,
				style: editProt ? 'color:red' : ''
			});
		});
		apiobj.params.form.append({ type: 'header', label: 'Sider at gendanne' });
		apiobj.params.form.append({
			type: 'button',
			label: 'Vælg alle',
			event: function(e) {
				$(Morebits.QuickForm.getElements(e.target.form, 'pages')).prop('checked', true);
			}
		});
		apiobj.params.form.append({
			type: 'button',
			label: 'Fravælg alle',
			event: function(e) {
				$(Morebits.QuickForm.getElements(e.target.form, 'pages')).prop('checked', false);
			}
		});
		apiobj.params.form.append({
			type: 'checkbox',
			name: 'pages',
			shiftClickSupport: true,
			list: list
		});
		apiobj.params.form.append({ type: 'submit' });

		const result = apiobj.params.form.render();
		apiobj.params.Window.setContent(result);

		Morebits.QuickForm.getElements(result, 'pages').forEach(Twinkle.generateArrowLinks);

	}), statelem);
	wikipediaApi.params = { form: form, Window: Window };
	wikipediaApi.post();
};

Twinkle.batchundelete.callback.evaluate = function(event) {
	Morebits.wiki.actionCompleted.notice = 'Masse-gendannelse er nu fuldført';

	const numProtected = Morebits.QuickForm.getElements(event.target, 'pages').filter((element) => element.checked && element.nextElementSibling.style.color === 'red').length;
	if (numProtected > 0 && !confirm('Du er ved at gendanne ' + numProtected + ' fuldt oprettelsesbeskyttet(e) side(r). Er du sikker?')) {
		return;
	}

	const input = Morebits.QuickForm.getInputData(event.target);

	if (!input.reason) {
		alert('Du skal angive en begrundelse!');
		return;
	}
	Morebits.SimpleWindow.setButtonsEnabled(false);
	Morebits.Status.init(event.target);

	if (!input.pages || !input.pages.length) {
		Morebits.Status.error('Fejl', 'intet at gendanne, afbryder');
		return;
	}

	const pageUndeleter = new Morebits.BatchOperation('Gendanner sider');
	pageUndeleter.setOption('chunkSize', Twinkle.getPref('batchChunks'));
	pageUndeleter.setOption('preserveIndividualStatusLines', true);
	pageUndeleter.setPageList(input.pages);
	pageUndeleter.run((pageName) => {
		const params = {
			page: pageName,
			undel_talk: input.undel_talk,
			reason: input.reason,
			pageUndeleter: pageUndeleter
		};

		const wikipediaPage = new Morebits.wiki.Page(pageName, 'Gendanner side ' + pageName);
		wikipediaPage.setCallbackParameters(params);
		wikipediaPage.setEditSummary(input.reason);
		wikipediaPage.setChangeTags(Twinkle.changeTags);
		wikipediaPage.suppressProtectWarning();
		wikipediaPage.setMaxRetries(3); // temporary increase from 2 to make batchundelete more likely to succeed [[phab:T222402]] #613
		wikipediaPage.undeletePage(Twinkle.batchundelete.callbacks.doExtras, pageUndeleter.workerFailure);
	});
};

Twinkle.batchundelete.callbacks = {
	// this stupid parameter name is a temporary thing until I implement an overhaul
	// of Morebits.wiki.* callback parameters
	doExtras: function(thingWithParameters) {
		const params = thingWithParameters.parent ? thingWithParameters.parent.getCallbackParameters() :
			thingWithParameters.getCallbackParameters();
		// the initial batch operation's job is to delete the page, and that has
		// succeeded by now
		params.pageUndeleter.workerSuccess(thingWithParameters);

		let query, wikipediaApi;

		if (params.undel_talk) {
			const talkpagename = new mw.Title(params.page).getTalkPage().getPrefixedText();
			if (talkpagename !== params.page) {
				query = {
					action: 'query',
					prop: 'deletedrevisions',
					drvprop: 'ids',
					drvlimit: 1,
					titles: talkpagename,
					format: 'json'
				};
				wikipediaApi = new Morebits.wiki.Api('Kontrollerer diskussionsside for slettede versioner', query, Twinkle.batchundelete.callbacks.undeleteTalk);
				wikipediaApi.params = params;
				wikipediaApi.params.talkPage = talkpagename;
				wikipediaApi.post();
			}
		}
	},
	undeleteTalk: function(apiobj) {
		const page = apiobj.getResponse().query.pages[0];
		const exists = !page.missing;
		const delrevs = page.deletedrevisions && page.deletedrevisions[0].revid;

		if (exists || !delrevs) {
			// page exists or has no deleted revisions; forget about it
			return;
		}

		const talkpage = new Morebits.wiki.Page(apiobj.params.talkPage, 'Gendanner diskussionssiden for ' + apiobj.params.page);
		talkpage.setEditSummary('Undeleting [[Help:Talk page|talk page]] of "' + apiobj.params.page + '"');
		talkpage.setChangeTags(Twinkle.changeTags);
		talkpage.undeletePage();
	}
};

Twinkle.addInitCallback(Twinkle.batchundelete, 'batchundelete');
}());

// </nowiki>
