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

public.route('/', {
  name: 'App.home',
  action: function(params) {
    Tracker.autorun(function() {
      if (!Meteor.loggingIn()) BlazeLayout.render('App_body', { main: 'login_page' });
    });
  },
  waitOn: function() {
    Accounts.loginServicesConfigured();
  }
});

loggedIn.route('/dashboard', {
  name: 'App.dashboard',
  triggersEnter: [checkLoggedIn],
  action: function() {
    // TODO: Should only need to attach Temp data if new signup but our current routing doesn't seem to expose signup vs. signin
    Meteor.call('getAuthInfo', function() {
      var timeZoneOffset = new Date().getTimezoneOffset();
      Meteor.call('setUserTimeZoneOffset', timeZoneOffset, function(error, result) { if (error) console.log('setUserTimeZoneOffset: ' + error)});
      Meteor.call('attachTempUser', function(error, result) { if (error) console.log('attachTempUser: ' + error)});
      Meteor.call('deleteOldMeetings', function(error, result) { if (error) console.log('deleteOldMeetings: ' + error)});
      Meteor.call('getCalendarList', function(error, result) {
        if (error) console.log('getCalendarList: ' + error);
        Meteor.call('getFullCalendarConsidered', false, function(error, result) {
          if (error) console.log(error);
          if (result) {
            for (var id in result) {
              var events = result[id];
              var busyId = 'gCalBusy' + id;
              var availableId = 'gCalAvailable' + id;

              $( '#events-calendar' ).fullCalendar('removeEventSource', busyId);
              $( '#events-calendar' ).fullCalendar('removeEventSource', availableId);
              $( '#events-calendar' ).fullCalendar('addEventSource', { id: busyId, events: events.busy });
              $( '#events-calendar' ).fullCalendar('addEventSource', { id: availableId, events: events.available });
            }
          }
          Meteor.call("updateEventsInDB", function(error, result) {});
        });
      });
      Meteor.call('getFullCalendarFinalized', function(error, result) {
        if (error) console.log(error);
        if (result) {
          $( '#events-calendar' ).fullCalendar('removeEventSource', 'finalized');
          $( '#events-calendar' ).fullCalendar('addEventSource', { id: 'finalized', events: result });
        }
      });
      Meteor.call("getFullCalendarAdditional", function(error, result) {
        if (error) console.log(error);
        if (result) {
          $( '#events-calendar' ).fullCalendar('removeEventSource', 'additional');
          $( '#events-calendar' ).fullCalendar('addEventSource', { id: 'additional', events: result });
        }
      });
    });
    BlazeLayout.render('App_body', { main: 'dashboard_page' });
  },
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
