import { FlowRouter } from 'meteor/kadira:flow-router';
import { BlazeLayout } from 'meteor/kadira:blaze-layout';

// Import to load these templates
import '../../ui/layouts/app-body.js';
import '../../ui/pages/login-page.js';
import '../../ui/pages/error-page.js';
import '../../ui/pages/dashboard-page.js';

var public = FlowRouter.group({}) /* routes that are public */

var loggedIn = FlowRouter.group({ /* routes only for loggedIn users */
  name: 'loggedIn',
  triggersEnter: [checkLoggedIn]
});

function checkLoggedIn(ctx, redirect) {  /* check if user is logged in */
  if (!Meteor.userId() || Meteor.loggingIn()) {
    redirect('/');
  }
}

function redirectIfLoggedIn(ctx, redirect) {
  if (Meteor.userId()) {
    redirect('/dashboard')
  }
}

Accounts.onLogin(function () {
  FlowRouter.go('/dashboard');
});

Blaze._allowJavascriptUrls();
public.route('/', {
  name: 'App.home',
  action: function(params) {
    Tracker.autorun(function() {
      if (!Meteor.loggingIn()) BlazeLayout.render('App_body', { main: 'login_page' });
    });
  }
});

loggedIn.route('/dashboard', {
  name: 'App.dashboard',
  triggersEnter: [checkLoggedIn],
  action: function() {
    BlazeLayout.render('App_body', { main: 'dashboard_page' });
  },
  subscriptions: function(params) {
    this.register('Meetings', Meteor.subscribe('Meetings'));
    this.register('Users', Meteor.subscribe('Users'));
  }
});

public.route('/error', {
  name: 'App.error',
  action() {
    BlazeLayout.render('App_body', { main: 'error_page' });
  },
});

// the App_notFound template is used for unknown routes and missing lists
FlowRouter.notFound = {
  action() {
    BlazeLayout.render('App_body', { main: 'error_page' });
  },
};
