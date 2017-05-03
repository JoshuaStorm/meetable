import { Template } from 'meteor/templating';
import { Meteor } from 'meteor/meteor';
import Meetings from '/collections/meetings.js'
import { FlowRouter } from 'meteor/kadira:flow-router';

import './dashboard-page.html';

Date.prototype.toDateInputValue = (function() {
    var local = new Date(this);
    local.setMinutes(this.getMinutes() - this.getTimezoneOffset());
    return local.toJSON().slice(0,10);
});

/////////////////////////////////////////////
/////////// MAIN PAGE TEMPLATING ////////////
/////////////////////////////////////////////

Template.dashboard_page.helpers({
    firstName: function(){
      var user = Meteor.user();
      if (user) {
        return user.services.google.given_name;
      }
      else {
        return "user that's not logged in"
      }
    },
    email: function(){
      var user = Meteor.user();
      if (user) {
        return user.services.google.email;
      }
      else {
        return "user that's not logged in"
      }
    },
    currentUser: function() {
      return Meteor.userId();
    },
    invites:function() {
      return Meteor.users.findOne(Meteor.userId()).profile.meetingInvitesReceived;
    },
    numIncoming:function() { // for badge
      return Meteor.users.findOne(Meteor.userId()).profile.meetingInvitesReceived.length;
    },
    outgoingMeetings:function() {
        return Meteor.users.findOne(Meteor.userId()).profile.meetingInvitesSent;
    },
    numOutgoing:function() { // for badge
      return Meteor.users.findOne(Meteor.userId()).profile.meetingInvitesSent.length;
    },
    final: function() {
        return Meteor.users.findOne(Meteor.userId()).profile.finalizedMeetings;
    },
    numFinalized:function() { // for badge
      return Meteor.users.findOne(Meteor.userId()).profile.finalizedMeetings.length;
    },
    additionalTime: function() {
        return Meteor.users.findOne(Meteor.userId()).profile.additionalBusyTimes;
    }
});

Template.dashboard_page.onRendered( () => {
  $( '#events-calendar' ).fullCalendar({
    defaultView: 'agendaWeek',
    header: {
      center: 'month,agendaWeek,agendaDay' // buttons for switching between views
    },
  });


  // initialize the date time picker
  this.$('.datetimepicker').datetimepicker();

  //autopopulates the start field with an ISOstring of current time (which is readable by the html datetime-local)
  //the tzoffset is to get the ISO from UTC time to current timezone
  var tzoffset = (new Date()).getTimezoneOffset() * 60000; //offset in milliseconds
  var isoStrStart = (new Date(Date.now() - tzoffset)).toISOString();
  var isoStrEnd = (new Date(Date.now() - tzoffset + 3600000)).toISOString(); // end time is an hour ahead of start time
  $('#datetime-start').val(isoStrStart.substring(0,isoStrStart.length-5));
  $('#datetime-end').val(isoStrEnd.substring(0,isoStrEnd.length-5));

  // toggle main tabs
  // must be in this function because jQuery can only run on DOM after
  // the DOM is rendered (which is when this function is called)

  // only show schedule meeting section from start
  $(".dashboardDropdownContent").hide();
  $("#scheduleMeeting").show();

  // time parameters are in milliseconds
  $("#scheduleButton").click(function(){
    $("#scheduleMeeting").slideToggle(100);
  });
  $("#invitesButton").click(function(){
    $("#incomingInvites").slideToggle(100);
  });
  $("#outgoingButton").click(function(){
    $("#outgoingInvites").slideToggle(100);
  });
  $("#meetingsButton").click(function(){
    $("#finalizedMeetings").slideToggle(100);
  });
  $("#hideCalendarsButton").click(function(){
    $("#hideCalendars").slideToggle(100);
  });
  $("#extraBusyTimesButton").click(function(){
    $("#extraBusyTimes").slideToggle(100);
  });

  // hide the meeting creation section when user cancels creation
  $("#cancelCreateMeeting").click(function() {
    $("#scheduleMeeting").slideUp(100);
  });
});

