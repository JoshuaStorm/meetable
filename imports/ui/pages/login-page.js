import { Template } from 'meteor/templating';
import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session'

import './login-page.html';

Template.login_page.events({
	'click [name=google]'(e, tmpl) {
		e.preventDefault();
		var googleLoginOptions = {
			requestOfflineToken: true, 
			forceApprovalPrompt: true, // TODO: we may be able to remove this, unclear
			requestPermissions: ['https://www.googleapis.com/auth/calendar'],
			loginStyle: 'popup'
	  };

	  Meteor.loginWithGoogle(googleLoginOptions, function (err) {
			if (err) Session.set('errorMessage', err.reason || 'Unknown error');
		});
	},
});