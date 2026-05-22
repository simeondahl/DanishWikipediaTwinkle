// <nowiki>

(function() {

/*
 ****************************************
 *** twinkletag.js: Tag module
 ****************************************
 * Mode of invocation:     Tab ("Tag")
 * Active on:              Existing articles and drafts; file pages with a corresponding file
 *                         which is local (not on Commons); all redirects
 */

Twinkle.tag = function twinkletag() {
	// redirect tagging (exclude category redirects, which are all soft redirects and so shouldn't be tagged with rcats)
	if (Morebits.isPageRedirect() && mw.config.get('wgNamespaceNumber') !== 14) {
		Twinkle.tag.mode = 'redirect';
		Twinkle.addPortletLink(Twinkle.tag.callback, 'Tag', 'twinkle-tag', 'Mærk omdirigering');
	// file tagging
	} else if (mw.config.get('wgNamespaceNumber') === 6 && !document.getElementById('mw-sharedupload') && document.getElementById('mw-imagepage-section-filehistory')) {
		Twinkle.tag.mode = 'file';
		Twinkle.addPortletLink(Twinkle.tag.callback, 'Tag', 'twinkle-tag', 'Tilføj vedligeholdsmærker til fil');
	// article/draft article tagging
	} else if ([0, 118].includes(mw.config.get('wgNamespaceNumber')) && mw.config.get('wgCurRevisionId')) {
		Twinkle.tag.mode = 'article';
		// Can't remove tags when not viewing current version
		Twinkle.tag.canRemove = (mw.config.get('wgCurRevisionId') === mw.config.get('wgRevisionId')) &&
			// Disabled on latest diff because the diff slider could be used to slide
			// away from the latest diff without causing the script to reload
			!mw.config.get('wgDiffNewId');
		Twinkle.addPortletLink(Twinkle.tag.callback, 'Tag', 'twinkle-tag', 'Tilføj eller fjern vedligeholdsmærker');
	}
};

Twinkle.tag.checkedTags = [];

Twinkle.tag.callback = function twinkletagCallback() {
	const Window = new Morebits.SimpleWindow(630, Twinkle.tag.mode === 'article' ? 500 : 400);
	Window.setScriptName('Twinkle');

	const form = new Morebits.QuickForm(Twinkle.tag.callback.evaluate);

	// if page is unreviewed, add a checkbox to the form so that user can pick whether or not to review it
	const isPatroller = mw.config.get('wgUserGroups').some((r) => ['patroller', 'sysop'].includes(r));
	if (isPatroller) {
		new mw.Api().get({
			action: 'pagetriagelist',
			format: 'json',
			page_id: mw.config.get('wgArticleId')
		}).then((response) => {
			// Figure out whether the article is marked as reviewed in PageTriage.
			// Recent articles will have a patrol_status that we can read.
			// For articles that have been out of the new pages feed for awhile, pages[0] will be undefined.
			const isReviewed = response.pagetriagelist.pages[0] ?
				response.pagetriagelist.pages[0].patrol_status > 0 :
				true;

			// if article is not marked as reviewed, show the "mark as reviewed" check box
			if (!isReviewed) {
				// Quickform is probably already rendered. Instead of using form.append(), we need to make an element and then append it using JQuery.
				const checkbox = new Morebits.QuickForm.Element({
					type: 'checkbox',
					list: [
						{
							label: 'Markér siden som patruljeret',
							value: 'patrol',
							name: 'patrol',
							checked: Twinkle.getPref('markTaggedPagesAsPatrolled')
						}
					]
				});
				const html = checkbox.render();
				$('.quickform').prepend(html);
			}
		});
	}

	form.append({
		type: 'input',
		label: 'Filtrer mærkeliste:',
		name: 'quickfilter',
		size: '30',
		event: function twinkletagquickfilter() {
			// flush the DOM of all existing underline spans
			$allCheckboxDivs.find('.search-hit').each((i, e) => {
				const labelElement = e.parentElement;
				// This would convert <label>Hello <span class=search-hit>wo</span>rld</label>
				// to <label>Hello world</label>
				labelElement.innerHTML = labelElement.textContent;
			});

			if (this.value) {
				$allCheckboxDivs.hide();
				$allHeaders.hide();
				const searchString = this.value;
				const searchRegex = new RegExp(mw.util.escapeRegExp(searchString), 'i');

				$allCheckboxDivs.find('label').each(function () {
					const labelText = this.textContent;
					const searchHit = searchRegex.exec(labelText);
					if (searchHit) {
						const range = document.createRange();
						const textnode = this.childNodes[0];
						range.selectNodeContents(textnode);
						range.setStart(textnode, searchHit.index);
						range.setEnd(textnode, searchHit.index + searchString.length);
						const underlineSpan = $('<span>').addClass('search-hit').css('text-decoration', 'underline')[0];
						range.surroundContents(underlineSpan);
						this.parentElement.style.display = 'block'; // show
					}
				});
			} else {
				$allCheckboxDivs.show();
				$allHeaders.show();
			}
		}
	});

	switch (Twinkle.tag.mode) {
		case 'article':
			Window.setTitle('Vedligeholdsmærkning af artikel');

			// Build sorting and lookup object flatObject, which is always
			// needed but also used to generate the alphabetical list
			Twinkle.tag.article.flatObject = {};
			Object.values(Twinkle.tag.article.tagList).forEach((group) => {
				Object.values(group).forEach((subgroup) => {
					if (Array.isArray(subgroup)) {
						subgroup.forEach((item) => {
							Twinkle.tag.article.flatObject[item.tag] = item;
						});
					} else {
						Twinkle.tag.article.flatObject[subgroup.tag] = subgroup;
					}
				});
			});

			form.append({
				type: 'select',
				name: 'sortorder',
				label: 'Vis denne liste:',
				tooltip: 'Du kan ændre standardvisningsrækkefølgen i dine Twinkle-indstillinger.',
				event: Twinkle.tag.updateSortOrder,
				list: [
					{ type: 'option', value: 'cat', label: 'Efter kategorier', selected: Twinkle.getPref('tagArticleSortOrder') === 'cat' },
					{ type: 'option', value: 'alpha', label: 'I alfabetisk rækkefølge', selected: Twinkle.getPref('tagArticleSortOrder') === 'alpha' }
				]
			});

			if (!Twinkle.tag.canRemove) {
				const divElement = document.createElement('div');
				divElement.innerHTML = 'For at fjerne eksisterende mærker skal du åbne Tag-menuen fra den aktuelle version af artiklen';
				form.append({
					type: 'div',
					name: 'untagnotice',
					label: divElement
				});
			}

			form.append({
				type: 'div',
				id: 'tagWorkArea',
				className: 'morebits-scrollbox',
				style: 'max-height: 28em'
			});

			form.append({
				type: 'checkbox',
				list: [
					{
						label: 'Gruppér inden i {{multiple issues}} hvis muligt',
						value: 'group',
						name: 'group',
						tooltip: 'Hvis der anvendes to eller flere skabeloner understøttet af {{multiple issues}}, og dette felt er markeret, vil alle understøttede skabeloner blive grupperet inden i en {{multiple issues}}-skabelon.',
						checked: Twinkle.getPref('groupByDefault')
					}
				]
			});

			form.append({
				type: 'input',
				label: 'Begrundelse',
				name: 'reason',
				tooltip: 'Valgfri begrundelse der tilføjes i redigeringsresuméet. Anbefales når mærker fjernes.',
				size: '60'
			});

			break;

		case 'file':
			Window.setTitle('Vedligeholdsmærkning af fil');

			$.each(Twinkle.tag.fileList, (groupName, group) => {
				form.append({ type: 'header', label: groupName });
				form.append({ type: 'checkbox', name: 'tags', list: group });
			});

			if (Twinkle.getPref('customFileTagList').length) {
				form.append({ type: 'header', label: 'Brugerdefinerede mærker' });
				form.append({ type: 'checkbox', name: 'tags', list: Twinkle.getPref('customFileTagList') });
			}
			break;

		case 'redirect':
			Window.setTitle('Mærkning af omdirigering');

			// If a tag has a restriction for this namespace or title, return true, so that we know not to display it in the list of check boxes.
			var isRestricted = function(item) {
				if (typeof item.restriction === 'undefined') {
					return false;
				}
				const namespace = mw.config.get('wgNamespaceNumber');
				switch (item.restriction) {
					case 'insideMainspaceOnly':
						if (namespace !== 0) {
							return true;
						}
						break;
					case 'outsideUserspaceOnly':
						if (namespace === 2 || namespace === 3) {
							return true;
						}
						break;
					case 'insideTalkNamespaceOnly':
						if (namespace % 2 !== 1 || namespace < 0) {
							return true;
						}
						break;
					case 'disambiguationPagesOnly':
						if (!mw.config.get('wgPageName').endsWith('_(disambiguation)')) {
							return true;
						}
						break;
					default:
						alert('Twinkle.tag: ukendt begrænsning ' + item.restriction);
						break;
				}
				return false;
			};

			// Generate the HTML form with the list of redirect tags that the user can choose to apply.
			var i = 1;
			$.each(Twinkle.tag.redirectList, (groupName, group) => {
				form.append({ type: 'header', id: 'tagHeader' + i, label: groupName });
				const subdiv = form.append({ type: 'div', id: 'tagSubdiv' + i++ });
				$.each(group, (subgroupName, subgroup) => {
					subdiv.append({ type: 'div', label: [ Morebits.htmlNode('b', subgroupName) ] });
					subdiv.append({
						type: 'checkbox',
						name: 'tags',
						list: subgroup
							.filter((item) => !isRestricted(item))
							.map((item) => ({ value: item.tag, label: '{{' + item.tag + '}}: ' + item.description, subgroup: item.subgroup }))
					});
				});
			});

			if (Twinkle.getPref('customRedirectTagList').length) {
				form.append({ type: 'header', label: 'Brugerdefinerede mærker' });
				form.append({ type: 'checkbox', name: 'tags', list: Twinkle.getPref('customRedirectTagList') });
			}
			break;

		default:
			alert('Twinkle.tag: ukendt tilstand ' + Twinkle.tag.mode);
			break;
	}

	form.append({ type: 'submit', className: 'tw-tag-submit', label: 'Send' });

	const result = form.render();
	Window.setContent(result);
	Window.display();

	// for quick filter:
	$allCheckboxDivs = $(result).find('[name$=tags]').parent();
	$allHeaders = $(result).find('h5, .quickformDescription');
	result.quickfilter.focus(); // place cursor in the quick filter field as soon as window is opened
	result.quickfilter.autocomplete = 'off'; // disable browser suggestions
	result.quickfilter.addEventListener('keypress', (e) => {
		if (e.keyCode === 13) { // prevent enter key from accidentally submitting the form
			e.preventDefault();
			return false;
		}
	});

	if (Twinkle.tag.mode === 'article') {

		Twinkle.tag.alreadyPresentTags = [];

		if (Twinkle.tag.canRemove) {
			// Look for existing maintenance tags in the lead section and put them in array

			// All tags are HTML table elements that are direct children of .mw-parser-output,
			// except when they are within {{multiple issues}}
			$('.mw-parser-output').children().each((i, e) => {

				// break out on encountering the first heading, which means we are no
				// longer in the lead section
				if (e.classList.contains('mw-heading')) {
					return false;
				}

				// The ability to remove tags depends on the template's {{ambox}} |name=
				// parameter bearing the template's correct name (preferably) or a name that at
				// least redirects to the actual name

				// All tags have their first class name as "box-" + template name
				if (e.className.indexOf('box-') === 0) {
					if (e.classList[0] === 'box-Multiple_issues') {
						$(e).find('.ambox').each((idx, e) => {
							if (e.classList[0].indexOf('box-') === 0) {
								const tag = e.classList[0].slice('box-'.length).replace(/_/g, ' ');
								Twinkle.tag.alreadyPresentTags.push(tag);
							}
						});
						return true; // continue
					}

					const tag = e.classList[0].slice('box-'.length).replace(/_/g, ' ');
					Twinkle.tag.alreadyPresentTags.push(tag);
				}
			});

			// {{Ukategoriseret}} placed at the end
			if ($('.box-Ukategoriseret').length) {
				Twinkle.tag.alreadyPresentTags.push('Ukategoriseret');
			}

		}

		// Add status text node after Submit button
		const statusNode = document.createElement('small');
		statusNode.id = 'tw-tag-status';
		Twinkle.tag.status = {
			// initial state; defined like this because these need to be available for reference
			// in the click event handler
			numAdded: 0,
			numRemoved: 0
		};
		$('button.tw-tag-submit').after(statusNode);

		// fake a change event on the sort dropdown, to initialize the tag list
		const evt = document.createEvent('Event');
		evt.initEvent('change', true, true);
		result.sortorder.dispatchEvent(evt);
	} else {
		// Redirects and files: Add a link to each template's description page
		Morebits.QuickForm.getElements(result, 'tags').forEach(generateLinks);
	}
};

// $allCheckboxDivs and $allHeaders are defined globally, rather than in the
// quickfilter event function, to avoid having to recompute them on every keydown
let $allCheckboxDivs, $allHeaders;

Twinkle.tag.updateSortOrder = function(e) {
	const form = e.target.form;
	const sortorder = e.target.value;
	Twinkle.tag.checkedTags = form.getChecked('tags');

	const container = new Morebits.QuickForm.Element({ type: 'fragment' });

	// function to generate a checkbox, with appropriate subgroup if needed
	const makeCheckbox = function (item) {
		const tag = item.tag, description = item.description;
		const checkbox = { value: tag, label: '{{' + tag + '}}: ' + description };
		if (Twinkle.tag.checkedTags.includes(tag)) {
			checkbox.checked = true;
		}
		checkbox.subgroup = item.subgroup;
		return checkbox;
	};

	const makeCheckboxesForAlreadyPresentTags = function() {
		container.append({ type: 'header', id: 'tagHeader0', label: 'Allerede tilstedeværende mærker' });
		const subdiv = container.append({ type: 'div', id: 'tagSubdiv0' });
		const checkboxes = [];
		const unCheckedTags = e.target.form.getUnchecked('existingTags');
		Twinkle.tag.alreadyPresentTags.forEach((tag) => {
			const checkbox =
				{
					value: tag,
					label: '{{' + tag + '}}' + (Twinkle.tag.article.flatObject[tag] ? ': ' + Twinkle.tag.article.flatObject[tag].description : ''),
					checked: !unCheckedTags.includes(tag),
					style: 'font-style: italic'
				};

			checkboxes.push(checkbox);
		});
		subdiv.append({
			type: 'checkbox',
			name: 'existingTags',
			list: checkboxes
		});
	};

	if (sortorder === 'cat') { // categorical sort order
		// function to iterate through the tags and create a checkbox for each one
		const doCategoryCheckboxes = function(subdiv, subgroup) {
			const checkboxes = [];
			$.each(subgroup, (k, item) => {
				if (!Twinkle.tag.alreadyPresentTags.includes(item.tag)) {
					checkboxes.push(makeCheckbox(item));
				}
			});
			subdiv.append({
				type: 'checkbox',
				name: 'tags',
				list: checkboxes
			});
		};

		if (Twinkle.tag.alreadyPresentTags.length > 0) {
			makeCheckboxesForAlreadyPresentTags();
		}
		let i = 1;
		// go through each category and sub-category and append lists of checkboxes
		$.each(Twinkle.tag.article.tagList, (groupName, group) => {
			container.append({ type: 'header', id: 'tagHeader' + i, label: groupName });
			const subdiv = container.append({ type: 'div', id: 'tagSubdiv' + i++ });
			if (Array.isArray(group)) {
				doCategoryCheckboxes(subdiv, group);
			} else {
				$.each(group, (subgroupName, subgroup) => {
					subdiv.append({ type: 'div', label: [ Morebits.htmlNode('b', subgroupName) ] });
					doCategoryCheckboxes(subdiv, subgroup);
				});
			}
		});
	} else { // alphabetical sort order
		if (Twinkle.tag.alreadyPresentTags.length > 0) {
			makeCheckboxesForAlreadyPresentTags();
			container.append({ type: 'header', id: 'tagHeader1', label: 'Tilgængelige mærker' });
		}

		// Avoid repeatedly resorting
		Twinkle.tag.article.alphabeticalList = Twinkle.tag.article.alphabeticalList || Object.keys(Twinkle.tag.article.flatObject).sort();
		const checkboxes = [];
		Twinkle.tag.article.alphabeticalList.forEach((tag) => {
			if (!Twinkle.tag.alreadyPresentTags.includes(tag)) {
				checkboxes.push(makeCheckbox(Twinkle.tag.article.flatObject[tag]));
			}
		});
		container.append({
			type: 'checkbox',
			name: 'tags',
			list: checkboxes
		});
	}

	// append any custom tags
	if (Twinkle.getPref('customTagList').length) {
		container.append({ type: 'header', label: 'Brugerdefinerede mærker' });
		container.append({ type: 'checkbox', name: 'tags',
			list: Twinkle.getPref('customTagList').map((el) => {
				el.checked = Twinkle.tag.checkedTags.includes(el.value);
				return el;
			})
		});
	}

	const $workarea = $(form).find('#tagWorkArea');
	const rendered = container.render();
	$workarea.empty().append(rendered);

	// for quick filter:
	$allCheckboxDivs = $workarea.find('[name=tags], [name=existingTags]').parent();
	$allHeaders = $workarea.find('h5, .quickformDescription');
	form.quickfilter.value = ''; // clear search, because the search results are not preserved over mode change
	form.quickfilter.focus();

	// style adjustments
	$workarea.find('h5').css({ 'font-size': '110%' });
	$workarea.find('h5:not(:first-child)').css({ 'margin-top': '1em' });
	$workarea.find('div').filter(':has(span.quickformDescription)').css({ 'margin-top': '0.4em' });

	Morebits.QuickForm.getElements(form, 'existingTags').forEach(generateLinks);
	Morebits.QuickForm.getElements(form, 'tags').forEach(generateLinks);

	// tally tags added/removed, update statusNode text
	const statusNode = document.getElementById('tw-tag-status');
	$('[name=tags], [name=existingTags]').on('click', function() {
		if (this.name === 'tags') {
			Twinkle.tag.status.numAdded += this.checked ? 1 : -1;
		} else if (this.name === 'existingTags') {
			Twinkle.tag.status.numRemoved += this.checked ? -1 : 1;
		}

		const firstPart = 'Tilføjer ' + Twinkle.tag.status.numAdded + ' mærke' + (Twinkle.tag.status.numAdded > 1 ? 'r' : '');
		const secondPart = 'Fjerner ' + Twinkle.tag.status.numRemoved + ' mærke' + (Twinkle.tag.status.numRemoved > 1 ? 'r' : '');
		statusNode.textContent =
			(Twinkle.tag.status.numAdded ? '  ' + firstPart : '') +
			(Twinkle.tag.status.numRemoved ? (Twinkle.tag.status.numAdded ? '; ' : '  ') + secondPart : '');
	});
};

/**
 * Adds a link to each template's description page
 *
 * @param {Morebits.QuickForm.Element} checkbox  associated with the template
 */
var generateLinks = function(checkbox) {
	const link = Morebits.htmlNode('a', '>');
	link.setAttribute('class', 'tag-template-link');
	const tagname = checkbox.values;
	link.setAttribute('href', mw.util.getUrl(
		(!tagname.includes(':') ? 'Skabelon:' : '') +
		(!tagname.includes('|') ? tagname : tagname.slice(0, tagname.indexOf('|')))
	));
	link.setAttribute('target', '_blank');
	$(checkbox).parent().append([' ', link]);
};

// Tags for ARTICLES start here
Twinkle.tag.article = {};

// Tags arranged by category; will be used to generate the alphabetical list,
// but tags should be in alphabetical order within the categories
// excludeMI: true indicate a tag that *does not* work inside {{multiple issues}}
Twinkle.tag.article.tagList = {
	'Oprydning og vedligeholdelse': {
		'Generel oprydning': [
			{
				tag: 'Oprydning', description: 'kræver oprydning',
				subgroup: {
					name: 'cleanup',
					parameter: 'reason',
					type: 'input',
					label: 'Specifik grund til at oprydning er nødvendig:',
					tooltip: 'Påkrævet.',
					size: 35,
					required: true
				}
			}
		],
		'Sprog': [
			{
				tag: 'Oversæt', description: 'siden er skrevet på et fremmed sprog og skal oversættes',
				excludeMI: true
			},
			{
				tag: 'maskinoversættelse', description: 'siden ser ud til at være maskinoversat',
				excludeMI: true
			}
		]
	},
	'Generelle indholdsproblemer': {
		'Skrivestil': [
			{ tag: 'Reklame', description: 'indholdet er reklamerende eller spamming' },
			{ tag: 'uencyklopædisk', description: 'indholdet er ikke encyklopædisk' }
		],
		'Neutralitet og faktanøjagtighed': [
			{ tag: 'POV', description: 'neutral synsvinkel diskuteres' }
		],
		'Verificerbarhed og kilder': [
			{ tag: 'Kilde mangler', description: 'manglende kildehenvisninger' }
		]
	},
	'Stub': [
		{ tag: 'Stub', description: 'ufuldstændig artikel (stub)', excludeMI: true }
	]
};

// Tags for REDIRECTS start here
Twinkle.tag.redirectList = {
	'Grammatik, tegnsætning og stavning': {
		Forkortelse: [
			{ tag: 'R from acronym', description: 'omdirigering fra et akronym til dets fulde form', restriction: 'insideMainspaceOnly' },
			{ tag: 'R from initialism', description: 'omdirigering fra et initialisme til dets fulde form', restriction: 'insideMainspaceOnly' }
		],
		Stavning: [
			{ tag: 'R from alternative spelling', description: 'omdirigering fra en titel med en anden stavning' },
			{ tag: 'R from diacritic', description: 'omdirigering fra et sidenavn med diakritiske tegn (accenter, umlauts osv.)' },
			{ tag: 'R to diacritic', description: 'omdirigering til artikeltitlen med diakritiske tegn' },
			{ tag: 'R from misspelling', description: 'omdirigering fra en stavefejl eller tastefejl' }
		]
	},
	'Alternative navne': {
		Generelt: [
			{ tag: 'R from alternative name', description: 'omdirigering fra en titel der er et andet navn, et pseudonym, et kaldenavn eller et synonym' },
			{ tag: 'R from former name', description: 'omdirigering fra et tidligere eller historisk navn eller en arbejdstitel', restriction: 'insideMainspaceOnly' },
			{ tag: 'R from long name', description: 'omdirigering fra en mere fuldstændig titel' },
			{ tag: 'R from short name', description: 'omdirigering fra en forkortelse af et navn eller en titel' },
			{ tag: 'R from synonym', description: 'omdirigering fra et semantisk synonym af målsidens titel' }
		],
		Personer: [
			{ tag: 'R from birth name', description: 'omdirigering fra en persons fødselsnavn til et mere almindeligt navn', restriction: 'insideMainspaceOnly' },
			{ tag: 'R from pseudonym', description: 'omdirigering fra et pseudonym', restriction: 'insideMainspaceOnly' },
			{ tag: 'R from surname', description: 'omdirigering fra en titel der er et efternavn', restriction: 'insideMainspaceOnly' }
		]
	},
	'Navigationshjælp': {
		Navigation: [
			{ tag: 'R to anchor', description: 'omdirigering fra et emne der ikke har sin egen side til en ankret del af en side om emnet' },
			{ tag: 'R from move', description: 'omdirigering fra en side der er blevet flyttet/omdøbt' },
			{ tag: 'R with history', description: 'omdirigering fra en side med substantiel sidehistorik, bevaret for at bevare indhold og tilskrivninger' }
		],
		Flertydighed: [
			{ tag: 'R from ambiguous term', description: 'omdirigering fra et flertydigt sidenavn til en side der disambiguerer det' },
			{ tag: 'R from incomplete disambiguation', description: 'omdirigering fra et sidenavn der er for flertydigt til at være titlen på en artikel' }
		]
	}
};

// maintenance tags for FILES start here

Twinkle.tag.fileList = {
	'Licens- og kildeproblemsmærker': [
		{ label: '{{Non-free reduce}}: ikke-lavopløsnings fair use-billede (eller for lang lydklip osv.)', value: 'Non-free reduce' },
		{ label: '{{Orphaned non-free revisions}}: fair use-medie med gamle revisioner der skal slettes', value: 'Orphaned non-free revisions' }
	],
	'Wikimedia Commons-relaterede mærker': [
		{ label: '{{Copy to Commons}}: frit medie der bør kopieres til Commons', value: 'Copy to Commons' },
		{
			label: '{{Deleted on Commons}}: fil er tidligere blevet slettet fra Commons',
			value: 'Deleted on Commons',
			subgroup: {
				type: 'input',
				name: 'deletedOnCommonsName',
				label: 'Navn på Commons:',
				tooltip: 'Navn på billedet på Commons (hvis forskelligt fra lokalt navn), uden File:-præfikset'
			}
		},
		{
			label: '{{Do not move to Commons}}: fil egner sig ikke til flytning til Commons',
			value: 'Do not move to Commons',
			subgroup: [
				{
					type: 'input',
					name: 'DoNotMoveToCommons_reason',
					label: 'Begrundelse:',
					tooltip: 'Angiv årsagen til at dette billede ikke bør flyttes til Commons (påkrævet).',
					required: true
				},
				{
					type: 'number',
					name: 'DoNotMoveToCommons_expiry',
					label: 'Udløbsår:',
					min: new Morebits.Date().getFullYear(),
					tooltip: 'Hvis denne fil kan flyttes til Commons fra et bestemt år, kan du angive det her (valgfrit).'
				}
			]
		},
		{
			label: '{{Keep local}}: anmodning om at beholde lokal kopi af en Commons-fil',
			value: 'Keep local',
			subgroup: {
				type: 'input',
				name: 'keeplocalName',
				label: 'Commons-billedets navn hvis forskelligt:',
				tooltip: 'Navn på billedet på Commons (hvis forskelligt fra lokalt navn), uden File:-præfikset:'
			}
		},
		{
			label: '{{Nominated for deletion on Commons}}: fil er nomineret til sletning på Commons',
			value: 'Nominated for deletion on Commons',
			subgroup: {
				type: 'input',
				name: 'nominatedOnCommonsName',
				label: 'Navn på Commons:',
				tooltip: 'Navn på billedet på Commons (hvis forskelligt fra lokalt navn), uden File:-præfikset:'
			}
		}
	],
	'Oprydningsmærker': [
		{ label: '{{Artifacts}}: PNG indeholder resterende komprimeringsartefakter', value: 'Artifacts' },
		{ label: '{{Bad font}}: SVG bruger skrifttyper der ikke er tilgængelige på thumbnail-serveren', value: 'Bad font' },
		{ label: '{{Bad format}}: PDF/DOC/...-fil bør konverteres til et mere nyttigt format', value: 'Bad format' },
		{ label: '{{Bad GIF}}: GIF der bør være PNG, JPEG eller SVG', value: 'Bad GIF' },
		{ label: '{{Bad JPEG}}: JPEG der bør være PNG eller SVG', value: 'Bad JPEG' },
		{ label: '{{Bad SVG}}: SVG med en blanding af raster- og vektorgrafik', value: 'Bad SVG' },
		{ label: '{{Bad trace}}: automatisk sporet SVG der kræver oprydning', value: 'Bad trace' },
		{
			label: '{{Cleanup image}}: generel oprydning', value: 'Cleanup image',
			subgroup: {
				type: 'input',
				name: 'cleanupimageReason',
				label: 'Begrundelse:',
				tooltip: 'Angiv årsagen til oprydning (påkrævet)',
				required: true
			}
		},
		{ label: '{{Fake SVG}}: SVG der udelukkende indeholder rastergrafik uden ægte vektorindhold', value: 'Fake SVG' },
		{ label: '{{Imagewatermark}}: billede indeholder synlig eller usynlig vandmærkning', value: 'Imagewatermark' },
		{ label: '{{Overcompressed JPEG}}: JPEG med høje niveauer af artefakter', value: 'Overcompressed JPEG' },
		{ label: '{{Opaque}}: uigennemsigtig baggrund bør være gennemsigtig', value: 'Opaque' },
		{ label: '{{Remove border}}: unødvendig kant, blankt rum osv.', value: 'Remove border' },
		{
			label: '{{Rename media}}: fil bør omdøbes',
			value: 'Rename media',
			subgroup: [
				{
					type: 'input',
					name: 'renamemediaNewname',
					label: 'Nyt navn:',
					tooltip: 'Angiv det nye navn for billedet (valgfrit)'
				},
				{
					type: 'input',
					name: 'renamemediaReason',
					label: 'Begrundelse:',
					tooltip: 'Angiv årsagen til omdøbningen (valgfrit)'
				}
			]
		},
		{ label: '{{Should be PNG}}: GIF eller JPEG bør være tabsfri', value: 'Should be PNG' },
		{
			label: '{{Should be SVG}}: PNG, GIF eller JPEG bør være vektorgrafik', value: 'Should be SVG',
			subgroup: {
				name: 'svgCategory',
				type: 'select',
				list: [
					{ label: '{{Should be SVG|other}}', value: 'other' },
					{ label: '{{Should be SVG|alphabet}}: tegn, skrifteksempler osv.', value: 'alphabet' },
					{ label: '{{Should be SVG|chemical}}: kemiske diagrammer osv.', value: 'chemical' },
					{ label: '{{Should be SVG|circuit}}: elektroniske kredsløbsdiagrammer osv.', value: 'circuit' },
					{ label: '{{Should be SVG|coat of arms}}: våbenskjolde', value: 'coat of arms' },
					{ label: '{{Should be SVG|diagram}}: diagrammer der ikke passer til andre underkategorier', value: 'diagram' },
					{ label: '{{Should be SVG|emblem}}: emblemer, frie logoer, insignier osv.', value: 'emblem' },
					{ label: '{{Should be SVG|flag}}: flag', value: 'flag' },
					{ label: '{{Should be SVG|graph}}: visuelle plots af data', value: 'graph' },
					{ label: '{{Should be SVG|logo}}: logoer', value: 'logo' },
					{ label: '{{Should be SVG|map}}: kort', value: 'map' },
					{ label: '{{Should be SVG|music}}: musikalske skalaer, noder osv.', value: 'music' },
					{ label: '{{Should be SVG|symbol}}: diverse symboler, ikoner osv.', value: 'symbol' }
				]
			}
		},
		{ label: '{{Should be text}}: billede bør repræsenteres som tekst, tabeller eller matematisk markup', value: 'Should be text' }
	],
	'Billedkvalitetsmærker': [
		{ label: '{{Image hoax}}: billede kan være manipuleret eller udgøre en svindel', value: 'Image hoax' },
		{ label: '{{Image-blownout}}', value: 'Image-blownout' },
		{ label: '{{Image-out-of-focus}}', value: 'Image-out-of-focus' },
		{
			label: '{{Image-Poor-Quality}}', value: 'Image-Poor-Quality',
			subgroup: {
				type: 'input',
				name: 'ImagePoorQualityReason',
				label: 'Begrundelse:',
				tooltip: 'Angiv årsagen til at dette billede er så dårligt (påkrævet)',
				required: true
			}
		},
		{ label: '{{Image-underexposure}}', value: 'Image-underexposure' }
	],
	'Erstatningsmærker': [
		{ label: '{{Obsolete}}: forbedret version tilgængelig', value: 'Obsolete' },
		{ label: '{{PNG version available}}', value: 'PNG version available' },
		{ label: '{{Vector version available}}', value: 'Vector version available' }
	]
};
Twinkle.tag.fileList['Erstatningsmærker'].forEach((el) => {
	el.subgroup = {
		type: 'input',
		label: 'Erstatningsfil:',
		tooltip: 'Angiv navnet på den fil der erstatter denne (påkrævet)',
		name: el.value.replace(/ /g, '_') + 'File',
		required: true
	};
});

Twinkle.tag.callbacks = {
	article: function articleCallback(pageobj) {

		// Remove tags that become superfluous with this action
		let pageText = pageobj.getPageText().replace(/\{\{\s*([Uu]serspace draft)\s*(\|(?:\{\{[^{}]*\}\}|[^{}])*)?\}\}\s*/g, '');
		const params = pageobj.getCallbackParameters();

		/**
		 * Saves the page following the removal of tags if any. The last step.
		 * Called from removeTags()
		 */
		const postRemoval = function() {
			if (params.tagsToRemove.length) {
				// Remove empty {{multiple issues}} if found
				pageText = pageText.replace(/\{\{(multiple ?issues|article ?issues|mi)\s*\|\s*\}\}\n?/im, '');
				// Remove single-element {{multiple issues}} if found
				pageText = pageText.replace(/\{\{(?:multiple ?issues|article ?issues|mi)\s*\|\s*(\{\{[^}]+\}\})\s*\}\}/im, '$1');
			}

			// Build edit summary
			const makeSentence = function(array) {
				if (array.length < 3) {
					return array.join(' og ');
				}
				const last = array.pop();
				return array.join(', ') + ' og ' + last;
			};
			const makeTemplateLink = function(tag) {
				let text = '{{[[';
				// if it is a custom tag with a parameter
				if (tag.includes('|')) {
					tag = tag.slice(0, tag.indexOf('|'));
				}
				text += tag.includes(':') ? tag : 'Skabelon:' + tag + '|' + tag;
				return text + ']]}}';
			};

			let summaryText;
			const addedTags = params.tags.map(makeTemplateLink);
			const removedTags = params.tagsToRemove.map(makeTemplateLink);
			if (addedTags.length) {
				summaryText = 'Tilføjede ' + makeSentence(addedTags);
				summaryText += removedTags.length ? '; og fjernede ' + makeSentence(removedTags) : '';
			} else {
				summaryText = 'Fjernede ' + makeSentence(removedTags);
			}
			summaryText += ' mærke' + (addedTags.length + removedTags.length > 1 ? 'r' : '');
			if (params.reason) {
				summaryText += ': ' + params.reason;
			}

			// avoid truncated summaries
			if (summaryText.length > 499) {
				summaryText = summaryText.replace(/\[\[[^|]+\|([^\]]+)\]\]/g, '$1');
			}

			pageobj.setPageText(pageText);
			pageobj.setEditSummary(summaryText);
			if ((mw.config.get('wgNamespaceNumber') === 0 && Twinkle.getPref('watchTaggedVenues').includes('articles')) || (mw.config.get('wgNamespaceNumber') === 118 && Twinkle.getPref('watchTaggedVenues').includes('drafts'))) {
				pageobj.setWatchlist(Twinkle.getPref('watchTaggedPages'));
			}
			pageobj.setMinorEdit(Twinkle.getPref('markTaggedPagesAsMinor'));
			pageobj.setCreateOption('nocreate');
			pageobj.save(() => {
				// No special post-save actions needed for da.wikipedia tag set
			});

			if (params.patrol) {
				pageobj.triage();
			}
		};

		/**
		 * Removes the existing tags that were deselected (if any)
		 * Calls postRemoval() when done
		 */
		const removeTags = function removeTags() {

			if (params.tagsToRemove.length === 0) {
				postRemoval();
				return;
			}

			Morebits.Status.info('Info', 'Fjerner fravalgte mærker der allerede var til stede');

			const getRedirectsFor = [];

			// Remove the tags from the page text, if found in its proper name,
			// otherwise moves it to `getRedirectsFor` array earmarking it for
			// later removal
			params.tagsToRemove.forEach((tag) => {
				const tagRegex = new RegExp('\\{\\{' + Morebits.pageNameRegex(tag) + '\\s*(\\|[^}]+)?\\}\\}\\n?');

				if (tagRegex.test(pageText)) {
					pageText = pageText.replace(tagRegex, '');
				} else {
					getRedirectsFor.push('Skabelon:' + tag);
				}
			});

			if (!getRedirectsFor.length) {
				postRemoval();
				return;
			}

			// Remove tags which appear in page text as redirects
			const api = new Morebits.wiki.Api('Henter skabelonomdirigeringer', {
				action: 'query',
				prop: 'linkshere',
				titles: getRedirectsFor.join('|'),
				redirects: 1, // follow redirect if the class name turns out to be a redirect page
				lhnamespace: '10', // template namespace only
				lhshow: 'redirect',
				lhlimit: 'max', // 500 is max for normal users, 5000 for bots and sysops
				format: 'json'
			}, ((apiobj) => {
				const pages = apiobj.getResponse().query.pages.filter((p) => !p.missing && !!p.linkshere);
				pages.forEach((page) => {
					let removed = false;
					page.linkshere.concat({title: page.title}).forEach((el) => {
						const tag = el.title.slice(9);
						const tagRegex = new RegExp('\\{\\{' + Morebits.pageNameRegex(tag) + '\\s*(\\|[^}]*)?\\}\\}\\n?');
						if (tagRegex.test(pageText)) {
							pageText = pageText.replace(tagRegex, '');
							removed = true;
							return false; // break out of $.each
						}
					});
					if (!removed) {
						Morebits.Status.warn('Info', 'Kunne ikke finde {{' +
						page.title.slice(9) + '}} på siden... springer over');
					}

				});

				postRemoval();

			}));
			api.post();

		};

		if (!params.tags.length) {
			removeTags();
			return;
		}

		let tagRe, tagText = '', tags = [];
		const groupableTags = [], groupableExistingTags = [];
		// Executes first: addition of selected tags

		/**
		 * Updates `tagText` with the syntax of `tagName` template with its parameters
		 *
		 * @param {number} tagIndex
		 * @param {string} tagName
		 */
		const addTag = function articleAddTag(tagIndex, tagName) {
			let currentTag = '';
			currentTag += '{{' + tagName;
			// fill in other parameters, based on the tag

			const subgroupObj = Twinkle.tag.article.flatObject[tagName] &&
				Twinkle.tag.article.flatObject[tagName].subgroup;
			if (subgroupObj) {
				const subgroups = Array.isArray(subgroupObj) ? subgroupObj : [ subgroupObj ];
				subgroups.forEach((gr) => {
					if (gr.parameter && (params[gr.name] || gr.required)) {
						currentTag += '|' + gr.parameter + '=' + (params[gr.name] || '');
					}
				});
			}

			currentTag += '|dato={{subst:CURRENTMONTHNAME}} {{subst:CURRENTYEAR}}}}\n';
			tagText += currentTag;
		};

		/**
		 * Adds the tags which go outside {{multiple issues}}, either because
		 * these tags aren't supported in {{multiple issues}} or because
		 * {{multiple issues}} is not being added to the page at all
		 */
		const addUngroupedTags = function() {
			$.each(tags, addTag);

			// Insert tag after short description or any hatnotes,
			// as well as deletion/protection-related templates
			const wikipage = new Morebits.wikitext.Page(pageText);
			const templatesAfter = Twinkle.hatnoteRegex +
				// Protection templates
				'pp|pp-.*?|' +
				// CSD
				'db|delete|db-.*?|speedy deletion-.*?|' +
				// PROD
				'(?:proposed deletion|prod blp)\\/dated(?:\\s*\\|(?:concern|user|timestamp|help).*)+|' +
				// not a hatnote, but sometimes under a CSD or AfD
				'salt|proposed deletion endorsed';
			// AfD is special, as the tag includes html comments before and after the actual template
			// trailing whitespace/newline needed since this subst's a newline
			const afdRegex = '(?:<!--.*AfD.*\\n\\{\\{(?:Article for deletion\\/dated|AfDM).*\\}\\}\\n<!--.*(?:\\n<!--.*)?AfD.*(?:\\s*\\n))?';
			pageText = wikipage.insertAfterTemplates(tagText, templatesAfter, null, afdRegex).getText();

			removeTags();
		};

		// Separate tags into groupable ones (`groupableTags`) and non-groupable ones (`tags`)
		params.tags.forEach((tag) => {
			tagRe = new RegExp('\\{\\{' + tag + '(\\||\\}\\})', 'im');
			// regex check for preexistence of tag can be skipped if in canRemove mode
			if (Twinkle.tag.canRemove || !tagRe.exec(pageText)) {
				// condition Twinkle.tag.article.tags[tag] to ensure that its not a custom tag
				// Custom tags are assumed non-groupable, since we don't know whether MI template supports them
				if (Twinkle.tag.article.flatObject[tag] && !Twinkle.tag.article.flatObject[tag].excludeMI) {
					groupableTags.push(tag);
				} else {
					tags.push(tag);
				}
			} else {
				Morebits.Status.warn('Info', 'Fandt {{' + tag +
					'}} på artiklen allerede... springer over');
			}
		});

		// To-be-retained existing tags that are groupable
		params.tagsToRemain.forEach((tag) => {
			// If the tag is unknown to us, we consider it non-groupable
			if (Twinkle.tag.article.flatObject[tag] && !Twinkle.tag.article.flatObject[tag].excludeMI) {
				groupableExistingTags.push(tag);
			}
		});

		const miTest = /\{\{(multiple ?issues|article ?issues|mi)(?!\s*\|\s*section\s*=)[^}]+\{/im.exec(pageText);

		if (miTest && groupableTags.length > 0) {
			Morebits.Status.info('Info', 'Tilføjer understøttede mærker inden i eksisterende {{multiple issues}}-mærke');

			tagText = '';
			$.each(groupableTags, addTag);

			const miRegex = new RegExp('(\\{\\{\\s*' + miTest[1] + '\\s*(?:\\|(?:\\{\\{[^{}]*\\}\\}|[^{}])*)?)\\}\\}\\s*', 'im');
			pageText = pageText.replace(miRegex, '$1' + tagText + '}}\n');
			tagText = '';

			addUngroupedTags();

		} else if (params.group && !miTest && (groupableExistingTags.length + groupableTags.length) >= 2) {
			Morebits.Status.info('Info', 'Grupperer understøttede mærker inden i {{multiple issues}}');

			tagText += '{{Multiple issues|\n';

			/**
			 * Adds newly added tags to MI
			 */
			const addNewTagsToMI = function() {
				$.each(groupableTags, addTag);
				tagText += '}}\n';

				addUngroupedTags();
			};

			const getRedirectsFor = [];

			// Reposition the tags on the page into {{multiple issues}}, if found with its
			// proper name, else moves it to `getRedirectsFor` array to be handled later
			groupableExistingTags.forEach((tag) => {
				const tagRegex = new RegExp('(\\{\\{' + Morebits.pageNameRegex(tag) + '\\s*(\\|[^}]+)?\\}\\}\\n?)');
				if (tagRegex.test(pageText)) {
					tagText += tagRegex.exec(pageText)[1];
					pageText = pageText.replace(tagRegex, '');
				} else {
					getRedirectsFor.push('Skabelon:' + tag);
				}
			});

			if (!getRedirectsFor.length) {
				addNewTagsToMI();
				return;
			}

			const api = new Morebits.wiki.Api('Henter skabelonomdirigeringer', {
				action: 'query',
				prop: 'linkshere',
				titles: getRedirectsFor.join('|'),
				redirects: 1,
				lhnamespace: '10', // template namespace only
				lhshow: 'redirect',
				lhlimit: 'max', // 500 is max for normal users, 5000 for bots and sysops
				format: 'json'
			}, ((apiobj) => {
				const pages = apiobj.getResponse().query.pages.filter((p) => !p.missing && !!p.linkshere);
				pages.forEach((page) => {
					let found = false;
					page.linkshere.forEach((el) => {
						const tag = el.title.slice(9);
						const tagRegex = new RegExp('(\\{\\{' + Morebits.pageNameRegex(tag) + '\\s*(\\|[^}]*)?\\}\\}\\n?)');
						if (tagRegex.test(pageText)) {
							tagText += tagRegex.exec(pageText)[1];
							pageText = pageText.replace(tagRegex, '');
							found = true;
							return false; // break out of $.each
						}
					});
					if (!found) {
						Morebits.Status.warn('Info', 'Kunne ikke finde eksisterende {{' +
						page.title.slice(9) + '}} på siden... springer over omplacering');
					}
				});
				addNewTagsToMI();
			}));
			api.post();

		} else {
			tags = tags.concat(groupableTags);
			addUngroupedTags();
		}
	},

	redirect: function redirect(pageobj) {
		const params = pageobj.getCallbackParameters(),
			tags = [];
		let pageText = pageobj.getPageText(),
			tagRe, tagText = '',
			summaryText = 'Tilføjede',
			i;

		for (i = 0; i < params.tags.length; i++) {
			tagRe = new RegExp('(\\{\\{' + params.tags[i] + '(\\||\\}\\}))', 'im');
			if (!tagRe.exec(pageText)) {
				tags.push(params.tags[i]);
			} else {
				Morebits.Status.warn('Info', 'Fandt {{' + params.tags[i] +
					'}} på omdirigeringen allerede... springer over');
			}
		}

		const addTag = function redirectAddTag(tagIndex, tagName) {
			tagText += '\n{{' + tagName;
			if (tagName === 'R from alternative language') {
				if (params.altLangFrom) {
					tagText += '|from=' + params.altLangFrom;
				}
				if (params.altLangTo) {
					tagText += '|to=' + params.altLangTo;
				}
			} else if (tagName === 'R avoided double redirect' && params.doubleRedirectTarget) {
				tagText += '|1=' + params.doubleRedirectTarget;
			}
			tagText += '}}';

			if (tagIndex > 0) {
				if (tagIndex === (tags.length - 1)) {
					summaryText += ' og';
				} else if (tagIndex < (tags.length - 1)) {
					summaryText += ',';
				}
			}

			summaryText += ' {{[[:' + (tagName.includes(':') ? tagName : 'Skabelon:' + tagName + '|' + tagName) + ']]}}';
		};

		if (!tags.length) {
			Morebits.Status.warn('Info', 'Ingen mærker tilbage at anvende');
		}

		tags.sort();
		$.each(tags, addTag);

		// Check for all Rcat shell redirects (from #433)
		if (pageText.match(/{{(?:redr|this is a redirect|r(?:edirect)?(?:.?cat.*)?[ _]?sh|RCS)/i)) {
			// Regex inspired by [[User:Kephir/gadgets/sagittarius.js]] ([[Special:PermaLink/831402893]])
			const oldTags = pageText.match(/(\s*{{[A-Za-z\s]+\|(?:\s*1=)?)((?:[^|{}]|{{[^}]+}})+)(}})\s*/i);
			pageText = pageText.replace(oldTags[0], oldTags[1] + tagText + oldTags[2] + oldTags[3]);
		} else {
			// Fold any pre-existing Rcats into taglist and under Rcatshell
			const pageTags = pageText.match(/\s*{{R(?:edirect)? .*?}}/img);
			let oldPageTags = '';
			if (pageTags) {
				pageTags.forEach((pageTag) => {
					const pageRe = new RegExp(Morebits.string.escapeRegExp(pageTag), 'img');
					pageText = pageText.replace(pageRe, '');
					pageTag = pageTag.trim();
					oldPageTags += '\n' + pageTag;
				});
			}
			pageText = pageText.trim() + '\n\n{{Redirect category shell|' + tagText + oldPageTags + '\n}}';
		}

		summaryText += (tags.length > 0 ? ' mærke' + (tags.length > 1 ? 'r ' : ' ') : ' {{[[Skabelon:Redirect category shell|Redirect category shell]]}}') + ' til omdirigering';

		// avoid truncated summaries
		if (summaryText.length > 499) {
			summaryText = summaryText.replace(/\[\[[^|]+\|([^\]]+)\]\]/g, '$1');
		}

		pageobj.setPageText(pageText);
		pageobj.setEditSummary(summaryText);
		if (Twinkle.getPref('watchTaggedVenues').includes('redirects')) {
			pageobj.setWatchlist(Twinkle.getPref('watchTaggedPages'));
		}
		pageobj.setMinorEdit(Twinkle.getPref('markTaggedPagesAsMinor'));
		pageobj.setCreateOption('nocreate');
		pageobj.save();

		if (params.patrol) {
			pageobj.triage();
		}

	},

	file: function twinkletagCallbacksFile(pageobj) {
		let text = pageobj.getPageText();
		const params = pageobj.getCallbackParameters();
		let summary = 'Tilføjer ';

		// Add maintenance tags
		if (params.tags.length) {

			let tagtext = '', currentTag;
			$.each(params.tags, (k, tag) => {
				// when other commons-related tags are placed, remove "move to Commons" tag
				if (['Keep local', 'Do not move to Commons'].includes(tag)) {
					text = Twinkle.removeMoveToCommonsTagsFromWikicode( text );
				}

				currentTag = tag;

				switch (tag) {
					case 'Keep local':
						if (params.keeplocalName !== '') {
							currentTag += '|1=' + params.keeplocalName;
						}
						break;
					case 'Rename media':
						if (params.renamemediaNewname !== '') {
							currentTag += '|1=' + params.renamemediaNewname;
						}
						if (params.renamemediaReason !== '') {
							currentTag += '|2=' + params.renamemediaReason;
						}
						break;
					case 'Cleanup image':
						currentTag += '|1=' + params.cleanupimageReason;
						break;
					case 'Image-Poor-Quality':
						currentTag += '|1=' + params.ImagePoorQualityReason;
						break;
					case 'Image hoax':
						currentTag += '|date={{subst:CURRENTMONTHNAME}} {{subst:CURRENTYEAR}}';
						break;
					case 'Vector version available':
						text = text.replace(/\{\{((convert to |convertto|should be |shouldbe|to)?svg|badpng|vectorize)[^}]*\}\}/gi, '');
						/* falls through */
					case 'PNG version available':
						/* falls through */
					case 'Obsolete':
						currentTag += '|1=' + params[tag.replace(/ /g, '_') + 'File'];
						break;
					case 'Do not move to Commons':
						currentTag += '|reason=' + params.DoNotMoveToCommons_reason;
						if (params.DoNotMoveToCommons_expiry) {
							currentTag += '|expiry=' + params.DoNotMoveToCommons_expiry;
						}
						break;
					case 'Orphaned non-free revisions':
						currentTag = 'subst:' + currentTag; // subst
						// remove {{non-free reduce}} and redirects
						text = text.replace(/\{\{\s*(Template\s*:\s*)?(Non-free reduce|FairUseReduce|Fairusereduce|Fair Use Reduce|Fair use reduce|Reduce size|Reduce|Fair-use reduce|Image-toobig|Comic-ovrsize-img|Non-free-reduce|Nfr|Smaller image|Nonfree reduce)\s*(\|(?:\{\{[^{}]*\}\}|[^{}])*)?\}\}\s*/ig, '');
						currentTag += '|date={{subst:date}}';
						break;
					case 'Copy to Commons':
						currentTag += '|human=' + mw.config.get('wgUserName');
						break;
					case 'Should be SVG':
						currentTag += '|' + params.svgCategory;
						break;
					case 'Nominated for deletion on Commons':
						if (params.nominatedOnCommonsName !== '') {
							currentTag += '|1=' + params.nominatedOnCommonsName;
						}
						break;
					case 'Deleted on Commons':
						if (params.deletedOnCommonsName !== '') {
							currentTag += '|1=' + params.deletedOnCommonsName;
						}
						break;
					default:
						break; // don't care
				}

				currentTag = '{{' + currentTag + '}}\n';

				tagtext += currentTag;
				summary += '{{' + tag + '}}, ';
			});

			if (!tagtext) {
				pageobj.getStatusElement().warn('Bruger annullerede handlingen; intet at gøre');
				return;
			}

			text = tagtext + text;
		}

		pageobj.setPageText(text);
		pageobj.setEditSummary(summary.substring(0, summary.length - 2));
		pageobj.setChangeTags(Twinkle.changeTags);
		if (Twinkle.getPref('watchTaggedVenues').includes('files')) {
			pageobj.setWatchlist(Twinkle.getPref('watchTaggedPages'));
		}
		pageobj.setMinorEdit(Twinkle.getPref('markTaggedPagesAsMinor'));
		pageobj.setCreateOption('nocreate');
		pageobj.save();

		if (params.patrol) {
			pageobj.triage();
		}
	}
};

/**
 * Given an array of incompatible tags, check if we have two or more selected
 *
 * @param {Array} incompatibleTags
 * @param {Array} tagsToCheck
 * @param {string} [extraMessage]
 * @return {true|undefined}
 */
Twinkle.tag.checkIncompatible = function(incompatibleTags, tagsToCheck, extraMessage = null) {
	const count = incompatibleTags.filter((tag) => tagsToCheck.includes(tag)).length;
	if (count > 1) {
		const incompatibleTagsString = '{{' + incompatibleTags.join('}}, {{') + '}}';
		let message = 'Vælg kun én af: ' + incompatibleTagsString + '.';
		message += extraMessage ? ' ' + extraMessage : '';
		alert(message);
		return true;
	}
};

Twinkle.tag.callback.evaluate = function twinkletagCallbackEvaluate(e) {
	const form = e.target;
	const params = Morebits.QuickForm.getInputData(form);

	// Validation
	switch (Twinkle.tag.mode) {
		case 'article':
			params.tagsToRemove = form.getUnchecked('existingTags'); // not in `input`
			params.tagsToRemain = params.existingTags || []; // container not created if none present
			break;

		case 'file':
			if (Twinkle.tag.checkIncompatible(['Bad GIF', 'Bad JPEG', 'Bad SVG', 'Bad format'], params.tags)) {
				return;
			}
			if (Twinkle.tag.checkIncompatible(['Should be PNG', 'Should be SVG', 'Should be text'], params.tags)) {
				return;
			}
			if (Twinkle.tag.checkIncompatible(['Bad SVG', 'Vector version available'], params.tags)) {
				return;
			}
			if (Twinkle.tag.checkIncompatible(['Bad JPEG', 'Overcompressed JPEG'], params.tags)) {
				return;
			}
			if (Twinkle.tag.checkIncompatible(['PNG version available', 'Vector version available'], params.tags)) {
				return;
			}

			// Get extension from either mime-type or title, if not present (e.g., SVGs)
			var extension = ((extension = $('.mime-type').text()) && extension.split(/\//)[1]) || mw.Title.newFromText(Morebits.pageNameNorm).getExtension();
			if (extension) {
				const extensionUpper = extension.toUpperCase();

				// What self-respecting file format has *two* extensions?!
				if (extensionUpper === 'JPG') {
					extension = 'JPEG';
				}

				// Check that selected templates make sense given the file's extension.

				// {{Bad GIF|JPEG|SVG}}, {{Fake SVG}}
				if (extensionUpper !== 'GIF' && params.tags.includes('Bad GIF')) {
					alert('Dette ser ud til at være en ' + extension + '-fil, så {{Bad GIF}} er upassende.');
					return;
				} else if (extensionUpper !== 'JPEG' && params.tags.includes('Bad JPEG')) {
					alert('Dette ser ud til at være en ' + extension + '-fil, så {{Bad JPEG}} er upassende.');
					return;
				} else if (extensionUpper !== 'SVG' && params.tags.includes('Bad SVG')) {
					alert('Dette ser ud til at være en ' + extension + '-fil, så {{Bad SVG}} er upassende.');
					return;
				} else if (extensionUpper !== 'SVG' && params.tags.includes('Fake SVG')) {
					alert('Dette ser ud til at være en ' + extension + '-fil, så {{Fake SVG}} er upassende.');
					return;
				}

				// {{Should be PNG|SVG}}
				if (params.tags.includes('Should be ' + extensionUpper)) {
					alert('Dette er allerede en ' + extension + '-fil, så {{Should be ' + extensionUpper + '}} er upassende.');
					return;
				}

				// {{Overcompressed JPEG}}
				if (params.tags.includes('Overcompressed JPEG') && extensionUpper !== 'JPEG') {
					alert('Dette ser ud til at være en ' + extension + '-fil, så {{Overcompressed JPEG}} gælder sandsynligvis ikke.');
					return;
				}

				// {{Bad trace}} and {{Bad font}}
				if (extensionUpper !== 'SVG') {
					if (params.tags.includes('Bad trace')) {
						alert('Dette ser ud til at være en ' + extension + '-fil, så {{Bad trace}} gælder sandsynligvis ikke.');
						return;
					} else if (params.tags.includes('Bad font')) {
						alert('Dette ser ud til at være en ' + extension + '-fil, så {{Bad font}} gælder sandsynligvis ikke.');
						return;
					}
				}
			}

			// {{Do not move to Commons}}
			if (
				params.tags.includes('Do not move to Commons') &&
				params.DoNotMoveToCommons_expiry &&
				(
					!/^2\d{3}$/.test(params.DoNotMoveToCommons_expiry) ||
					parseInt(params.DoNotMoveToCommons_expiry, 10) <= new Date().getFullYear()
				)
			) {
				alert('Skal være et gyldigt fremtidigt årstal.');
				return;
			}

			break;

		case 'redirect':
			if (Twinkle.tag.checkIncompatible(['R printworthy', 'R unprintworthy'], params.tags)) {
				return;
			}
			if (Twinkle.tag.checkIncompatible(['R from subtopic', 'R to subtopic'], params.tags)) {
				return;
			}
			if (Twinkle.tag.checkIncompatible([
				'R to category namespace',
				'R to help namespace',
				'R to main namespace',
				'R to portal namespace',
				'R to project namespace',
				'R to user namespace'
			], params.tags)) {
				return;
			}
			break;

		default:
			alert('Twinkle.tag: ukendt tilstand ' + Twinkle.tag.mode);
			break;
	}

	// File/redirect: return if no tags selected
	// Article: return if no tag is selected and no already present tag is deselected
	if (params.tags.length === 0 && (Twinkle.tag.mode !== 'article' || params.tagsToRemove.length === 0)) {
		alert('Du skal vælge mindst ét mærke!');
		return;
	}

	Morebits.SimpleWindow.setButtonsEnabled(false);
	Morebits.Status.init(form);

	Morebits.wiki.actionCompleted.redirect = Morebits.pageNameNorm;
	Morebits.wiki.actionCompleted.notice = 'Mærkning fuldført, genindlæser artiklen om et øjeblik';
	if (Twinkle.tag.mode === 'redirect') {
		Morebits.wiki.actionCompleted.followRedirect = false;
	}

	const wikipediaPage = new Morebits.wiki.Page(Morebits.pageNameNorm, 'Mærker ' + Twinkle.tag.mode);
	wikipediaPage.setCallbackParameters(params);
	wikipediaPage.setChangeTags(Twinkle.changeTags); // Here to apply to triage
	wikipediaPage.load(Twinkle.tag.callbacks[Twinkle.tag.mode]);

};

Twinkle.addInitCallback(Twinkle.tag, 'tag');
}());
// </nowiki>
