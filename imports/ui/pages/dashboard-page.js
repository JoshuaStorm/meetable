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
    },
    showScheduleDiv:function(){ // foldout for 'Schedule a Meeting'
        return Session.get('showSchedule')
    },
    showInvitesDiv:function(){ // foldout for 'Invites'
        return Session.get('showInvites')
    },
    showOutgoingDiv:function(){ // foldout for 'Meetings'
        return Session.get('showOutgoing')
    },
    showMeetingsDiv:function(){ // foldout for 'Meetings'
        return Session.get('showMeetings')
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
  'click #scheduleButton':function(){
    Session.set('showInvites',false); // if one tab is open, close the others
    Session.set('showMeetings',false);
    Session.set('showOutgoing',false)
    if (Session.get('showSchedule') == true){ // toggle the state of the tab (open/close on click)
      Session.set('showSchedule',false);
    } else
    {
      Session.set('showSchedule',true);
    }
  },
  'click #cancel':function(){
    if (Session.get('showSchedule') == true){ // toggle the state of the tab (open/close on click)
      Session.set('showSchedule',false);
    } else
    {
      Session.set('showSchedule',true);
    }
  },
  'click #invitesButton':function(){
    Session.set('showSchedule',false);// if one tab is open, close the others
    Session.set('showMeetings',false);
    Session.set('showOutgoing',false)
    if (Session.get('showInvites') == true){ // toggle the state of the tab (open/close on click)
      Session.set('showInvites',false);
    } else
    {
      Session.set('showInvites',true);
    }
  },
  'click #outgoingButton':function(){
    Session.set('showSchedule',false);// if one tab is open, close the others
    Session.set('showMeetings',false);
    Session.set('showInvites',false)
    if (Session.get('showOutgoing') == true){ // toggle the state of the tab (open/close on click)
      Session.set('showOutgoing',false);
    } else
    {
      Session.set('showOutgoing',true);
    }
  },
    'click #meetingsButton':function(){
    Session.set('showSchedule',false);// if one tab is open, close the others
    Session.set('showInvites',false);
    Session.set('showOutgoing',false)
    if (Session.get('showMeetings') == true){ // toggle the state of the tab (open/close on click)
      Session.set('showMeetings',false);
    } else
    {
      Session.set('showMeetings',true);
    }
  },
  'click #save': function(e) {
    e.preventDefault();

    //TODO: make sure all these user inputs are sanitized/safe

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

    // for now, the window of every meeting is the 24 hour period from clicking save
    var windowStart = new Date();
    var windowEnd = new Date(windowStart.valueOf())
    windowEnd.setDate(windowEnd.getDate() + 1);

    // TODO: add fields to set the window of time to schedule the time
    // currently using 24 hours after time button was pressed 
    Meteor.call('createMeeting', title, [email], length, windowStart, windowEnd, function(error, result) {
      if (error) {
        console.log("createMeeting: " + error);
      }
    });
  },
})



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
