import { Template } from 'meteor/templating';
import './login-page.html';

import { Meteor } from 'meteor/meteor';

// How we send email from client-side JS
// NOTE: Uncommenting this will send an email EVERY TIME THE LOGIN PAGE IS REFRESHED.
// BAD IDEA FOR ANYTHING BUT TESTING
// Meteor.call('sendEmail',
//            'jsbecker@princeton.edu',
//            'prince@nigeria.gov',
//            'Give me all your credit card info!',
//            'I promise I\'ll give you $1 million if you do!\n....\n I got email working! I ended up using Mailgun. Will add notes on it on GitHub PR');