Template.dashboard_page.events({
  'click #save': function(e) {
    e.preventDefault();
    // TODO: make sure all these user inputs are sanitized/safe
    var title = $('#meetingTitle').val();
    // TODO: User dynamic fields instead of just comma separating emails
    var emails = $('#meetingInvitee').val().split(",");
    var length = $('#meetingLength').val();
    var windowStart = new Date($('#chooseWindowStart').val());
    var windowEnd = new Date($('#chooseWindowEnd').val());

    // Remove all non-emails from this list
    // ReGex check email field. This is the 99.9% working email ReGex
    var regex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    var cleanEmails = [];
    for (var i = 0; i < emails.length; i++) {
      // TODO: Prompt user when they pass a non-email?
      if (emails[i].trim() === Meteor.users.findOne(Meteor.userId()).services.google.email) {
        Bert.alert( 'Cannot schedule meeting with yourself', 'danger', 'growl-bottom-left' );
        return;
      }
      if (emails[i].trim().match(regex)) cleanEmails.push(emails[i].trim());
      else console.log("Non-email passed in; removed from invitees list.")
    }

    // TODO: add fields to set the window of time to schedule the time
    // currently using 24 hours after time button was pressed
    Meteor.call('createMeeting', title, emails, length, windowStart, windowEnd, function(error, result) {
      if (error) {
        console.log("createMeeting: " + error);
      } else{
        var resetTitle = document.getElementById('meetingTitle').value ="";
        var resetInvitee = document.getElementById('meetingInvitee').value ="";
        var resetLength = document.getElementById('meetingLength').value ="";
        var resetWindowStart = document.getElementById('chooseWindowStart').value ="";
        var resetWindowEnd = document.getElementById('chooseWindowEnd').value ="";
        Bert.alert( 'Success! Meeting invite sent.', 'success', 'growl-bottom-left' );
      }
    });
  },
  'click .navbar-brand': function(e) {
    FlowRouter.go('/');
  },

  'click #submit-extra-times': function(e) {
    e.preventDefault();

    var startTime = $('#datetime-start').val();
    startTime = new Date(startTime);
    var endTime = $('#datetime-end').val();
    endTime = new Date(endTime);

    if (isNaN(startTime.getTime())) {
      Bert.alert( 'Please enter a valid start time.', 'danger', 'fixed-bottom');
      throw 'Invalid Start';
    }
    else if (isNaN(endTime.getTime())) {
      Bert.alert( 'Please enter a valid end time.', 'danger', 'fixed-bottom');
      throw 'Invalid End';
    }

    if (endTime.getTime() <= startTime.getTime()) {
      Bert.alert( 'End time must be after start time. ', 'danger', 'fixed-bottom');
      throw 'EndTime greater than startTime';
    }

    var busyTime = {start: startTime, end: endTime};

    Meteor.call('addBusyTimes', busyTime, function(error, result) {
      if (error) {
        console.log("Error in addBusyTimes: " + error);
      } else {
        Meteor.call("getFullCalendarAdditional", function(error, result) {
          if (error) console.log(error);
          $( '#events-calendar' ).fullCalendar('removeEventSource', 'additional');
          $( '#events-calendar' ).fullCalendar('addEventSource', { id: 'additional', events: result });
        });
      }
    });
  }
});

/////////////////////////////////////////////
/////////  additional template  /////////////
/////////////////////////////////////////////
Template.additional.helpers({
  timeStart() {
    var startDate = new Date(this.start);
    var weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    var day = weekday[startDate.getDay()];
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var month = months[startDate.getMonth()];
    var date = startDate.getDate();
    var year = startDate.getFullYear();
    var hour = startDate.getHours();
    if (hour < 10) hour = "0" + hour;
    var min = startDate.getMinutes();
    if (min < 10) min = "0" + min;
    return (day + " " + month + " " + date + ", " + year + " " + hour + ":" + min);
  },
  timeEnd() {
    var endDate = new Date(this.end);
    var weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    var day = weekday[endDate.getDay()];
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var month = months[endDate.getMonth()];
    var date = endDate.getDate();
    var year = endDate.getFullYear();
    var hour = endDate.getHours();
    if (hour < 10) hour = "0" + hour;
    var min = endDate.getMinutes();
    if (min < 10) min = "0" + min;
    return (day + " " + month + " " + date + ", " + year + " " + hour + ":" + min);
  }
});

