import { Template } from 'meteor/templating';
import { Meteor } from 'meteor/meteor';

import './dashboard-page.html';

/////////////////////////////////////////////
/////////// MAIN PAGE TEMPLATING ////////////
/////////////////////////////////////////////

Template.dashboard_page.helpers({
   firstName: function(){
    var user = Meteor.user();
	    if (user) {
        // DEBUG:helpful to know exactly which account is logged in
        console.log("logged in email: " + user.services.google.email);
	      return user.services.google.given_name;
	   	}
	},
   currentUser: function() {
    	return Meteor.userId();
  	}
});

Template.dashboard_page.onRendered( () => {
  $( '#events-calendar' ).fullCalendar({
    defaultView: 'agendaWeek',
    header: {
      center: 'month,agendaWeek,agendaDay' // buttons for switching between views
    }
  });
});

Template.dashboard_page.events({
  'click #scheduleButton': function(error) {
    $('#dashboardModal').modal('show');
  }
});

/////////////////////////////////////////////
////////// MODAL PAGE TEMPLATING ////////////
/////////////////////////////////////////////

Template.dashboard_modal.events({
  'click #save': function(e) {
    e.preventDefault();

    var title = $('#meetingTitle').val();
    var email = $('#meetingInvitee').val();
    var length = $('#meetingLength').val();
    // TODO: Handled errors, enforce the text boxes all have a value
    // TODO: Handle multiple emails, just passing an array of size 1 but backend should be able to handle multiple fine
    Meteor.call('inviteToMeeting', [email], title, length, function(error, result) {
      if (error) {
        alert(error);
      }
    });

    const windowStart = moment();

    console.log("window start original: ");
    console.log(windowStart);
    var windowEnd = windowStart.clone().add(1, 'days');

    // TODO: add fields to set the window of time to schedule the time
    // currently using 24 hours after time button was pressed 
    Meteor.call('createMeeting', [email], length, moment(), windowEnd, function(error, result) {
      if (error) {
        console.log("createMeeting: " + error);
      }
    });

    $('#dashboardModal').modal('hide');
  }
});



// I think we have to initiate the call to get the OAuth info from the client
Meteor.call("getAuthInfo", function(error){});

// Not sure if this needs to be called on client or server -- depends how we
// will parse the calendar data
// Meteor.call("getCalendarInfo", function(error){});

// var startDate = new Date("2017-04-1");
// var endDate = new Date("2017-04-4");
//
// Meteor.call("getCalendarList", function(error, result) {
//   console.log(result);
// });
//
// Meteor.call("getFreeBusy", startDate, endDate, "est", function(error, result) {
//   console.log(result);
// });
//
Meteor.call("getFullCalendarEvents", false, function(error, result) {
  $( '#events-calendar' ).fullCalendar('addEventSource', result);
});

// Meteor.call("printFromDB", function (error) {});
