// <nowiki>

(function() {

/*
 ****************************************
 *** twinklediff.js: Diff module
 ****************************************
 * Mode of invocation:     Tab on non-diff pages ("Last"); tabs on diff pages ("Since", "Since mine", "Current")
 * Active on:              Existing non-special pages
 */

Twinkle.diff = function twinklediff() {
	if (mw.config.get('wgNamespaceNumber') < 0 || !mw.config.get('wgArticleId')) {
		return;
	}
	Twinkle.addPortletLink(mw.util.getUrl(mw.config.get('wgPageName'), {diff: 'cur', oldid: 'prev'}), 'Seneste', 'tw-lastdiff', 'Vis seneste ændring');

	// Vis yderligere faner kun på diff-sider
	if (mw.config.get('wgDiffNewId')) {
		Twinkle.addPortletLink(() => {
			Twinkle.diff.evaluate(false);
		}, 'Siden', 'tw-since', 'Vis forskel mellem seneste diff og den forrige brugers version');
		Twinkle.addPortletLink(() => {
			Twinkle.diff.evaluate(true);
		}, 'Siden min', 'tw-sincemine', 'Vis forskel mellem seneste diff og min seneste version');

		Twinkle.addPortletLink(mw.util.getUrl(mw.config.get('wgPageName'), {diff: 'cur', oldid: mw.config.get('wgDiffNewId')}), 'Nuværende', 'tw-curdiff', 'Vis forskel til nuværende version');
	}
};

Twinkle.diff.evaluate = function twinklediffEvaluate(me) {

	let user;
	if (me) {
		user = mw.config.get('wgUserName');
	} else {
		const node = document.getElementById('mw-diff-ntitle2');
		if (!node) {
			// nothing to do?
			return;
		}
		user = $(node).find('a').first().text();
	}
	const query = {
		prop: 'revisions',
		action: 'query',
		titles: mw.config.get('wgPageName'),
		rvlimit: 1,
		rvprop: [ 'ids', 'user' ],
		rvstartid: mw.config.get('wgCurRevisionId') - 1, // i.e. not the current one
		rvuser: user,
		format: 'json'
	};
	Morebits.Status.init(document.getElementById('mw-content-text'));
	const wikipedia_api = new Morebits.wiki.Api('Henter data om den første bidragyder', query, Twinkle.diff.callbacks.main);
	wikipedia_api.params = { user: user };
	wikipedia_api.post();
};

Twinkle.diff.callbacks = {
	main: function(self) {
		const rev = self.response.query.pages[0].revisions;
		const revid = rev && rev[0].revid;

		if (!revid) {
			self.statelem.error('Ingen egnet tidligere version fundet, eller ' + self.params.user + ' er den eneste bidragyder. Afbryder.');
			return;
		}
		window.location = mw.util.getUrl(mw.config.get('wgPageName'), {
			diff: mw.config.get('wgCurRevisionId'),
			oldid: revid
		});
	}
};

Twinkle.addInitCallback(Twinkle.diff, 'diff');
}());

// </nowiki>