Template.additional.events({

  'click #delete-button': function(e) {
    //e.preventDefault();
    Meteor.call('deleteBusyTimes', this, function(error, result) {
      if (error) throw "there are no additional busyTimes for some reason!";
      Meteor.call("getFullCalendarAdditional", function(error, result) {
          if (error) console.log(error);
          $( '#events-calendar' ).fullCalendar('removeEventSource', 'additional');
          $( '#events-calendar' ).fullCalendar('addEventSource', { id: 'additional', events: result });
        });
    });
  }
});


/////////////////////////////////////////////
/////////     invite Template      //////////
/////////////////////////////////////////////

Template.invite.helpers({
  inviteType: function() {
    var thisMeeting = Meetings.findOne({_id:this.toString()});
    // iterate through all meeting participants to find index in array for the current user
    // start with index 1 because you can skip the first participant ( creator)
    Meteor.call('readyToFinalize', this.toString(), function(error, result) {
      if (error) {
        console.log("readyToFinalize: " + error);
      }
    });
    // an incoming meeting is only ready to finalize if the flag 'readytoFinalize' is set to true AND this meeting is a two person meeting
    if (thisMeeting.readyToFinalize && thisMeeting.participants.length === 2) {
      Template.instance().currentInviteType.set('readyToFinalize');
    }
    else {
      Template.instance().currentInviteType.set('incoming');
    }
    return Template.instance().currentInviteType.get();
  }
});

// set default value for the Invite type, dynamic template
Template.invite.onCreated( function() {
  this.currentInviteType = new ReactiveVar( "incoming" );
});

Template.invite.events({
  // call function to change this user's 'accepted' value to true for the given meeting
  'click #acceptInvite': function(event, template) {
    Meteor.call('acceptInvite', this.toString(), Meteor.userId(), function(error, result) {
      if (error) {
        console.log("acceptInvite: " + error);
      }
    });
  },
  'click #declineInvite': function(event, template) {
    Meteor.call('declineInvite', this.toString(), Meteor.userId(), function(error, result) {
      if (error){
        console.log("declineInvite: " + error);
      } else {
        Bert.alert( 'Invite has been declined', 'danger', 'growl-bottom-left', 'fa-calendar-times-o' );
      }
    });
  }
});

Template.incoming.helpers({
  inviterName() {
      // This should show a list of users
      return Meetings.findOne({_id:this.toString()}).participants[0].email;
    },
  meetingTitle() {
      return Meetings.findOne({_id:this.toString()}).title;
    },
  meetingDuration() {
      var length = Meetings.findOne({_id:this.toString()}).duration;
      var hour = length / (1000 * 60 * 60);
      var minute = length % (1000 * 60 * 60);
      return hour + "hr " + minute + "min";
    },
  acceptedInvite() {
    var thisMeeting = Meetings.findOne({_id:this.toString()});
    // iterate through all meeting participants to find index in array for the current user
    // NOTE: Switch this to check all users, I don't think we should assume the first participant is always the creator. May get us into trouble later
    for (var i = 0; i < thisMeeting.participants.length; i++) {
      var currUser = thisMeeting.participants[i];
      if (currUser.id === Meteor.userId()) { // current user found
        return currUser.accepted;
      }
    }
  }
});

/////////////////////////////////////////////
////////  readyToFinalize Template   ////////
/////////////////////////////////////////////

