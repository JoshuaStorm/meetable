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
    // TODO: Handled errors, enforce the text boxes all have a value
    // TODO: Handle multiple emails, just passing an array of size 1 but backend should be able to handle multiple fine
    Meteor.call('inviteToMeeting', [email], title, 1, function(error, result) {
      if (error) {
        alert(error);
      }
    });

    $('#dashboardModal').modal('hide');
  }
});



// I think we have to initiate the call to get the OAuth info from the client
Meteor.call("getAuthInfo", function(error){});

Meteor.call("getFullCalendarEvents", function(error, result) {
  $( '#events-calendar' ).fullCalendar('addEventSource', result);
});

// These calls are just for testing for now :)
Meteor.call("updateEventsInDB", function(error, result) {});

Meteor.call("printFromDB", function(error) {});
