// <nowiki>

(function() {

/*
 ****************************************
 *** twinkleconfig.js: Preferences module
 ****************************************
 * Mode of invocation:     Adds configuration form to Wikipedia:Twinkle/Preferences,
                           and adds an ad box to the top of user subpages belonging to the
                           currently logged-in user which end in '.js'
 * Active on:              What I just said.  Yeah.
 */

Twinkle.config = {};

Twinkle.config.watchlistEnums = {
	yes: 'Tilføj til overvågningsliste (på ubestemt tid)',
	no: 'Tilføj ikke til overvågningsliste',
	default: 'Følg dine webstedsindstillinger',
	'1 week': 'Overvåg i 1 uge',
	'1 month': 'Overvåg i 1 måned',
	'3 months': 'Overvåg i 3 måneder',
	'6 months': 'Overvåg i 6 måneder'
};

// Dansk Wikipedia RFS-kriterier (jf. twinklespeedy.js)
Twinkle.config.commonSets = {
	csdCriteria: {
		hurtigslet: 'Brugerdefineret begrundelse ({{hurtigslet}})',
		g1: 'G1/G2: Sludder eller hærværk',
		g3: 'G3: Chikane/personangreb',
		g4: 'G4: Fejloprettelse',
		g5: 'G5: Ophavsretskrænkelse',
		a1: 'A1: Ikke encyklopædisk',
		a2: 'A2: Indforstået/uforståelig',
		a3: 'A3: Maskinoversættelse',
		a4: 'A4: Fremmed sprog',
		r1: 'R: Manglende relevans/notabilitet'
	},
	csdCriteriaNotification: {
		hurtigslet: 'Brugerdefineret begrundelse ({{hurtigslet}})',
		g1: 'G1/G2: Sludder eller hærværk',
		g3: 'G3: Chikane/personangreb',
		g4: 'G4: Fejloprettelse',
		g5: 'G5: Ophavsretskrænkelse',
		a1: 'A1: Ikke encyklopædisk',
		a2: 'A2: Indforstået/uforståelig',
		a3: 'A3: Maskinoversættelse',
		a4: 'A4: Fremmed sprog',
		r1: 'R: Manglende relevans/notabilitet'
	},
	csdAndImageDeletionCriteria: {
		hurtigslet: 'Brugerdefineret begrundelse ({{hurtigslet}})',
		g1: 'G1/G2: Sludder eller hærværk',
		g3: 'G3: Chikane/personangreb',
		g4: 'G4: Fejloprettelse',
		g5: 'G5: Ophavsretskrænkelse',
		a1: 'A1: Ikke encyklopædisk',
		a2: 'A2: Indforstået/uforståelig',
		a3: 'A3: Maskinoversættelse',
		a4: 'A4: Fremmed sprog',
		r1: 'R: Manglende relevans/notabilitet'
	},
	namespacesNoSpecial: {
		0: 'Artikel',
		1: 'Diskussion (artikel)',
		2: 'Bruger',
		3: 'Brugerdiskussion',
		4: 'Wikipedia',
		5: 'Wikipedia-diskussion',
		6: 'Fil',
		7: 'Fildiskussion',
		8: 'MediaWiki',
		9: 'MediaWiki-diskussion',
		10: 'Skabelon',
		11: 'Skabelondiskussion',
		12: 'Hjælp',
		13: 'Hjælpdiskussion',
		14: 'Kategori',
		15: 'Kategoridiskussion',
		100: 'Portal',
		101: 'Portaldiskussion',
		118: 'Kladde',
		119: 'Kladdediskussion',
		710: 'TimedText',
		711: 'TimedText-diskussion',
		828: 'Modul',
		829: 'Moduldiskussion'
	}
};

Twinkle.config.commonSets.csdCriteriaDisplayOrder = Object.keys( Twinkle.config.commonSets.csdCriteria );
Twinkle.config.commonSets.csdCriteriaNotificationDisplayOrder = Object.keys( Twinkle.config.commonSets.csdCriteriaNotification );
Twinkle.config.commonSets.csdAndImageDeletionCriteriaDisplayOrder = Object.keys( Twinkle.config.commonSets.csdAndImageDeletionCriteria );

/**
 * Section entry format:
 *
 * {
 *   title: <human-readable section title>,
 *   module: <name of the associated module, used to link to sections>,
 *   adminOnly: <true for admin-only sections>,
 *   hidden: <true for advanced preferences that rarely need to be changed - they can still be modified by manually editing twinkleoptions.js>,
 *   preferences: [
 *     {
 *       name: <TwinkleConfig property name>,
 *       label: <human-readable short description - used as a form label>,
 *       helptip: <(optional) human-readable text (using valid HTML) that complements the description, like limits, warnings, etc.>
 *       adminOnly: <true for admin-only preferences>,
 *       type: <string|boolean|integer|enum|set|customList> (customList stores an array of JSON objects { value, label }),
 *       enumValues: <for type = "enum": a JSON object where the keys are the internal names and the values are human-readable strings>,
 *       setValues: <for type = "set": a JSON object where the keys are the internal names and the values are human-readable strings>,
 *       setDisplayOrder: <(optional) for type = "set": an array containing the keys of setValues (as strings) in the order that they are displayed>,
 *       customListValueTitle: <for type = "customList": the heading for the left "value" column in the custom list editor>,
 *       customListLabelTitle: <for type = "customList": the heading for the right "label" column in the custom list editor>
 *     },
 *     . . .
 *   ]
 * },
 * . . .
 *
 */

Twinkle.config.sections = [
	{
		title: 'Generelt',
		module: 'general',
		preferences: [
			// TwinkleConfig.userTalkPageMode may take arguments:
			// 'window': open a new window, remember the opened window
			// 'tab': opens in a new tab, if possible.
			// 'blank': force open in a new window, even if such a window exists
			{
				name: 'userTalkPageMode',
				label: 'Når en brugerdiskussionsside åbnes, åbn den',
				type: 'enum',
				enumValues: { window: 'I et vindue, der erstatter andre brugerdiskussioner', tab: 'I en ny fane', blank: 'I et helt nyt vindue' }
			},

			// TwinkleConfig.dialogLargeFont (boolean)
			{
				name: 'dialogLargeFont',
				label: 'Brug større tekst i Twinkle-dialoger',
				type: 'boolean'
			},

			// Twinkle.config.disabledModules (array)
			{
				name: 'disabledModules',
				label: 'Deaktiver de valgte Twinkle-moduler',
				helptip: 'Alt du vælger her vil IKKE være tilgængeligt, så vær forsigtig. Fjern markeringen for at genaktivere.',
				type: 'set',
				setValues: { arv: 'ARV', warn: 'Advar', welcome: 'Velkomst', shared: 'Delt IP', talkback: 'Talkback', speedy: 'CSD', prod: 'PROD', xfd: 'XfD', image: 'Billede (DI)', protect: 'Beskyt (RPP)', tag: 'Mærk', diff: 'Diff', unlink: 'Fjern links', rollback: 'Tilbagerul og rollback' }
			},

			// Twinkle.config.disabledSysopModules (array)
			{
				name: 'disabledSysopModules',
				label: 'Deaktiver de valgte admin-moduler',
				helptip: 'Alt du vælger her vil IKKE være tilgængeligt, så vær forsigtig. Fjern markeringen for at genaktivere.',
				adminOnly: true,
				type: 'set',
				setValues: { block: 'Bloker', deprod: 'DePROD', batchdelete: 'M-slet', batchprotect: 'M-beskyt', batchundelete: 'M-gendan' }
			}
		]
	},

	{
		title: 'ARV',
		module: 'arv',
		preferences: [
			{
				name: 'spiWatchReport',
				label: 'Tilføj sokkedukke-anmeldelsessider til overvågningsliste',
				type: 'enum',
				enumValues: Twinkle.config.watchlistEnums
			}
		]
	},

	{
		title: 'Bloker bruger',
		module: 'block',
		adminOnly: true,
		preferences: [
			// TwinkleConfig.defaultToBlock64 (boolean)
			// Whether to default to just blocking the /64 on or off
			{
				name: 'defaultToBlock64',
				label: 'For IPv6-adresser, vælg som standard at blokere /64-området',
				type: 'boolean'
			},

			// TwinkleConfig.defaultToPartialBlocks (boolean)
			// Whether to default partial blocks on or off
			{
				name: 'defaultToPartialBlocks',
				label: 'Vælg delvise blokeringer som standard når blokeringsmenuen åbnes',
				helptip: 'Hvis brugeren allerede er blokeret, vil dette blive tilsidesat til fordel for den nuværende blokeringstype',
				type: 'boolean'
			},

			// TwinkleConfig.blankTalkpageOnIndefBlock (boolean)
			// if true, blank the talk page when issuing an indef block notice (per [[WP:UWUL#Indefinitely blocked users]])
			{
				name: 'blankTalkpageOnIndefBlock',
				label: 'Tøm diskussionssiden ved permanent blokering af brugere',
				helptip: 'Se <a href="' + mw.util.getUrl('Wikipedia:WikiProject_User_warnings/Usage_and_layout#Indefinitely_blocked_users') + '">WP:UWUL</a> for mere information.',
				type: 'boolean'
			}
		]
	},

	{
		title: 'Filvejledning (DI)',
		module: 'image',
		preferences: [
			// TwinkleConfig.notifyUserOnDeli (boolean)
			// If the user should be notified after placing a file deletion tag
			{
				name: 'notifyUserOnDeli',
				label: 'Markér "underret den oprindelige oploader" som standard',
				type: 'boolean'
			},

			// TwinkleConfig.deliWatchPage (string)
			// The watchlist setting of the page tagged for deletion.
			{
				name: 'deliWatchPage',
				label: 'Tilføj billedside til overvågningsliste ved mærkning',
				type: 'enum',
				enumValues: Twinkle.config.watchlistEnums
			},

			// TwinkleConfig.deliWatchUser (string)
			// The watchlist setting of the user talk page if a notification is placed.
			{
				name: 'deliWatchUser',
				label: 'Tilføj den oprindelige opladers brugerdiskussionsside til overvågningsliste ved underretning',
				type: 'enum',
				enumValues: Twinkle.config.watchlistEnums
			}
		]
	},

	{
		title: 'Sidebeskyttelse ' + (Morebits.userIsSysop ? '(PP)' : '(RPP)'),
		module: 'protect',
		preferences: [
			{
				name: 'watchRequestedPages',
				label: 'Tilføj side til overvågningsliste ved anmodning om beskyttelse',
				type: 'enum',
				enumValues: Twinkle.config.watchlistEnums
			},
			{
				name: 'watchPPTaggedPages',
				label: 'Tilføj side til overvågningsliste ved mærkning med beskyttelsesskabelon',
				type: 'enum',
				enumValues: Twinkle.config.watchlistEnums
			},
			{
				name: 'watchProtectedPages',
				label: 'Tilføj side til overvågningsliste ved beskyttelse',
				helptip: 'Hvis siden også mærkes efter beskyttelse, vil den indstilling foretrækkes.',
				adminOnly: true,
				type: 'enum',
				enumValues: Twinkle.config.watchlistEnums
			}
		]
	},

	{
		title: 'Foreslået sletning (PROD)',
		module: 'prod',
		preferences: [
			// TwinkleConfig.watchProdPages (string)
			// Watchlist setting when applying prod template to page
			{
				name: 'watchProdPages',
				label: 'Tilføj artikel til overvågningsliste ved mærkning',
				type: 'enum',
				enumValues: Twinkle.config.watchlistEnums
			},

			// TwinkleConfig.markProdPagesAsPatrolled (boolean)
			// If, when applying prod template to page, to mark the page as curated/patrolled (if the page was reached from NewPages)
			{
				name: 'markProdPagesAsPatrolled',
				label: 'Markér siden som patruljeret/gennemgået ved mærkning (hvis muligt)',
				helptip: 'Dette bør sandsynligvis ikke markeres, da det er imod konsensus om bedste praksis',
				type: 'boolean'
			},

			// TwinkleConfig.prodReasonDefault (string)
			// The prefilled PROD reason.
			{
				name: 'prodReasonDefault',
				label: 'Forudfyldt PROD-begrundelse',
				type: 'string'
			},

			{
				name: 'logProdPages',
				label: 'Oprethold en log i brugerrummet over alle sider du mærker til PROD',
				helptip: 'Da ikke-administratorer ikke har adgang til deres slettede bidrag, er brugerrumloggen en god måde at holde styr på alle sider du mærker til PROD med Twinkle.',
				type: 'boolean'
			},
			{
				name: 'prodLogPageName',
				label: 'Oprethold PROD-brugerrumloggen på denne brugerunderside',
				helptip: 'Skriv et undersidenavni dette felt. Du finder din PROD-log på Bruger:<i>brugernavn</i>/<i>undersidenavn</i>. Virker kun hvis du aktiverer PROD-brugerrumloggen.',
				type: 'string'
			}
		]
	},

	{
		title: 'Tilbageful og rollback',
		module: 'rollback',
		preferences: [
			// TwinkleConfig.autoMenuAfterRollback (bool)
			// Option to automatically open the warning menu if the user talk page is opened post-reversion
			{
				name: 'autoMenuAfterRollback',
				label: 'Åbn automatisk Twinkle advarselsmenuen på en brugerdiskussionsside efter Twinkle rollback',
				helptip: 'Virker kun hvis det relevante felt er markeret nedenfor.',
				type: 'boolean'
			},

			// TwinkleConfig.openTalkPage (array)
			// What types of actions that should result in opening of talk page
			{
				name: 'openTalkPage',
				label: 'Åbn brugerdiskussionsside efter disse typer tilbagerulninger',
				type: 'set',
				setValues: { agf: 'AGF-rollback', norm: 'Normal rollback', vand: 'Hærværks-rollback' }
			},

			// TwinkleConfig.openTalkPageOnAutoRevert (bool)
			// Defines if talk page should be opened when calling revert from contribs or recent changes pages. If set to true, openTalkPage defines then if talk page will be opened.
			{
				name: 'openTalkPageOnAutoRevert',
				label: 'Åbn brugerdiskussionsside ved rollback fra brugerbidrag eller seneste ændringer',
				helptip: 'Når dette er aktiveret, skal de ønskede muligheder være aktiveret i den forrige indstilling for at det virker.',
				type: 'boolean'
			},

			// TwinkleConfig.rollbackInPlace (bool)
			//
			{
				name: 'rollbackInPlace',
				label: 'Genindlæs ikke siden ved rollback fra bidrag eller seneste ændringer',
				helptip: 'Når dette er aktiveret, genindlæser Twinkle ikke bidragene eller seneste ændringer efter tilbagerulning, hvilket giver mulighed for at tilbagerulle mere end en redigering ad gangen.',
				type: 'boolean'
			},

			// TwinkleConfig.markRevertedPagesAsMinor (array)
			// What types of actions that should result in marking edit as minor
			{
				name: 'markRevertedPagesAsMinor',
				label: 'Markér som mindre redigering for disse typer tilbagerulninger',
				type: 'set',
				setValues: { agf: 'AGF-rollback', norm: 'Normal rollback', vand: 'Hærværks-rollback', torev: '"Gendan denne version"' }
			},

			// TwinkleConfig.watchRevertedPages (array)
			// What types of actions that should result in forced addition to watchlist
			{
				name: 'watchRevertedPages',
				label: 'Tilføj sider til overvågningsliste for disse typer tilbagerulninger',
				type: 'set',
				setValues: { agf: 'AGF-rollback', norm: 'Normal rollback', vand: 'Hærværks-rollback', torev: '"Gendan denne version"' }
			},
			// TwinkleConfig.watchRevertedExpiry
			// If any of the above items are selected, whether to expire the watch
			{
				name: 'watchRevertedExpiry',
				label: 'Når en side tilbagestilles, hvor længe skal den overvåges',
				type: 'enum',
				enumValues: Twinkle.config.watchlistEnums
			},

			// TwinkleConfig.offerReasonOnNormalRevert (boolean)
			// If to offer a prompt for extra summary reason for normal reverts, default to true
			{
				name: 'offerReasonOnNormalRevert',
				label: 'Bed om begrundelse for normale rollbacks',
				helptip: '"Normale" rollbacks er dem der aktiveres fra det midterste [rollback]-link.',
				type: 'boolean'
			},

			{
				name: 'confirmOnRollback',
				label: 'Kræv bekræftelse inden tilbagerulning (alle enheder)',
				helptip: 'For brugere af pen- eller berøringsenheder, og kronisk ubeslutsomme mennesker.',
				type: 'boolean'
			},

			{
				name: 'confirmOnMobileRollback',
				label: 'Kræv bekræftelse inden tilbagerulning (kun mobilenheder)',
				helptip: 'Undgå utilsigtede tilbagerulninger på mobilenheder.',
				type: 'boolean'
			},

			// TwinkleConfig.showRollbackLinks (array)
			// Where Twinkle should show rollback links:
			// diff, others, mine, contribs, history, recent
			// Note from TTO: |contribs| seems to be equal to |others| + |mine|, i.e. redundant, so I left it out heres
			{
				name: 'showRollbackLinks',
				label: 'Vis rollback-links på disse sider',
				type: 'set',
				setValues: { diff: 'Diff-sider', others: 'Bidragssider for andre brugere', mine: 'Min bidragsside', recent: 'Seneste ændringer og relaterede ændringer', history: 'Historikksider' }
			}
		]
	},

	{
		title: 'Delt IP-mærkning',
		module: 'shared',
		preferences: [
			{
				name: 'markSharedIPAsMinor',
				label: 'Markér delt IP-mærkning som en mindre redigering',
				type: 'boolean'
			}
		]
	},

	{
		title: 'Hurtig sletning (CSD)',
		module: 'speedy',
		preferences: [
			{
				name: 'speedySelectionStyle',
				label: 'Hvornår skal siden mærkes/slettes',
				type: 'enum',
				enumValues: { buttonClick: 'Når jeg klikker "Send"', radioClick: 'Så snart jeg klikker på en mulighed' }
			},

			// TwinkleConfig.watchSpeedyPages (array)
			// Whether to add speedy tagged or deleted pages to watchlist
			{
				name: 'watchSpeedyPages',
				label: 'Tilføj side til overvågningsliste ved brug af disse kriterier',
				type: 'set',
				setValues: Twinkle.config.commonSets.csdCriteria,
				setDisplayOrder: Twinkle.config.commonSets.csdCriteriaDisplayOrder
			},
			// TwinkleConfig.watchSpeedyExpiry
			// If any of the above items are selected, whether to expire the watch
			{
				name: 'watchSpeedyExpiry',
				label: 'Når en side mærkes, hvor længe skal den overvåges',
				type: 'enum',
				enumValues: Twinkle.config.watchlistEnums
			},

			// TwinkleConfig.markSpeedyPagesAsPatrolled (boolean)
			// If, when applying speedy template to page, to mark the page as triaged/patrolled (if the page was reached from NewPages)
			{
				name: 'markSpeedyPagesAsPatrolled',
				label: 'Markér siden som patruljeret/gennemgået ved mærkning (hvis muligt)',
				helptip: 'Dette bør sandsynligvis ikke markeres, da det er imod konsensus om bedste praksis',
				type: 'boolean'
			},

			// TwinkleConfig.watchSpeedyUser (string)
			// The watchlist setting of the user talk page if they receive a notification.
			{
				name: 'watchSpeedyUser',
				label: 'Tilføj den oprindelige bidragsyders brugerdiskussionsside til overvågningsliste (ved underretning)',
				type: 'enum',
				enumValues: Twinkle.config.watchlistEnums
			},

			// TwinkleConfig.welcomeUserOnSpeedyDeletionNotification (array of strings)
			// On what types of speedy deletion notifications shall the user be welcomed
			// with a "firstarticle" notice if their talk page has not yet been created.
			{
				name: 'welcomeUserOnSpeedyDeletionNotification',
				label: 'Byd sideophavsmanden velkommen ved underretning med disse kriterier',
				helptip: 'Velkomsten udsendes kun hvis brugeren underrettes om sletningen, og kun hvis deres diskussionsside endnu ikke eksisterer. Skabelonen der bruges er {{firstarticle}}.',
				type: 'set',
				setValues: Twinkle.config.commonSets.csdCriteriaNotification,
				setDisplayOrder: Twinkle.config.commonSets.csdCriteriaNotificationDisplayOrder
			},

			// TwinkleConfig.notifyUserOnSpeedyDeletionNomination (array)
			// What types of actions should result in the author of the page being notified of nomination
			{
				name: 'notifyUserOnSpeedyDeletionNomination',
				label: 'Underret sideophavsmandem ved mærkning med disse kriterier',
				helptip: 'Selvom du vælger at underrette fra CSD-skærmen, vil underretningen kun ske for de kriterier der er valgt her.',
				type: 'set',
				setValues: Twinkle.config.commonSets.csdCriteriaNotification,
				setDisplayOrder: Twinkle.config.commonSets.csdCriteriaNotificationDisplayOrder
			},

			// TwinkleConfig.warnUserOnSpeedyDelete (array)
			// What types of actions should result in the author of the page being notified of speedy deletion (admin only)
			{
				name: 'warnUserOnSpeedyDelete',
				label: 'Underret sideophavsmandem ved sletning under disse kriterier',
				helptip: 'Selvom du vælger at underrette fra CSD-skærmen, vil underretningen kun ske for de kriterier der er valgt her.',
				adminOnly: true,
				type: 'set',
				setValues: Twinkle.config.commonSets.csdCriteriaNotification,
				setDisplayOrder: Twinkle.config.commonSets.csdCriteriaNotificationDisplayOrder
			},

			// TwinkleConfig.promptForSpeedyDeletionSummary (array of strings)
			{
				name: 'promptForSpeedyDeletionSummary',
				label: 'Tillad redigering af sletningsbegrundelse ved sletning under disse kriterier',
				adminOnly: true,
				type: 'set',
				setValues: Twinkle.config.commonSets.csdAndImageDeletionCriteria,
				setDisplayOrder: Twinkle.config.commonSets.csdAndImageDeletionCriteriaDisplayOrder
			},

			// TwinkleConfig.deleteTalkPageOnDelete (boolean)
			// If talk page if exists should also be deleted (CSD G8) when spedying a page (admin only)
			{
				name: 'deleteTalkPageOnDelete',
				label: 'Markér "slet også diskussionssiden" som standard',
				adminOnly: true,
				type: 'boolean'
			},

			{
				name: 'deleteRedirectsOnDelete',
				label: 'Markér "slet også omdirigeringer" som standard',
				adminOnly: true,
				type: 'boolean'
			},

			// TwinkleConfig.deleteSysopDefaultToDelete (boolean)
			// Make the CSD screen default to "delete" instead of "tag" (admin only)
			{
				name: 'deleteSysopDefaultToDelete',
				label: 'Standard til direkte sletning i stedet for hurtig mærkning',
				helptip: 'Hvis der allerede er et CSD-mærke til stede, vil Twinkle altid standardisere til "slet"-tilstand',
				adminOnly: true,
				type: 'boolean'
			},

			// TwinkleConfig.speedyWindowWidth (integer)
			// Defines the width of the Twinkle SD window in pixels
			{
				name: 'speedyWindowWidth',
				label: 'Bredde af hurtig sletnings-vindue (pixels)',
				type: 'integer'
			},

			// TwinkleConfig.speedyWindowWidth (integer)
			// Defines the width of the Twinkle SD window in pixels
			{
				name: 'speedyWindowHeight',
				label: 'Højde af hurtig sletnings-vindue (pixels)',
				helptip: 'Hvis du har en stor skærm, kan du øge denne.',
				type: 'integer'
			},

			{
				name: 'logSpeedyNominations',
				label: 'Oprethold en log i brugerrummet over alle CSD-nomineringer',
				helptip: 'Da ikke-administratorer ikke har adgang til deres slettede bidrag, er brugerrumloggen en god måde at holde styr på alle sider du nominerer til CSD med Twinkle. Filer mærket med DI tilføjes også til denne log.',
				type: 'boolean'
			},
			{
				name: 'speedyLogPageName',
				label: 'Oprethold CSD-brugerrumloggen på denne brugerunderside',
				helptip: 'Skriv et undersidenavni dette felt. Du finder din CSD-log på Bruger:<i>brugernavn</i>/<i>undersidenavn</i>. Virker kun hvis du aktiverer CSD-brugerrumloggen.',
				type: 'string'
			},
			{
				name: 'noLogOnSpeedyNomination',
				label: 'Opret ikke en brugerrumlogpost ved mærkning med disse kriterier',
				type: 'set',
				setValues: Twinkle.config.commonSets.csdAndImageDeletionCriteria,
				setDisplayOrder: Twinkle.config.commonSets.csdAndImageDeletionCriteriaDisplayOrder
			}
		]
	},

	{
		title: 'Mærk',
		module: 'tag',
		preferences: [
			{
				name: 'watchTaggedVenues',
				label: 'Tilføj side til overvågningsliste ved mærkning af disse sidetyper',
				type: 'set',
				setValues: { articles: 'Artikler', drafts: 'Kladder', redirects: 'Omdirigeringer', files: 'Filer' }
			},
			{
				name: 'watchTaggedPages',
				label: 'Når en side mærkes, hvor længe skal den overvåges',
				type: 'enum',
				enumValues: Twinkle.config.watchlistEnums
			},
			{
				name: 'watchMergeDiscussions',
				label: 'Tilføj diskussionssider til overvågningsliste ved start af sammenlægningsdiskussioner',
				type: 'enum',
				enumValues: Twinkle.config.watchlistEnums
			},
			{
				name: 'markTaggedPagesAsMinor',
				label: 'Markér tilføjelse af mærker som en mindre redigering',
				type: 'boolean'
			},
			{
				name: 'markTaggedPagesAsPatrolled',
				label: 'Markér "markér side som patruljeret/gennemgået" som standard',
				type: 'boolean'
			},
			{
				name: 'groupByDefault',
				label: 'Markér "gruppér i {{multiple issues}}" som standard',
				type: 'boolean'
			},
			{
				name: 'tagArticleSortOrder',
				label: 'Standard visningsrækkefølge for artikelmærker',
				type: 'enum',
				enumValues: { cat: 'Efter kategorier', alpha: 'I alfabetisk rækkefølge' }
			},
			{
				name: 'customTagList',
				label: 'Tilpassede vedligeholdelsesmærker for artikler/kladder der skal vises',
				helptip: 'Disse vises som yderligere muligheder nederst på listen af mærker. Du kan for eksempel tilføje nye vedligeholdelsesmærker der endnu ikke er tilføjet til Twinkles standarder.',
				type: 'customList',
				customListValueTitle: 'Skabelonnavn (uden krøllede parenteser)',
				customListLabelTitle: 'Tekst der vises i Mærk-dialog'
			},
			{
				name: 'customFileTagList',
				label: 'Tilpassede vedligeholdelsesmærker for filer der skal vises',
				helptip: 'Yderligere mærker du ønsker at tilføje for filer.',
				type: 'customList',
				customListValueTitle: 'Skabelonnavn (uden krøllede parenteser)',
				customListLabelTitle: 'Tekst der vises i Mærk-dialog'
			},
			{
				name: 'customRedirectTagList',
				label: 'Tilpassede kategorimærker for omdirigeringer der skal vises',
				helptip: 'Yderligere mærker du ønsker at tilføje for omdirigeringer.',
				type: 'customList',
				customListValueTitle: 'Skabelonnavn (uden krøllede parenteser)',
				customListLabelTitle: 'Tekst der vises i Mærk-dialog'
			}
		]
	},

	{
		title: 'Talkback',
		module: 'talkback',
		preferences: [
			{
				name: 'markTalkbackAsMinor',
				label: 'Markér talkbacks som mindre redigeringer',
				type: 'boolean'
			},
			{
				name: 'insertTalkbackSignature',
				label: 'Indsæt signatur i talkbacks',
				type: 'boolean'
			},
			{
				name: 'talkbackHeading',
				label: 'Afsnitoverskrift til brug for talkback og "se venligst"',
				tooltip: 'Bør IKKE indeholde lighedstegnene ("==") brugt til wikitekstformatering',
				type: 'string'
			},
			{
				name: 'mailHeading',
				label: 'Afsnitoverskrift til brug for "du har post"-beskeder',
				tooltip: 'Bør IKKE indeholde lighedstegnene ("==") brugt til wikitekstformatering',
				type: 'string'
			}
		]
	},

	{
		title: 'Fjern links',
		module: 'unlink',
		preferences: [
			// TwinkleConfig.unlinkNamespaces (array)
			// In what namespaces unlink should happen, default in 0 (article), 10 (template), 100 (portal), and 118 (draft)
			{
				name: 'unlinkNamespaces',
				label: 'Fjern links fra sider i disse navnerum',
				helptip: 'Undgå at vælge diskussionsnavnerum, da Twinkle kan ende med at fjerne links fra diskussionsarkiver (meget uønsket).',
				type: 'set',
				setValues: Twinkle.config.commonSets.namespacesNoSpecial
			}
		]
	},

	{
		title: 'Advar bruger',
		module: 'warn',
		preferences: [
			// TwinkleConfig.defaultWarningGroup (int)
			// Which level warning should be the default selected group, default is 1
			{
				name: 'defaultWarningGroup',
				label: 'Standard advarselniveau',
				type: 'enum',
				enumValues: {
					1: 'Niveau 1',
					2: 'Niveau 2',
					3: 'Niveau 3',
					4: 'Niveau 4',
					5: 'Niveau 4im',
					6: 'Enkeltspørgsmål-notiser',
					7: 'Enkeltspørgsmål-advarsler',
					// 8 was used for block templates before #260
					9: 'Tilpassede advarsler',
					10: 'Alle advarsels-skabeloner',
					11: 'Vælg niveau automatisk (1-4)'
				}
			},

			// TwinkleConfig.combinedSingletMenus (boolean)
			// if true, show one menu with both single-issue notices and warnings instead of two separately
			{
				name: 'combinedSingletMenus',
				label: 'Erstat de to separate enkeltspørgsmål-menuer med én kombineret menu',
				helptip: 'At vælge enten enkeltspørgsmål-notiser eller enkeltspørgsmål-advarsler som standard vil gøre dette til din standard hvis aktiveret.',
				type: 'boolean'
			},

			// TwinkleConfig.watchWarnings (string)
			// Watchlist setting for the page which has been dispatched an warning or notice
			{
				name: 'watchWarnings',
				label: 'Tilføj brugerdiskussionsside til overvågningsliste ved underretning',
				type: 'enum',
				enumValues: Twinkle.config.watchlistEnums
			},

			// TwinkleConfig.oldSelect (boolean)
			// if true, use the native select menu rather the select2-based one
			{
				name: 'oldSelect',
				label: 'Brug den ikke-søgbare klassiske valgmenu',
				type: 'boolean'
			},

			{
				name: 'customWarningList',
				label: 'Tilpassede advarsels-skabeloner der skal vises',
				helptip: 'Du kan tilføje individuelle skabeloner eller brugerundersider. Tilpassede advarsler vises i kategorien "Tilpassede advarsler" i advarsels-dialogboksen.',
				type: 'customList',
				customListValueTitle: 'Skabelonnavn (uden krøllede parenteser)',
				customListLabelTitle: 'Tekst der vises i advarsels-listen (bruges også som redigeringsbegrundelse)'
			}
		]
	},

	{
		title: 'Byd bruger velkommen',
		module: 'welcome',
		preferences: [
			{
				name: 'topWelcomes',
				label: 'Placer velkomster over eksisterende indhold på brugerdiskussionssider',
				type: 'boolean'
			},
			{
				name: 'watchWelcomes',
				label: 'Tilføj brugerdiskussionssider til overvågningsliste ved velkomst',
				helptip: 'Det tilføjer et personligt element til velkomsten – du vil kunne se hvordan de klarer sig som nybegynder og muligvis hjælpe dem.',
				type: 'enum',
				enumValues: Twinkle.config.watchlistEnums
			},
			{
				name: 'insertUsername',
				label: 'Tilføj dit brugernavn til skabelonen (hvor det er relevant)',
				helptip: 'Nogle velkomstskabeloner har en indledende sætning som "Hej, jeg er &lt;brugernavn&gt;. Velkommen" osv. Hvis du slår denne mulighed fra, vil disse skabeloner ikke vise dit brugernavn på den måde.',
				type: 'boolean'
			},
			{
				name: 'quickWelcomeMode',
				label: 'At klikke på "velkomst"-linket på en diff-side (som kun vises hvis redaktørens brugerdiskussionsside endnu ikke er oprettet) vil',
				helptip: 'Hvis du vælger at byde velkommen automatisk, vil skabelonen du angiver nedenfor blive brugt.',
				type: 'enum',
				enumValues: { auto: 'straks sende velkomstskabelonen angivet nedenfor', norm: 'bede dig om at vælge en skabelon' }
			},
			{
				name: 'quickWelcomeTemplate',
				label: 'Skabelon der bruges ved automatisk velkomst',
				helptip: 'Skriv navnet på en velkomstskabelon uden krøllede parenteser. Et link til den givne artikel vil blive tilføjet.',
				type: 'string'
			},
			{
				name: 'customWelcomeList',
				label: 'Tilpassede velkomstskabeloner der skal vises',
				helptip: 'Du kan tilføje andre velkomstskabeloner eller brugerundersider der er velkomstskabeloner (med præfikset "Bruger:"). Glem ikke at disse skabeloner substitueres på brugerdiskussionssider.',
				type: 'customList',
				customListValueTitle: 'Skabelonnavn (uden krøllede parenteser)',
				customListLabelTitle: 'Tekst der vises i Velkomst-dialog'
			},
			{
				name: 'customWelcomeSignature',
				label: 'Underskriv automatisk tilpassede velkomstskabeloner',
				helptip: 'Hvis dine tilpassede velkomstskabeloner indeholder en indbygget signatur i skabelonen, slå da denne mulighed fra.',
				type: 'boolean'
			}
		]
	},

	{
		title: 'XFD (slettediskussioner)',
		module: 'xfd',
		preferences: [
			{
				name: 'logXfdNominations',
				label: 'Oprethold en log i brugerrummet over alle sider du nominerer til en slettediskussion (XfD)',
				helptip: 'Brugerrumloggen er en god måde at holde styr på alle sider du nominerer til XfD med Twinkle.',
				type: 'boolean'
			},
			{
				name: 'xfdLogPageName',
				label: 'Oprethold slettediskussionens brugerrumlog på denne brugerunderside',
				helptip: 'Skriv et undersidenavni dette felt. Du finder din XfD-log på Bruger:<i>brugernavn</i>/<i>undersidenavn</i>. Virker kun hvis du aktiverer XfD-brugerrumloggen.',
				type: 'string'
			},
			{
				name: 'noLogOnXfdNomination',
				label: 'Opret ikke en brugerrumlogpost ved nominering på dette sted',
				type: 'set',
				setValues: { afd: 'AfD', tfd: 'TfD', ffd: 'FfD', cfd: 'CfD', cfds: 'CfD/S', mfd: 'MfD', rfd: 'RfD', rm: 'RM' }
			},

			// TwinkleConfig.xfdWatchPage (string)
			// The watchlist setting of the page being nominated for XfD.
			{
				name: 'xfdWatchPage',
				label: 'Tilføj den nominerede side til overvågningsliste',
				type: 'enum',
				enumValues: Twinkle.config.watchlistEnums
			},

			// TwinkleConfig.xfdWatchDiscussion (string)
			// The watchlist setting of the newly created XfD page (for those processes that create discussion pages for each nomination),
			// or the list page for the other processes.
			{
				name: 'xfdWatchDiscussion',
				label: 'Tilføj slettediskussionssiden til overvågningsliste',
				helptip: 'Dette refererer til diskussionsundersiden (for AfD og MfD) eller den daglige logside (for TfD, CfD, RfD og FfD)',
				type: 'enum',
				enumValues: Twinkle.config.watchlistEnums
			},

			// TwinkleConfig.xfdWatchList (string)
			// The watchlist setting of the XfD list page, *if* the discussion is on a separate page.
			{
				name: 'xfdWatchList',
				label: 'Tilføj den daglige log-/listeside til overvågningsliste (AfD og MfD)',
				helptip: 'Dette gælder kun for AfD og MfD, hvor diskussionerne transskluderes til en daglig logside (for AfD) eller MfD-hovedsiden (for MfD).',
				type: 'enum',
				enumValues: Twinkle.config.watchlistEnums
			},

			// TwinkleConfig.xfdWatchUser (string)
			// The watchlist setting of the user talk page if they receive a notification.
			{
				name: 'xfdWatchUser',
				label: 'Tilføj den oprindelige bidragsyders brugerdiskussionsside til overvågningsliste (ved underretning)',
				type: 'enum',
				enumValues: Twinkle.config.watchlistEnums
			},

			// TwinkleConfig.xfdWatchRelated (string)
			// The watchlist setting of the target of a redirect being nominated for RfD.
			{
				name: 'xfdWatchRelated',
				label: 'Tilføj omdirigeringens målside til overvågningsliste (ved underretning)',
				helptip: 'Dette gælder kun for RfD, ved efterladelse af en underretning på diskussionssiden for omdirigeringens mål',
				type: 'enum',
				enumValues: Twinkle.config.watchlistEnums
			},

			{
				name: 'markXfdPagesAsPatrolled',
				label: 'Markér siden som patruljeret/gennemgået ved nominering til AFD (hvis muligt)',
				type: 'boolean'
			}
		]
	},

	{
		title: 'Skjult',
		hidden: true,
		preferences: [
			// twinklerollback.js: defines how many revision to query maximum, maximum possible is 50, default is 50
			{
				name: 'revertMaxRevisions',
				type: 'integer'
			},
			// twinklewarn.js: When using the autolevel select option, how many days makes a prior warning stale
			// Huggle is three days ([[Special:Diff/918980316]] and [[Special:Diff/919417999]]) while ClueBotNG is two:
			// https://github.com/DamianZaremba/cluebotng/blob/4958e25d6874cba01c75f11debd2e511fd5a2ce5/bot/action_functions.php#L62
			{
				name: 'autolevelStaleDays',
				type: 'integer'
			},
			// How many pages should be queried by deprod and batchdelete/protect/undelete
			{
				name: 'batchMax',
				type: 'integer',
				adminOnly: true
			},
			// How many pages should be processed at a time by deprod and batchdelete/protect/undelete
			{
				name: 'batchChunks',
				type: 'integer',
				adminOnly: true
			}
		]
	}

]; // end of Twinkle.config.sections

Twinkle.config.init = function twinkleconfigInit() {

	// create the config page at Wikipedia:Twinkle/Preferences
	if ((mw.config.get('wgNamespaceNumber') === mw.config.get('wgNamespaceIds').project && mw.config.get('wgTitle') === 'Twinkle/Preferences') &&
			mw.config.get('wgAction') === 'view') {

		if (!document.getElementById('twinkle-config')) {
			return; // maybe the page is misconfigured, or something - but any attempt to modify it will be pointless
		}

		// set style to nothing to prevent conflict with external css
		document.getElementById('twinkle-config').removeAttribute('style');
		document.getElementById('twinkle-config-titlebar').removeAttribute('style');

		const contentdiv = document.getElementById('twinkle-config-content');
		contentdiv.textContent = ''; // clear children

		// let user know about possible conflict with skin js/common.js file
		// (settings in that file will still work, but they will be overwritten by twinkleoptions.js settings)
		if (window.TwinkleConfig || window.FriendlyConfig) {
			const contentnotice = document.createElement('p');
			contentnotice.innerHTML = '<table class="plainlinks morebits-ombox morebits-ombox-content"><tr><td class="morebits-mbox-image">' +
				'<img alt="" src="https://upload.wikimedia.org/wikipedia/commons/3/38/Imbox_content.png" /></td>' +
				'<td class="morebits-mbox-text"><p><big><b>Inden du ændrer dine indstillinger her,</b> skal du fjerne dine gamle Twinkle- og Friendly-indstillinger fra din personlige skin-JavaScript.</big></p>' +
				'<p>For at gøre dette kan du <a href="' + mw.util.getUrl('User:' + mw.config.get('wgUserName') + '/' + mw.config.get('skin') +
				'.js', { action: 'edit' }) + '" target="_blank"><b>redigere din personlige skin-JavaScript-fil</b></a> eller <a href="' +
				mw.util.getUrl('User:' + mw.config.get('wgUserName') + '/common.js', { action: 'edit'}) + '" target="_blank"><b>din common.js-fil</b></a>, og fjerne alle kodelinjer der refererer til <code>TwinkleConfig</code> og <code>FriendlyConfig</code>.</p>' +
				'</td></tr></table>';
			contentdiv.appendChild(contentnotice);
		}

		// start a table of contents
		const toctable = document.createElement('div');
		toctable.className = 'toc';
		toctable.style.marginLeft = '0.4em';
		// create TOC title
		const toctitle = document.createElement('div');
		toctitle.id = 'toctitle';
		const toch2 = document.createElement('h2');
		toch2.textContent = 'Indhold ';
		toctitle.appendChild(toch2);
		// add TOC show/hide link
		const toctoggle = document.createElement('span');
		toctoggle.className = 'toctoggle';
		toctoggle.appendChild(document.createTextNode('['));
		const toctogglelink = document.createElement('a');
		toctogglelink.className = 'internal';
		toctogglelink.setAttribute('href', '#tw-tocshowhide');
		toctogglelink.textContent = 'skjul';
		toctoggle.appendChild(toctogglelink);
		toctoggle.appendChild(document.createTextNode(']'));
		toctitle.appendChild(toctoggle);
		toctable.appendChild(toctitle);
		// create item container: this is what we add stuff to
		const tocul = document.createElement('ul');
		toctogglelink.addEventListener('click', () => {
			const $tocul = $(tocul);
			$tocul.toggle();
			if ($tocul.find(':visible').length) {
				toctogglelink.textContent = 'skjul';
			} else {
				toctogglelink.textContent = 'vis';
			}
		}, false);
		toctable.appendChild(tocul);
		contentdiv.appendChild(toctable);

		const contentform = document.createElement('form');
		contentform.setAttribute('action', 'javascript:void(0)'); // was #tw-save - changed to void(0) to work around Chrome issue
		contentform.addEventListener('submit', Twinkle.config.save, true);
		contentdiv.appendChild(contentform);

		const container = document.createElement('table');
		container.style.width = '100%';
		contentform.appendChild(container);

		$(Twinkle.config.sections).each((sectionkey, section) => {
			if (section.hidden || (section.adminOnly && !Morebits.userIsSysop)) {
				return true; // i.e. "continue" in this context
			}

			// add to TOC
			const tocli = document.createElement('li');
			tocli.className = 'toclevel-1';
			const toca = document.createElement('a');
			toca.setAttribute('href', '#' + section.module);
			toca.appendChild(document.createTextNode(section.title));
			tocli.appendChild(toca);
			tocul.appendChild(tocli);

			let row = document.createElement('tr');
			let cell = document.createElement('td');
			cell.setAttribute('colspan', '3');
			const heading = document.createElement('h4');
			heading.style.borderBottom = '1px solid gray';
			heading.style.marginTop = '0.2em';
			heading.id = section.module;
			heading.appendChild(document.createTextNode(section.title));
			cell.appendChild(heading);
			row.appendChild(cell);
			container.appendChild(row);

			let rowcount = 1; // for row banding

			// add each of the preferences to the form
			$(section.preferences).each((prefkey, pref) => {
				if (pref.adminOnly && !Morebits.userIsSysop) {
					return true; // i.e. "continue" in this context
				}

				row = document.createElement('tr');
				row.style.marginBottom = '0.2em';
				// create odd row banding
				if (rowcount++ % 2 === 0) {
					row.style.backgroundColor = 'rgba(128, 128, 128, 0.1)';
				}
				cell = document.createElement('td');

				let label, input;
				const gotPref = Twinkle.getPref(pref.name);
				switch (pref.type) {

					case 'boolean': // create a checkbox
						cell.setAttribute('colspan', '2');

						label = document.createElement('label');
						input = document.createElement('input');
						input.setAttribute('type', 'checkbox');
						input.setAttribute('id', pref.name);
						input.setAttribute('name', pref.name);
						if (gotPref === true) {
							input.setAttribute('checked', 'checked');
						}
						label.appendChild(input);
						label.appendChild(document.createTextNode(pref.label));
						cell.appendChild(label);
						break;

					case 'string': // create an input box
					case 'integer':
						// add label to first column
						cell.style.textAlign = 'right';
						cell.style.paddingRight = '0.5em';
						label = document.createElement('label');
						label.setAttribute('for', pref.name);
						label.appendChild(document.createTextNode(pref.label + ':'));
						cell.appendChild(label);
						row.appendChild(cell);

						// add input box to second column
						cell = document.createElement('td');
						cell.style.paddingRight = '1em';
						input = document.createElement('input');
						input.setAttribute('type', 'text');
						input.setAttribute('id', pref.name);
						input.setAttribute('name', pref.name);
						if (pref.type === 'integer') {
							input.setAttribute('size', 6);
							input.setAttribute('type', 'number');
							input.setAttribute('step', '1'); // integers only
						}
						if (gotPref) {
							input.setAttribute('value', gotPref);
						}
						cell.appendChild(input);
						break;

					case 'enum': // create a combo box
						// add label to first column
						// note: duplicates the code above, under string/integer
						cell.style.textAlign = 'right';
						cell.style.paddingRight = '0.5em';
						label = document.createElement('label');
						label.setAttribute('for', pref.name);
						label.appendChild(document.createTextNode(pref.label + ':'));
						cell.appendChild(label);
						row.appendChild(cell);

						// add input box to second column
						cell = document.createElement('td');
						cell.style.paddingRight = '1em';
						input = document.createElement('select');
						input.setAttribute('id', pref.name);
						input.setAttribute('name', pref.name);
						$.each(pref.enumValues, (enumvalue, enumdisplay) => {
							const option = document.createElement('option');
							option.setAttribute('value', enumvalue);
							if ((gotPref === enumvalue) ||
								// Hack to convert old boolean watchlist prefs
								// to corresponding enums (added in v2.1)
								(typeof gotPref === 'boolean' &&
								((gotPref && enumvalue === 'yes') ||
								(!gotPref && enumvalue === 'no')))) {
								option.setAttribute('selected', 'selected');
							}
							option.appendChild(document.createTextNode(enumdisplay));
							input.appendChild(option);
						});
						cell.appendChild(input);
						break;

					case 'set': // create a set of check boxes
						// add label first of all
						cell.setAttribute('colspan', '2');
						label = document.createElement('label'); // not really necessary to use a label element here, but we do it for consistency of styling
						label.appendChild(document.createTextNode(pref.label + ':'));
						cell.appendChild(label);

						var checkdiv = document.createElement('div');
						checkdiv.style.paddingLeft = '1em';
						var worker = function(itemkey, itemvalue) {
							const checklabel = document.createElement('label');
							checklabel.style.marginRight = '0.7em';
							checklabel.style.display = 'inline-block';
							const check = document.createElement('input');
							check.setAttribute('type', 'checkbox');
							check.setAttribute('id', pref.name + '_' + itemkey);
							check.setAttribute('name', pref.name + '_' + itemkey);
							if (gotPref && gotPref.includes(itemkey)) {
								check.setAttribute('checked', 'checked');
							}
							// cater for legacy integer array values for unlinkNamespaces (this can be removed a few years down the track...)
							if (pref.name === 'unlinkNamespaces') {
								if (gotPref && gotPref.includes(parseInt(itemkey, 10))) {
									check.setAttribute('checked', 'checked');
								}
							}
							checklabel.appendChild(check);
							checklabel.appendChild(document.createTextNode(itemvalue));
							checkdiv.appendChild(checklabel);
						};
						if (pref.setDisplayOrder) {
							// add check boxes according to the given display order
							$.each(pref.setDisplayOrder, (itemkey, item) => {
								worker(item, pref.setValues[item]);
							});
						} else {
							// add check boxes according to the order it gets fed to us (probably strict alphabetical)
							$.each(pref.setValues, worker);
						}
						cell.appendChild(checkdiv);
						break;

					case 'customList':
						// add label to first column
						cell.style.textAlign = 'right';
						cell.style.paddingRight = '0.5em';
						label = document.createElement('label');
						label.setAttribute('for', pref.name);
						label.appendChild(document.createTextNode(pref.label + ':'));
						cell.appendChild(label);
						row.appendChild(cell);

						// add button to second column
						cell = document.createElement('td');
						cell.style.paddingRight = '1em';
						var button = document.createElement('button');
						button.setAttribute('id', pref.name);
						button.setAttribute('name', pref.name);
						button.setAttribute('type', 'button');
						button.addEventListener('click', Twinkle.config.listDialog.display, false);
						// use jQuery data on the button to store the current config value
						$(button).data({
							value: gotPref,
							pref: pref
						});
						button.appendChild(document.createTextNode('Rediger elementer'));
						cell.appendChild(button);
						break;

					default:
						alert('twinkleconfig: unknown data type for preference ' + pref.name);
						break;
				}
				row.appendChild(cell);

				// add help tip
				cell = document.createElement('td');
				cell.className = 'twinkle-config-helptip';

				if (pref.helptip) {
					// convert mentions of templates in the helptip to clickable links
					cell.innerHTML = pref.helptip.replace(/{{(.+?)}}/g,
						'{{<a href="' + mw.util.getUrl('Template:') + '$1" target="_blank">$1</a>}}');
				}
				// add reset link (custom lists don't need this, as their config value isn't displayed on the form)
				if (pref.type !== 'customList') {
					const resetlink = document.createElement('a');
					resetlink.setAttribute('href', '#tw-reset');
					resetlink.setAttribute('id', 'twinkle-config-reset-' + pref.name);
					resetlink.addEventListener('click', Twinkle.config.resetPrefLink, false);
					resetlink.style.cssFloat = 'right';
					resetlink.style.margin = '0 0.6em';
					resetlink.appendChild(document.createTextNode('Nulstil'));
					cell.appendChild(resetlink);
				}
				row.appendChild(cell);

				container.appendChild(row);
				return true;
			});
			return true;
		});

		const footerbox = document.createElement('div');
		footerbox.setAttribute('id', 'twinkle-config-buttonpane');
		const button = document.createElement('button');
		button.setAttribute('id', 'twinkle-config-submit');
		button.setAttribute('type', 'submit');
		button.appendChild(document.createTextNode('Gem ændringer'));
		footerbox.appendChild(button);
		const footerspan = document.createElement('span');
		footerspan.className = 'plainlinks';
		footerspan.style.marginLeft = '2.4em';
		footerspan.style.fontSize = '90%';
		const footera = document.createElement('a');
		footera.setAttribute('href', '#tw-reset-all');
		footera.setAttribute('id', 'twinkle-config-resetall');
		footera.addEventListener('click', Twinkle.config.resetAllPrefs, false);
		footera.appendChild(document.createTextNode('Gendan standarder'));
		footerspan.appendChild(footera);
		footerbox.appendChild(footerspan);
		contentform.appendChild(footerbox);

		// since all the section headers exist now, we can try going to the requested anchor
		if (window.location.hash) {
			const loc = window.location.hash;
			window.location.hash = '';
			window.location.hash = loc;
		}

	} else if (mw.config.get('wgNamespaceNumber') === mw.config.get('wgNamespaceIds').user &&
			mw.config.get('wgTitle').indexOf(mw.config.get('wgUserName')) === 0 &&
			mw.config.get('wgPageName').slice(-3) === '.js') {

		const box = document.createElement('div');
		// Styled in twinkle.css
		box.setAttribute('id', 'twinkle-config-headerbox');

		let link;
		const scriptPageName = mw.config.get('wgPageName').slice(
			mw.config.get('wgPageName').lastIndexOf('/') + 1,
			mw.config.get('wgPageName').lastIndexOf('.js')
		);

		if (scriptPageName === 'twinkleoptions') {
			// place "why not try the preference panel" notice
			box.setAttribute('class', 'config-twopt-box');

			if (mw.config.get('wgArticleId') > 0) { // page exists
				box.appendChild(document.createTextNode('Denne side indeholder dine Twinkle-præferencer. Du kan ændre dem via '));
			} else { // page does not exist
				box.appendChild(document.createTextNode('Du kan tilpasse Twinkle til dine præferencer ved hjælp af '));
			}
			link = document.createElement('a');
			link.setAttribute('href', mw.util.getUrl(mw.config.get('wgFormattedNamespaces')[mw.config.get('wgNamespaceIds').project] + ':Twinkle/Preferences'));
			link.appendChild(document.createTextNode('Twinkle-konfigurationspanelet'));
			box.appendChild(link);
			box.appendChild(document.createTextNode(', eller ved at redigere denne side.'));
			$(box).insertAfter($('#contentSub'));

		} else if (['monobook', 'vector', 'vector-2022', 'cologneblue', 'modern', 'timeless', 'minerva', 'common'].includes(scriptPageName)) {
			// place "Looking for Twinkle options?" notice
			box.setAttribute('class', 'config-userskin-box');

			box.appendChild(document.createTextNode('Hvis du vil indstille Twinkle-præferencer, kan du bruge '));
			link = document.createElement('a');
			link.setAttribute('href', mw.util.getUrl(mw.config.get('wgFormattedNamespaces')[mw.config.get('wgNamespaceIds').project] + ':Twinkle/Preferences'));
			link.appendChild(document.createTextNode('Twinkle-konfigurationspanelet'));
			box.appendChild(link);
			box.appendChild(document.createTextNode('.'));
			$(box).insertAfter($('#contentSub'));
		}
	}
};

// custom list-related stuff

Twinkle.config.listDialog = {};

Twinkle.config.listDialog.addRow = function twinkleconfigListDialogAddRow($dlgtable, value, label) {
	let $contenttr, $valueInput, $labelInput;

	$dlgtable.append(
		$contenttr = $('<tr>').append(
			$('<td>').append(
				$('<button>')
					.attr('type', 'button')
					.on('click', () => {
						$contenttr.remove();
					})
					.text('Fjern')
			),
			$('<td>').append(
				$valueInput = $('<input>')
					.attr('type', 'text')
					.addClass('twinkle-config-customlist-value')
					.css('width', '97%')
			),
			$('<td>').append(
				$labelInput = $('<input>')
					.attr('type', 'text')
					.addClass('twinkle-config-customlist-label')
					.css('width', '98%')
			)
		)
	);

	if (value) {
		$valueInput.val(value);
	}
	if (label) {
		$labelInput.val(label);
	}

};

Twinkle.config.listDialog.display = function twinkleconfigListDialogDisplay(e) {
	const $prefbutton = $(e.target);
	const curvalue = $prefbutton.data('value');
	const curpref = $prefbutton.data('pref');

	const dialog = new Morebits.SimpleWindow(720, 400);
	dialog.setTitle(curpref.label);
	dialog.setScriptName('Twinkle-præferencer');

	let $dlgtbody;

	dialog.setContent(
		$('<div>').append(
			$('<table>')
				.addClass('wikitable')
				.css({
					margin: '1.4em 1em',
					width: 'auto'
				})
				.append(
					$dlgtbody = $('<tbody>').append(
						// header row
						$('<tr>').append(
							$('<th>') // top-left cell
								.css('width', '5%'),
							$('<th>') // value column header
								.css('width', '35%')
								.text(curpref.customListValueTitle ? curpref.customListValueTitle : 'Værdi'),
							$('<th>') // label column header
								.css('width', '60%')
								.text(curpref.customListLabelTitle ? curpref.customListLabelTitle : 'Etiket')
						)
					),
					$('<tfoot>').append(
						$('<tr>').append(
							$('<td>')
								.attr('colspan', '3')
								.append(
									$('<button>')
										.text('Tilføj')
										.css('min-width', '8em')
										.attr('type', 'button')
										.on('click', () => {
											Twinkle.config.listDialog.addRow($dlgtbody);
										})
								)
						)
					)
				),
			$('<button>')
				.text('Gem ændringer')
				.attr('type', 'submit') // so Morebits.SimpleWindow puts the button in the button pane
				.on('click', () => {
					Twinkle.config.listDialog.save($prefbutton, $dlgtbody);
					dialog.close();
				}),
			$('<button>')
				.text('Nulstil')
				.attr('type', 'submit')
				.on('click', () => {
					Twinkle.config.listDialog.reset($prefbutton, $dlgtbody);
				}),
			$('<button>')
				.text('Annuller')
				.attr('type', 'submit')
				.on('click', () => {
					dialog.close();
				})
		)[0]
	);

	// content rows
	let gotRow = false;
	$.each(curvalue, (k, v) => {
		gotRow = true;
		Twinkle.config.listDialog.addRow($dlgtbody, v.value, v.label);
	});
	// if there are no values present, add a blank row to start the user off
	if (!gotRow) {
		Twinkle.config.listDialog.addRow($dlgtbody);
	}

	dialog.display();
};

// Resets the data value, re-populates based on the new (default) value, then saves the
// old data value again (less surprising behaviour)
Twinkle.config.listDialog.reset = function twinkleconfigListDialogReset($button, $tbody) {
	// reset value on button
	const curpref = $button.data('pref');
	const oldvalue = $button.data('value');
	Twinkle.config.resetPref(curpref);

	// reset form
	$tbody.find('tr').slice(1).remove(); // all rows except the first (header) row
	// add the new values
	const curvalue = $button.data('value');
	$.each(curvalue, (k, v) => {
		Twinkle.config.listDialog.addRow($tbody, v.value, v.label);
	});

	// save the old value
	$button.data('value', oldvalue);
};

Twinkle.config.listDialog.save = function twinkleconfigListDialogSave($button, $tbody) {
	const result = [];
	let current = {};
	$tbody.find('input[type="text"]').each((inputkey, input) => {
		if ($(input).hasClass('twinkle-config-customlist-value')) {
			current = { value: input.value };
		} else {
			current.label = input.value;
			// exclude totally empty rows
			if (current.value || current.label) {
				result.push(current);
			}
		}
	});
	$button.data('value', result);
};

// reset/restore defaults

Twinkle.config.resetPrefLink = function twinkleconfigResetPrefLink(e) {
	const wantedpref = e.target.id.slice(21); // "twinkle-config-reset-" prefix is stripped

	// search tactics
	$(Twinkle.config.sections).each((sectionkey, section) => {
		if (section.hidden || (section.adminOnly && !Morebits.userIsSysop)) {
			return true; // continue: skip impossibilities
		}

		let foundit = false;

		$(section.preferences).each((prefkey, pref) => {
			if (pref.name !== wantedpref) {
				return true; // continue
			}
			Twinkle.config.resetPref(pref);
			foundit = true;
			return false; // break
		});

		if (foundit) {
			return false; // break
		}
	});
	return false; // stop link from scrolling page
};

Twinkle.config.resetPref = function twinkleconfigResetPref(pref) {
	switch (pref.type) {

		case 'boolean':
			document.getElementById(pref.name).checked = Twinkle.defaultConfig[pref.name];
			break;

		case 'string':
		case 'integer':
		case 'enum':
			document.getElementById(pref.name).value = Twinkle.defaultConfig[pref.name];
			break;

		case 'set':
			$.each(pref.setValues, (itemkey) => {
				if (document.getElementById(pref.name + '_' + itemkey)) {
					document.getElementById(pref.name + '_' + itemkey).checked = Twinkle.defaultConfig[pref.name].includes(itemkey);
				}
			});
			break;

		case 'customList':
			$(document.getElementById(pref.name)).data('value', Twinkle.defaultConfig[pref.name]);
			break;

		default:
			alert('twinkleconfig: unknown data type for preference ' + pref.name);
			break;
	}
};

Twinkle.config.resetAllPrefs = function twinkleconfigResetAllPrefs() {
	// no confirmation message - the user can just refresh/close the page to abort
	$(Twinkle.config.sections).each((sectionkey, section) => {
		if (section.hidden || (section.adminOnly && !Morebits.userIsSysop)) {
			return true; // continue: skip impossibilities
		}
		$(section.preferences).each((prefkey, pref) => {
			if (!pref.adminOnly || Morebits.userIsSysop) {
				Twinkle.config.resetPref(pref);
			}
		});
		return true;
	});
	return false; // stop link from scrolling page
};

Twinkle.config.save = function twinkleconfigSave(e) {
	Morebits.Status.init(document.getElementById('twinkle-config-content'));

	const userjs = mw.config.get('wgFormattedNamespaces')[mw.config.get('wgNamespaceIds').user] + ':' + mw.config.get('wgUserName') + '/twinkleoptions.js';
	const wikipediaPage = new Morebits.wiki.Page(userjs, 'Gemmer præferencer til ' + userjs);
	wikipediaPage.setCallbackParameters(e.target);
	wikipediaPage.load(Twinkle.config.writePrefs);

	return false;
};

Twinkle.config.writePrefs = function twinkleconfigWritePrefs(pageobj) {
	const form = pageobj.getCallbackParameters();

	// this is the object which gets serialized into JSON; only
	// preferences that this script knows about are kept
	const newConfig = {optionsVersion: 2.1};

	// a comparison function is needed later on
	// it is just enough for our purposes (i.e. comparing strings, numbers, booleans,
	// arrays of strings, and arrays of { value, label })
	// and it is not very robust: e.g. compare([2], ["2"]) === true, and
	// compare({}, {}) === false, but it's good enough for our purposes here
	const compare = function(a, b) {
		if (Array.isArray(a)) {
			if (a.length !== b.length) {
				return false;
			}
			const asort = a.sort(), bsort = b.sort();
			for (let i = 0; asort[i]; ++i) {
				// comparison of the two properties of custom lists
				if ((typeof asort[i] === 'object') && (asort[i].label !== bsort[i].label ||
					asort[i].value !== bsort[i].value)) {
					return false;
				} else if (asort[i].toString() !== bsort[i].toString()) {
					return false;
				}
			}
			return true;
		}
		return a === b;

	};

	$(Twinkle.config.sections).each((sectionkey, section) => {
		if (section.adminOnly && !Morebits.userIsSysop) {
			return; // i.e. "continue" in this context
		}

		// reach each of the preferences from the form
		$(section.preferences).each((prefkey, pref) => {
			let userValue; // = undefined

			// only read form values for those prefs that have them
			if (!pref.adminOnly || Morebits.userIsSysop) {
				if (!section.hidden) {
					switch (pref.type) {
						case 'boolean': // read from the checkbox
							userValue = form[pref.name].checked;
							break;

						case 'string': // read from the input box or combo box
						case 'enum':
							userValue = form[pref.name].value;
							break;

						case 'integer': // read from the input box
							userValue = parseInt(form[pref.name].value, 10);
							if (isNaN(userValue)) {
								Morebits.Status.warn('Gemmer', 'Værdien du angav for ' + pref.name + ' (' + pref.value + ') var ugyldig. Gemning fortsætter, men den ugyldige dataværdi springes over.');
								userValue = null;
							}
							break;

						case 'set': // read from the set of check boxes
							userValue = [];
							if (pref.setDisplayOrder) {
							// read only those keys specified in the display order
								$.each(pref.setDisplayOrder, (itemkey, item) => {
									if (form[pref.name + '_' + item].checked) {
										userValue.push(item);
									}
								});
							} else {
							// read all the keys in the list of values
								$.each(pref.setValues, (itemkey) => {
									if (form[pref.name + '_' + itemkey].checked) {
										userValue.push(itemkey);
									}
								});
							}
							break;

						case 'customList': // read from the jQuery data stored on the button object
							userValue = $(form[pref.name]).data('value');
							break;

						default:
							alert('twinkleconfig: unknown data type for preference ' + pref.name);
							break;
					}
				} else if (Twinkle.prefs) {
					// Retain the hidden preferences that may have customised by the user from twinkleoptions.js
					// undefined if not set
					userValue = Twinkle.prefs[pref.name];
				}
			}

			// only save those preferences that are *different* from the default
			if (userValue !== undefined && !compare(userValue, Twinkle.defaultConfig[pref.name])) {
				newConfig[pref.name] = userValue;
			}
		});
	});

	let text =
		'// twinkleoptions.js: personlig Twinkle-præferencefil\n' +
		'//\n' +
		'// BEMÆRK: Den nemmeste måde at ændre dine Twinkle-præferencer er ved at bruge\n' +
		'// Twinkle-konfigurationspanelet, på [[' + Morebits.pageNameNorm + ']].\n' +
		'//\n' +
		'// Denne fil er AUTOMATISK GENERERET. Eventuelle ændringer du foretager (bortset fra\n' +
		'// ændring af konfigurationsparametrene på en gyldig JavaScript-måde) vil blive\n' +
		'// overskrevet næste gang du klikker "Gem" i Twinkle-konfigurationspanelet.\n' +
		'// Hvis du ændrer denne fil, skal du bruge korrekt JavaScript.\n' +
		// eslint-disable-next-line no-useless-concat
		'// <no' + 'wiki>\n' +
		'\n' +
		'window.Twinkle.prefs = ';
	text += JSON.stringify(newConfig, null, 2);
	text +=
		';\n' +
		'\n' +
		// eslint-disable-next-line no-useless-concat
		'// </no' + 'wiki>\n' +
		'// Slut på twinkleoptions.js\n';

	pageobj.setPageText(text);
	pageobj.setEditSummary('Gemmer Twinkle-præferencer: automatisk redigering fra [[:' + Morebits.pageNameNorm + ']]');
	pageobj.setChangeTags(Twinkle.changeTags);
	pageobj.setCreateOption('recreate');
	pageobj.save(Twinkle.config.saveSuccess);
};

Twinkle.config.saveSuccess = function twinkleconfigSaveSuccess(pageobj) {
	pageobj.getStatusElement().info('gennemført');

	const noticebox = document.createElement('div');
	noticebox.className = 'cdx-message cdx-message--success';
	noticebox.style.fontSize = '100%';
	noticebox.innerHTML = '<p><b>Dine Twinkle-præferencer er blevet gemt.</b> For at se ændringerne skal du rydde din browser-cache fuldstændigt (se <a href="' + mw.util.getUrl('WP:BYPASS') + '" title="WP:BYPASS">WP:BYPASS</a> for instruktioner).</p>';
	mw.loader.using('mediawiki.htmlform.codex.styles', () => {
		Morebits.Status.root.appendChild(noticebox);
	});
	const noticeclear = document.createElement('br');
	noticeclear.style.clear = 'both';
	Morebits.Status.root.appendChild(noticeclear);
};

Twinkle.addInitCallback(Twinkle.config.init);
}());

// </nowiki>
