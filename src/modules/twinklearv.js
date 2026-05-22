// <nowiki>

(function() {

/*
 ****************************************
 *** twinklearv.js: Administratorrapportering
 ****************************************
 * Aktiveringsform: Fane ("ARV")
 * Aktiv på:        Sider med relevant brugernavn
 *
 * Rapporterer til: Wikipedia:Anmodning om administratorassistance
 */

Twinkle.arv = function twinklearv() {
	const username = mw.config.get('wgRelevantUserName');
	if (!username || username === mw.config.get('wgUserName')) {
		return;
	}
	const isIP = mw.util.isIPAddress(username, true);
	if (Morebits.ip.isRange(username) && !Morebits.ip.validCIDR(username)) {
		return;
	}
	const userType = isIP ? 'IP' + (Morebits.ip.isRange(username) ? '-interval' : '') : 'bruger';

	Twinkle.addPortletLink(() => {
		Twinkle.arv.callback(username, isIP);
	}, 'ARV', 'tw-arv', 'Rapportér ' + userType + ' til administrator');
};

Twinkle.arv.callback = function(uid, isIP) {
	const Window = new Morebits.SimpleWindow(600, 450);
	Window.setTitle('Rapportér til administrator');
	Window.setScriptName('Twinkle');
	Window.addFooterLink('Anmodning om administratorassistance', 'Wikipedia:Anmodning om administratorassistance');

	const form = new Morebits.QuickForm(Twinkle.arv.callback.evaluate);

	const categories = form.append({
		type: 'select',
		name: 'category',
		label: 'Vælg rapporttype:',
		event: Twinkle.arv.callback.changeCategory
	});
	categories.append({ type: 'option', label: 'Hærværk', value: 'vandalism' });
	categories.append({ type: 'option', label: 'Upassende brugernavn', value: 'username', disabled: isIP });
	categories.append({ type: 'option', label: 'Misbrug af flere konti (sockpuppetry)', value: 'sock' });
	categories.append({ type: 'option', label: 'Andet', value: 'other' });

	form.append({
		type: 'div',
		label: '',
		style: 'color: red',
		id: 'twinkle-arv-blockwarning'
	});

	form.append({
		type: 'field',
		label: 'Arbejdsområde',
		name: 'work_area'
	});
	form.append({ type: 'submit', label: 'Rapportér' });
	form.append({ type: 'hidden', name: 'uid', value: uid });

	const result = form.render();
	Window.setContent(result);
	Window.display();

	// Tjek om brugeren allerede er blokeret
	const query = {
		action: 'query',
		list: 'blocks',
		bkprop: 'range|flags',
		format: 'json'
	};
	if (isIP) {
		query.bkip = uid;
	} else {
		query.bkusers = uid;
	}
	new Morebits.wiki.Api('Tjekker blokeringsstatus', query, ((apiobj) => {
		const blocklist = apiobj.getResponse().query.blocks;
		if (blocklist.length) {
			const block = blocklist[0];
			let message = (isIP ? 'Denne IP-' + (Morebits.ip.isRange(uid) ? 'interval' : 'adresse') : 'Denne konto') + ' er ' + (block.partial ? 'delvist' : 'allerede') + ' blokeret';
			message += block.rangestart !== block.rangeend ? ' som del af en intervalblokering.' : '.';
			if (block.partial) {
				$('#twinkle-arv-blockwarning').css('color', 'black');
			}
			$('#twinkle-arv-blockwarning').text(message);
		}
	})).post();

	const evt = document.createEvent('Event');
	evt.initEvent('change', true, true);
	result.category.dispatchEvent(evt);
};

Twinkle.arv.callback.changeCategory = function(e) {
	const value = e.target.value;
	const root = e.target.form;
	const old_area = Morebits.QuickForm.getElements(root, 'work_area')[0];
	let work_area;

	switch (value) {
		case 'vandalism':
		default:
			work_area = new Morebits.QuickForm.Element({
				type: 'field',
				label: 'Rapportér bruger for hærværk',
				name: 'work_area'
			});
			work_area.append({
				type: 'input',
				name: 'page',
				label: 'Primær side (valgfrit):',
				tooltip: 'Siden, der blev udsat for hærværk. Lad stå tomt for ikke at linke til en side.',
				value: Twinkle.getPrefill('vanarticle') || ''
			});
			work_area.append({
				type: 'checkbox',
				name: 'arvtype',
				list: [
					{ label: 'Hærværk efter endelig advarsel', value: 'final' },
					{ label: 'Hærværk efter nylig ophævelse af blokering', value: 'postblock' },
					{ label: 'Kontoen bruges kun til hærværk', value: 'vandalonly', disabled: mw.util.isIPAddress(root.uid.value, true) },
					{ label: 'Kontoen bruges til reklame/spam', value: 'promoonly', disabled: mw.util.isIPAddress(root.uid.value, true) }
				]
			});
			work_area.append({ type: 'textarea', name: 'reason', label: 'Kommentar:' });
			break;

		case 'username':
			work_area = new Morebits.QuickForm.Element({
				type: 'field',
				label: 'Rapportér upassende brugernavn',
				name: 'work_area'
			});
			work_area.append({
				type: 'checkbox',
				name: 'arvtype',
				list: [
					{ label: 'Vildledende brugernavn', value: 'misleading' },
					{ label: 'Reklamerende brugernavn', value: 'promotional' },
					{ label: 'Stødende brugernavn', value: 'offensive' },
					{ label: 'Forstyrrende brugernavn', value: 'disruptive' }
				]
			});
			work_area.append({ type: 'textarea', name: 'reason', label: 'Kommentar:' });
			break;

		case 'sock':
			work_area = new Morebits.QuickForm.Element({
				type: 'field',
				label: 'Rapportér misbrug af flere konti',
				name: 'work_area'
			});
			work_area.append({ type: 'input', name: 'sockmaster', label: 'Primær konto (hvis kendt):', tooltip: 'Brugernavn uden "Bruger:"-præfiks' });
			work_area.append({ type: 'textarea', name: 'reason', label: 'Bevis:' });
			break;

		case 'other':
			work_area = new Morebits.QuickForm.Element({
				type: 'field',
				label: 'Anden rapportering',
				name: 'work_area'
			});
			work_area.append({ type: 'textarea', name: 'reason', label: 'Beskriv problemet:' });
			break;
	}

	work_area = work_area.render();
	old_area.parentNode.replaceChild(work_area, old_area);
};

Twinkle.arv.callback.evaluate = function(e) {
	const form = e.target;
	const input = Morebits.QuickForm.getInputData(form);

	let reasonText = '';
	const reportPage = 'Wikipedia:Anmodning om administratorassistance';

	switch (input.category) {
		case 'vandalism':
		default: {
			const types = (input.arvtype || []).map((v) => {
				switch (v) {
					case 'final': return 'hærværk efter endelig advarsel';
					case 'postblock': return 'hærværk efter nylig ophævelse af blokering';
					case 'vandalonly': return 'kontoen bruges kun til hærværk';
					case 'promoonly': return 'kontoen bruges til reklame/spam';
					default: return '';
				}
			}).filter(Boolean).join('; ');

			if (input.page) {
				reasonText = 'På [[' + input.page + ']]';
				if (types) { reasonText += ': ' + types; }
			} else if (types) {
				reasonText = types;
			}
			if (input.reason) {
				reasonText += (reasonText ? '. ' : '') + input.reason;
			}
			if (!reasonText) {
				alert('Du skal angive en begrundelse.');
				return;
			}
			reasonText = reasonText.trim();
			if (!/[.?!;]$/.test(reasonText)) { reasonText += '.'; }
			reasonText += ' ~~~~';
			break;
		}
		case 'username': {
			const types = (input.arvtype || []).map((v) => {
				switch (v) {
					case 'misleading': return 'vildledende';
					case 'promotional': return 'reklamerende';
					case 'offensive': return 'stødende';
					case 'disruptive': return 'forstyrrende';
					default: return '';
				}
			}).filter(Boolean).join(', ');
			reasonText = 'Brud på brugernavnspolitikken';
			if (types) { reasonText += ' (' + types + ')'; }
			if (input.reason) { reasonText += '. ' + input.reason; }
			reasonText += '. ~~~~';
			break;
		}
		case 'sock':
			reasonText = 'Mistanke om misbrug af flere konti';
			if (input.sockmaster) { reasonText += ' (primær konto: [[Bruger:' + input.sockmaster + ']])'; }
			if (input.reason) { reasonText += '. ' + input.reason; }
			reasonText += '. ~~~~';
			break;
		case 'other':
			reasonText = (input.reason || '').trim();
			if (!reasonText) {
				alert('Du skal beskrive problemet.');
				return;
			}
			if (!/[.?!;]$/.test(reasonText)) { reasonText += '.'; }
			reasonText += ' ~~~~';
			break;
	}

	Morebits.SimpleWindow.setButtonsEnabled(false);
	Morebits.Status.init(form);

	Morebits.wiki.actionCompleted.redirect = reportPage;
	Morebits.wiki.actionCompleted.notice = 'Rapport indsendt, genindlæser siden om få sekunder';

	const appendText = '\n\n=== Rapport om [[Bruger:' + input.uid + ']] ===\n' +
		'{{brugerinfo|' + input.uid + '}}\n' +
		reasonText;

	const page = new Morebits.wiki.Page(reportPage, 'Indsender rapport');
	page.setFollowRedirect(true);
	page.setAppendText(appendText);
	page.setEditSummary('Rapport om [[Bruger:' + input.uid + ']].');
	page.setChangeTags(Twinkle.changeTags);
	page.append();
};

Twinkle.addInitCallback(Twinkle.arv, 'arv');
}());

// </nowiki>