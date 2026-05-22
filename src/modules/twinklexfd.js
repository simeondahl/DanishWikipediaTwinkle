// <nowiki>

(function() {

/*
 ****************************************
 *** twinklexfd.js: SF-modul (Sletningsforslag)
 ****************************************
 * Aktiveringsform:    Fane ("SF")
 * Aktiv på:          Eksisterende, ikke-specielle sider
 */

Twinkle.xfd = function twinklexfd() {
	// Deaktivér på:
	// * specielle sider
	// * ikke-eksisterende sider
	if (mw.config.get('wgNamespaceNumber') < 0 || !mw.config.get('wgArticleId')) {
		return;
	}

	Twinkle.addPortletLink(Twinkle.xfd.callback, 'SF', 'tw-xfd', 'Start et sletningsforslag');
};

const utils = {
	/**
	 * Fjern navnerumspræfiks fra titel, hvis det er til stede
	 * Exception-safe wrapper around mw.Title
	 *
	 * @param {string} title
	 */
	stripNs: function(title) {
		const title_obj = mw.Title.newFromUserInput(title);
		if (!title_obj) {
			return title; // ugyldigt input; gør ingenting
		}
		return title_obj.getMainText();
	},

	/**
	 * Tilføj navnerumsnavn til sidetitel, hvis ikke allerede angivet
	 *
	 * @param {string} title
	 * @param {number} namespaceNumber
	 */
	addNs: function(title, namespaceNumber) {
		const title_obj = mw.Title.newFromUserInput(title, namespaceNumber);
		if (!title_obj) {
			return title; // ugyldigt input; gør ingenting
		}
		return title_obj.toText();
	}
};

Twinkle.xfd.currentRationale = null;

// fejl-callback på Morebits.Status.object
Twinkle.xfd.printRationale = function twinklexfdPrintRationale() {
	if (Twinkle.xfd.currentRationale) {
		Morebits.Status.printUserText(Twinkle.xfd.currentRationale, 'Din begrundelse for sletning er angivet nedenfor. Du kan kopiere og indsætte den i en ny SF-dialog, hvis du vil prøve igen:');
		// begrundelsen behøver kun udskrives én gang
		Twinkle.xfd.currentRationale = null;
	}
};

Twinkle.xfd.callback = function twinklexfdCallback() {
	const Window = new Morebits.SimpleWindow(600, 350);
	Window.setTitle('Start et sletningsforslag');
	Window.setScriptName('Twinkle');
	Window.addFooterLink('Om sletningsforslag', 'Wikipedia:Sletningsforslag');

	const form = new Morebits.QuickForm(Twinkle.xfd.callback.evaluate);

	form.append({
		type: 'textarea',
		name: 'reason',
		label: 'Begrundelse:',
		tooltip: 'Du kan bruge wikimarkup i din begrundelse. Twinkle tilføjer automatisk din signatur.'
	});

	form.append({
		type: 'checkbox',
		list: [
			{
				label: 'Underret sidens opretter, hvis muligt',
				value: 'notify',
				name: 'notifycreator',
				tooltip: 'En besked vil blive lagt på opretterens diskussionsside.',
				checked: true
			}
		]
	});

	const previewlink = document.createElement('a');
	$(previewlink).on('click', () => {
		Twinkle.xfd.callbacks.preview(result); // |result| defineres nedenfor
	});
	previewlink.style.cursor = 'pointer';
	previewlink.textContent = 'Forhåndsvisning';
	form.append({ type: 'div', id: 'xfdpreview', label: [ previewlink ] });
	form.append({ type: 'div', id: 'twinklexfd-previewbox', style: 'display: none' });

	form.append({ type: 'submit', value: 'Indsend' });

	var result = form.render();
	Window.setContent(result);
	Window.display();
	result.previewer = new Morebits.wiki.Preview($(result).find('div#twinklexfd-previewbox').last()[0]);
};

Twinkle.xfd.callbacks = {
	getTagText: function(params) {
		return '{{Sletningsforslag|dato={{subst:CURRENTMONTHNAME}} {{subst:CURRENTYEAR}}|begrundelse=' +
			Morebits.string.formatReasonText(params.reason) + '}}';
	},

	getDiscussionWikitext: function(params) {
		return '=== [[' + Morebits.pageNameNorm + ']] ===\n' +
			Morebits.string.formatReasonText(params.reason, true) + ' ~~~~\n';
	},

	preview: function(form) {
		const params = Morebits.QuickForm.getInputData(form);
		const templatetext = Twinkle.xfd.callbacks.getTagText(params);
		form.previewer.beginRender(templatetext, Morebits.pageNameNorm);
	},

	/**
	 * Underret sidens opretter om sletningsforslaget
	 *
	 * @param {Object} params
	 * @param {string} creator Brugernavnet på sidens opretter
	 */
	notifyCreator: function(params, creator) {
		// Undgå at advare dig selv
		if (creator === mw.config.get('wgUserName')) {
			Morebits.Status.warn('Du (' + creator + ') oprettede denne side; springer brugerunderretning over');
			Twinkle.xfd.callbacks.addToLog(params, null);
			return;
		}

		const notifytext = '\n{{subst:Sletningsforslag underretning|side=' + Morebits.pageNameNorm + '}} ~~~~';
		const editSummary = 'Underretning: [[:' + Morebits.pageNameNorm + ']] er foreslået slettet på [[Wikipedia:Sletningsforslag]].';

		const usertalkpage = new Morebits.wiki.Page('Brugerdiskussion:' + creator, 'Underretter sidens opretter (' + creator + ')');
		usertalkpage.setAppendText(notifytext);
		usertalkpage.setEditSummary(editSummary);
		usertalkpage.setChangeTags(Twinkle.changeTags);
		usertalkpage.setCreateOption('recreate');
		usertalkpage.setWatchlist(Twinkle.getPref('xfdWatchUser'));
		usertalkpage.setFollowRedirect(true, false);
		usertalkpage.append(() => {
			Twinkle.xfd.callbacks.addToLog(params, creator);
		}, () => {
			Twinkle.xfd.callbacks.addToLog(params, null);
		});
	},

	addToLog: function(params, initialContrib) {
		if (!Twinkle.getPref('logXfdNominations') || Twinkle.getPref('noLogOnXfdNomination').includes('sf')) {
			return;
		}

		const usl = new Morebits.UserspaceLogger(Twinkle.getPref('xfdLogPageName'));

		usl.initialText =
			'Dette er en log over alle [[Wikipedia:Sletningsforslag|sletningsforslag]] indsendt af denne bruger ved hjælp af [[WP:TW|Twinkles]] SF-modul.\n\n' +
			'Hvis du ikke længere ønsker at beholde denne log, kan du deaktivere den i indstillingspanelet og ' +
			'foreslå denne side slettet via [[WP:HS#B6|HS B6]].' +
			(Morebits.userIsSysop ? '\n\nDenne log sporer ikke SF-relaterede sletninger foretaget med Twinkle.' : '');

		const editsummary = params.discussionpage ?
			'Logger [[' + params.discussionpage + '|SF-forslag]] om [[:' + Morebits.pageNameNorm + ']].' :
			'Logger SF-forslag om [[:' + Morebits.pageNameNorm + ']].';

		let appendText = '# [[:' + Morebits.pageNameNorm + ']]: foreslået slettet på [[Wikipedia:Sletningsforslag]]';

		if (initialContrib && params.notifycreator) {
			appendText += '; underrettede {{bruger|1=' + initialContrib + '}}';
		}
		appendText += ' ~~~~~';
		if (params.reason) {
			appendText += "\n#* '''Begrundelse''': " + Morebits.string.formatReasonForLog(params.reason);
		}

		usl.changeTags = Twinkle.changeTags;
		usl.log(appendText, editsummary);
	},

	sf: {
		/**
		 * Trin 1: Tag siden med {{Sletningsforslag}}
		 */
		taggingPage: function(pageobj) {
			const text = pageobj.getPageText();
			const params = pageobj.getCallbackParameters();
			const statelem = pageobj.getStatusElement();

			if (!pageobj.exists()) {
				statelem.error('Siden ser ikke ud til at eksistere; den er måske allerede slettet.');
				return;
			}

			// Kontroller om siden allerede har et sletningsforslag-tag
			if (/\{\{\s*[Ss]letningsforslag/.test(text)) {
				if (!confirm('Siden har allerede et sletningsforslag-tag. Klik OK for at erstatte det, eller Annuller for at afbryde.')) {
					statelem.error('Siden er allerede tagget med sletningsforslag, og du valgte at afbryde.');
					window.location.reload();
					return;
				}
			}

			// Markér siden som patruljeret, hvis ønsket
			if (Twinkle.getPref('markXfdPagesAsPatrolled')) {
				pageobj.triage();
			}

			// Start oprettelse af afsnittet på Wikipedia:Sletningsforslag
			const sfPage = new Morebits.wiki.Page('Wikipedia:Sletningsforslag', 'Tilføjer sletningsforslag til Wikipedia:Sletningsforslag');
			sfPage.setFollowRedirect(true);
			sfPage.setCallbackParameters(params);
			sfPage.load(Twinkle.xfd.callbacks.sf.addToList);

			// Underret opretteren, hvis valgt
			if (params.notifycreator) {
				const thispage = new Morebits.wiki.Page(mw.config.get('wgPageName'));
				thispage.setCallbackParameters(params);
				thispage.setLookupNonRedirectCreator(true);
				thispage.lookupCreation((po) => {
					Twinkle.xfd.callbacks.notifyCreator(po.getCallbackParameters(), po.getCreator());
				});
			} else {
				Twinkle.xfd.callbacks.addToLog(params, null);
			}

			// Tag artiklen
			params.tagText = Twinkle.xfd.callbacks.getTagText(params) + '\n';

			if (pageobj.canEdit()) {
				// Fjern eventuelle eksisterende sletningsforslag-tags
				let newText = text.replace(/\{\{\s*[Ss]letningsforslag[^}]*\}\}\s*/g, '');

				// Indsæt tag i starten af siden (eller efter korte beskrivelser/hatnotes)
				const wikipage = new Morebits.wikitext.Page(newText);
				newText = wikipage.insertAfterTemplates(params.tagText, Twinkle.hatnoteRegex).getText();

				pageobj.setPageText(newText);
				pageobj.setEditSummary('Foreslår sletning; se [[Wikipedia:Sletningsforslag#' + Morebits.pageNameNorm + ']].');
				pageobj.setChangeTags(Twinkle.changeTags);
				pageobj.setWatchlist(Twinkle.getPref('xfdWatchPage'));
				pageobj.setCreateOption('nocreate');
				pageobj.save();
			} else {
				// Siden er beskyttet — vi kan ikke redigere den direkte
				statelem.warn('Siden er beskyttet; kan ikke tilføje tag automatisk.');
			}
		},

		/**
		 * Trin 2: Tilføj sletningsforslaget til Wikipedia:Sletningsforslag
		 */
		addToList: function(pageobj) {
			const params = pageobj.getCallbackParameters();
			const statelem = pageobj.getStatusElement();

			const added_data = Twinkle.xfd.callbacks.getDiscussionWikitext(params);
			let text;

			if (!pageobj.exists()) {
				text = added_data;
			} else {
				const old_text = pageobj.getPageText();
				// Forsøg at tilføje afsnittet øverst i listen (under den øverste overskrift / introduktionssektionen)
				// Sletningsforslag-siden forventes at have en markering som <!-- Nye forslag tilføjes her -->
				// eller vi appender til sidst
				if (/<!--\s*[Nn]ye forslag tilføjes her\s*-->/.test(old_text)) {
					text = old_text.replace(
						/(<!--\s*[Nn]ye forslag tilføjes her\s*-->)/,
						'$1\n' + added_data
					);
				} else {
					// Fallback: tilføj til sidst på siden
					text = old_text.trimEnd() + '\n\n' + added_data;
				}

				if (text === old_text) {
					statelem.warn('Kunne ikke finde det rette sted på siden; tilføjer til sidst.');
					text = old_text.trimEnd() + '\n\n' + added_data;
				}
			}

			params.discussionpage = 'Wikipedia:Sletningsforslag#' + Morebits.pageNameNorm;

			pageobj.setPageText(text);
			pageobj.setEditSummary('Tilføjer sletningsforslag for [[:' + Morebits.pageNameNorm + ']].');
			pageobj.setChangeTags(Twinkle.changeTags);
			pageobj.setWatchlist(Twinkle.getPref('xfdWatchDiscussion'));
			pageobj.setCreateOption('recreate');
			pageobj.save(() => {
				Twinkle.xfd.currentRationale = null; // eventuelle fejl fra nu af behøver ikke at udskrive begrundelsen, da den er gemt på wikien
			});
		}
	}
};

Twinkle.xfd.callback.evaluate = function(e) {
	const form = e.target;
	const params = Morebits.QuickForm.getInputData(form);

	if (!params.reason || !params.reason.trim()) {
		alert('Du skal angive en begrundelse for sletningsforslaget.');
		return;
	}

	Morebits.SimpleWindow.setButtonsEnabled(false);
	Morebits.Status.init(form);

	Twinkle.xfd.currentRationale = params.reason;
	Morebits.Status.onError(Twinkle.xfd.printRationale);

	// Opdater data for handlingen "afsluttet"-event
	Morebits.wiki.actionCompleted.redirect = 'Wikipedia:Sletningsforslag';
	Morebits.wiki.actionCompleted.notice = 'Sletningsforslag oprettet; omdirigerer til Wikipedia:Sletningsforslag';

	// Tag siden
	const wikipedia_page = new Morebits.wiki.Page(mw.config.get('wgPageName'), 'Tilføjer sletningsforslag-tag til siden');
	wikipedia_page.setFollowRedirect(true);
	wikipedia_page.setCallbackParameters(params);
	wikipedia_page.load(Twinkle.xfd.callbacks.sf.taggingPage);
};

Twinkle.addInitCallback(Twinkle.xfd, 'xfd');
}());

// </nowiki>
