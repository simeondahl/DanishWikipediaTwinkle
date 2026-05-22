// <nowiki>

(function() {

const api = new mw.Api();
let relevantUserName, blockedUserName, blockWindow;
const menuFormattedNamespaces = $.extend({}, mw.config.get('wgFormattedNamespaces'));
menuFormattedNamespaces[0] = '(Artikel)';

/*
 ****************************************
 *** twinkleblock.js: Block module
 ****************************************
 * Mode of invocation:     Tab ("Block")
 * Active on:              Any page with relevant user name (userspace, contribs, etc.)
 */

Twinkle.block = function twinkleblock() {
	relevantUserName = mw.config.get('wgRelevantUserName');
	// should show on Contributions or Block pages, anywhere there's a relevant user
	// Ignore ranges wider than the CIDR limit
	if (Morebits.userIsSysop && relevantUserName && (!Morebits.ip.isRange(relevantUserName) || Morebits.ip.validCIDR(relevantUserName))) {
		Twinkle.addPortletLink(Twinkle.block.callback, 'Bloker', 'tw-block', 'Bloker relevant bruger');
	}
};

Twinkle.block.callback = function twinkleblockCallback() {
	if (relevantUserName === mw.config.get('wgUserName') &&
			!confirm('Du er ved at blokere dig selv! Er du sikker på, at du vil fortsætte?')) {
		return;
	}

	Twinkle.block.currentBlockInfo = undefined;
	Twinkle.block.field_block_options = {};
	Twinkle.block.field_template_options = {};

	blockWindow = new Morebits.SimpleWindow(650, 530);
	// need to be verbose about who we're blocking
	blockWindow.setTitle('Bloker eller send blokeringsskabelon til ' + relevantUserName);
	blockWindow.setScriptName('Twinkle');
	blockWindow.addFooterLink('Blokeringsskabeloner', 'Skabelon:Blokeret');
	blockWindow.addFooterLink('Blokeringspolitik', 'Wikipedia:Politik for blokering og bandlysning');

	// Always added, hidden later if actual user not blocked
	blockWindow.addFooterLink('Ophæv blokering af denne bruger', 'Special:Unblock/' + relevantUserName, true);

	const form = new Morebits.QuickForm(Twinkle.block.callback.evaluate);
	const actionfield = form.append({
		type: 'field',
		label: 'Handlingstype'
	});
	actionfield.append({
		type: 'checkbox',
		name: 'actiontype',
		event: Twinkle.block.callback.change_action,
		list: [
			{
				label: 'Bloker bruger',
				value: 'block',
				tooltip: 'Bloker den relevante bruger med de angivne indstillinger. Hvis delvis blokering ikke er markeret, vil det være en stedvis blokering.',
				checked: true
			},
			{
				label: 'Delvis blokering',
				value: 'partial',
				tooltip: 'Aktiver delvise blokeringer og skabeloner til delvise blokeringer.',
				checked: Twinkle.getPref('defaultToPartialBlocks') // Overridden if already blocked
			},
			{
				label: 'Tilføj blokeringsskabelon til brugerens diskussionsside',
				value: 'template',
				tooltip: 'Hvis den blokerende administrator glemte at sende en blokeringsskabelon, eller du netop har blokeret brugeren uden at skabelonere dem, kan du bruge dette til at udsende den relevante skabelon. Markér feltet for delvis blokering for skabeloner til delvise blokeringer.',
				// Disallow when viewing the block dialog on an IP range
				checked: !Morebits.ip.isRange(relevantUserName),
				disabled: Morebits.ip.isRange(relevantUserName)
			}
		]
	});

	/*
	  Add option for IPv6 ranges smaller than /64 to upgrade to the 64
	  CIDR ([[WP:/64]]).  This is one of the few places where we want
	  wgRelevantUserName since this depends entirely on the original user.
	  In theory, we shouldn't use Morebits.ip.get64 here since since we want
	  to exclude functionally-equivalent /64s.  That'd be:
	  // if (mw.util.isIPv6Address(mw.config.get('wgRelevantUserName'), true) &&
	  // (mw.util.isIPv6Address(mw.config.get('wgRelevantUserName')) || parseInt(mw.config.get('wgRelevantUserName').replace(/^(.+?)\/?(\d{1,3})?$/, '$2'), 10) > 64)) {
	  In practice, though, since functionally-equivalent ranges are
	  (mis)treated as separate by MediaWiki's logging ([[phab:T146628]]),
	  using Morebits.ip.get64 provides a modicum of relief in thise case.
	*/
	const sixtyFour = Morebits.ip.get64(mw.config.get('wgRelevantUserName'));
	if (sixtyFour && sixtyFour !== mw.config.get('wgRelevantUserName')) {
		const block64field = form.append({
			type: 'field',
			label: 'Konverter til /64 områdeblokering',
			name: 'field_64'
		});
		block64field.append({
			type: 'div',
			style: 'margin-bottom: 0.5em',
			label: ['Det er som regel fint, hvis ikke bedre, bare at ', $.parseHTML('<a target="_blank" href="' + mw.util.getUrl('WP:/64') + '">blokere /64</a>')[0], '-området (',
				$.parseHTML('<a target="_blank" href="' + mw.util.getUrl('Special:Contributions/' + sixtyFour) + '">' + sixtyFour + '</a>)')[0], ').']
		});
		block64field.append({
			type: 'checkbox',
			name: 'block64',
			event: Twinkle.block.callback.change_block64,
			list: [{
				checked: Twinkle.getPref('defaultToBlock64'),
				label: 'Bloker /64 i stedet',
				value: 'block64',
				tooltip: Morebits.ip.isRange(mw.config.get('wgRelevantUserName')) ? 'Vil undlade at efterlade en skabelon.' : 'Eventuelle skabeloner sendes til den oprindelige IP: ' + mw.config.get('wgRelevantUserName')
			}]
		});
	}

	form.append({ type: 'field', label: 'Forindstilling', name: 'field_preset' });
	form.append({ type: 'field', label: 'Skabelonindstillinger', name: 'field_template_options' });
	form.append({ type: 'field', label: 'Blokeringsindstillinger', name: 'field_block_options' });

	form.append({ type: 'submit' });

	const result = form.render();
	blockWindow.setContent(result);
	blockWindow.display();
	result.root = result;

	Twinkle.block.fetchUserInfo(() => {
		// Toggle initial partial state depending on prior block type,
		// will override the defaultToPartialBlocks pref
		if (blockedUserName === relevantUserName) {
			$(result).find('[name=actiontype][value=partial]').prop('checked', Twinkle.block.currentBlockInfo.partial === '');
		}

		// clean up preset data (defaults, etc.), done exactly once, must be before Twinkle.block.callback.change_action is called
		Twinkle.block.transformBlockPresets();

		// init the controls after user and block info have been fetched
		const evt = document.createEvent('Event');
		evt.initEvent('change', true, true);

		if (result.block64 && result.block64.checked) {
			// Calls the same change_action event once finished
			result.block64.dispatchEvent(evt);
		} else {
			result.actiontype[0].dispatchEvent(evt);
		}
	});
};

// Store fetched user data, only relevant if switching IPv6 to a /64
Twinkle.block.fetchedData = {};
// Processes the data from a query response, separated from
// Twinkle.block.fetchUserInfo to allow reprocessing of already-fetched data
Twinkle.block.processUserInfo = function twinkleblockProcessUserInfo(data, fn) {
	let blockinfo = data.query.blocks[0];
	// Soft redirect to Special:Block if the user is multi-blocked (#2178)
	if (blockinfo && data.query.blocks.length > 1) {
		// Remove submission buttons.
		$(blockWindow.content).dialog('widget').find('.morebits-dialog-buttons').empty();
		Morebits.Status.init(blockWindow.content.querySelector('form'));
		Morebits.Status.warn(
			`Dette mål har ${data.query.blocks.length} aktive blokeringer`,
			`Flere samtidige blokeringer understøttes ikke af Twinkle. Brug [[Special:Block/${relevantUserName}]] i stedet.`
		);
		return;
	}
	const userinfo = data.query.users[0];
	// If an IP is blocked *and* rangeblocked, the above finds
	// whichever block is more recent, not necessarily correct.
	// Three seems... unlikely
	if (data.query.blocks.length > 1 && blockinfo.user !== relevantUserName) {
		blockinfo = data.query.blocks[1];
	}
	// Cache response, used when toggling /64 blocks
	Twinkle.block.fetchedData[userinfo.name] = data;

	Twinkle.block.isRegistered = !!userinfo.userid;
	if (Twinkle.block.isRegistered) {
		Twinkle.block.userIsBot = !!userinfo.groupmemberships && userinfo.groupmemberships.map((e) => e.group).includes('bot');
	} else {
		Twinkle.block.userIsBot = false;
	}

	if (blockinfo) {
		// handle frustrating system of inverted boolean values
		blockinfo.disabletalk = blockinfo.allowusertalk === undefined;
		blockinfo.hardblock = blockinfo.anononly === undefined;
	}
	// will undefine if no blocks present
	Twinkle.block.currentBlockInfo = blockinfo;
	blockedUserName = Twinkle.block.currentBlockInfo && Twinkle.block.currentBlockInfo.user;

	// Toggle unblock link if not the user in question; always first
	const unblockLink = document.querySelector('.morebits-dialog-footerlinks a');
	if (blockedUserName !== relevantUserName) {
		unblockLink.hidden = true;
		unblockLink.nextSibling.hidden = true; // link+trailing bullet
	} else {
		unblockLink.hidden = false;
		unblockLink.nextSibling.hidden = false; // link+trailing bullet
	}

	// Semi-busted on ranges, see [[phab:T270737]] and [[phab:T146628]].
	// Basically, logevents doesn't treat functionally-equivalent ranges
	// as equivalent, meaning any functionally-equivalent IP range is
	// misinterpreted by the log throughout.  Without logevents
	// redirecting (like Special:Block does) we would need a function to
	// parse ranges, which is a pain.  IPUtils has the code, but it'd be a
	// lot of cruft for one purpose.
	Twinkle.block.hasBlockLog = !!data.query.logevents.length;
	Twinkle.block.blockLog = Twinkle.block.hasBlockLog && data.query.logevents;
	// Used later to check if block status changed while filling out the form
	Twinkle.block.blockLogId = Twinkle.block.hasBlockLog ? data.query.logevents[0].logid : false;

	if (typeof fn === 'function') {
		return fn();
	}
};

Twinkle.block.fetchUserInfo = function twinkleblockFetchUserInfo(fn) {
	const query = {
		format: 'json',
		action: 'query',
		list: 'blocks|users|logevents',
		letype: 'block',
		lelimit: 1,
		letitle: 'User:' + relevantUserName,
		bkprop: 'expiry|reason|flags|restrictions|range|user',
		ususers: relevantUserName
	};

	// bkusers doesn't catch single IPs blocked as part of a range block
	if (mw.util.isIPAddress(relevantUserName, true)) {
		query.bkip = relevantUserName;
	} else {
		query.bkusers = relevantUserName;
		// groupmemberships only relevant for registered users
		query.usprop = 'groupmemberships';
	}

	api.get(query).then((data) => {
		Twinkle.block.processUserInfo(data, fn);
	}, (msg) => {
		Morebits.Status.init($('div[name="currentblock"] span').last()[0]);
		Morebits.Status.warn('Fejl ved hentning af brugeroplysninger', msg);
	});
};

Twinkle.block.callback.saveFieldset = function twinkleblockCallbacksaveFieldset(fieldset) {
	Twinkle.block[$(fieldset).prop('name')] = {};
	$(fieldset).serializeArray().forEach((el) => {
		// namespaces and pages for partial blocks are overwritten
		// here, but we're handling them elsewhere so that's fine
		Twinkle.block[$(fieldset).prop('name')][el.name] = el.value;
	});
};

Twinkle.block.callback.change_block64 = function twinkleblockCallbackChangeBlock64(e) {
	const $form = $(e.target.form), $block64 = $form.find('[name=block64]');

	// Show/hide block64 button
	// Single IPv6, or IPv6 range smaller than a /64
	const priorName = relevantUserName;
	if ($block64.is(':checked')) {
		relevantUserName = Morebits.ip.get64(mw.config.get('wgRelevantUserName'));
	} else {
		relevantUserName = mw.config.get('wgRelevantUserName');
	}
	// No templates for ranges, but if the original user is a single IP, offer the option
	// (done separately in Twinkle.block.callback.issue_template)
	const originalIsRange = Morebits.ip.isRange(mw.config.get('wgRelevantUserName'));
	$form.find('[name=actiontype][value=template]').prop('disabled', originalIsRange).prop('checked', !originalIsRange);

	// Refetch/reprocess user info then regenerate the main content
	const regenerateForm = function() {
		// Tweak titlebar text.  In theory, we could save the dialog
		// at initialization and then use `.setTitle` or
		// `dialog('option', 'title')`, but in practice that swallows
		// the scriptName and requires `.display`ing, which jumps the
		// window.  It's just a line of text, so this is fine.
		const titleBar = document.querySelector('.ui-dialog-title').firstChild.nextSibling;
		titleBar.nodeValue = titleBar.nodeValue.replace(priorName, relevantUserName);
		// Tweak unblock link
		const unblockLink = document.querySelector('.morebits-dialog-footerlinks a');
		unblockLink.href = unblockLink.href.replace(priorName, relevantUserName);
		unblockLink.title = unblockLink.title.replace(priorName, relevantUserName);

		// Correct partial state
		$form.find('[name=actiontype][value=partial]').prop('checked', Twinkle.getPref('defaultToPartialBlocks'));
		if (blockedUserName === relevantUserName) {
			$form.find('[name=actiontype][value=partial]').prop('checked', Twinkle.block.currentBlockInfo.partial === '');
		}

		// Set content appropriately
		Twinkle.block.callback.change_action(e);
	};

	if (Twinkle.block.fetchedData[relevantUserName]) {
		Twinkle.block.processUserInfo(Twinkle.block.fetchedData[relevantUserName], regenerateForm);
	} else {
		Twinkle.block.fetchUserInfo(regenerateForm);
	}
};

Twinkle.block.callback.change_action = function twinkleblockCallbackChangeAction(e) {
	let fieldPreset, fieldTemplateOptions, fieldBlockOptions;
	const $form = $(e.target.form);
	// Make ifs shorter
	const blockBox = $form.find('[name=actiontype][value=block]').is(':checked');
	const templateBox = $form.find('[name=actiontype][value=template]').is(':checked');
	const $partial = $form.find('[name=actiontype][value=partial]');
	const partialBox = $partial.is(':checked');
	let blockGroup = partialBox ? Twinkle.block.blockGroupsPartial : Twinkle.block.blockGroups;

	$partial.prop('disabled', !blockBox && !templateBox);

	// Add current block parameters as default preset
	const prior = { label: 'Tidligere blokering' };
	if (blockedUserName === relevantUserName) {
		Twinkle.block.blockPresetsInfo.prior = Twinkle.block.currentBlockInfo;
		// value not a valid template selection, chosen below by setting templateName
		prior.list = [{ label: 'Tidligere blokeringsindstillinger', value: 'prior', selected: true }];

		// Arrays of objects are annoying to check
		if (!blockGroup.some((bg) => bg.label === prior.label)) {
			blockGroup.push(prior);
		}

		// Always ensure proper template exists/is selected when switching modes
		if (partialBox) {
			Twinkle.block.blockPresetsInfo.prior.templateName = Morebits.string.isInfinity(Twinkle.block.currentBlockInfo.expiry) ? 'Bandlyst-delvis' : 'Blokeret-delvis';
		} else {
			if (!Twinkle.block.isRegistered) {
				Twinkle.block.blockPresetsInfo.prior.templateName = 'Blokeret-IP';
			} else {
				Twinkle.block.blockPresetsInfo.prior.templateName = Morebits.string.isInfinity(Twinkle.block.currentBlockInfo.expiry) ? 'Bandlyst' : 'Blokeret';
			}
		}
	} else {
		// But first remove any prior prior
		blockGroup = blockGroup.filter((bg) => bg.label !== prior.label);
	}

	// Can be in preset or template field, so the old one in the template
	// field will linger. No need to keep the old value around, so just
	// remove it; saves trouble when hiding/evaluating
	$form.find('[name=dstopic]').parent().remove();

	Twinkle.block.callback.saveFieldset($('[name=field_block_options]'));
	Twinkle.block.callback.saveFieldset($('[name=field_template_options]'));

	if (blockBox) {
		fieldPreset = new Morebits.QuickForm.Element({ type: 'field', label: 'Forindstilling', name: 'field_preset' });
		fieldPreset.append({
			type: 'select',
			name: 'preset',
			label: 'Vælg en forindstilling:',
			event: Twinkle.block.callback.change_preset,
			list: Twinkle.block.callback.filtered_block_groups(blockGroup)
		});

		fieldBlockOptions = new Morebits.QuickForm.Element({ type: 'field', label: 'Blokeringsindstillinger', name: 'field_block_options' });
		fieldBlockOptions.append({ type: 'div', name: 'currentblock', label: ' ' });
		fieldBlockOptions.append({ type: 'div', name: 'hasblocklog', label: ' ' });
		fieldBlockOptions.append({
			type: 'select',
			name: 'expiry_preset',
			label: 'Blokeringsvarighed:',
			event: Twinkle.block.callback.change_expiry,
			list: [
				{ label: 'tilpasset', value: 'custom', selected: true },
				{ label: 'ubestemt', value: 'infinity' },
				{ label: '3 timer', value: '3 hours' },
				{ label: '12 timer', value: '12 hours' },
				{ label: '24 timer', value: '24 hours' },
				{ label: '31 timer', value: '31 hours' },
				{ label: '36 timer', value: '36 hours' },
				{ label: '48 timer', value: '48 hours' },
				{ label: '60 timer', value: '60 hours' },
				{ label: '72 timer', value: '72 hours' },
				{ label: '1 uge', value: '1 week' },
				{ label: '2 uger', value: '2 weeks' },
				{ label: '1 måned', value: '1 month' },
				{ label: '3 måneder', value: '3 months' },
				{ label: '6 måneder', value: '6 months' },
				{ label: '1 år', value: '1 year' },
				{ label: '2 år', value: '2 years' },
				{ label: '3 år', value: '3 years' }
			]
		});
		fieldBlockOptions.append({
			type: 'input',
			name: 'expiry',
			label: 'Tilpasset varighed',
			tooltip: 'Du kan bruge relative tider som "1 minute" eller "19 days", eller absolutte tidsstempler "yyyymmddhhmm" (f.eks. "200602011405" er 1. feb 2006 kl. 14:05 UTC).',
			value: Twinkle.block.field_block_options.expiry || Twinkle.block.field_template_options.template_expiry
		});

		if (partialBox) { // Partial block
			fieldBlockOptions.append({
				type: 'select',
				multiple: true,
				name: 'pagerestrictions',
				label: 'Specifikke sider at blokere fra redigering',
				value: '',
				tooltip: 'Maks. 10 sider.'
			});
			const ns = fieldBlockOptions.append({
				type: 'select',
				multiple: true,
				name: 'namespacerestrictions',
				label: 'Navnerumsblokeringer',
				value: '',
				tooltip: 'Bloker fra redigering i disse navnerum.'
			});
			$.each(menuFormattedNamespaces, (number, name) => {
				// Ignore -1: Special; -2: Media; and 2300-2303: Gadget (talk) and Gadget definition (talk)
				if (number >= 0 && number < 830) {
					ns.append({ type: 'option', label: name, value: number });
				}
			});
		}

		const blockoptions = [
			{
				checked: Twinkle.block.field_block_options.nocreate,
				label: 'Forhindre kontooprettelse',
				name: 'nocreate',
				value: '1'
			},
			{
				checked: Twinkle.block.field_block_options.noemail,
				label: 'Bloker brugeren fra at sende e-mail',
				name: 'noemail',
				value: '1'
			},
			{
				checked: Twinkle.block.field_block_options.disabletalk,
				label: 'Forhindre denne bruger i at redigere sin egen diskussionsside under blokering',
				name: 'disabletalk',
				value: '1',
				tooltip: partialBox ? 'Hvis der udstedes en delvis blokering, SKAL dette forblive umarkeret, medmindre du også forhindrer dem i at redigere Brugerdiskussion-navnerummet' : ''
			}
		];

		if (Twinkle.block.isRegistered) {
			blockoptions.push({
				checked: Twinkle.block.field_block_options.autoblock,
				label: 'Autoblokering af alle anvendte IP-adresser (hård blokering)',
				name: 'autoblock',
				value: '1'
			});
		} else {
			blockoptions.push({
				checked: Twinkle.block.field_block_options.hardblock,
				label: 'Bloker indloggede brugere fra at bruge denne IP-adresse (hård blokering)',
				name: 'hardblock',
				value: '1'
			});
		}

		blockoptions.push({
			checked: Twinkle.block.field_block_options.watchuser,
			label: 'Overvåg bruger- og brugerdiskussionssider',
			name: 'watchuser',
			value: '1'
		});

		fieldBlockOptions.append({
			type: 'checkbox',
			name: 'blockoptions',
			list: blockoptions
		});
		fieldBlockOptions.append({
			type: 'textarea',
			label: 'Årsag til blokering (til blokeringsloggen):',
			name: 'reason',
			tooltip: 'Overvej at tilføje nyttige detaljer til standardmeddelelsen.',
			value: Twinkle.block.field_block_options.reason
		});

		fieldBlockOptions.append({
			type: 'div',
			name: 'filerlog_label',
			label: 'Se også:',
			style: 'display:inline-block;font-style:normal !important',
			tooltip: 'Indsæt en "se også"-besked for at angive, om filterloggen, slettede bidrag eller relaterede midlertidige konti spillede en rolle i beslutningen om at blokere.'
		});
		fieldBlockOptions.append({
			type: 'checkbox',
			name: 'filter_see_also',
			event: Twinkle.block.callback.toggle_see_alsos,
			style: 'display:inline-block; margin-right:5px',
			list: [
				{
					label: 'Filterlog',
					checked: false,
					value: 'filter log'
				}
			]
		});
		fieldBlockOptions.append({
			type: 'checkbox',
			name: 'deleted_see_also',
			event: Twinkle.block.callback.toggle_see_alsos,
			style: 'display:inline-block; margin-right:5px',
			list: [
				{
					label: 'Slettede bidrag',
					checked: false,
					value: 'deleted contribs'
				}
			]
		});
		if (mw.util.isTemporaryUser(mw.config.get('wgRelevantUserName'))) {
			fieldBlockOptions.append({
				type: 'checkbox',
				name: 'related_see_also',
				event: Twinkle.block.callback.toggle_see_alsos,
				style: 'display:inline-block',
				list: [
					{
						label: 'Relaterede midlertidige konti',
						checked: false,
						value: 'related temporary accounts'
					}
				]
			});
		}

		// Yet-another-logevents-doesn't-handle-ranges-well
		if (blockedUserName === relevantUserName) {
			fieldBlockOptions.append({ type: 'hidden', name: 'reblock', value: '1' });
		}
	}

	// grab discretionary sanctions list from en-wiki
	Twinkle.block.dsinfo = Morebits.wiki.getCachedJson('Template:Ds/topics.json');

	Twinkle.block.dsinfo.then((dsinfo) => {
		const $select = $('[name="dstopic"]');
		const $options = $.map(dsinfo, (value, key) => $('<option>').val(value.code).text(key).prop('label', key));
		$select.append($options);
	});

	// DS selection visible in either the template field set or preset,
	// joint settings saved here
	const dsSelectSettings = {
		type: 'select',
		name: 'dstopic',
		label: 'DS-emne',
		value: '',
		tooltip: 'Hvis valgt, vil det informere skabelonen og kan tilføjes til blokeringsmeddelelsen',
		event: Twinkle.block.callback.toggle_ds_reason
	};
	if (templateBox) {
		fieldTemplateOptions = new Morebits.QuickForm.Element({ type: 'field', label: 'Skabelonindstillinger', name: 'field_template_options' });
		fieldTemplateOptions.append({
			type: 'select',
			name: 'template',
			label: 'Vælg diskussionssideskabelon:',
			event: Twinkle.block.callback.change_template,
			list: Twinkle.block.callback.filtered_block_groups(blockGroup, true),
			value: Twinkle.block.field_template_options.template
		});

		// Only visible for aeblock and aepblock, toggled in change_template
		fieldTemplateOptions.append(dsSelectSettings);

		fieldTemplateOptions.append({
			type: 'input',
			name: 'article',
			label: 'Tilknyttet side',
			value: '',
			tooltip: 'En side kan linkes i beskeden, måske hvis det var det primære mål for forstyrrende adfærd. Lad være tom for ingen link.'
		});

		// Only visible if partial and not blocking
		fieldTemplateOptions.append({
			type: 'input',
			name: 'area',
			label: 'Område blokeret fra',
			value: '',
			tooltip: 'Valgfri forklaring af de sider eller navnerum brugeren er blokeret fra at redigere.'
		});

		if (!blockBox) {
			fieldTemplateOptions.append({
				type: 'input',
				name: 'template_expiry',
				label: 'Blokeringsperiode:',
				value: '',
				tooltip: 'Blokeringsperioden, f.eks. 24 timer, 2 uger, ubestemt osv.'
			});
		}
		fieldTemplateOptions.append({
			type: 'input',
			name: 'block_reason',
			label: '"Du er blokeret for ..."',
			tooltip: 'En valgfri årsag til at erstatte standardårsagen. Kun tilgængelig for generiske blokeringsskabeloner.',
			value: Twinkle.block.field_template_options.block_reason
		});

		if (blockBox) {
			fieldTemplateOptions.append({
				type: 'checkbox',
				name: 'blank_duration',
				list: [
					{
						label: 'Inkluder ikke udløbsdato i skabelon',
						checked: Twinkle.block.field_template_options.blank_duration,
						tooltip: 'I stedet for at inkludere varigheden, lad blokeringsskabelonen læse "Du er midlertidigt blokeret..."'
					}
				]
			});
		} else {
			fieldTemplateOptions.append({
				type: 'checkbox',
				list: [
					{
						label: 'Adgang til diskussionsside deaktiveret',
						name: 'notalk',
						checked: Twinkle.block.field_template_options.notalk,
						tooltip: 'Lad blokeringsskabelonen angive, at brugerens adgang til diskussionssiden er fjernet'
					},
					{
						label: 'Bruger blokeret fra at sende e-mail',
						name: 'noemail_template',
						checked: Twinkle.block.field_template_options.noemail_template,
						tooltip: 'Hvis området ikke er angivet, lad blokeringsskabelonen angive, at brugerens e-mail-adgang er fjernet'
					},
					{
						label: 'Bruger blokeret fra at oprette konti',
						name: 'nocreate_template',
						checked: Twinkle.block.field_template_options.nocreate_template,
						tooltip: 'Hvis området ikke er angivet, lad blokeringsskabelonen angive, at brugerens evne til at oprette konti er fjernet'
					}
				]
			});
		}

		const $previewlink = $('<a id="twinkleblock-preview-link">Forhåndsvisning</a>');
		$previewlink.off('click').on('click', () => {
			Twinkle.block.callback.preview($form[0]);
		});
		$previewlink.css({cursor: 'pointer'});
		fieldTemplateOptions.append({ type: 'div', id: 'blockpreview', label: [ $previewlink[0] ] });
		fieldTemplateOptions.append({ type: 'div', id: 'twinkleblock-previewbox', style: 'display: none' });
	} else if (fieldPreset) {
		// Only visible for arbitration enforcement, toggled in change_preset
		fieldPreset.append(dsSelectSettings);
	}

	let oldfield;
	if (fieldPreset) {
		oldfield = $form.find('fieldset[name="field_preset"]')[0];
		oldfield.parentNode.replaceChild(fieldPreset.render(), oldfield);
	} else {
		$form.find('fieldset[name="field_preset"]').hide();
	}
	if (fieldBlockOptions) {
		oldfield = $form.find('fieldset[name="field_block_options"]')[0];
		oldfield.parentNode.replaceChild(fieldBlockOptions.render(), oldfield);
		$form.find('fieldset[name="field_64"]').show();

		$form.find('[name=pagerestrictions]').select2({
			theme: 'default select2-morebits',
			width: '100%',
			placeholder: 'Vælg sider at blokere brugeren fra',
			language: {
				errorLoading: function() {
					return 'Ufuldstændigt eller ugyldigt søgeord';
				}
			},
			maximumSelectionLength: 10, // Software limitation [[phab:T202776]]
			minimumInputLength: 1, // prevent ajax call when empty
			ajax: {
				url: mw.util.wikiScript('api'),
				dataType: 'json',
				delay: 100,
				data: function(params) {
					const title = mw.Title.newFromText(params.term);
					if (!title) {
						return;
					}
					return {
						action: 'query',
						format: 'json',
						list: 'allpages',
						apfrom: title.title,
						apnamespace: title.namespace,
						aplimit: '10'
					};
				},
				processResults: function(data) {
					return {
						results: data.query.allpages.map((page) => {
							const title = mw.Title.newFromText(page.title, page.ns).toText();
							return {
								id: title,
								text: title
							};
						})
					};
				}
			},
			templateSelection: function(choice) {
				return $('<a>').text(choice.text).attr({
					href: mw.util.getUrl(choice.text),
					target: '_blank'
				});
			}
		});

		$form.find('[name=namespacerestrictions]').select2({
			theme: 'default select2-morebits',
			width: '100%',
			matcher: Morebits.select2.matchers.wordBeginning,
			language: {
				searching: Morebits.select2.queryInterceptor
			},
			templateResult: Morebits.select2.highlightSearchMatches,
			placeholder: 'Vælg navnerum at blokere brugeren fra'
		});

		mw.util.addCSS(
			// Reduce padding
			'.select2-results .select2-results__option { padding-top: 1px; padding-bottom: 1px; }' +
			// Adjust font size
			'.select2-container .select2-dropdown .select2-results { font-size: 13px; }' +
			'.select2-container .selection .select2-selection__rendered { font-size: 13px; }' +
			// Remove black border
			'.select2-container--default.select2-container--focus .select2-selection--multiple { border: 1px solid #aaa; }' +
			// Make the tiny cross larger
			'.select2-selection__choice__remove { font-size: 130%; }'
		);
	} else {
		$form.find('fieldset[name="field_block_options"]').hide();
		$form.find('fieldset[name="field_64"]').hide();
		// Clear select2 options
		$form.find('[name=pagerestrictions]').val(null).trigger('change');
		$form.find('[name=namespacerestrictions]').val(null).trigger('change');
	}

	if (fieldTemplateOptions) {
		oldfield = $form.find('fieldset[name="field_template_options"]')[0];
		oldfield.parentNode.replaceChild(fieldTemplateOptions.render(), oldfield);
		e.target.form.root.previewer = new Morebits.wiki.Preview($(e.target.form.root).find('#twinkleblock-previewbox').last()[0]);
	} else {
		$form.find('fieldset[name="field_template_options"]').hide();
	}

	// Any block, including ranges
	if (Twinkle.block.currentBlockInfo) {
		// false for an ip covered by a range or a smaller range within a larger range;
		// true for a user, single ip block, or the exact range for a range block
		const sameUser = blockedUserName === relevantUserName;

		Morebits.Status.init($('div[name="currentblock"] span').last()[0]);
		let statusStr = relevantUserName + ' er ' + (Twinkle.block.currentBlockInfo.partial === '' ? 'delvist blokeret' : 'blokeret stedvist');

		// Range blocked
		if (Twinkle.block.currentBlockInfo.rangestart !== Twinkle.block.currentBlockInfo.rangeend) {
			if (sameUser) {
				statusStr += ' som en områdeblokering';
			} else {
				statusStr += ' inden for en' + (Morebits.ip.get64(relevantUserName) === blockedUserName ? ' /64' : '') + ' områdeblokering';
				// Link to the full range
				const $rangeblockloglink = $('<span>').append($('<a target="_blank" href="' + mw.util.getUrl('Special:Log', {action: 'view', page: blockedUserName, type: 'block'}) + '">' + blockedUserName + '</a>)'));
				statusStr += ' (' + $rangeblockloglink.html() + ')';
			}
		}

		if (Twinkle.block.currentBlockInfo.expiry === 'infinity') {
			statusStr += ' (ubestemt)';
		} else if (new Morebits.Date(Twinkle.block.currentBlockInfo.expiry).isValid()) {
			statusStr += ' (udløber ' + new Morebits.Date(Twinkle.block.currentBlockInfo.expiry).calendar('utc') + ')';
		}

		let infoStr = 'Denne formular vil';
		if (sameUser) {
			infoStr += ' ændre denne blokering';
			if (Twinkle.block.currentBlockInfo.partial === undefined && partialBox) {
				infoStr += ' og konvertere den til en delvis blokering';
			} else if (Twinkle.block.currentBlockInfo.partial === '' && !partialBox) {
				infoStr += ' og konvertere den til en stedvis blokering';
			}
			infoStr += '.';
		} else {
			infoStr += ' tilføje en yderligere ' + (partialBox ? 'delvis ' : '') + 'blokering.';
		}

		Morebits.Status.warn(statusStr, infoStr);

		// Default to the current block conditions on intial form generation
		Twinkle.block.callback.update_form(e, Twinkle.block.currentBlockInfo);
	}

	// This is where T146628 really comes into play: a rangeblock will
	// only return the correct block log if wgRelevantUserName is the
	// exact range, not merely a funtional equivalent
	if (Twinkle.block.hasBlockLog) {
		const $blockloglink = $('<span>').append($('<a target="_blank" href="' + mw.util.getUrl('Special:Log', {action: 'view', page: relevantUserName, type: 'block'}) + '">blokeringslog</a>)'));
		if (!Twinkle.block.currentBlockInfo) {
			const lastBlockAction = Twinkle.block.blockLog[0];
			if (lastBlockAction.action === 'unblock') {
				$blockloglink.append(' (ophævet ' + new Morebits.Date(lastBlockAction.timestamp).calendar('utc') + ')');
			} else { // block or reblock
				$blockloglink.append(' (' + lastBlockAction.params.duration + ', udløbet ' + new Morebits.Date(lastBlockAction.params.expiry).calendar('utc') + ')');
			}
		}

		Morebits.Status.init($('div[name="hasblocklog"] span').last()[0]);
		Morebits.Status.warn(Twinkle.block.currentBlockInfo ? 'Tidligere blokeringer' : 'Dette ' + (Morebits.ip.isRange(relevantUserName) ? 'område' : 'bruger') + ' er blevet blokeret tidligere', $blockloglink[0]);
	}

	// Make sure all the fields are correct based on initial defaults
	if (blockBox) {
		Twinkle.block.callback.change_preset(e);
	} else if (templateBox) {
		Twinkle.block.callback.change_template(e);
	}
};

/*
 * Keep alphabetized by key name, Twinkle.block.blockGroups establishes
 *    the order they will appear in the interface
 *
 * Block preset format, all keys accept only 'true' (omit for false) except where noted:
 * <title of block template> : {
 *   autoblock: <autoblock any IP addresses used (for registered users only)>
 *   disabletalk: <disable user from editing their own talk page while blocked>
 *   expiry: <string - expiry timestamp, can include relative times like "5 months", "2 weeks" etc>
 *   forIPsOnly: <show block option in the interface only if the relevant user is an IP>
 *   forTempAccountsOnly: <show block option in the interface only if the relevant user is a temporary account>
 *   forRegisteredOnly: <show block option in the interface only if the relevant user is a temporary account or regular account>
 *   label: <string - label for the option of the dropdown in the interface (keep brief)>
 *   noemail: prevent the user from sending email through Special:Emailuser
 *   pageParam: <set if the associated block template accepts a page parameter>
 *   prependReason: <string - prepends the value of 'reason' to the end of the existing reason, namely for when revoking talk page access>
 *   nocreate: <block account creation from the user's IP (for unregistered users only)>
 *   nonstandard: <template does not conform to stewardship of WikiProject User Warnings and may not accept standard parameters>
 *   reason: <string - block rationale, as would appear in the block log,
 *            and the edit summary for when adding block template, unless 'summary' is set>
 *   reasonParam: <set if the associated block template accepts a reason parameter>
 *   sig: <string - set to ~~~~ if block template does not accept "true" as the value, or set null to omit sig param altogether>
 *   summary: <string - edit summary for when adding block template to user's talk page, if not set, 'reason' is used>
 *   suppressArticleInSummary: <set to suppress showing the article name in the edit summary, as with attack pages>
 *   templateName: <string - name of template to use (instead of key name), entry will be omitted from the Templates list.
 *                  (e.g. use another template but with different block options)>
 *   useInitialOptions: <when preset is chosen, only change given block options, leave others as they were>
 *
 * WARNING: 'anononly' and 'allowusertalk' are enabled by default.
 *   To disable, set 'hardblock' and 'disabletalk', respectively
 */
Twinkle.block.blockPresetsInfo = {
	// IP-blokeringer
	'Blokeret-IP': {
		expiry: '31 hours',
		forIPsOnly: true,
		nocreate: true,
		templateName: 'Blokeret',
		reason: '[[Wikipedia:Politik for blokering og bandlysning|Hærværk]]',
		summary: 'Din IP-adresse er blokeret fra redigering'
	},
	'Blokeret-skoleIP': {
		expiry: '36 hours',
		forIPsOnly: true,
		nocreate: true,
		reason: '[[Wikipedia:Politik for blokering og bandlysning|Hærværk fra skole-IP]]',
		summary: 'Din IP-adresse er blokeret fra redigering (skole-IP)'
	},
	// Midlertidige blokeringer af registrerede brugere
	Blokeret: {
		autoblock: true,
		expiry: '24 hours',
		forRegisteredOnly: true,
		nocreate: true,
		pageParam: true,
		reasonParam: true,
		summary: 'Du er blokeret fra redigering',
		suppressArticleInSummary: true
	},
	// Permanente blokeringer (bandlysninger)
	Bandlyst: {
		autoblock: true,
		expiry: 'infinity',
		forRegisteredOnly: true,
		nocreate: true,
		pageParam: true,
		reasonParam: true,
		summary: 'Du er permanent bandlyst fra redigering',
		suppressArticleInSummary: true
	},
	// Hærværk
	'Blokeret-hærværk': {
		autoblock: true,
		expiry: '31 hours',
		nocreate: true,
		pageParam: true,
		templateName: 'Blokeret',
		reason: '[[Wikipedia:Hærværk|Hærværk]]',
		summary: 'Du er blokeret fra redigering for at forhindre yderligere [[Wikipedia:Hærværk|hærværk]]'
	},
	// Hærværkskonto
	'Bandlyst-hærværkskonto': {
		autoblock: true,
		expiry: 'infinity',
		forRegisteredOnly: true,
		nocreate: true,
		pageParam: true,
		templateName: 'Bandlyst',
		reason: 'Hærværkskonto',
		summary: 'Du er permanent bandlyst fra redigering, fordi din konto udelukkende bruges til [[Wikipedia:Hærværk|hærværk]]'
	},
	// Spam
	'Blokeret-spam': {
		autoblock: true,
		nocreate: true,
		templateName: 'Blokeret',
		reason: 'Spam',
		summary: 'Du er blokeret fra redigering for brug af Wikipedia til [[Wikipedia:Spam|spam]]'
	},
	// Chikane
	'Blokeret-chikane': {
		autoblock: true,
		nocreate: true,
		pageParam: true,
		templateName: 'Blokeret',
		reason: 'Chikane eller personlige angreb',
		summary: 'Du er blokeret fra redigering for chikane af andre brugere'
	},
	// Misbrug af flere konti (puppet)
	'Bandlyst-sokkedukke': {
		autoblock: true,
		expiry: 'infinity',
		forRegisteredOnly: true,
		nocreate: true,
		templateName: 'Bandlyst',
		reason: 'Misbrug af flere konti ([[Wikipedia:Sokkedukker|sokkedukke]])',
		summary: 'Denne konto er bandlyst som en sokkedukke oprettet til at krænke Wikipedias politikker'
	},
	// Misbrug af flere konti (mester)
	'Bandlyst-kontomisbrug': {
		autoblock: true,
		forRegisteredOnly: true,
		nocreate: true,
		templateName: 'Bandlyst',
		reason: 'Misbrug af [[Wikipedia:Sokkedukker|flere konti]]',
		summary: 'Du er blokeret fra redigering for misbrug af [[Wikipedia:Sokkedukker|flere konti]]'
	},
	// Forstyrrende redigering
	'Blokeret-forstyrrende': {
		autoblock: true,
		nocreate: true,
		templateName: 'Blokeret',
		reason: 'Forstyrrende redigering',
		summary: 'Du er blokeret fra redigering for forstyrrende redigering'
	},
	// Tilbagekald af adgang til diskussionsside
	'Blokeret-talkrevoked': {
		disabletalk: true,
		templateName: 'Blokeret',
		reason: 'Tilbagekaldelse af adgang til diskussionsside: upassende brug af brugerdiskussionsside under blokering',
		prependReason: true,
		summary: 'Din adgang til brugerdiskussionssiden er deaktiveret',
		useInitialOptions: true
	},
	// Omgåelse af blokering (IP)
	'Blokeret-omgåelse-IP': {
		forIPsOnly: true,
		expiry: '1 week',
		nocreate: true,
		templateName: 'Blokeret',
		reason: 'Omgåelse af blokering',
		summary: 'Din IP-adresse er blokeret fra redigering, fordi den er brugt til at omgå en tidligere blokering'
	},
	// Omgåelse af blokering (midlertidig konto)
	'Bandlyst-omgåelse-temp': {
		autoblock: true,
		expiry: 'infinity',
		forTempAccountsOnly: true,
		nocreate: true,
		templateName: 'Bandlyst',
		reason: 'Omgåelse af blokering',
		summary: 'Din midlertidige konto er blokeret fra redigering, fordi den er brugt til at omgå en tidligere blokering'
	},
	// Brugernavn krænkelse (blød)
	'Blokeret-brugernavn-blød': {
		expiry: 'infinity',
		forRegisteredOnly: true,
		templateName: 'Blokeret',
		reasonParam: true,
		reason: 'Krænkelse af [[Wikipedia:Brugernavnspolitik|brugernavnspolitikken]] (blød blokering)',
		summary: 'Du er permanent blokeret fra redigering, fordi dit brugernavn krænker [[Wikipedia:Brugernavnspolitik|brugernavnspolitikken]]'
	},
	// Brugernavn krænkelse (hård)
	'Bandlyst-brugernavn-hård': {
		autoblock: true,
		expiry: 'infinity',
		forRegisteredOnly: true,
		nocreate: true,
		templateName: 'Bandlyst',
		reasonParam: true,
		reason: 'Grov krænkelse af [[Wikipedia:Brugernavnspolitik|brugernavnspolitikken]] (hård blokering)',
		summary: 'Du er permanent bandlyst fra redigering, fordi dit brugernavn groft krænker [[Wikipedia:Brugernavnspolitik|brugernavnspolitikken]]'
	},
	// Ophavsretskrænkelser
	'Bandlyst-ophavsret': {
		autoblock: true,
		expiry: 'infinity',
		nocreate: true,
		pageParam: true,
		templateName: 'Bandlyst',
		reason: 'Ophavsretskrænkelser',
		summary: 'Du er blokeret fra redigering for vedvarende [[Wikipedia:Ophavsret|ophavsretskrænkelser]]'
	},
	// CheckUser-blokering
	'CheckUser-blokering': {
		expiry: '1 week',
		forIPsOnly: true,
		nocreate: true,
		nonstandard: true,
		reason: '{{CheckUser block}}',
		sig: '~~~~'
	},
	'CheckUser-blokering-konto': {
		autoblock: true,
		expiry: 'infinity',
		forRegisteredOnly: true,
		nocreate: true,
		nonstandard: true,
		reason: '{{checkuserblock-account}}',
		sig: '~~~~'
	},
	// Uberettiget betalt redigering
	'Bandlyst-betalt-redigering': {
		autoblock: true,
		expiry: 'infinity',
		forRegisteredOnly: true,
		nocreate: true,
		pageParam: true,
		templateName: 'Bandlyst',
		reason: 'Uoplyst betalt redigering i strid med [[Wikipedia:Betalt redigering|politikken for betalt redigering]]',
		summary: 'Du er permanent bandlyst fra redigering, fordi din konto bruges i strid med [[Wikipedia:Betalt redigering|politikken for betalt redigering]]'
	},
	// Redigeringskrig
	'Blokeret-redigeringskrig': {
		autoblock: true,
		expiry: '24 hours',
		nocreate: true,
		pageParam: true,
		templateName: 'Blokeret',
		reason: 'Redigeringskrig',
		summary: 'Du er blokeret fra redigering for at forhindre yderligere forstyrrelser som følge af en redigeringskrig'
	},
	// Ukildebæstiget indhold
	'Blokeret-ukildebæstiget': {
		autoblock: true,
		expiry: '31 hours',
		nocreate: true,
		pageParam: true,
		templateName: 'Blokeret',
		reason: 'Vedvarende tilføjelse af ukildebæstiget indhold',
		summary: 'Du er blokeret fra redigering for vedvarende tilføjelse af ukildebæstiget indhold'
	},
	// Ikke her for at bygge en encyklopædi
	'Bandlyst-ikke-her': {
		autoblock: true,
		expiry: 'infinity',
		nocreate: true,
		forRegisteredOnly: true,
		templateName: 'Bandlyst',
		reason: 'Åbenbart ikke her for at bygge en encyklopædi',
		summary: 'Du er permanent bandlyst fra redigering, fordi det lader til, at du ikke er her for at bygge en encyklopædi'
	},
	rangeblock: {
		reason: '{{rangeblock}}',
		nocreate: true,
		nonstandard: true,
		forIPsOnly: true,
		sig: '~~~~'
	},

	// Begin partial block templates, accessed in Twinkle.block.blockGroupsPartial
	'Blokeret-delvis': {
		autoblock: true,
		expiry: '24 hours',
		nocreate: false,
		pageParam: false,
		reasonParam: true,
		templateName: 'Blokeret',
		summary: 'Du er delvist blokeret fra visse dele af encyklopædien'
	},
	'Bandlyst-delvis': {
		autoblock: true,
		expiry: 'infinity',
		forRegisteredOnly: true,
		nocreate: false,
		pageParam: false,
		reasonParam: true,
		templateName: 'Bandlyst',
		summary: 'Du er permanent delvist blokeret fra visse dele af encyklopædien'
	},
	'Blokeret-delvis-redigeringskrig': {
		autoblock: true,
		expiry: '24 hours',
		nocreate: false,
		pageParam: false,
		reasonParam: true,
		templateName: 'Blokeret',
		reason: 'Redigeringskrig',
		summary: 'Du er delvist blokeret fra visse dele af encyklopædien for at forhindre yderligere forstyrrelser på grund af redigeringskrig'
	},
	'Bandlyst-delvis-kontomisbrug': {
		autoblock: true,
		expiry: 'infinity',
		forRegisteredOnly: true,
		nocreate: true,
		pageParam: false,
		reasonParam: true,
		templateName: 'Bandlyst',
		reason: 'Misbrug af [[Wikipedia:Sokkedukker|flere konti]]',
		summary: 'Du er permanent blokeret fra at oprette konti for misbrug af [[Wikipedia:Sokkedukker|flere konti]]'
	}
};

Twinkle.block.transformBlockPresets = function twinkleblockTransformBlockPresets() {
	// supply sensible defaults
	$.each(Twinkle.block.blockPresetsInfo, (preset, settings) => {
		settings.summary = settings.summary || settings.reason;
		settings.sig = settings.sig !== undefined ? settings.sig : 'yes';
		settings.indefinite = settings.indefinite || Morebits.string.isInfinity(settings.expiry);

		if (!Twinkle.block.isRegistered && settings.indefinite) {
			settings.expiry = '31 hours';
		} else {
			settings.expiry = settings.expiry || '31 hours';
		}

		Twinkle.block.blockPresetsInfo[preset] = settings;
	});
};

// These are the groups of presets and defines the order in which they appear. For each list item:
//   label: <string, the description that will be visible in the dropdown>
//   value: <string, the key of a preset in blockPresetsInfo>
Twinkle.block.blockGroups = [
	{
		label: 'Almindelige blokeringsårsager',
		list: [
			{ label: 'Blokeret IP (tilpasset årsag)', value: 'Blokeret-IP', selected: true }, // standard for IP-brugere
			{ label: 'Blokeret-skoleIP', value: 'Blokeret-skoleIP' },
			{ label: 'Blokeret registreret bruger (tilpasset årsag)', value: 'Blokeret' }, // standard for registrerede brugere
			{ label: 'Bandlyst (permanent, tilpasset årsag)', value: 'Bandlyst' },
			{ label: 'Hærværk', value: 'Blokeret-hærværk' },
			{ label: 'Hærværkskonto (permanent)', value: 'Bandlyst-hærværkskonto' },
			{ label: 'Forstyrrende redigering', value: 'Blokeret-forstyrrende' },
			{ label: 'Upassende brug af diskussionsside under blokering', value: 'Blokeret-talkrevoked' },
			{ label: 'Ikke her for at bygge en encyklopædi (permanent)', value: 'Bandlyst-ikke-her' },
			{ label: 'Ukildebæstiget indhold', value: 'Blokeret-ukildebæstiget' },
			{ label: 'Redigeringskrig', value: 'Blokeret-redigeringskrig' }
		]
	},
	{
		label: 'Udvidede årsager',
		list: [
			{ label: 'Spam', value: 'Blokeret-spam' },
			{ label: 'Chikane', value: 'Blokeret-chikane' },
			{ label: 'Omgåelse af blokering – IP', value: 'Blokeret-omgåelse-IP' },
			{ label: 'Omgåelse af blokering – midlertidig konto', value: 'Bandlyst-omgåelse-temp' },
			{ label: 'Ophavsretskrænkelser (permanent)', value: 'Bandlyst-ophavsret' },
			{ label: 'Misbrug af flere konti (mester)', value: 'Bandlyst-kontomisbrug' },
			{ label: 'Misbrug af flere konti (dukke)', value: 'Bandlyst-sokkedukke' },
			{ label: 'Uberettiget betalt redigering (permanent)', value: 'Bandlyst-betalt-redigering' },
			{ label: 'CheckUser-blokering – IP', value: 'CheckUser-blokering' },
			{ label: 'CheckUser-blokering – konto', value: 'CheckUser-blokering-konto' },
			{ label: 'Områdeblokering', value: 'rangeblock' } // Only for IP ranges, selected for non-/64 ranges in filtered_block_groups
		]
	},
	{
		label: 'Brugernavn krænkelser',
		list: [
			{ label: 'Brugernavn krænkelse, blød blokering', value: 'Blokeret-brugernavn-blød' },
			{ label: 'Brugernavn krænkelse, hård blokering (permanent)', value: 'Bandlyst-brugernavn-hård' }
		]
	}
];

Twinkle.block.blockGroupsPartial = [
	{
		label: 'Almindelige årsager til delvis blokering',
		list: [
			{ label: 'Delvis blokering (tilpasset årsag)', value: 'Blokeret-delvis', selected: true },
			{ label: 'Permanent delvis blokering (tilpasset årsag)', value: 'Bandlyst-delvis' },
			{ label: 'Redigeringskrig', value: 'Blokeret-delvis-redigeringskrig' }
		]
	},
	{
		label: 'Udvidede årsager til delvis blokering',
		list: [
			{ label: 'Misbrug af flere konti (permanent)', value: 'Bandlyst-delvis-kontomisbrug' }
		]
	}
];

Twinkle.block.callback.filtered_block_groups = function twinkleblockCallbackFilteredBlockGroups(group, showTemplate) {
	return $.map(group, (blockGroup) => {
		const list = $.map(blockGroup.list, (blockPreset) => {
			switch (blockPreset.value) {
				case 'Blokeret-talkrevoked':
					if (blockedUserName !== relevantUserName) {
						return;
					}
					break;
				case 'rangeblock':
					if (!Morebits.ip.isRange(relevantUserName)) {
						return;
					}
					blockPreset.selected = !Morebits.ip.get64(relevantUserName);
					break;
				case 'CheckUser-blokering':
				case 'CheckUser-blokering-konto':
					if (!Morebits.userIsInGroup('checkuser')) {
						return;
					}
					break;
				default:
					break;
			}

			const blockSettings = Twinkle.block.blockPresetsInfo[blockPreset.value];

			let allowedUserType;
			// for regular users and temporary accounts
			if (blockSettings.forRegisteredOnly) {
				allowedUserType = Twinkle.block.isRegistered;
			// for temporary accounts
			} else if (blockSettings.forTempAccountsOnly) {
				allowedUserType = mw.util.isTemporaryUser(mw.config.get('wgRelevantUserName'));
			// for IPs
			} else if (blockSettings.forIPsOnly) {
				allowedUserType = !Twinkle.block.isRegistered;
			} else {
				allowedUserType = true;
			}

			if (!(blockSettings.templateName && showTemplate) && allowedUserType) {
				const templateName = blockSettings.templateName || blockPreset.value;
				return {
					label: (showTemplate ? '{{' + templateName + '}}: ' : '') + blockPreset.label,
					value: blockPreset.value,
					data: [{
						name: 'template-name',
						value: templateName
					}],
					selected: !!blockPreset.selected,
					disabled: !!blockPreset.disabled
				};
			}
		});
		if (list.length) {
			return {
				label: blockGroup.label,
				list: list
			};
		}
	});
};

Twinkle.block.callback.change_preset = function twinkleblockCallbackChangePreset(e) {
	const form = e.target.form, key = form.preset.value;
	if (!key) {
		return;
	}

	Twinkle.block.callback.update_form(e, Twinkle.block.blockPresetsInfo[key]);
	if (form.template) {
		form.template.value = Twinkle.block.blockPresetsInfo[key].templateName || key;
		Twinkle.block.callback.change_template(e);
	} else {
		Morebits.QuickForm.setElementVisibility(form.dstopic.parentNode, false);
	}
};

Twinkle.block.callback.change_expiry = function twinkleblockCallbackChangeExpiry(e) {
	const expiry = e.target.form.expiry;
	if (e.target.value === 'custom') {
		Morebits.QuickForm.setElementVisibility(expiry.parentNode, true);
	} else {
		Morebits.QuickForm.setElementVisibility(expiry.parentNode, false);
		expiry.value = e.target.value;
	}
};

Twinkle.block.seeAlsos = [];
Twinkle.block.callback.toggle_see_alsos = function twinkleblockCallbackToggleSeeAlso() {
	const joinEnum = function(e) {
		if (e.length >= 3) {
			return e.slice(0, -1).join(', ') + ' og ' + e[e.length - 1];
		} else {
			return e.join(' og ');
		}
	};
	const reason = this.form.reason.value.replace(
		new RegExp('( <!--|;) se også ' + joinEnum(Twinkle.block.seeAlsos) + '( -->)?'), ''
	);

	Twinkle.block.seeAlsos = Twinkle.block.seeAlsos.filter((el) => el !== this.value);

	if (this.checked) {
		Twinkle.block.seeAlsos.push(this.value);
	}
	const seeAlsoMessage = joinEnum(Twinkle.block.seeAlsos);

	if (!Twinkle.block.seeAlsos.length) {
		this.form.reason.value = reason;
	} else if (reason.includes('{{')) {
		this.form.reason.value = reason + ' <!-- se også ' + seeAlsoMessage + ' -->';
	} else {
		this.form.reason.value = reason + '; se også ' + seeAlsoMessage;
	}
};

Twinkle.block.dsReason = '';
Twinkle.block.callback.toggle_ds_reason = function twinkleblockCallbackToggleDSReason() {
	const reason = this.form.reason.value.replace(
		new RegExp(' ?\\(\\[\\[' + Twinkle.block.dsReason + '\\]\\]\\)'), ''
	);

	Twinkle.block.dsinfo.then((dsinfo) => {
		const sanctionCode = this.selectedIndex;
		const sanctionName = this.options[sanctionCode].label;
		Twinkle.block.dsReason = dsinfo[sanctionName].page;
		if (!this.value) {
			this.form.reason.value = reason;
		} else {
			this.form.reason.value = reason + ' ([[' + Twinkle.block.dsReason + ']])';
		}
	});
};

Twinkle.block.callback.update_form = function twinkleblockCallbackUpdateForm(e, data) {
	const form = e.target.form;
	let expiry = data.expiry;

	// don't override original expiry if useInitialOptions is set
	if (!data.useInitialOptions) {
		if (Date.parse(expiry)) {
			expiry = new Date(expiry).toGMTString();
			form.expiry_preset.value = 'custom';
		} else {
			form.expiry_preset.value = data.expiry || 'custom';
		}

		form.expiry.value = expiry;
		if (form.expiry_preset.value === 'custom') {
			Morebits.QuickForm.setElementVisibility(form.expiry.parentNode, true);
		} else {
			Morebits.QuickForm.setElementVisibility(form.expiry.parentNode, false);
		}
	}

	// boolean-flipped options, more at [[mw:API:Block]]
	data.disabletalk = data.disabletalk !== undefined ? data.disabletalk : false;
	data.hardblock = data.hardblock !== undefined ? data.hardblock : false;

	// disable autoblock if blocking a bot
	if (Twinkle.block.userIsBot || /bot\b/i.test(relevantUserName)) {
		data.autoblock = false;
	}

	$(form).find('[name=field_block_options]').find(':checkbox').each((i, el) => {
		// don't override original options if useInitialOptions is set
		if (data.useInitialOptions && data[el.name] === undefined) {
			return;
		}

		const check = data[el.name] === '' || !!data[el.name];
		$(el).prop('checked', check);
	});

	if (data.prependReason && data.reason) {
		form.reason.value = data.reason + '; ' + form.reason.value;
	} else {
		form.reason.value = data.reason || '';
	}

	// Clear and/or set any partial page or namespace restrictions
	if (form.pagerestrictions) {
		const $pageSelect = $(form).find('[name=pagerestrictions]');
		const $namespaceSelect = $(form).find('[name=namespacerestrictions]');

		// Respect useInitialOptions by clearing data when switching presets
		// In practice, this will always clear, since no partial presets use it
		if (!data.useInitialOptions) {
			$pageSelect.val(null).trigger('change');
			$namespaceSelect.val(null).trigger('change');
		}

		// Add any preset options; in practice, just used for prior block settings
		if (data.restrictions) {
			if (data.restrictions.pages && !$pageSelect.val().length) {
				const pages = data.restrictions.pages.map((pr) => pr.title);
				// since page restrictions use an ajax source, we
				// short-circuit that and just add a new option
				pages.forEach((page) => {
					if (!$pageSelect.find("option[value='" + $.escapeSelector(page) + "']").length) {
						const newOption = new Option(page, page, true, true);
						$pageSelect.append(newOption);
					}
				});
				$pageSelect.val($pageSelect.val().concat(pages)).trigger('change');
			}
			if (data.restrictions.namespaces) {
				$namespaceSelect.val($namespaceSelect.val().concat(data.restrictions.namespaces)).trigger('change');
			}
		}
	}
};

Twinkle.block.callback.change_template = function twinkleblockcallbackChangeTemplate(e) {
	const form = e.target.form, value = form.template.value, settings = Twinkle.block.blockPresetsInfo[value];

	const blockBox = $(form).find('[name=actiontype][value=block]').is(':checked');
	const partialBox = $(form).find('[name=actiontype][value=partial]').is(':checked');
	const templateBox = $(form).find('[name=actiontype][value=template]').is(':checked');

	// Block form is not present
	if (!blockBox) {
		if (settings.indefinite || settings.nonstandard) {
			if (Twinkle.block.prev_template_expiry === null) {
				Twinkle.block.prev_template_expiry = form.template_expiry.value || '';
			}
			form.template_expiry.parentNode.style.display = 'none';
			form.template_expiry.value = 'infinity';
		} else if (form.template_expiry.parentNode.style.display === 'none') {
			if (Twinkle.block.prev_template_expiry !== null) {
				form.template_expiry.value = Twinkle.block.prev_template_expiry;
				Twinkle.block.prev_template_expiry = null;
			}
			form.template_expiry.parentNode.style.display = 'block';
		}
		if (Twinkle.block.prev_template_expiry) {
			form.expiry.value = Twinkle.block.prev_template_expiry;
		}
		Morebits.QuickForm.setElementVisibility(form.notalk.parentNode, !settings.nonstandard);
		// Partial
		Morebits.QuickForm.setElementVisibility(form.noemail_template.parentNode, partialBox);
		Morebits.QuickForm.setElementVisibility(form.nocreate_template.parentNode, partialBox);
	} else if (templateBox) { // Only present if block && template forms both visible
		Morebits.QuickForm.setElementVisibility(
			form.blank_duration.parentNode,
			!settings.indefinite && !settings.nonstandard
		);
	}

	Morebits.QuickForm.setElementVisibility(form.dstopic.parentNode, false);

	// Only particularly relevant if template form is present
	Morebits.QuickForm.setElementVisibility(form.article.parentNode, settings && !!settings.pageParam);
	Morebits.QuickForm.setElementVisibility(form.block_reason.parentNode, settings && !!settings.reasonParam);

	// Partial block
	Morebits.QuickForm.setElementVisibility(form.area.parentNode, partialBox && !blockBox);

	form.root.previewer.closePreview();
};
Twinkle.block.prev_template_expiry = null;

Twinkle.block.callback.preview = function twinkleblockcallbackPreview(form) {
	const params = {
		article: form.article.value,
		blank_duration: form.blank_duration ? form.blank_duration.checked : false,
		disabletalk: form.disabletalk.checked || (form.notalk ? form.notalk.checked : false),
		expiry: form.template_expiry ? form.template_expiry.value : form.expiry.value,
		hardblock: Twinkle.block.isRegistered ? form.autoblock.checked : form.hardblock.checked,
		indefinite: Morebits.string.isInfinity(form.template_expiry ? form.template_expiry.value : form.expiry.value),
		reason: form.block_reason.value,
		template: form.template.value,
		dstopic: form.dstopic.value,
		partial: $(form).find('[name=actiontype][value=partial]').is(':checked'),
		pagerestrictions: $(form.pagerestrictions).val() || [],
		namespacerestrictions: $(form.namespacerestrictions).val() || [],
		noemail: form.noemail.checked || (form.noemail_template ? form.noemail_template.checked : false),
		nocreate: form.nocreate.checked || (form.nocreate_template ? form.nocreate_template.checked : false),
		area: form.area.value
	};

	const templateText = Twinkle.block.callback.getBlockNoticeWikitext(params);

	form.previewer.beginRender(templateText, 'User_talk:' + relevantUserName); // Force wikitext/correct username
};

Twinkle.block.callback.evaluate = function twinkleblockCallbackEvaluate(e) {
	const $form = $(e.target),
		toBlock = $form.find('[name=actiontype][value=block]').is(':checked'),
		toWarn = $form.find('[name=actiontype][value=template]').is(':checked'),
		toPartial = $form.find('[name=actiontype][value=partial]').is(':checked');
	let blockoptions = {}, templateoptions = {};

	Twinkle.block.callback.saveFieldset($form.find('[name=field_block_options]'));
	Twinkle.block.callback.saveFieldset($form.find('[name=field_template_options]'));

	blockoptions = Twinkle.block.field_block_options;

	templateoptions = Twinkle.block.field_template_options;

	templateoptions.disabletalk = !!(templateoptions.disabletalk || blockoptions.disabletalk);
	templateoptions.hardblock = !!blockoptions.hardblock;

	delete blockoptions.expiry_preset; // remove extraneous

	// Partial API requires this to be gone, not false or 0
	if (toPartial) {
		blockoptions.partial = templateoptions.partial = true;
	}
	templateoptions.pagerestrictions = $form.find('[name=pagerestrictions]').val() || [];
	templateoptions.namespacerestrictions = $form.find('[name=namespacerestrictions]').val() || [];
	// Format for API here rather than in saveFieldset
	blockoptions.pagerestrictions = templateoptions.pagerestrictions.join('|');
	blockoptions.namespacerestrictions = templateoptions.namespacerestrictions.join('|');

	// use block settings as warn options where not supplied
	templateoptions.summary = templateoptions.summary || blockoptions.reason;
	templateoptions.expiry = templateoptions.template_expiry || blockoptions.expiry;

	if (toBlock) {
		if (blockoptions.partial) {
			if (blockoptions.disabletalk && !blockoptions.namespacerestrictions.includes('3')) {
				return alert('Delvise blokeringer kan ikke forhindre adgang til diskussionsside, medmindre der også er begrænsninger på redigering i brugerdiskussion-navnerummet!');
			}
			if (!blockoptions.namespacerestrictions && !blockoptions.pagerestrictions) {
				if (!blockoptions.noemail && !blockoptions.nocreate) { // Blank entries technically allowed [[phab:T208645]]
					return alert('Ingen sider eller navnerum er valgt, og der er heller ikke anvendt e-mail- eller kontobegrænsninger. Vælg mindst én mulighed for at anvende en delvis blokering!');
				} else if (!confirm('Du er ved at blokere uden begrænsninger på side- eller navnerumsredigering. Er du sikker på, at du vil fortsætte?')) {
					return;
				}
			}
		}
		if (!blockoptions.expiry) {
			return alert('Angiv venligst en blokeringsvarighed!');
		} else if (Morebits.string.isInfinity(blockoptions.expiry) && !Twinkle.block.isRegistered) {
			return alert('En IP-adresse kan ikke blokeres ubestemet!');
		}
		if (!blockoptions.reason) {
			return alert('Angiv venligst en årsag til blokering!');
		}

		Morebits.SimpleWindow.setButtonsEnabled(false);
		Morebits.Status.init(e.target);
		const statusElement = new Morebits.Status('Udfører blokering');
		blockoptions.action = 'block';

		blockoptions.user = relevantUserName;

		// boolean-flipped options
		blockoptions.anononly = blockoptions.hardblock ? undefined : true;
		blockoptions.allowusertalk = blockoptions.disabletalk ? undefined : true;

		/*
		  Check if block status changed while processing the form.

		  There's a lot to consider here. list=blocks provides the
		  current block status, but there are at least two issues with
		  relying on it. First, the id doesn't update on a reblock,
		  meaning the individual parameters need to be compared. This
		  can be done roughly with JSON.stringify - we can thankfully
		  rely on order from the server, although sorting would be
		  fine if not - but falsey values are problematic and is
		  non-ideal. More importantly, list=blocks won't indicate if a
		  non-blocked user is blocked then unblocked. This should be
		  exceedingy rare, but regardless, we thus need to check
		  list=logevents, which has a nicely updating logid
		  parameter. We can't rely just on that, though, since it
		  doesn't account for blocks that have expired on their own.

		  As such, we use both. Using some ternaries, the logid
		  variables are false if there's no logevents, so if they
		  aren't equal we defintely have a changed entry (send
		  confirmation). If they are equal, then either the user was
		  never blocked (the block statuses will be equal, no
		  confirmation) or there's no new block, in which case either
		  a block expired (different statuses, confirmation) or the
		  same block is still active (same status, no confirmation).
		*/
		const query = {
			format: 'json',
			action: 'query',
			list: 'blocks|logevents',
			letype: 'block',
			lelimit: 1,
			letitle: 'User:' + blockoptions.user
		};
		// bkusers doesn't catch single IPs blocked as part of a range block
		if (mw.util.isIPAddress(blockoptions.user, true)) {
			query.bkip = blockoptions.user;
		} else {
			query.bkusers = blockoptions.user;
		}
		api.get(query).then((data) => {
			let block = data.query.blocks[0];
			// As with the initial data fetch, if an IP is blocked
			// *and* rangeblocked, this would only grab whichever
			// block is more recent, which would likely mean a
			// mismatch.  However, if the rangeblock is updated
			// while filling out the form, this won't detect that,
			// but that's probably fine.
			if (data.query.blocks.length > 1 && block.user !== relevantUserName) {
				block = data.query.blocks[1];
			}
			const logevents = data.query.logevents[0];
			const logid = data.query.logevents.length ? logevents.logid : false;

			if (logid !== Twinkle.block.blockLogId || !!block !== !!Twinkle.block.currentBlockInfo) {
				let message = 'Blokeringsstatussen for ' + blockoptions.user + ' har ændret sig. ';
				if (block) {
					message += 'Ny status: ';
				} else {
					message += 'Seneste post: ';
				}

				let logExpiry = '';
				if (logevents.params.duration) {
					if (logevents.params.duration === 'infinity') {
						logExpiry = 'ubestemet';
					} else {
						const expiryDate = new Morebits.Date(logevents.params.expiry);
						logExpiry += (expiryDate.isBefore(new Date()) ? ', udløbet ' : ' til ') + expiryDate.calendar();
					}
				} else { // no duration, action=unblock, just show timestamp
					logExpiry = ' ' + new Morebits.Date(logevents.timestamp).calendar();
				}
				message += Morebits.string.toUpperCaseFirstChar(logevents.action) + ' af ' + logevents.user + logExpiry +
					' for "' + logevents.comment + '". Vil du tilsidesætte med dine indstillinger?';

				if (!confirm(message)) {
					Morebits.Status.info('Udfører blokering', 'Annulleret af brugeren');
					return;
				}
				blockoptions.reblock = 1; // Writing over a block will fail otherwise
			}

			// execute block
			blockoptions.tags = Twinkle.changeTags;
			blockoptions.token = mw.user.tokens.get('csrfToken');
			const mbApi = new Morebits.wiki.Api('Udfører blokering', blockoptions, (() => {
				statusElement.info('Fuldført');
				if (toWarn) {
					Twinkle.block.callback.issue_template(templateoptions);
				}
			}));
			mbApi.post();
		});
	} else if (toWarn) {
		Morebits.SimpleWindow.setButtonsEnabled(false);

		Morebits.Status.init(e.target);
		Twinkle.block.callback.issue_template(templateoptions);
	} else {
		return alert('Angiv venligst Twinkle noget at gøre!');
	}
};

Twinkle.block.callback.issue_template = function twinkleblockCallbackIssueTemplate(formData) {
	// Use wgRelevantUserName to ensure the block template goes to a single IP and not to the
	// "talk page" of an IP range (which does not exist)
	const userTalkPage = 'User_talk:' + mw.config.get('wgRelevantUserName');

	const params = Twinkle.block.combineFormDataAndFieldTemplateOptions(
		formData,
		Twinkle.block.blockPresetsInfo[formData.template],
		Twinkle.block.field_template_options.block_reason,
		Twinkle.block.field_template_options.notalk,
		Twinkle.block.field_template_options.noemail_template,
		Twinkle.block.field_template_options.nocreate_template
	);

	Morebits.wiki.actionCompleted.redirect = userTalkPage;
	Morebits.wiki.actionCompleted.notice = 'Handlinger fuldført, indlæser brugerdiskussionssiden om et øjeblik';

	const wikipediaPage = new Morebits.wiki.Page(userTalkPage, 'Ændring af brugerdiskussionsside');
	wikipediaPage.setCallbackParameters(params);
	wikipediaPage.load(Twinkle.block.callback.main);
};

Twinkle.block.combineFormDataAndFieldTemplateOptions = function(formData, messageData, reason, disabletalk, noemail, nocreate) {
	return $.extend(formData, {
		messageData: messageData,
		reason: reason,
		disabletalk: disabletalk,
		noemail: noemail,
		nocreate: nocreate
	});
};

Twinkle.block.callback.getBlockNoticeWikitext = function(params) {
	let text = '{{';
	const settings = Twinkle.block.blockPresetsInfo[params.template];
	if (!settings.nonstandard) {
		text += 'subst:' + params.template;
		if (params.article && settings.pageParam) {
			text += '|page=' + params.article;
		}
		if (params.dstopic) {
			text += '|topic=' + params.dstopic;
		}

		if (!/te?mp|^\s*$|min/.exec(params.expiry)) {
			if (params.indefinite) {
				text += '|indef=yes';
			} else if (!params.blank_duration && !new Morebits.Date(params.expiry).isValid()) {
				// Block template wants a duration, not date
				text += '|time=' + params.expiry;
			}
		}

		if (!Twinkle.block.isRegistered && !params.hardblock) {
			text += '|anon=yes';
		}

		if (params.reason) {
			text += '|reason=' + params.reason;
		}
		if (params.disabletalk) {
			text += '|notalk=yes';
		}

		// Currently, all partial block templates are "standard"
		// Building the template, however, takes a fair bit of logic
		if (params.partial) {
			if (params.pagerestrictions.length || params.namespacerestrictions.length) {
				const makeSentence = function (array) {
					if (array.length < 3) {
						return array.join(' og ');
					}
					const last = array.pop();
					return array.join(', ') + ' og ' + last;

				};
				text += '|area=' + (params.indefinite ? 'visse ' : 'fra visse ');
				if (params.pagerestrictions.length) {
					text += 'sider (' + makeSentence(params.pagerestrictions.map((p) => '[[:' + p + ']]'));
					text += params.namespacerestrictions.length ? ') og visse ' : ')';
				}
				if (params.namespacerestrictions.length) {
					// 1 => Talk, 2 => User, etc.
					const namespaceNames = params.namespacerestrictions.map((id) => menuFormattedNamespaces[id]);
					text += '[[Wikipedia:Navnerum|navnerum]] (' + makeSentence(namespaceNames) + ')';
				}
			} else if (params.area) {
				text += '|area=' + params.area;
			} else {
				if (params.noemail) {
					text += '|email=yes';
				}
				if (params.nocreate) {
					text += '|accountcreate=yes';
				}
			}
		}
	} else {
		text += params.template;
	}

	if (settings.sig) {
		text += '|sig=' + settings.sig;
	}
	return text + '}}';
};

Twinkle.block.callback.main = function twinkleblockcallbackMain(pageobj) {
	const params = pageobj.getCallbackParameters(),
		date = new Morebits.Date(pageobj.getLoadTime()),
		messageData = params.messageData;
	let text;

	params.indefinite = Morebits.string.isInfinity(params.expiry);

	if (Twinkle.getPref('blankTalkpageOnIndefBlock') && params.indefinite) {
		Morebits.Status.info('Info', 'Rydder diskussionsside i henhold til indstillinger og opretter et nyt afsnit for denne måned');
		text = date.monthHeader() + '\n';
	} else {
		text = pageobj.getPageText();

		const dateHeaderRegex = date.monthHeaderRegex();
		let dateHeaderRegexLast, dateHeaderRegexResult;
		while ((dateHeaderRegexLast = dateHeaderRegex.exec(text)) !== null) {
			dateHeaderRegexResult = dateHeaderRegexLast;
		}
		// If dateHeaderRegexResult is null then lastHeaderIndex is never checked. If it is not null but
		// \n== is not found, then the date header must be at the very start of the page. lastIndexOf
		// returns -1 in this case, so lastHeaderIndex gets set to 0 as desired.
		const lastHeaderIndex = text.lastIndexOf('\n==') + 1;

		if (text.length > 0) {
			text += '\n\n';
		}

		if (!dateHeaderRegexResult || dateHeaderRegexResult.index !== lastHeaderIndex) {
			Morebits.Status.info('Info', 'Opretter et nyt afsnit for denne måned, da der ikke blev fundet et eksisterende');
			text += date.monthHeader() + '\n';
		}
	}

	params.expiry = typeof params.template_expiry !== 'undefined' ? params.template_expiry : params.expiry;

	text += Twinkle.block.callback.getBlockNoticeWikitext(params);

	// build the edit summary
	let summary = messageData.summary;
	if (messageData.suppressArticleInSummary !== true && params.article) {
		summary += ' på [[:' + params.article + ']]';
	}
	summary += '.';

	pageobj.setPageText(text);
	pageobj.setEditSummary(summary);
	pageobj.setChangeTags(Twinkle.changeTags);
	pageobj.setWatchlist(Twinkle.getPref('watchWarnings'));
	pageobj.save();
};

Twinkle.addInitCallback(Twinkle.block, 'block');
}());

// </nowiki>
