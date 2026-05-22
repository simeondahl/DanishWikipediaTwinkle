// <nowiki>

(function() {

/*
 ****************************************
 *** twinkletalkback.js: Svar til-modul
 ****************************************
 * Aktiveringsform: Fane ("TB")
 * Aktiv på:        Alle sider med relevant brugernavn (brugerrum, bidrag m.m.) undtagen IP-intervaller
 */

Twinkle.talkback = function() {
	if (!mw.config.exists('wgRelevantUserName') || Morebits.ip.isRange(mw.config.get('wgRelevantUserName'))) {
		return;
	}
	Twinkle.addPortletLink(Twinkle.talkback.callback, 'TB', 'twinkle-talkback', 'Nem svar til');
};

Twinkle.talkback.callback = function() {
	if (mw.config.get('wgRelevantUserName') === mw.config.get('wgUserName') && !confirm('Er du virkelig nødt til at svare dig selv?')) {
		return;
	}

	const Window = new Morebits.SimpleWindow(600, 350);
	Window.setTitle('Svar til / underret bruger');
	Window.setScriptName('Twinkle');

	const form = new Morebits.QuickForm(Twinkle.talkback.evaluate);

	form.append({ type: 'radio', name: 'tbtarget',
		list: [
			{
				label: 'Svar til (talkback)',
				value: 'talkback',
				checked: 'true'
			},
			{
				label: 'Se venligst',
				value: 'see'
			}
		],
		event: Twinkle.talkback.changeTarget
	});

	form.append({
		type: 'field',
		label: 'Arbejdsområde',
		name: 'work_area'
	});

	const previewlink = document.createElement('a');
	$(previewlink).on('click', () => {
		Twinkle.talkback.callbacks.preview(result); // |result| er defineret nedenfor
	});
	previewlink.style.cursor = 'pointer';
	previewlink.textContent = 'Forhåndsvisning';
	form.append({ type: 'div', id: 'talkbackpreview', label: [ previewlink ] });
	form.append({ type: 'div', id: 'twinkletalkback-previewbox', style: 'display: none' });

	form.append({ type: 'submit' });

	var result = form.render();
	Window.setContent(result);
	Window.display();
	result.previewer = new Morebits.wiki.Preview($(result).find('div#twinkletalkback-previewbox').last()[0]);

	// Initialiser første valg
	const evt = document.createEvent('Event');
	evt.initEvent('change', true, true);
	result.tbtarget[0].dispatchEvent(evt);

	// Tjek om brugeren har fravalgt talkback
	const query = {
		action: 'query',
		prop: 'extlinks',
		titles: 'User talk:' + mw.config.get('wgRelevantUserName'),
		elquery: 'userjs.invalid/noTalkback',
		ellimit: '1',
		format: 'json'
	};
	const wpapi = new Morebits.wiki.Api('Henter talkback-fravalgs-status', query, Twinkle.talkback.callback.optoutStatus);
	wpapi.post();
};

Twinkle.talkback.optout = '';

Twinkle.talkback.callback.optoutStatus = function(apiobj) {
	const el = apiobj.getResponse().query.pages[0].extlinks;
	if (el && el.length) {
		Twinkle.talkback.optout = mw.config.get('wgRelevantUserName') + ' foretrækker ikke at modtage talkbacks';
		const url = el[0].url;
		const reason = mw.util.getParamValue('reason', url);
		Twinkle.talkback.optout += reason ? ': ' + reason : '.';
	}
	$('#twinkle-talkback-optout-message').text(Twinkle.talkback.optout);
};

let prev_page = '';
let prev_section = '';
let prev_message = '';

Twinkle.talkback.changeTarget = function(e) {
	const value = e.target.values;
	const root = e.target.form;

	const old_area = Morebits.QuickForm.getElements(root, 'work_area')[0];

	if (root.section) {
		prev_section = root.section.value;
	}
	if (root.message) {
		prev_message = root.message.value;
	}
	if (root.page) {
		prev_page = root.page.value;
	}

	let work_area = new Morebits.QuickForm.Element({
		type: 'field',
		label: 'Talkback-oplysninger',
		name: 'work_area'
	});

	root.previewer.closePreview();

	switch (value) {
		case 'talkback':
			/* falls through */
		default:
			work_area.append({
				type: 'div',
				label: '',
				style: 'color: red',
				id: 'twinkle-talkback-optout-message'
			});

			work_area.append({
				type: 'input',
				name: 'page',
				label: 'Diskussionssidensnavnet',
				tooltip: "Siden, hvor diskussionen foregår. F.eks.: 'Brugerdiskussion:Den Gode Ven' eller 'Wikipedia-diskussion:Twinkle'. Begrænsning til diskussionssider og Wikipedia-rum.",
				value: prev_page || 'Brugerdiskussion:' + mw.config.get('wgUserName')
			});
			work_area.append({
				type: 'input',
				name: 'section',
				label: 'Linket afsnit (valgfrit)',
				tooltip: "Afsnittet, hvor diskussionen foregår. F.eks.: 'Fusioneringforslag'.",
				value: prev_section
			});
			break;
		case 'see':
			work_area.append({
				type: 'input',
				name: 'page',
				label: 'Diskussionssidensnavnet',
				tooltip: "Siden, du refererer til.",
				value: prev_page || ''
			});
			work_area.append({
				type: 'input',
				name: 'section',
				label: 'Linket afsnit (valgfrit)',
				tooltip: "Afsnittet, der er relevant.",
				value: prev_section
			});
			break;
	}

	work_area.append({ type: 'textarea', label: 'Ekstra besked (valgfrit):', name: 'message', tooltip: 'En ekstra besked, du vil efterlade under talkback-skabelonen. Din signatur tilføjes til sidst.' });

	work_area = work_area.render();
	root.replaceChild(work_area, old_area);
	if (root.message) {
		root.message.value = prev_message;
	}

	$('#twinkle-talkback-optout-message').text(Twinkle.talkback.optout);
};

Twinkle.talkback.evaluate = function(e) {
	const input = Morebits.QuickForm.getInputData(e.target);

	const fullUserTalkPageName = new mw.Title(mw.config.get('wgRelevantUserName'), 3).toText();
	const talkpage = new Morebits.wiki.Page(fullUserTalkPageName, 'Tilføjer talkback');

	Morebits.SimpleWindow.setButtonsEnabled(false);
	Morebits.Status.init(e.target);

	Morebits.wiki.actionCompleted.redirect = fullUserTalkPageName;
	Morebits.wiki.actionCompleted.notice = 'Talkback sendt; genindlæser diskussionssiden om få sekunder';

	switch (input.tbtarget) {
		case 'see':
			input.page = Twinkle.talkback.callbacks.normalizeTalkbackPage(input.page);
			talkpage.setEditSummary('Se venligst diskussionen på [[:' + input.page +
			(input.section ? '#' + input.section : '') + ']]');
			break;
		default: // talkback
			input.page = Twinkle.talkback.callbacks.normalizeTalkbackPage(input.page);
			talkpage.setEditSummary('Talkback ([[:' + input.page +
			(input.section ? '#' + input.section : '') + ']])');
			break;
	}

	talkpage.setFollowRedirect(true);

	talkpage.load((pageobj) => {
		const whitespaceToPrepend = pageobj.exists() && pageobj.getPageText() !== '' ? '\n\n' : '';
		talkpage.setAppendText(whitespaceToPrepend + Twinkle.talkback.callbacks.getNoticeWikitext(input));
		talkpage.setChangeTags(Twinkle.changeTags);
		talkpage.setCreateOption('recreate');
		talkpage.setMinorEdit(Twinkle.getPref('markTalkbackAsMinor'));
		talkpage.append();
	});
};

Twinkle.talkback.callbacks = {
	// Normaliserer talkback-sider – standard er brugerens diskussionsside
	normalizeTalkbackPage: function(page) {
		page = page || mw.config.get('wgUserName');

		// Antag at ingen præfiks er et brugernavn, konverter til brugerdiskussionsrum
		let normal = mw.Title.newFromText(page, 3);
		// Normaliser fejlagtige eller sandsynlige fejlindtastninger
		if (normal) {
			// Tillad kun diskussionssider og Wikipedia-rum
			if (normal.namespace !== 4 && normal.namespace !== 10) {
				normal = normal.getTalkPage();
			}
			page = normal.getPrefixedText();
		}
		return page;
	},

	preview: function(form) {
		const input = Morebits.QuickForm.getInputData(form);

		if (input.tbtarget === 'talkback' || input.tbtarget === 'see') {
			input.page = Twinkle.talkback.callbacks.normalizeTalkbackPage(input.page);
		}

		const noticetext = Twinkle.talkback.callbacks.getNoticeWikitext(input);
		form.previewer.beginRender(noticetext, 'User talk:' + mw.config.get('wgRelevantUserName'));
	},

	getNoticeWikitext: function(input) {
		let text;

		switch (input.tbtarget) {
			case 'see':
				var heading = Twinkle.getPref('talkbackHeading');
				text = '{{subst:Svar til|location=' + input.page + (input.section ? '#' + input.section : '') +
				'|more=' + input.message + '|heading=' + heading + '}}';
				break;
			default: // talkback – bruger {{Svar til}} fra da.wikipedia
				text = '==' + Twinkle.getPref('talkbackHeading') + '==\n' +
					'{{Svar til|' + input.page + (input.section ? '|' + input.section : '') + '|ts=~~~~~}}';

				if (input.message) {
					text += '\n' + input.message + ' ~~~~';
				} else if (Twinkle.getPref('insertTalkbackSignature')) {
					text += '\n~~~~';
				}
		}
		return text;
	}
};
Twinkle.addInitCallback(Twinkle.talkback, 'talkback');
}());

// </nowiki>