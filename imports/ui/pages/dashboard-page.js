import { Template } from 'meteor/templating';
import { Meteor } from 'meteor/meteor';

import './dashboard-page.html';

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
    header: {
        center: 'month,agendaWeek,agendaDay' // buttons for switching between views
    }
  });
});


// I think we have to initiate the call to get the OAuth info from the client
Meteor.call("getAuthInfo", function(error){});

// Not sure if this needs to be called on client or server -- depends how we
// will parse the calendar data
// Meteor.call("getCalendarInfo", function(error){});

var startDate = new Date("2017-04-1");
var endDate = new Date("2017-04-4");

Meteor.call("getCalendarList", function(error, result) {
  console.log(result);
});

Meteor.call("getFreeBusy", startDate, endDate, "est", function(error, result) {
  console.log(result);
});

Meteor.call("getFullCalendarEvents", function(error, result) {
  $( '#events-calendar' ).fullCalendar('addEventSource', result);
  console.log(result[0]);
});
