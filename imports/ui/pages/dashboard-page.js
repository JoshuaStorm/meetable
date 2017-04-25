import { Template } from 'meteor/templating';
import { Meteor } from 'meteor/meteor';
import Meetings from '/collections/meetings.js'


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
    invites:function() {
        return Meteor.users.findOne(Meteor.userId()).profile.meetingInvitesReceived;
    },
    outgoingMeetings:function() {
        return Meteor.users.findOne(Meteor.userId()).profile.meetingInvitesSent;
    },
    final: function() {
        return Meteor.users.findOne(Meteor.userId()).profile.finalizedMeetings;
    }
});

Template.dashboard_page.onRendered( () => {
  $( '#events-calendar' ).fullCalendar({
    defaultView: 'agendaWeek',
    header: {
      center: 'month,agendaWeek,agendaDay' // buttons for switching between views
    }
  });

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
  $("#extraBustyTimesButton").click(function(){
    $("#extraBusyTimes").slideToggle(100);
  });

  // hide the meeting creation section when user cancels creation
  $("#cancelCreateMeeting").click(function() {
    console.log("PLEASADS")
    $("#scheduleMeeting").slideUp(100);
  });
});

Template.dashboard_page.events({
  'click #save': function(e) {
    e.preventDefault();

    //TODO: make sure all these user inputs are sanitized/safe

    var title = $('#meetingTitle').val();
    var email = $('#meetingInvitee').val();
    var length = $('#meetingLength').val();

    // TODO: Handled errors, enforce the text boxes all have a value
    // TODO: Handle multiple emails, just passing an array of size 1 but backend should be able to handle multiple fine
    // for now, the window of every meeting is the 24 hour period from clicking save
    var windowStart = new Date();
    var windowEnd = new Date(windowStart.valueOf());
    windowEnd.setDate(windowEnd.getDate() + 1);

    // TODO: add fields to set the window of time to schedule the time
    // currently using 24 hours after time button was pressed
    Meteor.call('createMeeting', title, [email], length, windowStart, windowEnd, function(error, result) {
      if (error) {
        console.log("createMeeting: " + error);
      }
    });
  },
});

/////////////////////////////////////////////
/////////     invite Template      //////////
/////////////////////////////////////////////

Template.invite.helpers({
  inviteType: function() {
    var thisMeeting = Meetings.findOne({_id:this.toString()});
    // iterate through all meeting participants to find index in array for the current user
    // start with index 1 because you can skip the first participant ( creator)
    for (var i = 1; i < thisMeeting.participants.length; i++) {
      var currUser = thisMeeting.participants[i];
      if (currUser.id == Meteor.userId()) { // current user found
        if(currUser.accepted == true) {
          Template.instance().currentInviteType.set('readyToFinalize');
        }
        else {
          Template.instance().currentInviteType.set('incoming');
        }
        break;
      }
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
  'click #acceptInvite':function(event, template) {
    Meteor.call('acceptInvite', this.toString(), Meteor.userId(), function(error, result) {
      if (error) {
        console.log("acceptInvite: " + error);
      }
    });
  },
  'click #declineInvite': function(event, template) {
    Meteor.call('declineInvite', this.toString(), Meteor.userId(), function(error, result) {
      if (error) console.log("declineInvite: " + error);
    });
  }
});

Template.incoming.helpers({
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
      if (currUser.id == Meteor.userId()) { // current user found
        if(currUser.selector == true) {
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
  suggestedTimes:function() {
        return Meetings.findOne({_id:this.toString()}).suggestedMeetingTimes;
    },
});

Template.selector.events({
   'submit form': function(event){
      event.preventDefault();
      var radioValue = event.target.myForm.value;
      Meteor.call('selectFinaltime', this.toString(), radioValue, function(error, result) {
        if (error) {
          console.log("selectFinaltime: " + error);
        }
      });
    }
});


Template.outgoing.helpers({
  meetingParticipants() {
    return Meetings.findOne({_id:this.toString()}).participants[1].email;
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

Template.finalizedMeeting.helpers({
  meetingHost() {
    return Meetings.findOne({_id:this.toString()}).participants[0].email;
  },
  participants() {
    var peopleList = Meetings.findOne({_id:this.toString()}).participants;
    var participants = "";
    var comma = ", ";
    for (var i = 1; i < peopleList.length; i++) {
      participants = participants.concat(peopleList[i].email);
      if (i > 1)
        participants = participants.concat(comma);
    }
    return participants;
  },
  meetingTitle() {
    return Meetings.findOne({_id:this.toString()}).title;
  },
  selectedStart() {
    var start = Meetings.findOne({_id:this.toString()}).selectedBlock.startTime;
    var time=new Date(start).toLocaleString();
    return time;
  },
  selectedEnd() {
    var end = Meetings.findOne({_id:this.toString()}).selectedBlock.endTime;
    var time=new Date(end).toLocaleString();
    return time;
  }
});