Template.readyToFinalize.helpers({
  finalizeType: function() {
    var thisMeeting = Meetings.findOne({_id:this.toString()});
    // iterate through all meeting participants to find index in array for the current user
    // start with index 1 because you can skip the first participant ( creator)
    for (var i = 1; i < thisMeeting.participants.length; i++) {
      var currUser = thisMeeting.participants[i];
      if (currUser.id === Meteor.userId()) { // current user found
        if (currUser.selector) {
          Template.instance().currentFinalizeType.set('selector');
        }
        else {
          Template.instance().currentFinalizeType.set('notSelector');
        }
        break;
      }
    }
    return Template.instance().currentFinalizeType.get();
  }
});

// set default value for the Invite type, dynamic template
Template.readyToFinalize.onCreated( function() {
  this.currentFinalizeType = new ReactiveVar( "notSelector" );
});

Template.notSelector.helpers({
  inviterName() {
      return Meetings.findOne({_id:this.toString()}).participants[0].email;
    },
  meetingTitle() {
      return Meetings.findOne({_id:this.toString()}).title;
    },
  meetingDuration() {
      var length = Meetings.findOne({_id:this.toString()}).duration;
      var hour = length / (1000 * 60 * 60);
      var minute = length % (1000 * 60 * 60);
      return hour + "hr " + minute + "min";
    },
});

Template.selector.helpers({
  inviterName() {
      return Meetings.findOne({_id:this.toString()}).participants[0].email;
    },
  meetingTitle() {
      return Meetings.findOne({_id:this.toString()}).title;
    },
  meetingDuration() {
      var length = Meetings.findOne({_id:this.toString()}).duration;
      var hour = length / (1000 * 60 * 60);
      var minute = length % (1000 * 60 * 60);
      return hour + "hr " + minute + "min";
    },
  suggestedTimes() {
      return Meetings.findOne({_id:this.toString()}).suggestedMeetingTimes;
    },
});

Template.selector.events({
   'submit form': function(event){
      event.preventDefault();
      var radioValue = event.target.myForm.value;
      Meteor.call('selectFinalTime', this.toString(), radioValue, function(error, result) {
        if (error) {
          console.log("selectFinalTime: " + error);
        } else {
          Bert.alert( 'Success! Meeting finalized.', 'success', 'growl-bottom-left', 'fa-calendar-check-o' );
          Meteor.call("getFullCalendarFinalized", function(error, result) {
            if (error) console.log(error);
            $( '#events-calendar' ).fullCalendar('removeEventSource', 'finalized');
            $( '#events-calendar' ).fullCalendar('addEventSource', { id: 'finalized', events: result });
          });
        }
      });
    },
    'click #cancelInvite': function(event){
      Meteor.call('setNotReadyToFinalize', this.toString(), function(error, result) {
        if (error) console.log(error);
      });
    }
});

Template.outgoing.helpers({
  meetingParticipants() {
    var peopleList = Meetings.findOne({_id:this.toString()}).participants;
    var participants = "";
    var comma = ", ";
    participants = participants.concat(peopleList[1].email);
    for (var i = 2; i < peopleList.length; i++) {
      participants = participants.concat(comma);
      participants = participants.concat(peopleList[i].email);
    }
    return participants;
  },
  meetingTitle() {
    return Meetings.findOne({_id:this.toString()}).title;
  },
  meetingDuration() {
    var length = Meetings.findOne({_id:this.toString()}).duration;
    var hour = length / (1000 * 60 * 60);
    var minute = length % (1000 * 60 * 60);
    return hour + "hr " + minute + "min";
  },
  readyToFinalize() {
    var readyOutgoing = false;
    // an outgoing meeting is only ready to finalize if the flag 'readytoFinalize' is set to true AND this meeting is a group meeting
    if (Meetings.findOne({_id:this.toString()}).readyToFinalize && Meetings.findOne({_id:this.toString()}).participants.length > 2)
    {
      readyOutgoing = true;
    }
    return readyOutgoing;
  }
});

Template.outgoing.events({
  'click #deleteOutgoing': function(event) {
    event.preventDefault();
    console.log("UNCOMMENT THIS METEOR CALL ONCE WE HAVE THE OTHER PR MERGE. IM TOO LAZY TO MERGE THE TWO PRS TO ONE");
    // Meteor.call('deleteMeeting', this.toString(), function(error, result) {
    //   if (error) console.log(error);
    // });
  }
})

