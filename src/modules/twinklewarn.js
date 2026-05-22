// <nowiki>

(function() {

/*
 ****************************************
 *** twinklewarn.js: Warn module
 ****************************************
 * Mode of invocation:     Tab ("Warn")
 * Active on:              Any page with relevant user name (userspace, contribs,
 *                         etc.) (not IP ranges), as well as the rollback success page
 */

Twinkle.warn = function twinklewarn() {

	// Users and IPs but not IP ranges
	if (mw.config.exists('wgRelevantUserName') && !Morebits.ip.isRange(mw.config.get('wgRelevantUserName'))) {
		Twinkle.addPortletLink(Twinkle.warn.callback, 'Advar', 'tw-warn', 'Advar/underret bruger');
		if (Twinkle.getPref('autoMenuAfterRollback') &&
			mw.config.get('wgNamespaceNumber') === 3 &&
			Twinkle.getPrefill('vanarticle') &&
			!Twinkle.getPrefill('twinklewelcome') &&
			!Twinkle.getPrefill('noautowarn')) {
			Twinkle.warn.callback();
		}
	}

	// Modify URL of talk page on rollback success pages, makes use of a
	// custom message box in [[MediaWiki:Rollback-success]]
	if (mw.config.get('wgAction') === 'rollback') {
		const $vandalTalkLink = $('#mw-rollback-success').find('.mw-usertoollinks a').first();
		if ($vandalTalkLink.length) {
			$vandalTalkLink.css('font-weight', 'bold');
			$vandalTalkLink.wrapInner($('<span>').attr('title', 'If appropriate, you can use Twinkle to warn the user about their edits to this page.'));

			// Can't provide vanarticlerevid as only wgCurRevisionId is provided
			const extraParam = 'vanarticle=' + mw.util.rawurlencode(Morebits.pageNameNorm);
			const href = $vandalTalkLink.attr('href');
			if (!href.includes('?')) {
				$vandalTalkLink.attr('href', href + '?' + extraParam);
			} else {
				$vandalTalkLink.attr('href', href + '&' + extraParam);
			}
		}
	}
};

// Used to close window when switching to ARV in autolevel
Twinkle.warn.dialog = null;

Twinkle.warn.callback = function twinklewarnCallback() {
	if (mw.config.get('wgRelevantUserName') === mw.config.get('wgUserName') &&
		!confirm('Du er ved at advare dig selv! Er du sikker på, at du vil fortsætte?')) {
		return;
	}

	Twinkle.warn.dialog = new Morebits.SimpleWindow(600, 440);
	const dialog = Twinkle.warn.dialog;
	dialog.setTitle('Advar/underret bruger');
	dialog.setScriptName('Twinkle');

	const form = new Morebits.QuickForm(Twinkle.warn.callback.evaluate);
	const main_select = form.append({
		type: 'field',
		label: 'Vælg type advarsel/meddelelse',
		tooltip: 'Vælg først en overordnet advarselskategori, derefter den specifikke advarsel.'
	});

	const main_group = main_select.append({
		type: 'select',
		name: 'main_group',
		tooltip: 'Du kan tilpasse standardvalget i dine Twinkle-præferencer',
		event: Twinkle.warn.callback.change_category
	});

	const defaultGroup = parseInt(Twinkle.getPref('defaultWarningGroup'), 10);
	// Dansk Wikipedia bruger Test/Test2/Test3 – ingen niveaudelt uw-*-system
	main_group.append({ type: 'option', label: 'Første besked ({{Test}})', value: 'singlenotice', selected: defaultGroup === 6 || defaultGroup === 1 });
	main_group.append({ type: 'option', label: 'Advarsler ({{Test2}}/{{Test3}})', value: 'singlewarn', selected: defaultGroup === 7 || defaultGroup === 2 || defaultGroup === 3 });
	if (Twinkle.getPref('customWarningList').length) {
		main_group.append({ type: 'option', label: 'Brugerdefinerede advarsler', value: 'custom', selected: defaultGroup === 9 });
	}
	main_group.append({ type: 'option', label: 'Alle advarsler', value: 'kitchensink', selected: defaultGroup === 10 });

	main_select.append({ type: 'select', name: 'sub_group', event: Twinkle.warn.callback.change_subcategory }); // Will be empty to begin with.

	form.append({
		type: 'input',
		name: 'article',
		label: 'Linket side',
		value: Twinkle.getPrefill('vanarticle') || '',
		tooltip: 'En side kan linkes fra advarslen, f.eks. fordi det var en tilbageføring på den pågældende side, der udløste advarslen. Lad feltet stå tomt, hvis ingen side skal linkes.'
	});

	form.append({
		type: 'div',
		label: '',
		style: 'color: red',
		id: 'twinkle-warn-warning-messages'
	});

	const more = form.append({ type: 'field', name: 'reasonGroup', label: 'Advarselsinformation' });
	more.append({ type: 'textarea', label: 'Valgfri besked:', name: 'reason', tooltip: 'Måske en begrundelse, eller at en mere detaljeret meddelelse skal tilføjes' });

	const previewlink = document.createElement('a');
	$(previewlink).on('click', () => {
		Twinkle.warn.callbacks.preview(result); // |result| is defined below
	});
	previewlink.style.cursor = 'pointer';
	previewlink.textContent = 'Forhåndsvisning';
	more.append({ type: 'div', id: 'warningpreview', label: [ previewlink ] });
	more.append({ type: 'div', id: 'twinklewarn-previewbox', style: 'display: none' });

	more.append({ type: 'submit', label: 'Send' });

	var result = form.render();
	dialog.setContent(result);
	dialog.display();
	result.main_group.root = result;
	result.previewer = new Morebits.wiki.Preview($(result).find('div#twinklewarn-previewbox').last()[0]);

	// Potential notices for staleness and missed reverts
	const vanrevid = Twinkle.getPrefill('vanarticlerevid');
	if (vanrevid) {
		let message = '';
		let query = {};

		// If you tried reverting, check if *you* actually reverted
		if (!Twinkle.getPrefill('noautowarn') && Twinkle.getPrefill('vanarticle')) { // Via rollback link
			query = {
				action: 'query',
				titles: Twinkle.getPrefill('vanarticle'),
				prop: 'revisions',
				rvstartid: vanrevid,
				rvlimit: 2,
				rvdir: 'newer',
				rvprop: 'user',
				format: 'json'
			};

			new Morebits.wiki.Api('Kontrollerer om du tilbageførte siden', query, ((apiobj) => {
				const rev = apiobj.getResponse().query.pages[0].revisions;
				const revertUser = rev && rev[1].user;
				if (revertUser && revertUser !== mw.config.get('wgUserName')) {
					message += ' En anden har tilbageført siden og har muligvis allerede advaret brugeren.';
					$('#twinkle-warn-warning-messages').text('Bemærk:' + message);
				}
			})).post();
		}

		// Confirm edit wasn't too old for a warning
		const checkStale = function(vantimestamp) {
			const revDate = new Morebits.Date(vantimestamp);
			if (vantimestamp && revDate.isValid()) {
				if (revDate.add(24, 'hours').isBefore(new Date())) {
					message += ' Denne redigering blev foretaget for mere end 24 timer siden, så en advarsel kan være forældet.';
					$('#twinkle-warn-warning-messages').text('Bemærk:' + message);
				}
			}
		};

		let vantimestamp = Twinkle.getPrefill('vantimestamp');
		// If from a rollback module-based revert, no API lookup necessary
		if (vantimestamp) {
			checkStale(vantimestamp);
		} else {
			query = {
				action: 'query',
				prop: 'revisions',
				rvprop: 'timestamp',
				revids: vanrevid,
				format: 'json'
			};
			new Morebits.wiki.Api('Henter versions-tidsstempler', query, ((apiobj) => {
				const rev = apiobj.getResponse().query.pages[0].revisions;
				vantimestamp = rev && rev[0].timestamp;
				checkStale(vantimestamp);
			})).post();
		}
	}

	// We must init the first choice (General Note);
	const evt = document.createEvent('Event');
	evt.initEvent('change', true, true);
	result.main_group.dispatchEvent(evt);
};

// Dette er alle advarsler der kan sendes af modulet.
// Hvert template kræver følgende oplysninger:
//   label (påkrævet): En kort beskrivelse vist i dialogen
//   summary (påkrævet): Redigeringsopsummeringen.
//   suppressArticleInSummary (valgfri): true = artikelnavn undertrykkes i opsummeringen.
//   hideLinkedPage (valgfri): true = skjul "Linket side"-feltet.
//   hideReason (valgfri): true = skjul "Valgfri besked"-feltet.
//
// Dansk Wikipedia bruger {{Test}}, {{Test2}}, {{Test3}} som advarselsskabeloner.
Twinkle.warn.messages = {
	// levels er tomt – dansk Wikipedia bruger ikke niveaudelte uw-*-skabeloner
	levels: {},

	// Første besked – {{Test}}
	singlenotice: {
		'Test': {
			label: 'Ukonstruktiv redigering – første besked',
			summary: 'Meddelelse: Ukonstruktiv redigering'
		}
	},

	// Advarsler – {{Test2}} og {{Test3}}
	singlewarn: {
		'Test2': {
			label: 'Ukonstruktiv redigering – anden advarsel',
			summary: 'Advarsel: Gentagen ukonstruktiv redigering'
		},
		'Test3': {
			label: 'Ukonstruktiv redigering – endelig advarsel',
			summary: 'Advarsel: Gentagen ukonstruktiv redigering – endelig advarsel'
		}
	}
};

/**
 * Reads Twinkle.warn.messages and returns a specified template's property (such as label, summary,
 * suppressArticleInSummary, hideLinkedPage, or hideReason)
 */
Twinkle.warn.getTemplateProperty = function(templates, templateName, propertyName) {
	let result;
	const isNumberedTemplate = templateName.match(/(1|2|3|4|4im)$/);
	if (isNumberedTemplate) {
		const unNumberedTemplateName = templateName.replace(/(?:1|2|3|4|4im)$/, '');
		const level = isNumberedTemplate[0];
		const numberedWarnings = {};
		$.each(templates.levels, (key, val) => {
			$.extend(numberedWarnings, val);
		});
		$.each(numberedWarnings, (key) => {
			if (key === unNumberedTemplateName) {
				result = numberedWarnings[key]['level' + level][propertyName];
			}
		});
	}

	// Non-level templates can also end in a number. So check this for all templates.
	const otherWarnings = {};
	$.each(templates, (key, val) => {
		if (key !== 'levels') {
			$.extend(otherWarnings, val);
		}
	});
	$.each(otherWarnings, (key) => {
		if (key === templateName) {
			result = otherWarnings[key][propertyName];
		}
	});

	return result;
};

// Used repeatedly below across menu rebuilds
Twinkle.warn.prev_article = null;
Twinkle.warn.prev_reason = null;
Twinkle.warn.talkpageObj = null;

Twinkle.warn.callback.change_category = function twinklewarnCallbackChangeCategory(e) {
	const value = e.target.value;
	const sub_group = e.target.root.sub_group;
	sub_group.main_group = value;
	let old_subvalue = sub_group.value;
	let old_subvalue_re;
	if (old_subvalue) {
		if (value === 'kitchensink') { // Exact match possible in kitchensink menu
			old_subvalue_re = new RegExp(mw.util.escapeRegExp(old_subvalue));
		} else {
			old_subvalue = old_subvalue.replace(/\d*(im)?$/, '');
			old_subvalue_re = new RegExp(mw.util.escapeRegExp(old_subvalue) + '(\\d*(?:im)?)$');
		}
	}

	while (sub_group.hasChildNodes()) {
		sub_group.removeChild(sub_group.firstChild);
	}

	let selected = false;
	// worker function to create the combo box entries
	const createEntries = function(contents, container, wrapInOptgroup, val = value) {
		// level2->2, singlewarn->''; also used to distinguish the
		// scaled levels from singlenotice, singlewarn, and custom
		const level = val.replace(/^\D+/g, '');
		// due to an apparent iOS bug, we have to add an option-group to prevent truncation of text
		// (search WT:TW archives for "Problem selecting warnings on an iPhone")
		if (wrapInOptgroup && $.client.profile().platform === 'iphone') {
			let wrapperOptgroup = new Morebits.QuickForm.Element({
				type: 'optgroup',
				label: 'Tilgængelige skabeloner'
			});
			wrapperOptgroup = wrapperOptgroup.render();
			container.appendChild(wrapperOptgroup);
			container = wrapperOptgroup;
		}

		$.each(contents, (itemKey, itemProperties) => {
			// Skip if the current template doesn't have a version for the current level
			if (!!level && !itemProperties[val]) {
				return;
			}
			const key = typeof itemKey === 'string' ? itemKey : itemProperties.value;
			const template = key + level;

			const elem = new Morebits.QuickForm.Element({
				type: 'option',
				label: '{{' + template + '}}: ' + (level ? itemProperties[val].label : itemProperties.label),
				value: template
			});

			// Select item best corresponding to previous selection
			if (!selected && old_subvalue && old_subvalue_re.test(template)) {
				elem.data.selected = selected = true;
			}
			const elemRendered = container.appendChild(elem.render());
			$(elemRendered).data('messageData', itemProperties);
		});
	};
	const createGroup = function(warnGroup, label, wrapInOptgroup, val) {
		wrapInOptgroup = typeof wrapInOptgroup !== 'undefined' ? wrapInOptgroup : true;
		let optgroup = new Morebits.QuickForm.Element({
			type: 'optgroup',
			label: label
		});
		optgroup = optgroup.render();
		sub_group.appendChild(optgroup);
		createEntries(warnGroup, optgroup, wrapInOptgroup, val);
	};

	switch (value) {
		case 'singlenotice':
		case 'singlewarn':
			createEntries(Twinkle.warn.messages[value], sub_group, true);
			break;
		case 'singlecombined':
			var unSortedSinglets = $.extend({}, Twinkle.warn.messages.singlenotice, Twinkle.warn.messages.singlewarn);
			var sortedSingletMessages = {};
			Object.keys(unSortedSinglets).sort().forEach((key) => {
				sortedSingletMessages[key] = unSortedSinglets[key];
			});
			createEntries(sortedSingletMessages, sub_group, true);
			break;
		case 'custom':
			createEntries(Twinkle.getPref('customWarningList'), sub_group, true);
			break;
		case 'kitchensink':
			// Dansk Wikipedia: ingen niveaudelte skabeloner
			createGroup(Twinkle.warn.messages.singlenotice, 'Første beskeder');
			createGroup(Twinkle.warn.messages.singlewarn, 'Advarsler');
			createGroup(Twinkle.getPref('customWarningList'), 'Brugerdefinerede advarsler');
			break;
		default:
			alert('Ukendt advarselskategori i twinklewarn');
			break;
	}

	Twinkle.warn.callback.postCategoryCleanup(e);
};

Twinkle.warn.callback.postCategoryCleanup = function twinklewarnCallbackPostCategoryCleanup(e) {
	// clear overridden label on article textbox
	Morebits.QuickForm.setElementTooltipVisibility(e.target.root.article, true);
	Morebits.QuickForm.resetElementLabel(e.target.root.article);
	// Trigger custom label/change on main category change
	Twinkle.warn.callback.change_subcategory(e);

	// Use select2 to make the select menu searchable
	if (!Twinkle.getPref('oldSelect')) {
		$('select[name=sub_group]')
			.select2({
				theme: 'default select2-morebits',
				width: '100%',
				matcher: Morebits.select2.matchers.optgroupFull,
				templateResult: Morebits.select2.highlightSearchMatches,
				language: {
					searching: Morebits.select2.queryInterceptor
				}
			})
			.change(Twinkle.warn.callback.change_subcategory);

		$('.select2-selection').on('keydown', Morebits.select2.autoStart).trigger('focus');

		mw.util.addCSS(
			// Increase height
			'.select2-container .select2-dropdown .select2-results > .select2-results__options { max-height: 350px; }' +

			// Reduce padding
			'.select2-results .select2-results__option { padding-top: 1px; padding-bottom: 1px; }' +
			'.select2-results .select2-results__group { padding-top: 1px; padding-bottom: 1px; } ' +

			// Adjust font size
			'.select2-container .select2-dropdown .select2-results { font-size: 13px; }' +
			'.select2-container .selection .select2-selection__rendered { font-size: 13px; }'
		);
	}
};

Twinkle.warn.callback.change_subcategory = function twinklewarnCallbackChangeSubcategory(e) {
	const selected_main_group = e.target.form.main_group.value;
	const selected_template = e.target.form.sub_group.value;

	// If template shouldn't have a linked article, hide the linked article label and text box
	const hideLinkedPage = Twinkle.warn.getTemplateProperty(Twinkle.warn.messages, selected_template, 'hideLinkedPage');
	if (hideLinkedPage) {
		e.target.form.article.value = '';
		Morebits.QuickForm.setElementVisibility(e.target.form.article.parentElement, false);
	} else {
		Morebits.QuickForm.setElementVisibility(e.target.form.article.parentElement, true);
	}

	// If template shouldn't have an optional message, hide the optional message label and text box
	const hideReason = Twinkle.warn.getTemplateProperty(Twinkle.warn.messages, selected_template, 'hideReason');
	if (hideReason) {
		e.target.form.reason.value = '';
		Morebits.QuickForm.setElementVisibility(e.target.form.reason.parentElement, false);
	} else {
		Morebits.QuickForm.setElementVisibility(e.target.form.reason.parentElement, true);
	}

	// Skabeloner der ikke tager en linket artikel, men noget andet (f.eks. et brugernavn).
	// Værdien for hvert tag er etiketten ved siden af inputfeltet
	const notLinkedArticle = {}; // Ingen da.wp-skabeloner kræver dette for nu

	const hasLevel = ['singlenotice', 'singlewarn', 'singlecombined', 'kitchensink'].includes(selected_main_group);
	if (hasLevel) {
		if (notLinkedArticle[selected_template]) {
			if (Twinkle.warn.prev_article === null) {
				Twinkle.warn.prev_article = e.target.form.article.value;
			}
			e.target.form.article.notArticle = true;
			e.target.form.article.value = '';

			// change form labels according to the warning selected
			Morebits.QuickForm.setElementTooltipVisibility(e.target.form.article, false);
			Morebits.QuickForm.overrideElementLabel(e.target.form.article, notLinkedArticle[selected_template]);
		} else if (e.target.form.article.notArticle) {
			if (Twinkle.warn.prev_article !== null) {
				e.target.form.article.value = Twinkle.warn.prev_article;
				Twinkle.warn.prev_article = null;
			}
			e.target.form.article.notArticle = false;
			Morebits.QuickForm.setElementTooltipVisibility(e.target.form.article, true);
			Morebits.QuickForm.resetElementLabel(e.target.form.article);
		}
	}

	$('#tw-warn-red-notice').remove(); // Ryd eventuelle røde advarsler fra tidligere valg
};

Twinkle.warn.callbacks = {
	getWarningWikitext: function(templateName, article, reason, isCustom) {
		let text = '{{subst:' + templateName;

		// Tilføj linket artikel til brugeradvarsler
		if (article) {
			text += '|1=' + article;
		}
		if (reason && !isCustom) {
			// Tilføj ekstra besked
			text += "|2=''" + Morebits.string.formatReasonText(reason) + "''";
		}
		text += '}}';

		if (reason && isCustom) {
			// brugerdefinerede advarsler antages at mangle {{{2}}}-parameteren
			text += " ''" + reason + "''";
		}

		return text + ' ~~~~';
	},
	showPreview: function(form, templatename) {
		const input = Morebits.QuickForm.getInputData(form);
		// Provided on autolevel, not otherwise
		templatename = templatename || input.sub_group;
		const linkedarticle = input.article;
		const templatetext = Twinkle.warn.callbacks.getWarningWikitext(templatename, linkedarticle,
			input.reason, input.main_group === 'custom');

		form.previewer.beginRender(templatetext, 'User_talk:' + mw.config.get('wgRelevantUserName')); // Force wikitext/correct username
	},
	// Forhåndsvisning af skabelon
	preview: function(form) {
		Twinkle.warn.callbacks.showPreview(form);
	},
	/**
	 * Used in the main and autolevel loops to determine when to warn
	 * about excessively recent, stale, or identical warnings.
	 *
	 * @param {string} wikitext  The text of a user's talk page, from getPageText()
	 * @return {Object[]} - Array of objects: latest contains most recent
	 * warning and date; history lists all prior warnings
	 */
	dateProcessing: function(wikitext) {
		const history_re = /<!--\s?Template:([uU]w-.*?)\s?-->.*?(\d{1,2}:\d{1,2}, \d{1,2} \w+ \d{4} \(UTC\))/g;
		const history = {};
		const latest = { date: new Morebits.Date(0), type: '' };
		let current;

		while ((current = history_re.exec(wikitext)) !== null) {
			const template = current[1], current_date = new Morebits.Date(current[2]);
			if (!(template in history) || history[template].isBefore(current_date)) {
				history[template] = current_date;
			}
			if (!latest.date.isAfter(current_date)) {
				latest.date = current_date;
				latest.type = template;
			}
		}
		return [latest, history];
	},
	main: function(pageobj) {
		const text = pageobj.getPageText();
		const statelem = pageobj.getStatusElement();
		const params = pageobj.getCallbackParameters();
		let messageData = params.messageData;

		const [latest, history] = Twinkle.warn.callbacks.dateProcessing(text);

		const now = new Morebits.Date(pageobj.getLoadTime());

		Twinkle.warn.talkpageObj = pageobj; // Opdater talkpageObj, for en sikkerheds skyld

		if (params.sub_group in history) {
			if (new Morebits.Date(history[params.sub_group]).add(1, 'day').isAfter(now)) {
				if (!confirm('En identisk {{' + params.sub_group + '}} er blevet udsendt inden for de sidste 24 timer.\nVil du stadig tilføje denne advarsel?')) {
					statelem.error('Afbrudt af brugeren.');
					return;
				}
			}
		}

		latest.date.add(1, 'minute'); // efter lang debat er ét minut max

		if (latest.date.isAfter(now)) {
			if (!confirm('En {{' + latest.type + '}} er blevet udsendt inden for det seneste minut.\nVil du stadig tilføje denne advarsel?')) {
				statelem.error('Afbrudt af brugeren.');
				return;
			}
		}

		// build the edit summary
		// Function to handle generation of summary prefix for custom templates
		const customProcess = function(template) {
			template = template.split('|')[0];
			let prefix;
			switch (template.slice(-1)) {
				case '1':
					prefix = 'Generel bemærkning';
					break;
				case '2':
					prefix = 'Forsigtighed';
					break;
				case '3':
					prefix = 'Advarsel';
					break;
				case '4':
					prefix = 'Endelig advarsel';
					break;
				case 'm':
					if (template.slice(-3) === '4im') {
						prefix = 'Eneste advarsel';
						break;
					}
					// falls through
				default:
					prefix = 'Meddelelse';
					break;
			}
			return prefix + ': ' + Morebits.string.toUpperCaseFirstChar(messageData.label);
		};

		let summary;
		if (params.main_group === 'custom') {
			summary = customProcess(params.sub_group);
		} else {
			// Normalize kitchensink to the 1-4im style
			if (params.main_group === 'kitchensink' && !/^D+$/.test(params.sub_group)) {
				let sub = params.sub_group.slice(-1);
				if (sub === 'm') {
					sub = params.sub_group.slice(-3);
				}
				// Don't overwrite uw-3rr, technically unnecessary
				if (/\d/.test(sub)) {
					params.main_group = 'level' + sub;
				}
			}
			// singlet || level1-4im, no need to /^\D+$/.test(params.main_group)
			summary = messageData.summary || (messageData[params.main_group] && messageData[params.main_group].summary);
			// Not in Twinkle.warn.messages, assume custom template
			if (!summary) {
				summary = customProcess(params.sub_group);
			}
			if (messageData.suppressArticleInSummary !== true && params.article) {
				summary += ' på [[:' + params.article + ']]';
			}
		}

		pageobj.setEditSummary(summary + '.');
		pageobj.setChangeTags(Twinkle.changeTags);
		pageobj.setWatchlist(Twinkle.getPref('watchWarnings'));

		// Get actual warning text
		const warningText = Twinkle.warn.callbacks.getWarningWikitext(params.sub_group, params.article,
			params.reason, params.main_group === 'custom');

		let sectionExists = false, sectionNumber = 0;
		// Only check sections if there are sections or there's a chance we won't create our own
		if (!messageData.heading && text.length) {
			// Get all sections
			const sections = text.match(/^(==*).+\1/gm);
			if (sections && sections.length !== 0) {
				// Find the index of the section header in question
				const dateHeaderRegex = now.monthHeaderRegex();
				sectionNumber = 0;
				// Find this month's section among L2 sections, preferring the bottom-most
				sectionExists = sections.reverse().some((sec, idx) => /^(==)[^=].+\1/m.test(sec) && dateHeaderRegex.test(sec) && typeof (sectionNumber = sections.length - 1 - idx) === 'number');
			}
		}

		if (sectionExists) { // append to existing section
			pageobj.setPageSection(sectionNumber + 1);
			pageobj.setAppendText('\n\n' + warningText);
			pageobj.append();
		} else {
			if (messageData.heading) { // create new section
				pageobj.setNewSectionTitle(messageData.heading);
			} else {
				Morebits.Status.info('Oplysning', 'Opretter ny diskussionsafsnit for denne måned, da intet eksisterede');
				pageobj.setNewSectionTitle(now.monthHeader(0));
			}
			pageobj.setNewSectionText(warningText);
			pageobj.newSection();
		}
	}
};

Twinkle.warn.callback.evaluate = function twinklewarnCallbackEvaluate(e) {
	const userTalkPage = 'User_talk:' + mw.config.get('wgRelevantUserName');

	// reason, main_group, sub_group, article
	const params = Morebits.QuickForm.getInputData(e.target);

	// The error handling
	// after the form is submitted is probably preferable

	// Find the selected <option> element so we can fetch the data structure
	const $selectedEl = $(e.target.sub_group).find('option[value="' + $(e.target.sub_group).val() + '"]');
	params.messageData = $selectedEl.data('messageData');

	Morebits.SimpleWindow.setButtonsEnabled(false);
	Morebits.Status.init(e.target);

	Morebits.wiki.actionCompleted.redirect = userTalkPage;
	Morebits.wiki.actionCompleted.notice = 'Advarsel afsendt, genindlæser diskussionssiden om få sekunder';

	const wikipedia_page = new Morebits.wiki.Page(userTalkPage, 'Ændring af brugerens diskussionsside');
	wikipedia_page.setCallbackParameters(params);
	wikipedia_page.setFollowRedirect(true, false);
	wikipedia_page.load(Twinkle.warn.callbacks.main);
};

Twinkle.addInitCallback(Twinkle.warn, 'warn');
}());

// </nowiki>
