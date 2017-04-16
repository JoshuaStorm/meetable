import { FlowRouter } from 'meteor/kadira:flow-router';
import { BlazeLayout } from 'meteor/kadira:blaze-layout';

// Import to load these templates
import '../../ui/layouts/app-body.js';
import '../../ui/pages/login-page.js';
import '../../ui/pages/error-page.js';
import '../../ui/pages/dashboard-page.js';
// View calendar template
import '../../ui/pages/calViewPage.js';

/*FlowRouter.route('/', {
  name: 'App.home',
  action() {
    BlazeLayout.render('App_body', { main: 'login_page' });
  },
});
*/

var public = FlowRouter.group({}) /* routes that are public */

var loggedIn = FlowRouter.group({ /* routes only for loggedIn users */
  name: 'loggedIn',
  triggersEnter: [
    checkLoggedIn
  ]
})

function checkLoggedIn (ctx, redirect) {  /* check if user is logged in */
  if (!Meteor.userId()) {
    redirect('/')
  }
}

public.route('/', {
  name: 'App.home',
  action: function(params) {
    Tracker.autorun(function() {
      if (!Meteor.userId()) {
        BlazeLayout.render('App_body', { main: 'login_page' });
      } else {
        FlowRouter.go('/dashboard');
      }
    });
  }
});

public.route('/error', {
  name: 'App.error',
  action() {
    BlazeLayout.render('App_body', { main: 'error_page' });
  },
});

loggedIn.route('/dashboard', {
  name: 'App.dashboard',
  action: function() {
    Meteor.call("getAuthInfo", function() {
      Meteor.call("getFullCalendarEvents", false, function(error, result) {
        if (error) console.log(error);
        $( '#events-calendar' ).fullCalendar('addEventSource', result);
        Meteor.call("updateEventsInDB", function(error, result) {});
      });
    });
    BlazeLayout.render('App_body', { main: 'dashboard_page' });
  },
});

loggedIn.route('/cal', {
  name: 'App.calendar',
  action() {
    BlazeLayout.render('App_body', {main: 'calViewPage'});
  },
});

// the App_notFound template is used for unknown routes and missing lists
FlowRouter.notFound = {
  action() {
    BlazeLayout.render('App_body', { main: 'error_page' });
  },
};