Template.outgoingFinalize.helpers({
  inviterName() {
      return Meetings.findOne({_id:this.toString()}).participants[0].email;
    },
  meetingTitle() {
      return Meetings.findOne({_id:this.toString()}).title;
    },
  meetingDuration() {
      var length = Meetings.findOne({_id:this.toString()}).duration;
      var hour = length / (1000 * 60 * 60);
      var minute = length % (1000 * 60 * 60);
      return hour + "hr " + minute + "min";
    },
  suggestedTimes:function() {
        return Meetings.findOne({_id:this.toString()}).suggestedMeetingTimes;
    },
  participants() {
    var peopleList = Meetings.findOne({_id:this.toString()}).participants;
    var participants = "";
    var comma = ", ";
    participants = participants.concat(peopleList[1].email);
    for (var i = 2; i < peopleList.length; i++) {
      participants = participants.concat(comma);
      participants = participants.concat(peopleList[i].email);
    }
    return participants;
  }
});

Template.outgoingFinalize.events({
  'submit form': function(event){
      event.preventDefault();
      var radioValue = event.target.myForm.value;
      Meteor.call('selectFinalTime', this.toString(), radioValue, function(error, result) {
        if (error) {
          console.log("selectFinaltime: " + error);
        } else {
          Bert.alert( 'Success! Meeting finalized.', 'success', 'growl-bottom-left', 'fa-calendar-check-o' );
          Meteor.call("getFullCalendarFinalized", function(error, result) {
            if (error) console.log(error);
            $( '#events-calendar' ).fullCalendar('removeEventSource', 'finalized');
            $( '#events-calendar' ).fullCalendar('addEventSource', { id: 'finalized', events: result });
          });

        }
      });
    },
    'click #deleteInvite': function(event) {
      event.preventDefault();
      console.log("UNCOMMENT THIS METEOR CALL ONCE WE HAVE THE OTHER PR MERGE. IM TOO LAZY TO MERGE THE TWO PRS TO ONE");
      // Meteor.call('deleteMeeting', this.toString(), function(error, result) {
      //   if (error) console.log(error);
      // });
    }
});

Template.finalizedMeeting.helpers({
  meetingHost() {
    return Meetings.findOne({_id:this.toString()}).participants[0].email;
  },
  participants() {
    var peopleList = Meetings.findOne({_id:this.toString()}).participants;
    var participants = "";
    var comma = ", ";
    participants = participants.concat(peopleList[1].email);
    for (var i = 2; i < peopleList.length; i++) {
      participants = participants.concat(comma);
      participants = participants.concat(peopleList[i].email);
    }
    return participants;
  },
  meetingTitle() {
    return Meetings.findOne({_id:this.toString()}).title;
  },
  selectedStart() {
    var start = Meetings.findOne({_id:this.toString()}).selectedBlock.startTime;
    var time = new Date(start).toLocaleString();
    return time;
  },
  selectedEnd() {
    var end = Meetings.findOne({_id:this.toString()}).selectedBlock.endTime;
    var time = new Date(end).toLocaleString();
    return time;
  },
  addedToGCal: function() {
    var thisMeeting = Meetings.findOne({_id:this.toString()});
    // iterate through all meeting participants to find index in array for the current user
    // NOTE: Switch this to check all users, I don't think we should assume the first participant is always the creator. May get us into trouble later
    for (var i = 0; i < thisMeeting.participants.length; i++) {
      var currUser = thisMeeting.participants[i];
      if (currUser.id == Meteor.userId()) { // current user found
        return currUser.addedToGCal;
      }
    }
  }
});

Template.finalizedMeeting.events({
  'click #pushEvent': function(e) {
     //add code below to push the event to gcal
     Meteor.call('addMeetingToUserCalendar', this.toString(), function(error, result) {
       if (error) console.log('addMeetingToUserCalendar: ' + error);
     });
   }
});
