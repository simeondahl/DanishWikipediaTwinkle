// <nowiki>

(function() {

/*
 ****************************************
 *** twinkleprotect.js: Protect/RPP module
 ****************************************
 * Mode of invocation:     Tab ("BS"/"AB")
 * Active on:              Non-special, non-MediaWiki pages
 */

// Note: a lot of code in this module is re-used/called by batchprotect.

Twinkle.protect = function twinkleprotect() {
	if (mw.config.get('wgNamespaceNumber') < 0 || mw.config.get('wgNamespaceNumber') === 8) {
		return;
	}

	Twinkle.addPortletLink(Twinkle.protect.callback, Morebits.userIsSysop ? 'BS' : 'AB', 'tw-rpp',
		Morebits.userIsSysop ? 'Beskyt side' : 'Anmod om sidebeskyttelse');
};

Twinkle.protect.callback = function twinkleprotectCallback() {
	const Window = new Morebits.SimpleWindow(620, 530);
	Window.setTitle(Morebits.userIsSysop ? 'Anvend, anmod om eller mærk sidebeskyttelse' : 'Anmod om eller mærk sidebeskyttelse');
	Window.setScriptName('Twinkle');
	Window.addFooterLink('Beskyttelseskabeloner', 'Skabelon:Beskyttelseskabeloner');
	Window.addFooterLink('Beskyttelsespolitik', 'Wikipedia:Beskyttelse');

	const form = new Morebits.QuickForm(Twinkle.protect.callback.evaluate);
	const actionfield = form.append({
		type: 'field',
		label: 'Handlingstype'
	});
	if (Morebits.userIsSysop) {
		actionfield.append({
			type: 'radio',
			name: 'actiontype',
			event: Twinkle.protect.callback.changeAction,
			list: [
				{
					label: 'Beskyt side',
					value: 'protect',
					tooltip: 'Anvend faktisk beskyttelse på siden.',
					checked: true
				}
			]
		});
	}
	actionfield.append({
		type: 'radio',
		name: 'actiontype',
		event: Twinkle.protect.callback.changeAction,
		list: [
			{
				label: 'Anmod om sidebeskyttelse',
				value: 'request',
				tooltip: 'Hvis du ønsker at anmode om beskyttelse via Wikipedia:Anmodning om beskyttelse' + (Morebits.userIsSysop ? ' i stedet for at udføre beskyttelsen selv.' : '.'),
				checked: !Morebits.userIsSysop
			},
			{
				label: 'Mærk side med beskyttelsesskabelon',
				value: 'tag',
				tooltip: 'Hvis den beskyttende administrator glemte at tilføje en beskyttelsesskabelon, eller du netop har beskyttet siden uden at mærke den, kan du bruge dette til at tilføje den passende beskyttelseskabelon.',
				disabled: mw.config.get('wgArticleId') === 0 || mw.config.get('wgPageContentModel') === 'Scribunto' || mw.config.get('wgNamespaceNumber') === 710 // TimedText
			}
		]
	});

	form.append({ type: 'field', label: 'Forudindstilling', name: 'field_preset' });
	form.append({ type: 'field', label: '1', name: 'field1' });
	form.append({ type: 'field', label: '2', name: 'field2' });

	form.append({ type: 'submit' });

	const result = form.render();
	Window.setContent(result);
	Window.display();

	// We must init the controls
	const evt = document.createEvent('Event');
	evt.initEvent('change', true, true);
	result.actiontype[0].dispatchEvent(evt);

	// get current protection level asynchronously
	Twinkle.protect.fetchProtectionLevel();
};

// A list of bots who may be the protecting sysop, for whom we shouldn't
// remind the user contact before requesting unprotection (evaluate)
Twinkle.protect.trustedBots = ['MusikBot II', 'TFA Protector Bot'];

// Customizable namespace and FlaggedRevs settings
// In theory it'd be nice to have restrictionlevels defined here,
// but those are only available via a siteinfo query

// mw.loader.getState('ext.flaggedRevs.review') returns null if the
// FlaggedRevs extension is not registered.  Previously, this was done with
// wgFlaggedRevsParams, but after 1.34-wmf4 it is no longer exported if empty
// (https://gerrit.wikimedia.org/r/c/mediawiki/extensions/FlaggedRevs/+/508427)
const hasFlaggedRevs = mw.loader.getState('ext.flaggedRevs.review') &&
// FlaggedRevs only valid in some namespaces, hardcoded until [[phab:T218479]]
(mw.config.get('wgNamespaceNumber') === 0 || mw.config.get('wgNamespaceNumber') === 4);
// Limit template editor; a Twinkle restriction, not a site setting
const isTemplate = mw.config.get('wgNamespaceNumber') === 10 || mw.config.get('wgNamespaceNumber') === 828;

// Contains the current protection level in an object
// Once filled, it will look something like:
// { edit: { level: "sysop", expiry: <some date>, cascade: true }, ... }
Twinkle.protect.currentProtectionLevels = {};

// returns a jQuery Deferred object, usage:
//   Twinkle.protect.fetchProtectingAdmin(apiObject, pageName, protect/stable).done(function(admin_username) { ...code... });
Twinkle.protect.fetchProtectingAdmin = function twinkleprotectFetchProtectingAdmin(api, pageName, protType, logIds) {
	logIds = logIds || [];

	return api.get({
		format: 'json',
		action: 'query',
		list: 'logevents',
		letitle: pageName,
		letype: protType
	}).then((data) => {
		// don't check log entries that have already been checked (e.g. don't go into an infinite loop!)
		const event = data.query ? $.grep(data.query.logevents, (le) => $.inArray(le.logid, logIds))[0] : null;
		if (!event) {
			// fail gracefully
			return null;
		} else if (event.action === 'move_prot' || event.action === 'move_stable') {
			return twinkleprotectFetchProtectingAdmin(api, protType === 'protect' ? event.params.oldtitle_title : event.params.oldtitle, protType, logIds.concat(event.logid));
		}
		return event.user;
	});
};

Twinkle.protect.fetchProtectionLevel = function twinkleprotectFetchProtectionLevel() {

	const api = new mw.Api();
	const protectDeferred = api.get({
		format: 'json',
		indexpageids: true,
		action: 'query',
		list: 'logevents',
		letype: 'protect',
		letitle: mw.config.get('wgPageName'),
		prop: hasFlaggedRevs ? 'info|flagged' : 'info',
		inprop: 'protection|watched',
		titles: mw.config.get('wgPageName')
	});
	const stableDeferred = api.get({
		format: 'json',
		action: 'query',
		list: 'logevents',
		letype: 'stable',
		letitle: mw.config.get('wgPageName')
	});

	const earlyDecision = [protectDeferred];
	if (hasFlaggedRevs) {
		earlyDecision.push(stableDeferred);
	}

	$.when.apply($, earlyDecision).done((protectData, stableData) => {
		// $.when.apply is supposed to take an unknown number of promises
		// via an array, which it does, but the type of data returned varies.
		// If there are two or more deferreds, it returns an array (of objects),
		// but if there's just one deferred, it retuns a simple object.
		// This is annoying.
		protectData = $(protectData).toArray();

		const pageid = protectData[0].query.pageids[0];
		const page = protectData[0].query.pages[pageid];
		const current = {};
		let adminEditDeferred;

		// Save requested page's watched status for later in case needed when filing request
		Twinkle.protect.watched = page.watchlistexpiry || page.watched === '';

		$.each(page.protection, (index, protection) => {
			// Don't overwrite actual page protection with cascading protection
			if (!protection.source) {
				current[protection.type] = {
					level: protection.level,
					expiry: protection.expiry,
					cascade: protection.cascade === ''
				};
				// logs report last admin who made changes to either edit/move/create protection, regardless if they only modified one of them
				if (!adminEditDeferred) {
					adminEditDeferred = Twinkle.protect.fetchProtectingAdmin(api, mw.config.get('wgPageName'), 'protect');
				}
			} else {
				// Account for the page being covered by cascading protection
				current.cascading = {
					expiry: protection.expiry,
					source: protection.source,
					level: protection.level // should always be sysop, unused
				};
			}
		});

		if (page.flagged) {
			current.stabilize = {
				level: page.flagged.protection_level,
				expiry: page.flagged.protection_expiry
			};
			adminEditDeferred = Twinkle.protect.fetchProtectingAdmin(api, mw.config.get('wgPageName'), 'stable');
		}

		// show the protection level and log info
		Twinkle.protect.hasProtectLog = !!protectData[0].query.logevents.length;
		Twinkle.protect.protectLog = Twinkle.protect.hasProtectLog && protectData[0].query.logevents;
		Twinkle.protect.hasStableLog = hasFlaggedRevs ? !!stableData[0].query.logevents.length : false;
		Twinkle.protect.stableLog = Twinkle.protect.hasStableLog && stableData[0].query.logevents;
		Twinkle.protect.currentProtectionLevels = current;

		if (adminEditDeferred) {
			adminEditDeferred.done((admin) => {
				if (admin) {
					$.each(['edit', 'move', 'create', 'stabilize', 'cascading'], (i, type) => {
						if (Twinkle.protect.currentProtectionLevels[type]) {
							Twinkle.protect.currentProtectionLevels[type].admin = admin;
						}
					});
				}
				Twinkle.protect.callback.showLogAndCurrentProtectInfo();
			});
		} else {
			Twinkle.protect.callback.showLogAndCurrentProtectInfo();
		}
	});
};

Twinkle.protect.callback.showLogAndCurrentProtectInfo = function twinkleprotectCallbackShowLogAndCurrentProtectInfo() {
	const currentlyProtected = !$.isEmptyObject(Twinkle.protect.currentProtectionLevels);

	if (Twinkle.protect.hasProtectLog || Twinkle.protect.hasStableLog) {
		const $linkMarkup = $('<span>');

		if (Twinkle.protect.hasProtectLog) {
			$linkMarkup.append(
				$('<a target="_blank" href="' + mw.util.getUrl('Special:Log', {action: 'view', page: mw.config.get('wgPageName'), type: 'protect'}) + '">beskyttelseslog</a>'));
			if (!currentlyProtected || (!Twinkle.protect.currentProtectionLevels.edit && !Twinkle.protect.currentProtectionLevels.move)) {
				const lastProtectAction = Twinkle.protect.protectLog[0];
				if (lastProtectAction.action === 'unprotect') {
					$linkMarkup.append(' (fjernet beskyttelse ' + new Morebits.Date(lastProtectAction.timestamp).calendar('utc') + ')');
				} else { // protect or modify
					$linkMarkup.append(' (udløbet ' + new Morebits.Date(lastProtectAction.params.details[0].expiry).calendar('utc') + ')');
				}
			}
			$linkMarkup.append(Twinkle.protect.hasStableLog ? $('<span> &bull; </span>') : null);
		}

		if (Twinkle.protect.hasStableLog) {
			$linkMarkup.append($('<a target="_blank" href="' + mw.util.getUrl('Special:Log', {action: 'view', page: mw.config.get('wgPageName'), type: 'stable'}) + '">log over afventende ændringer</a>)'));
			if (!currentlyProtected || !Twinkle.protect.currentProtectionLevels.stabilize) {
				const lastStabilizeAction = Twinkle.protect.stableLog[0];
				if (lastStabilizeAction.action === 'reset') {
					$linkMarkup.append(' (nulstillet ' + new Morebits.Date(lastStabilizeAction.timestamp).calendar('utc') + ')');
				} else { // config or modify
					$linkMarkup.append(' (udløbet ' + new Morebits.Date(lastStabilizeAction.params.expiry).calendar('utc') + ')');
				}
			}
		}

		Morebits.Status.init($('div[name="hasprotectlog"] span')[0]);
		Morebits.Status.warn(
			currentlyProtected ? 'Tidligere beskyttelser' : 'Denne side har tidligere været beskyttet',
			$linkMarkup[0]
		);
	}

	Morebits.Status.init($('div[name="currentprot"] span')[0]);
	let protectionNode = [], statusLevel = 'info';

	if (currentlyProtected) {
		$.each(Twinkle.protect.currentProtectionLevels, (type, settings) => {
			let label = type === 'stabilize' ? 'Afventende ændringer' : Morebits.string.toUpperCaseFirstChar(type);

			if (type === 'cascading') { // Covered by another page
				label = 'Cascadebeskyttelse ';
				protectionNode.push($('<b>' + label + '</b>')[0]);
				if (settings.source) { // Should by definition exist
					const sourceLink = '<a target="_blank" href="' + mw.util.getUrl(settings.source) + '">' + settings.source + '</a>';
					protectionNode.push($('<span>fra ' + sourceLink + '</span>')[0]);
				}
			} else {
				let level = settings.level;
				// Make cascading protection more prominent
				if (settings.cascade) {
					level += ' (cascading)';
				}
				protectionNode.push($('<b>' + label + ': ' + level + '</b>')[0]);
			}

			if (settings.expiry === 'infinity') {
				protectionNode.push(' (ubestemt) ');
			} else {
				protectionNode.push(' (udløber ' + new Morebits.Date(settings.expiry).calendar('utc') + ') ');
			}
			if (settings.admin) {
				const adminLink = '<a target="_blank" href="' + mw.util.getUrl('User talk:' + settings.admin) + '">' + settings.admin + '</a>';
				protectionNode.push($('<span>af ' + adminLink + '</span>')[0]);
			}
			protectionNode.push($('<span> • </span>')[0]);
		});
		protectionNode = protectionNode.slice(0, -1); // remove the trailing bullet
		statusLevel = 'warn';
	} else {
		protectionNode.push($('<b>ingen beskyttelse</b>')[0]);
	}

	Morebits.Status[statusLevel]('Nuværende beskyttelsesniveau', protectionNode);
};

Twinkle.protect.callback.changeAction = function twinkleprotectCallbackChangeAction(e) {
	let field_preset;
	let field1;
	let field2;

	switch (e.target.values) {
		case 'protect':
			field_preset = new Morebits.QuickForm.Element({ type: 'field', label: 'Forudindstilling', name: 'field_preset' });
			field_preset.append({
				type: 'select',
				name: 'category',
				label: 'Vælg en forudindstilling:',
				event: Twinkle.protect.callback.changePreset,
				list: mw.config.get('wgArticleId') ? Twinkle.protect.protectionTypes : Twinkle.protect.protectionTypesCreate
			});

			field2 = new Morebits.QuickForm.Element({ type: 'field', label: 'Beskyttelsesindstillinger', name: 'field2' });
			field2.append({ type: 'div', name: 'currentprot', label: ' ' }); // holds the current protection level, as filled out by the async callback
			field2.append({ type: 'div', name: 'hasprotectlog', label: ' ' });
			// for existing pages
			if (mw.config.get('wgArticleId')) {
				field2.append({
					type: 'checkbox',
					event: Twinkle.protect.formevents.editmodify,
					list: [
						{
							label: 'Rediger redigeringsbeskyttelse',
							name: 'editmodify',
							tooltip: 'Hvis dette er slået fra, vil redigeringsbeskyttelsesniveauet og udløbstiden forblive uændret.',
							checked: true
						}
					]
				});
				field2.append({
					type: 'select',
					name: 'editlevel',
					label: 'Hvem kan redigere:',
					event: Twinkle.protect.formevents.editlevel,
					// Filter TE outside of templates and modules
					list: Twinkle.protect.protectionLevels.filter((level) => isTemplate || level.value !== 'templateeditor')
				});
				field2.append({
					type: 'select',
					name: 'editexpiry',
					label: 'Udløber:',
					event: function(e) {
						if (e.target.value === 'custom') {
							Twinkle.protect.doCustomExpiry(e.target);
						}
					},
					// default expiry selection (2 days) is conditionally set in Twinkle.protect.callback.changePreset
					list: Twinkle.protect.protectionLengths
				});
				field2.append({
					type: 'checkbox',
					event: Twinkle.protect.formevents.movemodify,
					list: [
						{
							label: 'Rediger flytningsbeskyttelse',
							name: 'movemodify',
							tooltip: 'Hvis dette er slået fra, vil flytningsbeskyttelsesniveauet og udløbstiden forblive uændret.',
							checked: true
						}
					]
				});
				field2.append({
					type: 'select',
					name: 'movelevel',
					label: 'Hvem kan flytte:',
					event: Twinkle.protect.formevents.movelevel,
					// Autoconfirmed is required for a move, redundant
					list: Twinkle.protect.protectionLevels.filter((level) => level.value !== 'autoconfirmed' && (isTemplate || level.value !== 'templateeditor'))
				});
				field2.append({
					type: 'select',
					name: 'moveexpiry',
					label: 'Udløber:',
					event: function(e) {
						if (e.target.value === 'custom') {
							Twinkle.protect.doCustomExpiry(e.target);
						}
					},
					// default expiry selection (2 days) is conditionally set in Twinkle.protect.callback.changePreset
					list: Twinkle.protect.protectionLengths
				});
				if (hasFlaggedRevs) {
					field2.append({
						type: 'checkbox',
						event: Twinkle.protect.formevents.pcmodify,
						list: [
							{
								label: 'Rediger beskyttelse af afventende ændringer',
								name: 'pcmodify',
								tooltip: 'Hvis dette er slået fra, vil niveauet for afventende ændringer og udløbstiden forblive uændret.',
								checked: true
							}
						]
					});
					field2.append({
						type: 'select',
						name: 'pclevel',
						label: 'Afventende ændringer:',
						event: Twinkle.protect.formevents.pclevel,
						list: [
							{ label: 'Ingen', value: 'none' },
							{ label: 'Afventende ændring', value: 'autoconfirmed', selected: true }
						]
					});
					field2.append({
						type: 'select',
						name: 'pcexpiry',
						label: 'Udløber:',
						event: function(e) {
							if (e.target.value === 'custom') {
								Twinkle.protect.doCustomExpiry(e.target);
							}
						},
						// default expiry selection (1 month) is conditionally set in Twinkle.protect.callback.changePreset
						list: Twinkle.protect.protectionLengths
					});
				}
			} else { // for non-existing pages
				field2.append({
					type: 'select',
					name: 'createlevel',
					label: 'Oprettelsesbeskyttelse:',
					event: Twinkle.protect.formevents.createlevel,
					// Filter TE always, and autoconfirmed in mainspace, redundant since WP:ACPERM
					list: Twinkle.protect.protectionLevels.filter((level) => level.value !== 'templateeditor' && (mw.config.get('wgNamespaceNumber') !== 0 || level.value !== 'autoconfirmed'))
				});
				field2.append({
					type: 'select',
					name: 'createexpiry',
					label: 'Udløber:',
					event: function(e) {
						if (e.target.value === 'custom') {
							Twinkle.protect.doCustomExpiry(e.target);
						}
					},
					// default expiry selection (indefinite) is conditionally set in Twinkle.protect.callback.changePreset
					list: Twinkle.protect.protectionLengths
				});
			}
			field2.append({
				type: 'textarea',
				name: 'protectReason',
				label: 'Årsag (til beskyttelsesloggen):'
			});
			field2.append({
				type: 'div',
				name: 'protectReason_notes',
				label: 'Noter:',
				style: 'display:inline-block; margin-top:4px;',
				tooltip: 'Tilføj en note til beskyttelsesloggen om, at dette blev anmodet på anmodningssiden.'
			});
			field2.append({
				type: 'checkbox',
				event: Twinkle.protect.callback.annotateProtectReason,
				style: 'display:inline-block; margin-top:4px;',
				list: [
					{
						label: 'Anmodning om beskyttelse',
						name: 'protectReason_notes_rfpp',
						checked: false,
						value: 'anmodet på [[Wikipedia:Anmodning om beskyttelse]]'
					}
				]
			});
			field2.append({
				type: 'input',
				event: Twinkle.protect.callback.annotateProtectReason,
				label: 'Versions-ID for anmodning',
				name: 'protectReason_notes_rfppRevid',
				value: '',
				tooltip: 'Valgfrit versions-ID for anmodningssiden, hvor beskyttelsen blev anmodet.'
			});
			if (!mw.config.get('wgArticleId') || mw.config.get('wgPageContentModel') === 'Scribunto' || mw.config.get('wgNamespaceNumber') === 710) { // tagging isn't relevant for non-existing, module, or TimedText pages
				break;
			}
			/* falls through */
		case 'tag':
			field1 = new Morebits.QuickForm.Element({ type: 'field', label: 'Mærkningsindstillinger', name: 'field1' });
			field1.append({ type: 'div', name: 'currentprot', label: ' ' }); // holds the current protection level, as filled out by the async callback
			field1.append({ type: 'div', name: 'hasprotectlog', label: ' ' });
			field1.append({
				type: 'select',
				name: 'tagtype',
				label: 'Vælg beskyttelseskabelon:',
				list: Twinkle.protect.protectionTags,
				event: Twinkle.protect.formevents.tagtype
			});

			var isTemplateNamespace = mw.config.get('wgNamespaceNumber') === 10;
			var isAFD = Morebits.pageNameNorm.startsWith('Wikipedia:Articles for deletion/');
			var isCode = ['javascript', 'css', 'sanitized-css'].includes(mw.config.get('wgPageContentModel'));
			field1.append({
				type: 'checkbox',
				list: [
					{
						name: 'small',
						label: 'Ikonificér (small=yes)',
						tooltip: 'Vil bruge |small=yes-funktionen i skabelonen og kun vise den som et låseikon',
						checked: true
					},
					{
						name: 'noinclude',
						label: 'Omslut beskyttelseskabelon med &lt;noinclude&gt;',
						tooltip: 'Vil omfatte beskyttelseskabelonen i &lt;noinclude&gt;-tags, så den ikke transskluderes',
						checked: (isTemplateNamespace || isAFD) && !isCode
					}
				]
			});
			break;

		case 'request':
			field_preset = new Morebits.QuickForm.Element({ type: 'field', label: 'Type af beskyttelse', name: 'field_preset' });
			field_preset.append({
				type: 'select',
				name: 'category',
				label: 'Type og årsag:',
				event: Twinkle.protect.callback.changePreset,
				list: mw.config.get('wgArticleId') ? Twinkle.protect.protectionTypes : Twinkle.protect.protectionTypesCreate
			});

			field1 = new Morebits.QuickForm.Element({ type: 'field', label: 'Indstillinger', name: 'field1' });
			field1.append({ type: 'div', name: 'currentprot', label: ' ' }); // holds the current protection level, as filled out by the async callback
			field1.append({ type: 'div', name: 'hasprotectlog', label: ' ' });
			field1.append({
				type: 'select',
				name: 'expiry',
				label: 'Varighed:',
				list: [
					{ label: '', selected: true, value: '' },
					{ label: 'Midlertidig', value: 'temporary' },
					{ label: 'Ubestemt', value: 'infinity' }
				]
			});
			field1.append({
				type: 'textarea',
				name: 'reason',
				label: 'Årsag:'
			});
			break;
		default:
			alert('Noget er galt i twinkleprotect');
			break;
	}

	let oldfield;

	if (field_preset) {
		oldfield = $(e.target.form).find('fieldset[name="field_preset"]')[0];
		oldfield.parentNode.replaceChild(field_preset.render(), oldfield);
	} else {
		$(e.target.form).find('fieldset[name="field_preset"]').css('display', 'none');
	}
	if (field1) {
		oldfield = $(e.target.form).find('fieldset[name="field1"]')[0];
		oldfield.parentNode.replaceChild(field1.render(), oldfield);
	} else {
		$(e.target.form).find('fieldset[name="field1"]').css('display', 'none');
	}
	if (field2) {
		oldfield = $(e.target.form).find('fieldset[name="field2"]')[0];
		oldfield.parentNode.replaceChild(field2.render(), oldfield);
	} else {
		$(e.target.form).find('fieldset[name="field2"]').css('display', 'none');
	}

	if (e.target.values === 'protect') {
		// fake a change event on the preset dropdown
		const evt = document.createEvent('Event');
		evt.initEvent('change', true, true);
		e.target.form.category.dispatchEvent(evt);

		// reduce vertical height of dialog
		$(e.target.form).find('fieldset[name="field2"] select').parent().css({ display: 'inline-block', marginRight: '0.5em' });
		$(e.target.form).find('fieldset[name="field2"] input[name="protectReason_notes_rfppRevid"]').parent().css({display: 'inline-block', marginLeft: '15px'}).hide();
	}

	// re-add protection level and log info, if it's available
	Twinkle.protect.callback.showLogAndCurrentProtectInfo();
};

// NOTE: This function is used by batchprotect as well
Twinkle.protect.formevents = {
	editmodify: function twinkleprotectFormEditmodifyEvent(e) {
		e.target.form.editlevel.disabled = !e.target.checked;
		e.target.form.editexpiry.disabled = !e.target.checked || (e.target.form.editlevel.value === 'all');
		e.target.form.editlevel.style.color = e.target.form.editexpiry.style.color = e.target.checked ? '' : 'transparent';
	},
	editlevel: function twinkleprotectFormEditlevelEvent(e) {
		e.target.form.editexpiry.disabled = e.target.value === 'all';
	},
	movemodify: function twinkleprotectFormMovemodifyEvent(e) {
		// sync move settings with edit settings if applicable
		if (e.target.form.movelevel.disabled && !e.target.form.editlevel.disabled) {
			e.target.form.movelevel.value = e.target.form.editlevel.value;
			e.target.form.moveexpiry.value = e.target.form.editexpiry.value;
		} else if (e.target.form.editlevel.disabled) {
			e.target.form.movelevel.value = 'sysop';
			e.target.form.moveexpiry.value = 'infinity';
		}
		e.target.form.movelevel.disabled = !e.target.checked;
		e.target.form.moveexpiry.disabled = !e.target.checked || (e.target.form.movelevel.value === 'all');
		e.target.form.movelevel.style.color = e.target.form.moveexpiry.style.color = e.target.checked ? '' : 'transparent';
	},
	movelevel: function twinkleprotectFormMovelevelEvent(e) {
		e.target.form.moveexpiry.disabled = e.target.value === 'all';
	},
	pcmodify: function twinkleprotectFormPcmodifyEvent(e) {
		e.target.form.pclevel.disabled = !e.target.checked;
		e.target.form.pcexpiry.disabled = !e.target.checked || (e.target.form.pclevel.value === 'none');
		e.target.form.pclevel.style.color = e.target.form.pcexpiry.style.color = e.target.checked ? '' : 'transparent';
	},
	pclevel: function twinkleprotectFormPclevelEvent(e) {
		e.target.form.pcexpiry.disabled = e.target.value === 'none';
	},
	createlevel: function twinkleprotectFormCreatelevelEvent(e) {
		e.target.form.createexpiry.disabled = e.target.value === 'all';
	},
	tagtype: function twinkleprotectFormTagtypeEvent(e) {
		e.target.form.small.disabled = e.target.form.noinclude.disabled = (e.target.value === 'none') || (e.target.value === 'noop');
	}
};

Twinkle.protect.doCustomExpiry = function twinkleprotectDoCustomExpiry(target) {
	const custom = prompt('Angiv en brugerdefineret udløbstid.  \nDu kan bruge relative tider som "1 minute" eller "19 days", eller absolutte tidsstempler "yyyymmddhhmm" (f.eks. "200602011405" er 1. februar 2006 kl. 14:05 UTC).', '');
	if (custom) {
		const option = document.createElement('option');
		option.setAttribute('value', custom);
		option.textContent = custom;
		target.appendChild(option);
		target.value = custom;
	} else {
		target.selectedIndex = 0;
	}
};

// NOTE: This list is used by batchprotect as well
Twinkle.protect.protectionLevels = [
	{ label: 'Alle brugere (fjern beskyttelse)', value: 'all' },
	{ label: 'Autobekræftede brugere', value: 'autoconfirmed' },
	{ label: 'Udvidet bekræftede brugere', value: 'extendedconfirmed' },
	{ label: 'Skabelonredaktører', value: 'templateeditor' },
	{ label: 'Kun administratorer', value: 'sysop', selected: true }
];

// default expiry selection is conditionally set in Twinkle.protect.callback.changePreset
// NOTE: This list is used by batchprotect as well
Twinkle.protect.protectionLengths = [
	{ label: '1 time', value: '1 hour' },
	{ label: '2 timer', value: '2 hours' },
	{ label: '3 timer', value: '3 hours' },
	{ label: '6 timer', value: '6 hours' },
	{ label: '12 timer', value: '12 hours' },
	{ label: '1 dag', value: '1 day' },
	{ label: '2 dage', value: '2 days' },
	{ label: '3 dage', value: '3 days' },
	{ label: '4 dage', value: '4 days' },
	{ label: '10 dage', value: '10 days' },
	{ label: '1 uge', value: '1 week' },
	{ label: '2 uger', value: '2 weeks' },
	{ label: '1 måned', value: '1 month' },
	{ label: '2 måneder', value: '2 months' },
	{ label: '3 måneder', value: '3 months' },
	{ label: '6 måneder', value: '6 months' },
	{ label: '1 år', value: '1 year' },
	{ label: '2 år', value: '2 years' },
	{ label: 'ubestemt', value: 'infinity' },
	{ label: 'Brugerdefineret...', value: 'custom' }
];

Twinkle.protect.protectionTypes = [
	{ label: 'Fjern beskyttelse', value: 'unprotect' },
	{
		label: 'Fuld beskyttelse',
		list: [
			{ label: 'Generel (fuld)', value: 'pp-protected' },
			{ label: 'Indholdskonflikt/redigeringskrig (fuld)', value: 'pp-dispute' },
			{ label: 'Vedvarende hærværk (fuld)', value: 'pp-vandalism' },
			{ label: 'Brugerdiskussionsside for blokeret bruger (fuld)', value: 'pp-usertalk' }
		]
	},
	{
		label: 'Skabelonbeskyttelse',
		list: [
			// Skabelonnavn pp-template beholdes da dansk ækvivalent er ukendt
			{ label: 'Meget synlig skabelon (skabelonredaktør)', value: 'pp-template' }
		]
	},
	{
		label: 'Udvidet bekræftet beskyttelse',
		list: [
			{ label: 'Generel (udvidet bekræftet)', value: 'pp-30-500' },
			{ label: 'Voldgiftshåndhævelse (udvidet bekræftet)', selected: true, value: 'pp-30-500-arb' },
			{ label: 'Vedvarende hærværk (udvidet bekræftet)', value: 'pp-30-500-vandalism' },
			{ label: 'Forstyrrende redigering (udvidet bekræftet)', value: 'pp-30-500-disruptive' },
			{ label: 'BLP-politikbrud (udvidet bekræftet)', value: 'pp-30-500-blp' },
			{ label: 'Sockpuppetry (udvidet bekræftet)', value: 'pp-30-500-sock' }
		]
	},
	{
		label: 'Semiprotection',
		list: [
			{ label: 'Generel (semi)', value: 'pp-semi-protected' },
			{ label: 'Vedvarende hærværk (semi)', selected: true, value: 'pp-semi-vandalism' },
			{ label: 'Forstyrrende redigering (semi)', value: 'pp-semi-disruptive' },
			{ label: 'Tilføjelse af ukildeangivet indhold (semi)', value: 'pp-semi-unsourced' },
			{ label: 'BLP-politikbrud (semi)', value: 'pp-semi-blp' },
			{ label: 'Sockpuppetry (semi)', value: 'pp-semi-sock' },
			{ label: 'Brugerdiskussionsside for blokeret bruger (semi)', value: 'pp-semi-usertalk' },
			{ label: 'Opslagstavle for LTA (semi)', value: 'pp-sock-noticeboard' }
		]
	},
	{
		label: 'Afventende ændringer',
		list: [
			{ label: 'Generel (afventende ændringer)', value: 'pp-pc-protected' },
			{ label: 'Vedvarende hærværk (afventende ændringer)', value: 'pp-pc-vandalism' },
			{ label: 'Forstyrrende redigering (afventende ændringer)', value: 'pp-pc-disruptive' },
			{ label: 'Tilføjelse af ukildeangivet indhold (afventende ændringer)', value: 'pp-pc-unsourced' },
			{ label: 'BLP-politikbrud (afventende ændringer)', value: 'pp-pc-blp' }
		]
	},
	{
		label: 'Flytningsbeskyttelse',
		list: [
			{ label: 'Generel (flytning)', value: 'pp-move' },
			{ label: 'Tvist/flytningskrig (flytning)', value: 'pp-move-dispute' },
			{ label: 'Sideflytningshærværk (flytning)', value: 'pp-move-vandalism' },
			{ label: 'Meget synlig side (flytning)', value: 'pp-move-indef' }
		]
	}
]
// Filter for templates and flaggedrevs
.filter((type) => (isTemplate || type.label !== 'Skabelonbeskyttelse') && (hasFlaggedRevs || type.label !== 'Afventende ændringer'));

Twinkle.protect.protectionTypesCreate = [
	{ label: 'Fjern beskyttelse', value: 'unprotect' },
	{
		label: 'Oprettelsesbeskyttelse',
		list: [
			{ label: 'Stødende navn', value: 'pp-create-offensive' },
			{ label: 'Gentagne gange genskabt', selected: true, value: 'pp-create-salt' },
			{ label: 'Nyligt slettet BLP', value: 'pp-create-blp' }
		]
	}
];

// A page with both regular and PC protection will be assigned its regular
// protection weight plus 2
Twinkle.protect.protectionWeight = {
	sysop: 40,
	templateeditor: 30,
	extendedconfirmed: 20,
	autoconfirmed: 10,
	flaggedrevs_autoconfirmed: 5, // Pending Changes protection alone
	all: 0,
	flaggedrevs_none: 0 // just in case
};

// NOTICE: keep this synched with [[MediaWiki:Protect-dropdown]]
// Also note: stabilize = Pending Changes level
// expiry will override any defaults
Twinkle.protect.protectionPresetsInfo = {
	'pp-protected': {
		edit: 'sysop',
		move: 'sysop',
		reason: null
	},
	'pp-dispute': {
		edit: 'sysop',
		move: 'sysop',
		reason: '[[Wikipedia:Beskyttelse|Redigeringskrig / indholdskonflikt]]'
	},
	'pp-sock-noticeboard': {
		edit: 'autoconfirmed',
		expiry: '2 hours',
		reason: 'Vedvarende [[Wikipedia:Sockpuppetry|sockpuppetry]]',
		template: 'pp-sock'
	},
	'pp-vandalism': {
		edit: 'sysop',
		move: 'sysop',
		reason: 'Vedvarende [[Wikipedia:Hærværk|hærværk]]'
	},
	'pp-usertalk': {
		edit: 'sysop',
		move: 'sysop',
		expiry: 'infinity',
		reason: '[[Wikipedia:Beskyttelse|Upassende brug af brugerdiskussionsside under blokering]]'
	},
	'pp-template': {
		edit: 'templateeditor',
		move: 'templateeditor',
		expiry: 'infinity',
		// Skabelonnavn pp-template beholdes da dansk ækvivalent er ukendt
		reason: 'Meget synlig skabelon'
	},
	'pp-30-500-arb': {
		edit: 'extendedconfirmed',
		move: 'extendedconfirmed',
		expiry: 'infinity',
		reason: 'Voldgiftshåndhævelse',
		template: 'pp-extended'
	},
	'pp-30-500-vandalism': {
		edit: 'extendedconfirmed',
		move: 'extendedconfirmed',
		reason: 'Vedvarende [[Wikipedia:Hærværk|hærværk]] fra (auto)bekræftede konti',
		template: 'pp-extended'
	},
	'pp-30-500-disruptive': {
		edit: 'extendedconfirmed',
		move: 'extendedconfirmed',
		reason: 'Vedvarende [[Wikipedia:Forstyrrende redigering|forstyrrende redigering]] fra (auto)bekræftede konti',
		template: 'pp-extended'
	},
	'pp-30-500-blp': {
		edit: 'extendedconfirmed',
		move: 'extendedconfirmed',
		reason: 'Vedvarende brud på [[Wikipedia:Biografier om levende personer|BLP-politikken]] fra (auto)bekræftede konti',
		template: 'pp-extended'
	},
	'pp-30-500-sock': {
		edit: 'extendedconfirmed',
		move: 'extendedconfirmed',
		reason: 'Vedvarende [[Wikipedia:Sockpuppetry|sockpuppetry]]',
		template: 'pp-extended'
	},
	'pp-30-500': {
		edit: 'extendedconfirmed',
		move: 'extendedconfirmed',
		reason: null,
		template: 'pp-extended'
	},
	'pp-semi-vandalism': {
		edit: 'autoconfirmed',
		reason: 'Vedvarende [[Wikipedia:Hærværk|hærværk]]',
		template: 'pp-vandalism'
	},
	'pp-semi-disruptive': {
		edit: 'autoconfirmed',
		reason: 'Vedvarende [[Wikipedia:Forstyrrende redigering|forstyrrende redigering]]',
		template: 'pp-protected'
	},
	'pp-semi-unsourced': {
		edit: 'autoconfirmed',
		reason: 'Vedvarende tilføjelse af ukildeangivet eller dårligt kildeangivet indhold',
		template: 'pp-protected'
	},
	'pp-semi-blp': {
		edit: 'autoconfirmed',
		reason: 'Brud på [[Wikipedia:Biografier om levende personer|BLP-politikken]]',
		template: 'pp-blp'
	},
	'pp-semi-usertalk': {
		edit: 'autoconfirmed',
		expiry: 'infinity',
		reason: '[[Wikipedia:Beskyttelse|Upassende brug af brugerdiskussionsside under blokering]]',
		template: 'pp-usertalk'
	},
	'pp-semi-template': { // removed for now
		edit: 'autoconfirmed',
		expiry: 'infinity',
		reason: 'Meget synlig skabelon',
		template: 'pp-template'
	},
	'pp-semi-sock': {
		edit: 'autoconfirmed',
		reason: 'Vedvarende [[Wikipedia:Sockpuppetry|sockpuppetry]]',
		template: 'pp-sock'
	},
	'pp-semi-protected': {
		edit: 'autoconfirmed',
		reason: null,
		template: 'pp-protected'
	},
	'pp-pc-vandalism': {
		stabilize: 'autoconfirmed', // stabilize = Pending Changes
		reason: 'Vedvarende [[Wikipedia:Hærværk|hærværk]]',
		template: 'pp-pc'
	},
	'pp-pc-disruptive': {
		stabilize: 'autoconfirmed',
		reason: 'Vedvarende [[Wikipedia:Forstyrrende redigering|forstyrrende redigering]]',
		template: 'pp-pc'
	},
	'pp-pc-unsourced': {
		stabilize: 'autoconfirmed',
		reason: 'Vedvarende tilføjelse af ukildeangivet eller dårligt kildeangivet indhold',
		template: 'pp-pc'
	},
	'pp-pc-blp': {
		stabilize: 'autoconfirmed',
		reason: 'Brud på [[Wikipedia:Biografier om levende personer|BLP-politikken]]',
		template: 'pp-pc'
	},
	'pp-pc-protected': {
		stabilize: 'autoconfirmed',
		reason: null,
		template: 'pp-pc'
	},
	'pp-move': {
		move: 'sysop',
		reason: null
	},
	'pp-move-dispute': {
		move: 'sysop',
		reason: '[[Wikipedia:Beskyttelse|Flytningskrig]]'
	},
	'pp-move-vandalism': {
		move: 'sysop',
		reason: '[[Wikipedia:Beskyttelse|Sideflytningshærværk]]'
	},
	'pp-move-indef': {
		move: 'sysop',
		expiry: 'infinity',
		reason: '[[Wikipedia:Beskyttelse|Meget synlig side]]'
	},
	unprotect: {
		edit: 'all',
		move: 'all',
		stabilize: 'none',
		create: 'all',
		reason: null,
		template: 'none'
	},
	'pp-create-offensive': {
		create: 'sysop',
		reason: 'Stødende navn'
	},
	'pp-create-salt': {
		create: 'extendedconfirmed',
		reason: 'Gentagne gange genskabt'
	},
	'pp-create-blp': {
		create: 'extendedconfirmed',
		reason: 'Nyligt slettet [[Wikipedia:Biografier om levende personer|BLP]]'
	}
};

Twinkle.protect.protectionTags = [
	{
		label: 'Ingen (fjern eksisterende beskyttelseskabeloner)',
		value: 'none'
	},
	{
		label: 'Ingen (behold eksisterende beskyttelseskabeloner)',
		value: 'noop'
	},
	{
		label: 'Redigeringsbeskyttelseskabeloner',
		list: [
			// Skabelonnavne (pp-*) beholdes da danske ækvivalenter er ukendte
			{ label: '{{pp-vandalism}}: hærværk', value: 'pp-vandalism' },
			{ label: '{{pp-dispute}}: tvist/redigeringskrig', value: 'pp-dispute' },
			{ label: '{{pp-blp}}: BLP-brud', value: 'pp-blp' },
			{ label: '{{pp-sock}}: sockpuppetry', value: 'pp-sock' },
			{ label: '{{pp-template}}: højrisikoskabelon', value: 'pp-template' },
			{ label: '{{pp-usertalk}}: blokeret brugers diskussionsside', value: 'pp-usertalk' },
			{ label: '{{pp-protected}}: generel beskyttelse', value: 'pp-protected' },
			{ label: '{{pp-semi-indef}}: generel langsigtet semiprotection', value: 'pp-semi-indef' },
			{ label: '{{pp-extended}}: udvidet bekræftet beskyttelse', value: 'pp-extended' }
		]
	},
	{
		label: 'Kabeloner for afventende ændringer',
		list: [
			{ label: '{{pp-pc}}: afventende ændringer', value: 'pp-pc' }
		]
	},
	{
		label: 'Flytningsbeskyttelseskabeloner',
		list: [
			{ label: '{{pp-move-dispute}}: tvist/flytningskrig', value: 'pp-move-dispute' },
			{ label: '{{pp-move-vandalism}}: sideflytningshærværk', value: 'pp-move-vandalism' },
			{ label: '{{pp-move-indef}}: generel langsigtet', value: 'pp-move-indef' },
			{ label: '{{pp-move}}: andet', value: 'pp-move' }
		]
	}
]
// Filter FlaggedRevs
.filter((type) => hasFlaggedRevs || type.label !== 'Kabeloner for afventende ændringer');

Twinkle.protect.callback.changePreset = function twinkleprotectCallbackChangePreset(e) {
	const form = e.target.form;

	const actiontypes = form.actiontype;
	let actiontype;
	for (let i = 0; i < actiontypes.length; i++) {
		if (!actiontypes[i].checked) {
			continue;
		}
		actiontype = actiontypes[i].values;
		break;
	}

	if (actiontype === 'protect') { // actually protecting the page
		const item = Twinkle.protect.protectionPresetsInfo[form.category.value];

		if (mw.config.get('wgArticleId')) {
			if (item.edit) {
				form.editmodify.checked = true;
				Twinkle.protect.formevents.editmodify({ target: form.editmodify });
				form.editlevel.value = item.edit;
				Twinkle.protect.formevents.editlevel({ target: form.editlevel });
			} else {
				form.editmodify.checked = false;
				Twinkle.protect.formevents.editmodify({ target: form.editmodify });
			}

			if (item.move) {
				form.movemodify.checked = true;
				Twinkle.protect.formevents.movemodify({ target: form.movemodify });
				form.movelevel.value = item.move;
				Twinkle.protect.formevents.movelevel({ target: form.movelevel });
			} else {
				form.movemodify.checked = false;
				Twinkle.protect.formevents.movemodify({ target: form.movemodify });
			}

			form.editexpiry.value = form.moveexpiry.value = item.expiry || '2 days';

			if (form.pcmodify) {
				if (item.stabilize) {
					form.pcmodify.checked = true;
					Twinkle.protect.formevents.pcmodify({ target: form.pcmodify });
					form.pclevel.value = item.stabilize;
					Twinkle.protect.formevents.pclevel({ target: form.pclevel });
				} else {
					form.pcmodify.checked = false;
					Twinkle.protect.formevents.pcmodify({ target: form.pcmodify });
				}
				form.pcexpiry.value = item.expiry || '1 month';
			}
		} else {
			if (item.create) {
				form.createlevel.value = item.create;
				Twinkle.protect.formevents.createlevel({ target: form.createlevel });
			}
			form.createexpiry.value = item.expiry || 'infinity';
		}

		const reasonField = actiontype === 'protect' ? form.protectReason : form.reason;
		if (item.reason) {
			reasonField.value = item.reason;
		} else {
			reasonField.value = '';
		}
		// Add any annotations
		Twinkle.protect.callback.annotateProtectReason(e);

		// sort out tagging options, disabled if nonexistent, lua, or TimedText
		if (mw.config.get('wgArticleId') && mw.config.get('wgPageContentModel') !== 'Scribunto' && mw.config.get('wgNamespaceNumber') !== 710) {
			if (form.category.value === 'unprotect') {
				form.tagtype.value = 'none';
			} else {
				form.tagtype.value = item.template ? item.template : form.category.value;
			}
			Twinkle.protect.formevents.tagtype({ target: form.tagtype });

			// Default settings for adding <noinclude> tags to protection templates
			const isTemplateEditorProtection = form.category.value === 'pp-template';
			const isAFD = Morebits.pageNameNorm.startsWith('Wikipedia:Articles for deletion/');
			const isNotTemplateNamespace = mw.config.get('wgNamespaceNumber') !== 10;
			const isCode = ['javascript', 'css', 'sanitized-css'].includes(mw.config.get('wgPageContentModel'));
			if ((isTemplateEditorProtection || isAFD) && !isCode) {
				form.noinclude.checked = true;
			} else if (isCode || isNotTemplateNamespace) {
				form.noinclude.checked = false;
			}
		}

	} else { // RPP request
		if (form.category.value === 'unprotect') {
			form.expiry.value = '';
			form.expiry.disabled = true;
		} else {
			form.expiry.value = '';
			form.expiry.disabled = false;
		}
	}
};

Twinkle.protect.callback.evaluate = function twinkleprotectCallbackEvaluate(e) {
	const form = e.target;
	const input = Morebits.QuickForm.getInputData(form);

	let tagparams;
	if (input.actiontype === 'tag' || (input.actiontype === 'protect' && mw.config.get('wgArticleId') && mw.config.get('wgPageContentModel') !== 'Scribunto' && mw.config.get('wgNamespaceNumber') !== 710 /* TimedText */)) {
		tagparams = {
			tag: input.tagtype,
			reason: false,
			small: input.small,
			noinclude: input.noinclude
		};
	}

	switch (input.actiontype) {
		case 'protect':
			// protect the page
			Morebits.wiki.actionCompleted.redirect = mw.config.get('wgPageName');
			Morebits.wiki.actionCompleted.notice = 'Beskyttelse fuldført';

			var statusInited = false;
			var thispage;

			var allDone = function twinkleprotectCallbackAllDone() {
				if (thispage) {
					thispage.getStatusElement().info('udført');
				}
				if (tagparams) {
					Twinkle.protect.callbacks.taggingPageInitial(tagparams);
				}
			};

			var protectIt = function twinkleprotectCallbackProtectIt(next) {
				thispage = new Morebits.wiki.Page(mw.config.get('wgPageName'), 'Beskytter side');
				if (mw.config.get('wgArticleId')) {
					if (input.editmodify) {
						thispage.setEditProtection(input.editlevel, input.editexpiry);
					}
					if (input.movemodify) {
						// Ensure a level has actually been chosen
						if (input.movelevel) {
							thispage.setMoveProtection(input.movelevel, input.moveexpiry);
						} else {
							alert('Du skal vælge et flytningsbeskyttelsesniveau!');
							return;
						}
					}
					thispage.setWatchlist(Twinkle.getPref('watchProtectedPages'));
				} else {
					thispage.setCreateProtection(input.createlevel, input.createexpiry);
					thispage.setWatchlist(false);
				}

				if (input.protectReason) {
					thispage.setEditSummary(input.protectReason);
				} else {
					alert('Du skal angive en beskyttelsesårsag, som vil blive indskrevet i beskyttelsesloggen.');
					return;
				}

				if (input.protectReason_notes_rfppRevid && !/^\d+$/.test(input.protectReason_notes_rfppRevid)) {
					alert('Det angivne versions-ID er forkert formateret. Se venligst https://da.wikipedia.org/wiki/Hjælp:Permanent_link for oplysninger om, hvordan du finder det korrekte ID (også kaldet "oldid").');
					return;
				}

				if (!statusInited) {
					Morebits.SimpleWindow.setButtonsEnabled(false);
					Morebits.Status.init(form);
					statusInited = true;
				}

				thispage.setChangeTags(Twinkle.changeTags);
				thispage.protect(next);
			};

			var stabilizeIt = function twinkleprotectCallbackStabilizeIt() {
				if (thispage) {
					thispage.getStatusElement().info('udført');
				}

				thispage = new Morebits.wiki.Page(mw.config.get('wgPageName'), 'Anvender beskyttelse af afventende ændringer');
				thispage.setFlaggedRevs(input.pclevel, input.pcexpiry);

				if (input.protectReason) {
					thispage.setEditSummary(input.protectReason + Twinkle.summaryAd); // flaggedrevs tag support: [[phab:T247721]]
				} else {
					alert('Du skal angive en beskyttelsesårsag, som vil blive indskrevet i beskyttelsesloggen.');
					return;
				}

				if (!statusInited) {
					Morebits.SimpleWindow.setButtonsEnabled(false);
					Morebits.Status.init(form);
					statusInited = true;
				}

				thispage.setWatchlist(Twinkle.getPref('watchProtectedPages'));
				thispage.stabilize(allDone, (error) => {
					if (error.errorCode === 'stabilize_denied') { // [[phab:T234743]]
						thispage.getStatusElement().error('Fejl ved forsøg på at ændre indstillinger for afventende ændringer, sandsynligvis på grund af en MediaWiki-fejl. Andre handlinger (mærkning eller almindelig beskyttelse) kan have fundet sted. Genindlæs venligst siden og prøv igen.');
					}
				});
			};

			if (input.editmodify || input.movemodify || !mw.config.get('wgArticleId')) {
				if (input.pcmodify) {
					protectIt(stabilizeIt);
				} else {
					protectIt(allDone);
				}
			} else if (input.pcmodify) {
				stabilizeIt();
			} else {
				alert('Giv venligst Twinkle noget at gøre! \nHvis du bare vil mærke siden, kan du vælge indstillingen \'Mærk side med beskyttelsesskabelon\' øverst.');
			}

			break;

		case 'tag':
			// apply a protection template

			Morebits.SimpleWindow.setButtonsEnabled(false);
			Morebits.Status.init(form);

			Morebits.wiki.actionCompleted.redirect = mw.config.get('wgPageName');
			Morebits.wiki.actionCompleted.followRedirect = false;
			Morebits.wiki.actionCompleted.notice = 'Mærkning fuldført';

			Twinkle.protect.callbacks.taggingPageInitial(tagparams);
			break;

		case 'request':
			// file request at anmodningssiden
			var typename, typereason;
			switch (input.category) {
				case 'pp-dispute':
				case 'pp-vandalism':
				case 'pp-usertalk':
				case 'pp-protected':
					typename = 'fuld beskyttelse';
					break;
				case 'pp-template':
					typename = 'skabelonbeskyttelse';
					break;
				case 'pp-30-500-arb':
				case 'pp-30-500-vandalism':
				case 'pp-30-500-disruptive':
				case 'pp-30-500-blp':
				case 'pp-30-500-sock':
				case 'pp-30-500':
					typename = 'udvidet bekræftet beskyttelse';
					break;
				case 'pp-sock-noticeboard':
				case 'pp-semi-vandalism':
				case 'pp-semi-disruptive':
				case 'pp-semi-unsourced':
				case 'pp-semi-usertalk':
				case 'pp-semi-sock':
				case 'pp-semi-blp':
				case 'pp-semi-protected':
					typename = 'semiprotection';
					break;
				case 'pp-pc-vandalism':
				case 'pp-pc-blp':
				case 'pp-pc-protected':
				case 'pp-pc-unsourced':
				case 'pp-pc-disruptive':
					typename = 'afventende ændringer';
					break;
				case 'pp-move':
				case 'pp-move-dispute':
				case 'pp-move-indef':
				case 'pp-move-vandalism':
					typename = 'flytningsbeskyttelse';
					break;
				case 'pp-create-offensive':
				case 'pp-create-blp':
				case 'pp-create-salt':
					typename = 'oprettelsesbeskyttelse';
					break;
				case 'unprotect':
					var admins = $.map(Twinkle.protect.currentProtectionLevels, (pl) => {
						if (!pl.admin || Twinkle.protect.trustedBots.includes(pl.admin)) {
							return null;
						}
						return 'User:' + pl.admin;
					});
					if (admins.length && !confirm('Har du forsøgt at kontakte de beskyttende administratorer (' + Morebits.array.uniq(admins).join(', ') + ') først?')) {
						return false;
					}
					// otherwise falls through
				default:
					typename = 'fjernelse af beskyttelse';
					break;
			}
			switch (input.category) {
				case 'pp-dispute':
					typereason = 'Indholdskonflikt/redigeringskrig';
					break;
				case 'pp-vandalism':
				case 'pp-semi-vandalism':
				case 'pp-pc-vandalism':
				case 'pp-30-500-vandalism':
					typereason = 'Vedvarende [[Wikipedia:Hærværk|hærværk]]';
					break;
				case 'pp-semi-disruptive':
				case 'pp-pc-disruptive':
				case 'pp-30-500-disruptive':
					typereason = 'Vedvarende [[Wikipedia:Forstyrrende redigering|forstyrrende redigering]]';
					break;
				case 'pp-semi-unsourced':
				case 'pp-pc-unsourced':
					typereason = 'Vedvarende tilføjelse af ukildeangivet eller dårligt kildeangivet indhold';
					break;
				case 'pp-template':
					typereason = 'Højrisikoskabelon';
					break;
				case 'pp-30-500-arb':
					typereason = 'Voldgiftshåndhævelse';
					break;
				case 'pp-usertalk':
				case 'pp-semi-usertalk':
					typereason = 'Upassende brug af brugerdiskussionsside under blokering';
					break;
				case 'pp-sock-noticeboard':
				case 'pp-semi-sock':
				case 'pp-30-500-sock':
					typereason = 'Vedvarende [[Wikipedia:Sockpuppetry|sockpuppetry]]';
					break;
				case 'pp-semi-blp':
				case 'pp-pc-blp':
				case 'pp-30-500-blp':
					typereason = '[[Wikipedia:Biografier om levende personer|BLP]]-politikbrud';
					break;
				case 'pp-move-dispute':
					typereason = 'Tvist om sidetitel/flytningskrig';
					break;
				case 'pp-move-vandalism':
					typereason = 'Sideflytningshærværk';
					break;
				case 'pp-move-indef':
					typereason = 'Meget synlig side';
					break;
				case 'pp-create-offensive':
					typereason = 'Stødende navn';
					break;
				case 'pp-create-blp':
					typereason = 'Nyligt slettet [[Wikipedia:Biografier om levende personer|BLP]]';
					break;
				case 'pp-create-salt':
					typereason = 'Gentagne gange genskabt';
					break;
				default:
					typereason = '';
					break;
			}

			var reason = typereason;
			if (input.reason !== '') {
				if (typereason !== '') {
					reason += ' – '; // U+00A0 NO-BREAK SPACE; U+2013 EN RULE
				}
				reason += input.reason;
			}
			if (reason !== '' && reason.charAt(reason.length - 1) !== '.') {
				reason += '.';
			}

			var rppparams = {
				reason: reason,
				typename: typename,
				category: input.category,
				expiry: input.expiry
			};

			Morebits.SimpleWindow.setButtonsEnabled(false);
			Morebits.Status.init(form);

			var rppName = 'Wikipedia:Anmodning om beskyttelse/Forøgelse';

			// Updating data for the action completed event
			Morebits.wiki.actionCompleted.redirect = 'Wikipedia:Anmodning om beskyttelse';
			Morebits.wiki.actionCompleted.notice = 'Nominering fuldført, omdirigerer nu til diskussionssiden';

			var rppPage = new Morebits.wiki.Page(rppName, 'Anmoder om beskyttelse af side');
			rppPage.setFollowRedirect(true);
			rppPage.setCallbackParameters(rppparams);
			rppPage.load(Twinkle.protect.callbacks.fileRequest);
			break;
		default:
			alert('twinkleprotect: ukendt handlingstype');
			break;
	}
};

Twinkle.protect.protectReasonAnnotations = [];
Twinkle.protect.callback.annotateProtectReason = function twinkleprotectCallbackAnnotateProtectReason(e) {
	const form = e.target.form;
	const protectReason = form.protectReason.value.replace(new RegExp('(?:; )?' + mw.util.escapeRegExp(Twinkle.protect.protectReasonAnnotations.join(': '))), '');

	if (this.name === 'protectReason_notes_rfpp') {
		if (this.checked) {
			Twinkle.protect.protectReasonAnnotations.push(this.value);
			$(form.protectReason_notes_rfppRevid).parent().show();
		} else {
			Twinkle.protect.protectReasonAnnotations = [];
			form.protectReason_notes_rfppRevid.value = '';
			$(form.protectReason_notes_rfppRevid).parent().hide();
		}
	} else if (this.name === 'protectReason_notes_rfppRevid') {
		Twinkle.protect.protectReasonAnnotations = Twinkle.protect.protectReasonAnnotations.filter((el) => !el.includes('[[Special:Permalink'));
		if (e.target.value.length) {
			const permalink = '[[Special:Permalink/' + e.target.value + '#' + Morebits.pageNameNorm + ']]';
			Twinkle.protect.protectReasonAnnotations.push(permalink);
		}
	}

	if (!Twinkle.protect.protectReasonAnnotations.length) {
		form.protectReason.value = protectReason;
	} else {
		form.protectReason.value = (protectReason ? protectReason + '; ' : '') + Twinkle.protect.protectReasonAnnotations.join(': ');
	}
};

Twinkle.protect.callbacks = {
	taggingPageInitial: function(tagparams) {
		if (tagparams.tag === 'noop') {
			Morebits.Status.info('Anvender beskyttelseskabelon', 'intet at gøre');
			return;
		}

		const protectedPage = new Morebits.wiki.Page(mw.config.get('wgPageName'), 'Mærker side');
		protectedPage.setCallbackParameters(tagparams);
		protectedPage.load(Twinkle.protect.callbacks.taggingPage);
	},
	taggingPage: function(protectedPage) {
		const params = protectedPage.getCallbackParameters();
		let text = protectedPage.getPageText();
		let tag, summary;

		const oldtag_re = /(?:\/\*)?\s*(?:<noinclude>)?\s*\{\{\s*(pp-[^{}]*?|protected|(?:t|v|s|p-|usertalk-v|usertalk-s|sb|move)protected(?:2)?|protected template|privacy protection)\s*?\}\}\s*(?:<\/noinclude>)?\s*(?:\*\/)?\s*/gi;
		const re_result = oldtag_re.exec(text);
		if (re_result) {
			if (params.tag === 'none' || confirm('{{' + re_result[1] + '}} blev fundet på siden. \nKlik OK for at fjerne den, eller klik Annuller for at beholde den.')) {
				text = text.replace(oldtag_re, '');
			}
		}

		if (params.tag === 'none') {
			summary = 'Fjerner beskyttelseskabelon';
		} else {
			tag = params.tag;
			if (params.reason) {
				tag += '|reason=' + params.reason;
			}
			if (params.small) {
				tag += '|small=yes';
			}

			if (/^\s*#redirect/i.test(text)) { // redirect page
				// Only tag if no {{rcat shell}} is found
				if (!text.match(/{{(?:redr|this is a redirect|r(?:edirect)?(?:.?cat.*)?[ _]?sh)/i)) {
					text = text.replace(/#REDIRECT ?(\[\[.*?\]\])(.*)/i, '#REDIRECT $1$2\n\n{{' + tag + '}}');
				} else {
					Morebits.Status.info('Omdirigeringskategori-skal til stede', 'intet at gøre');
					return;
				}
			} else {
				const needsTagToBeCommentedOut = ['javascript', 'css', 'sanitized-css'].includes(protectedPage.getContentModel());
				if (needsTagToBeCommentedOut) {
					if (params.noinclude) {
						tag = '/* <noinclude>{{' + tag + '}}</noinclude> */';
					} else {
						tag = '/* {{' + tag + '}} */\n';
					}

					// Prepend tag at very top
					text = tag + text;
				} else {
					if (params.noinclude) {
						tag = '<noinclude>{{' + tag + '}}</noinclude>';

						if (text.startsWith('==')) {
							tag += '\n'; // a newline is needed to prevent section headings at the very beginning of the page from breaking
						}
					} else {
						tag = '{{' + tag + '}}\n';
					}

					// Insert tag after short description or any hatnotes
					const wikipage = new Morebits.wikitext.Page(text);
					text = wikipage.insertAfterTemplates(tag, Twinkle.hatnoteRegex).getText();
				}
			}
			summary = 'Tilføjer {{' + params.tag + '}}';
		}

		protectedPage.setEditSummary(summary);
		protectedPage.setChangeTags(Twinkle.changeTags);
		protectedPage.setWatchlist(Twinkle.getPref('watchPPTaggedPages'));
		protectedPage.setPageText(text);
		protectedPage.setCreateOption('nocreate');
		protectedPage.suppressProtectWarning(); // no need to let admins know they are editing through protection
		protectedPage.save();
	},

	fileRequest: function(rppPage) {

		const rppPage2 = new Morebits.wiki.Page('Wikipedia:Anmodning om beskyttelse/Reduktion', 'Indlæser anmodningssider');
		rppPage2.load(() => {
			const params = rppPage.getCallbackParameters();
			let text = rppPage.getPageText();
			const statusElement = rppPage.getStatusElement();
			let text2 = rppPage2.getPageText();

			const rppRe = new RegExp('===\\s*(\\[\\[)?\\s*:?\\s*' + Morebits.string.escapeRegExp(Morebits.pageNameNorm) + '\\s*(\\]\\])?\\s*===', 'm');
			const tag = rppRe.exec(text) || rppRe.exec(text2);

			const rppLink = document.createElement('a');
			rppLink.setAttribute('href', mw.util.getUrl('Wikipedia:Anmodning om beskyttelse'));
			rppLink.appendChild(document.createTextNode('Wikipedia:Anmodning om beskyttelse'));

			if (tag) {
				statusElement.error([ 'Der er allerede en beskyttelsesanmodning for denne side på ', rppLink, ', afbryder.' ]);
				return;
			}

			let newtag = '=== [[:' + Morebits.pageNameNorm + ']] ===\n';
			if (new RegExp('^' + mw.util.escapeRegExp(newtag).replace(/\s+/g, '\\s*'), 'm').test(text) || new RegExp('^' + mw.util.escapeRegExp(newtag).replace(/\s+/g, '\\s*'), 'm').test(text2)) {
				statusElement.error([ 'Der er allerede en beskyttelsesanmodning for denne side på ', rppLink, ', afbryder.' ]);
				return;
			}
			newtag += '* {{pagelinks|1=' + Morebits.pageNameNorm + '}}\n\n';

			let words;
			switch (params.expiry) {
				case 'temporary':
					words = 'Midlertidig ';
					break;
				case 'infinity':
					words = 'Ubestemt ';
					break;
				default:
					words = '';
					break;
			}

			words += params.typename;

			newtag += "'''" + Morebits.string.toUpperCaseFirstChar(words) + (params.reason !== '' ? ":''' " +
				Morebits.string.formatReasonText(params.reason) : ".'''") + ' ~~~~';

			// If either protection type results in a increased status, then post it under increase
			// else we post it under decrease
			let increase = false;
			const protInfo = Twinkle.protect.protectionPresetsInfo[params.category];

			// function to compute protection weights (see comment at Twinkle.protect.protectionWeight)
			const computeWeight = function(mainLevel, stabilizeLevel) {
				let result = Twinkle.protect.protectionWeight[mainLevel || 'all'];
				if (stabilizeLevel) {
					if (result) {
						if (stabilizeLevel.level === 'autoconfirmed') {
							result += 2;
						}
					} else {
						result = Twinkle.protect.protectionWeight['flaggedrevs_' + stabilizeLevel];
					}
				}
				return result;
			};

			// compare the page's current protection weights with the protection we are requesting
			const editWeight = computeWeight(Twinkle.protect.currentProtectionLevels.edit &&
				Twinkle.protect.currentProtectionLevels.edit.level,
			Twinkle.protect.currentProtectionLevels.stabilize &&
				Twinkle.protect.currentProtectionLevels.stabilize.level);
			if (computeWeight(protInfo.edit, protInfo.stabilize) > editWeight ||
				computeWeight(protInfo.move) > computeWeight(Twinkle.protect.currentProtectionLevels.move &&
				Twinkle.protect.currentProtectionLevels.move.level) ||
				computeWeight(protInfo.create) > computeWeight(Twinkle.protect.currentProtectionLevels.create &&
				Twinkle.protect.currentProtectionLevels.create.level)) {
				increase = true;
			}

			if (increase) {
				const originalTextLength = text.length;
				text += '\n' + newtag;
				if (text.length === originalTextLength) {
					const linknode = document.createElement('a');
					linknode.setAttribute('href', mw.util.getUrl('Wikipedia:Anmodning om beskyttelse'));
					linknode.appendChild(document.createTextNode('Sådan rettes anmodningssiden'));
					statusElement.error([ 'Kunne ikke finde relevant overskrift på anmodningssiden. Se venligst ', linknode, '.' ]);
					return;
				}
				statusElement.status('Tilføjer ny anmodning...');
				rppPage.setEditSummary('/* ' + Morebits.pageNameNorm + ' */ Anmoder om ' + params.typename + (params.typename === 'afventende ændringer' ? ' på [[:' : ' af [[:') +
					Morebits.pageNameNorm + ']].');
				rppPage.setChangeTags(Twinkle.changeTags);
				rppPage.setPageText(text);
				rppPage.setCreateOption('recreate');
				rppPage.save(() => {
					// Watch the page being requested
					const watchPref = Twinkle.getPref('watchRequestedPages');
					// action=watch has no way to rely on user preferences (T262912), so we do it manually.
					// The watchdefault pref appears to reliably return '1' (string),
					// but that's not consistent among prefs so might as well be "correct"
					const watch = watchPref !== 'no' && (watchPref !== 'default' || !!parseInt(mw.user.options.get('watchdefault'), 10));
					if (watch) {
						const watch_query = {
							action: 'watch',
							titles: mw.config.get('wgPageName'),
							token: mw.user.tokens.get('watchToken')
						};
						// Only add the expiry if page is unwatched or already temporarily watched
						if (Twinkle.protect.watched !== true && watchPref !== 'default' && watchPref !== 'yes') {
							watch_query.expiry = watchPref;
						}
						new Morebits.wiki.Api('Tilføjer anmodet side til overvågningsliste', watch_query).post();
					}
				});
			} else {
				const originalTextLength2 = text2.length;
				text2 += '\n' + newtag;
				if (text2.length === originalTextLength2) {
					const linknode2 = document.createElement('a');
					linknode2.setAttribute('href', mw.util.getUrl('Wikipedia:Anmodning om beskyttelse'));
					linknode2.appendChild(document.createTextNode('Sådan rettes anmodningssiden'));
					statusElement.error([ 'Kunne ikke finde relevant overskrift på anmodningssiden. Se venligst ', linknode2, '.' ]);
					return;
				}
				statusElement.status('Tilføjer ny anmodning...');
				rppPage2.setEditSummary('/* ' + Morebits.pageNameNorm + ' */ Anmoder om ' + params.typename + (params.typename === 'afventende ændringer' ? ' på [[:' : ' af [[:') +
					Morebits.pageNameNorm + ']].');
				rppPage2.setChangeTags(Twinkle.changeTags);
				rppPage2.setPageText(text2);
				rppPage2.setCreateOption('recreate');
				rppPage2.save(() => {
					// Watch the page being requested
					const watchPref = Twinkle.getPref('watchRequestedPages');
					// action=watch has no way to rely on user preferences (T262912), so we do it manually.
					// The watchdefault pref appears to reliably return '1' (string),
					// but that's not consistent among prefs so might as well be "correct"
					const watch = watchPref !== 'no' && (watchPref !== 'default' || !!parseInt(mw.user.options.get('watchdefault'), 10));
					if (watch) {
						const watch_query = {
							action: 'watch',
							titles: mw.config.get('wgPageName'),
							token: mw.user.tokens.get('watchToken')
						};
						// Only add the expiry if page is unwatched or already temporarily watched
						if (Twinkle.protect.watched !== true && watchPref !== 'default' && watchPref !== 'yes') {
							watch_query.expiry = watchPref;
						}
						new Morebits.wiki.Api('Tilføjer anmodet side til overvågningsliste', watch_query).post();
					}
				});
			}
		});
	}
};

Twinkle.addInitCallback(Twinkle.protect, 'protect');
}());

// </nowiki>
