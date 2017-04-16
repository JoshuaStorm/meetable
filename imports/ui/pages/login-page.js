import { Template } from 'meteor/templating';
import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session'

import './login-page.html';

Template.login_page.events({
	'click [name=google]'(e, tmpl) {
		e.preventDefault();
	  var googleLoginOptions = {
	    requestOfflineToken: true,
	    requestPermissions: ['https://www.googleapis.com/auth/calendar'],
			loginStyle: 'popup'
	  };

	  Meteor.loginWithGoogle(googleLoginOptions, function (err) {
			if (err) Session.set('errorMessage', err.reason || 'Unknown error');
		});
	},
});

// How we send email from client-side JS
// NOTE: Uncommenting this will send an email EVERY TIME THE LOGIN PAGE IS REFRESHED.
// BAD IDEA FOR ANYTHING BUT TESTING
// Meteor.call('sendEmail',
//            'jsbecker@princeton.edu',
//            'prince@nigeria.gov',
//            'Give me all your credit card info!',
//            'I promise I\'ll give you $1 million if you do!\n....\n I got email working! I ended up using Mailgun. Will add notes on it on GitHub PR');
