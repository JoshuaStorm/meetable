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
    },
    invites:function() {
        return Meteor.users.findOne(Meteor.userId()).profile.meetingInvitesReceived;
    },
    outgoingMeetings:function() {
        return Meteor.users.findOne(Meteor.userId()).profile.meetingInvitesSent;
    },
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
  'click #scheduleButton':function() {
    Session.set('showInvites',false); // if one tab is open, close the others
    Session.set('showMeetings',false);
    Session.set('showOutgoing',false)
    if (Session.get('showSchedule') == true) { // toggle the state of the tab (open/close on click)
      Session.set('showSchedule',false);
    } else
    {
      Session.set('showSchedule',true);
    }
  },
  'click #cancel':function(){
    if (Session.get('showSchedule') == true) { // toggle the state of the tab (open/close on click)
      Session.set('showSchedule',false);
    } else
    {
      Session.set('showSchedule',true);
    }
  },
  'click #invitesButton':function() {
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
  'click #outgoingButton':function() {
    Session.set('showSchedule',false);// if one tab is open, close the others
    Session.set('showMeetings',false);
    Session.set('showInvites',false)
    if (Session.get('showOutgoing') == true) { // toggle the state of the tab (open/close on click)
      Session.set('showOutgoing',false);
    } else
    {
      Session.set('showOutgoing',true);
    }
  },
  'click #meetingsButton':function() {
    Session.set('showSchedule',false);// if one tab is open, close the others
    Session.set('showInvites',false);
    Session.set('showOutgoing',false)
    if (Session.get('showMeetings') == true) { // toggle the state of the tab (open/close on click)
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
    // for now, the window of every meeting is the 24 hour period from clicking save
    var windowStart = new Date();
    var windowEnd = new Date(windowStart.valueOf());
    windowEnd.setDate(windowEnd.getDate() + 1);

    // TODO: add fields to set the window of time to schedule the time
    // currently using 24 hours after time button was pressed
    Meteor.call('createMeeting', title, [email], length, windowStart, windowEnd, function(error, result) {
      if (error) {
        console.log("createMeeting: " + error);
      } else{
        var resetTitle = document.getElementById('meetingTitle').value ="";
        var resetInvitee = document.getElementById('meetingInvitee').value ="";
        var resetLength = document.getElementById('meetingLength').value ="";
        Bert.alert( 'Success! Meeting invite sent.', 'success', 'growl-bottom-left' );
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
        } else {
          Bert.alert( 'Success! Meeting finalized.', 'success', 'growl-bottom-left', 'fa-calendar-check-o' );
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
