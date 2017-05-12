import { Template } from 'meteor/templating';
import { Meteor } from 'meteor/meteor';
import Meetings from '/collections/meetings.js'
import { FlowRouter } from 'meteor/kadira:flow-router';
import moment from 'moment';
import twix from 'twix';

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
      var profile = Meteor.users.findOne(Meteor.userId()).profile;
      if (profile) return profile.meetingInvitesReceived;
    },
    numIncoming:function() { // for badge
      var profile = Meteor.users.findOne(Meteor.userId()).profile;
      if (profile) return profile.meetingInvitesReceived.length;
    },
    outgoingMeetings:function() {
      var profile = Meteor.users.findOne(Meteor.userId()).profile;
      if (profile) return profile.meetingInvitesSent;
    },
    numOutgoing:function() { // for badge
      var profile = Meteor.users.findOne(Meteor.userId()).profile;
      if (profile) return profile.meetingInvitesSent.length;
    },
    final: function() {
      var profile = Meteor.users.findOne(Meteor.userId()).profile;
      if (profile) return profile.finalizedMeetings;
    },
    numFinalized:function() { // for badge
      var profile = Meteor.users.findOne(Meteor.userId()).profile;
      if (profile) return profile.finalizedMeetings.length;
    },
    additionalTime: function() {
      var profile = Meteor.users.findOne(Meteor.userId()).profile;
      if (profile) return profile.additionalBusyTimes;
    },
    userCalendars: function() {
      var profile = Meteor.users.findOne(Meteor.userId()).profile;
      if (profile) return Object.keys(profile.calendars);
    },
    earliestTime: function() {
      var profile = Meteor.users.findOne(Meteor.userId()).profile;
      if (profile) return profile.meetRange.earliest;
      return "09:00";
    },
    latestTime: function() {
      var profile = Meteor.users.findOne(Meteor.userId()).profile;
      if (profile) return profile.meetRange.latest;
      return "22:00";
    }
});

Template.dashboard_page.onRendered( () => {
  $( '#events-calendar' ).fullCalendar({
    scrollTime: "09:00:00",
    // display day view on mobile devices (based on user agents not screen size)
    defaultView: window.mobilecheck() ? "agendaDay" : "agendaWeek",
    header: {
      center: 'month,agendaWeek,agendaDay' // buttons for switching between views
    },
    height: $('#dashboardRightCol').height() - 30, // -30 seems to produce a desired effect

  });

  // Hacky fix but seems to work. The purpose this is that whenever the window resizes,
  // we resize the 'contentHeight' of the full calendar (which is the part below the
  // toolbar). We set its height to the height of the dashboardRightCol - 80, where 80
  // is a bit more than the height of the toolbar. But if the window is larger than 525 pixels,
  // the toolbar spreads out and is only 50 pixels. This seems to produxe the desired effect
  $(document).ready(function() {
    $(window).resize(function() {
      if ($('#events-calendar').width() > 525){
        $('#events-calendar').fullCalendar('option', 'contentHeight', $('#dashboardRightCol').height() - 50);
      }
      else {
        var contentHeight = $('#dashboardRightCol').height() - 80;
        $('#events-calendar').fullCalendar('option', 'contentHeight', contentHeight);
      }
    });
  });

  // If this is a mobile screen, the calendar is 500 pixels tall (can change based on aesthetic)
  // Otherwise, set the contentHeight of the calendar to be equal to the height of the window - toolbar height
  if ($(window).width() <= 768) {
    $('#events-calendar').fullCalendar('option', 'contentHeight', "auto");
  }
  else if ($('#events-calendar').width() > 525) $('#events-calendar').fullCalendar('option', 'contentHeight', $('#dashboardRightCol').height() - 50);
  else $('#events-calendar').fullCalendar('option', 'contentHeight', $('#dashboardRightCol').height() - 80);

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
  $("#extraBusyTimesButton").click(function(){
    $("#extraBusyTimes").slideToggle(100);
  });
  $("#settingsButton").click(function(){
    $("#settings").slideToggle(100);
  });

  // hide the meeting creation section when user cancels creation
  $("#cancelCreateMeeting").click(function() {
    $("#scheduleMeeting").slideUp(100);
  });

  // round up to the nearest 30 minutes of the hour
  let currentTime = moment();
  let remainder = 15 - currentTime.minute() % 15;
  let roundUp = moment(currentTime).add(remainder, "minutes");

  $('#chooseWindowStart').datetimepicker({
    format: 'ddd, MMM Do, h:mm a',
    useCurrent: false,
    defaultDate: roundUp,
    minDate: roundUp,
  });

  $('#chooseWindowEnd').datetimepicker({
    format: 'ddd, MMM Do, h:mm a',
    useCurrent: false,
    defaultDate: moment(roundUp).add(2, "weeks"),
    minDate: roundUp
  });

  // datetime-start and end are for busy times

  $('#datetime-start').datetimepicker({
    format: 'ddd, MMM Do, h:mm a',
    minDate: moment().startOf("hour"),
  });

  $('#datetime-end').datetimepicker({
    format: 'ddd, MMM Do, h:mm a',
    minDate: moment().startOf("hour"),
  });

  var earliest = Meteor.users.findOne(Meteor.userId()).profile.meetRange.earliest;
  // if the latest string is not found in DB or it is an empty string
  if (!earliest || 0 === earliest.length) {
    console.log("Missing value for no meetings before. setting it to 00:00");
    earliest = "00:00";
  }
  var latest = Meteor.users.findOne(Meteor.userId()).profile.meetRange.latest;
  //if the latest string is not found in DB or it is an empty string
  if (!latest || 0 === latest.length) {
    console.log( 'Missing value for no meetings after. setting it to 00:00');
    latest = "00:00";
  }

  $('#no-meetings-before').datetimepicker({
    format: 'h:mm a',
    defaultDate: moment(earliest, "hh:mm")
  });

  $('#no-meetings-after').datetimepicker({
    format: 'h:mm a',
    defaultDate: moment(latest, "hh:mm")
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

    // get Date objects from the datepickers
    let windowStart = $('#chooseWindowStart').data("DateTimePicker").date().toDate();
    let windowEnd = $('#chooseWindowEnd').data("DateTimePicker").date().toDate();

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
        Bert.alert( 'Meeting invite could not be sent.', 'danger', 'growl-bottom-left' );
        console.log("createMeeting: " + error);
      } else{
        var resetTitle = document.getElementById('meetingTitle').value ="";
        var resetInvitee = document.getElementById('meetingInvitee').value ="";
        var resetLength = document.getElementById('meetingLength').value ="";

        // round up to the nearest 30 minutes of the hour
        let currentTime = moment();
        let remainder = 15 - currentTime.minute() % 15;
        let roundUp = moment(currentTime).add(remainder, "minutes");

        var resetWindowStart = document.getElementById('chooseWindowStart').value =roundUp.format('ddd, MMM Do, h:mm a');
        var resetWindowEnd = document.getElementById('chooseWindowEnd').value =moment(roundUp).add(2, "weeks").format('ddd, MMM Do, h:mm a');
        Bert.alert( 'Success! Meeting invite sent.', 'success', 'growl-bottom-left' );
      }
    });
  },

  'click .navbar-brand': function(e) {
    FlowRouter.go('/');
  },

  'click #submit-extra-times': function(e) {
    e.preventDefault();

    // I think doing moment().format() inside of moment fixes stuff but i don't know why
    let startTime = moment($('#datetime-start').data("DateTimePicker").date().format());
    let endTime = moment($('#datetime-end').data("DateTimePicker").date().format());

    if (!endTime.isAfter(startTime)) {
      Bert.alert( 'End time must be after start time. ', 'danger', 'growl-bottom-left');
      return;
    }

    // convert moment object to js Date object
    var busyTime = {start: startTime.toDate(), end: endTime.toDate()};

    Meteor.call('addBusyTimes', busyTime, function(error, result) {
      if (error) {
        console.log("Error in addBusyTimes: " + error);
      } else {

        // not sure if we should only say success if the next two Meteor.call are successful
        Bert.alert( 'Success! Extra busy time added.', 'success', 'growl-bottom-left' );

        Meteor.call("getFullCalendarAdditional", function(error, result) {
          if (error) console.log(error);
          $( '#events-calendar' ).fullCalendar('removeEventSource', 'additional');
          $( '#events-calendar' ).fullCalendar('addEventSource', { id: 'additional', events: result });
        });
        Meteor.call('updateMeetableTimes', function(error, result) {
          if (error) console.log('updateBusyTimes: ' + error);
        });

      }
    });
  },

  'click #submit-no-meetings-times': function(e) {
    e.preventDefault();

    // I think doing moment().format() inside of moment fixes stuff but i don't know why
    let beforeTime = moment($('#no-meetings-before').data("DateTimePicker").date().format());
    let afterTime = moment($('#no-meetings-after').data("DateTimePicker").date().format());

    if (!afterTime.isAfter(beforeTime)) {
      Bert.alert("You must have some time you're available. ", 'danger', 'fixed-bottom');

      return;
    }

    Meteor.call('setMeetRange', beforeTime.format("HH:mm"), afterTime.format("HH:mm"), function(error, result) {
      if (error) console.log("Error in addRecurringBusyTimes: " + error);

      Meteor.call('updateMeetableTimes', function(error, result) {
        if (error) console.log('updateBusyTimes: ' + error);
        else {
          // reset datepickers to their (new) database values
          let earliest = moment(Meteor.users.findOne(Meteor.userId()).profile.meetRange.earliest, "hh:mm")
          let latest = moment(Meteor.users.findOne(Meteor.userId()).profile.meetRange.latest, "hh:mm");
          $('#no-meetings-before').data("DateTimePicker").date(earliest);
          $('#no-meetings-after').data("DateTimePicker").date(latest);

          Bert.alert( 'Settings saved', 'success', 'growl-bottom-left', 'fa-calendar-check-o' );
        }
      });
    });
  }

});

/////////////////////////////////////////////
/////////  additional template  /////////////
/////////////////////////////////////////////
Template.additional.helpers({
  additionalRange() {
    // let start = Meetings.findOne(this.toString()).selectedBlock.startTime;
    // let end = Meetings.findOne(this.toString()).selectedBlock.endTime;

    return moment(this.start).twix(moment(this.end)).format({
      showDayOfWeek: true,
      weekdayFormat: "ddd,",
      meridiemFormat: "a",
    });
  }
});

Template.additional.events({

  'click #delete-button': function(e) {
    //e.preventDefault();
    Meteor.call('deleteBusyTime', this, function(error, result) {
      if (error) throw "there are no additional busyTimes for some reason!";
      Meteor.call("getFullCalendarAdditional", function(error, result) {
        if (error) console.log(error);
        $( '#events-calendar' ).fullCalendar('removeEventSource', 'additional');
        $( '#events-calendar' ).fullCalendar('addEventSource', { id: 'additional', events: result });
      });
      console.log("Updating");
      Meteor.call('updateMeetableTimes', function(error, result) {
        if (error) console.log('updateBusyTimes: ' + error);
      });
    });
  }
});


/////////////////////////////////////////////
/////////     invite Template      //////////
/////////////////////////////////////////////

Template.invite.helpers({
  inviteType: function() {
    var thisMeeting = Meetings.findOne(this.toString());
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
    event.preventDefault();
    Meteor.call('acceptInvite', this.toString(), Meteor.userId(), function(error, result) {
      if (error) console.log("acceptInvite: " + error);
    });
  },
  'click #declineInvite': function(event, template) {
    event.preventDefault();
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
      return Meetings.findOne(this.toString()).participants[0].email;
    },
  meetingTitle() {
      return Meetings.findOne(this.toString()).title;
    },
  meetingDuration() {
      var length = Meetings.findOne(this.toString()).duration;
      var hour = Math.floor(length / (1000 * 60 * 60));
      var minute = (length / (1000 * 60)) % 60;
      return hour + "hr " + minute + "min";
    },
  acceptedInvite() {
    var thisMeeting = Meetings.findOne(this.toString());
    // iterate through all meeting participants to find index in array for the current user
    // NOTE: Switch this to check all users, I don't think we should assume the first participant is always the creator. May get us into trouble later
    for (var i = 0; i < thisMeeting.participants.length; i++) {
      var currUser = thisMeeting.participants[i];
      if (currUser.id === Meteor.userId()) { // current user found
        return currUser.accepted;
      }
    }
  },
  incomingWindowRange() {
    let windowStart = Meetings.findOne(this.toString()).windowStart;
    let windowEnd = Meetings.findOne(this.toString()).windowEnd;

    return moment(windowStart).twix(moment(windowEnd)).format({
      showDayOfWeek: true,
      weekdayFormat: "ddd,",
      meridiemFormat: "a",
    });
  }
});

/////////////////////////////////////////////
////////  readyToFinalize Template   ////////
/////////////////////////////////////////////

Template.readyToFinalize.helpers({
  finalizeType: function() {
    var thisMeeting = Meetings.findOne(this.toString());
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
      return Meetings.findOne(this.toString()).participants[0].email;
    },
  meetingTitle() {
      return Meetings.findOne(this.toString()).title;
    },
  meetingDuration() {
      var length = Meetings.findOne(this.toString()).duration;
      var hour = Math.floor(length / (1000 * 60 * 60));
      var minute = (length / (1000 * 60)) % 60;
      return hour + "hr " + minute + "min";
    },
});

Template.selector.helpers({
  inviterName() {
      return Meetings.findOne(this.toString()).participants[0].email;
    },
  meetingTitle() {
      return Meetings.findOne(this.toString()).title;
    },
  meetingDuration() {
      var length = Meetings.findOne(this.toString()).duration;
      var hour = Math.floor(length / (1000 * 60 * 60));
      var minute = (length / (1000 * 60)) % 60;
      return hour + "hr " + minute + "min";
    },
  suggestedTimes() {
    return Meetings.findOne(this.toString()).suggestedMeetingTimes;
  },
  formattedStart() {
    var startDate = new Date(this.startTime);
    var pm = "AM";
    var weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    var day = weekday[startDate.getDay()];
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var month = months[startDate.getMonth()];
    var date = startDate.getDate();
    var year = startDate.getFullYear();
    var hour = startDate.getHours();
    if (hour > 12) {
      hour = hour - 12;
      pm = "PM";
    }
    if (hour < 10) hour = "0" + hour;
    var min = startDate.getMinutes();
    if (min < 10) min = "0" + min;
    return (day + " " + month + " " + date + ", " + year + " " + hour + ":" + min + " " + pm);
  },
  formattedEnd() {
    var endDate = new Date(this.endTime);
    var pm = "AM";
    var weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    var day = weekday[endDate.getDay()];
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var month = months[endDate.getMonth()];
    var date = endDate.getDate();
    var year = endDate.getFullYear();
    var hour = endDate.getHours();
    if (hour > 12) {
      hour = hour - 12;
      pm = "PM";
    }
    if (hour < 10) hour = "0" + hour;
    var min = endDate.getMinutes();
    if (min < 10) min = "0" + min;
    return (day + " " + month + " " + date + ", " + year + " " + hour + ":" + min + " " + pm);
  },
  noPrevSuggested() {
    var meeting = Meetings.findOne(this.toString());
    var available = meeting.durationLongAvailableTimes;
    var index = meeting.suggestedRangeIndex;

    if ((index - 1) < 0) return true;
    return false;
  },
  noNextSuggested() {
    var meeting = Meetings.findOne(this.toString());
    var available = meeting.durationLongAvailableTimes;
    var index = meeting.suggestedRangeIndex;

    if ((index + 1) >= (available.length / 5)) return true;
    return false;
  },
  suggestedRange() {
    return moment(this.startTime).twix(moment(this.endTime)).format({
      showDayOfWeek: true,
      weekdayFormat: "ddd,",
      meridiemFormat: "a",
    });
  }
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

          Meteor.call('updateMeetableTimes', function(error, result) {
            if (error) console.log('updateBusyTimes: ' + error);
          });
        }
      });
    },
    'click #cancelInvite': function(event){
      event.preventDefault();
      Meteor.call('setNotReadyToFinalize', this.toString(), function(error, result) {
        if (error) console.log(error);
      });
    },
    'click #deleteMeeting': function(e) {
      e.preventDefault();
      Meteor.call('deleteMeeting', this.toString(), function(error, result) {
        if (error) console.log('deleteMeeting: ' + error);
        Meteor.call('updateMeetableTimes', function(error, result) {
          if (error) console.log('updateBusyTimes: ' + error);
        });
      });
    },
    'click #prevSuggestedTimes' :function(e) {
      e.preventDefault();
      Meteor.call('getPrevSuggestedTimes', this.toString(), function(error, result) {
        if (error) console.log('getPrevSuggestedTimes: ' + error);
      });
    },
    'click #nextSuggestedTimes' :function(e) {
      e.preventDefault();
      Meteor.call('getNextSuggestedTimes', this.toString(), function(error, result) {
        if (error) console.log('getNextSuggestedTimes: ' + error);
      });
    },
});

Template.outgoing.helpers({
  meetingParticipants() {
    var peopleList = Meetings.findOne(this.toString()).participants;
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
    return Meetings.findOne(this.toString()).title;
  },
  meetingDuration() {
    var length = Meetings.findOne(this.toString()).duration;
    var hour = Math.floor(length / (1000 * 60 * 60));
    var minute = (length / (1000 * 60)) % 60;
    return hour + "hr " + minute + "min";
  },
  readyToFinalize() {
    var readyOutgoing = false;
    // an outgoing meeting is only ready to finalize if the flag 'readytoFinalize' is set to true AND this meeting is a group meeting
    if (Meetings.findOne(this.toString()).readyToFinalize && Meetings.findOne(this.toString()).participants.length > 2)
    {
      readyOutgoing = true;
    }
    return readyOutgoing;
  },
  outgoingWindowRange() {
    let windowStart = Meetings.findOne(this.toString()).windowStart;
    let windowEnd = Meetings.findOne(this.toString()).windowEnd;

    return moment(windowStart).twix(moment(windowEnd)).format({
      showDayOfWeek: true,
      weekdayFormat: "ddd,",
      meridiemFormat: "a",
    });
  }
});

Template.outgoing.events({
  'click #deleteOutgoing': function(event) {
    event.preventDefault();
    Meteor.call('deleteMeeting', this.toString(), function(error, result) {
      if (error) console.log(error);
    });
  }
})

Template.outgoingFinalize.helpers({
  inviterName() {
      return Meetings.findOne(this.toString()).participants[0].email;
    },
  meetingTitle() {
      return Meetings.findOne(this.toString()).title;
    },
  meetingDuration() {
      var length = Meetings.findOne(this.toString()).duration;
      var hour = Math.floor(length / (1000 * 60 * 60));
      var minute = (length / (1000 * 60)) % 60;
      return hour + "hr " + minute + "min";
    },
  suggestedTimes:function() {
        return Meetings.findOne(this.toString()).suggestedMeetingTimes;
    },
  participants() {
    var peopleList = Meetings.findOne(this.toString()).participants;
    var participants = "";
    var comma = ", ";
    participants = participants.concat(peopleList[1].email);
    for (var i = 2; i < peopleList.length; i++) {
      participants = participants.concat(comma);
      participants = participants.concat(peopleList[i].email);
    }
    return participants;
  },
  suggestedRange() {
    return moment(this.startTime).twix(moment(this.endTime)).format({
      showDayOfWeek: true,
      weekdayFormat: "ddd,",
      meridiemFormat: "a",
    });
  },
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
      Meteor.call('deleteMeeting', this.toString(), function(error, result) {
        if (error) console.log(error);
      });
    }
});

Template.finalizedMeeting.helpers({
  meetingHost() {
    return Meetings.findOne(this.toString()).participants[0].email;
  },
  participants() {
    var peopleList = Meetings.findOne(this.toString()).participants;
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
    return Meetings.findOne(this.toString()).title;
  },
  selectedrange() {
    let start = Meetings.findOne(this.toString()).selectedBlock.startTime;
    let end = Meetings.findOne(this.toString()).selectedBlock.endTime;

    return moment(start).twix(end).format({
      showDayOfWeek: true,
      weekdayFormat: "ddd,",
      meridiemFormat: "a",
    });
  },
  addedToGCal: function() {
    var thisMeeting = Meetings.findOne(this.toString());
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

Template.calendar.helpers({
  calendarTitle: function() {
    var profile = Meteor.users.findOne(Meteor.userId()).profile;
    if (profile) return profile.calendars[this.toString()].title;
  },
  isChecked: function() {
    var profile = Meteor.users.findOne(Meteor.userId()).profile;
    if (profile) return profile.calendars[this.toString()].considered;
  }
});

Template.calendar.events({
  'click input': function(event) {
    var id = this.toString();
    Meteor.call('setCalendarConsideration', id, function(error, result) {
      if (error) console.log(error);
      var busyId = 'gCalBusy' + id;
      var availableId = 'gCalAvailable' + id;
      $( '#events-calendar' ).fullCalendar('removeEventSource', busyId);
      $( '#events-calendar' ).fullCalendar('removeEventSource', availableId);
      if (result[id].considered) {
        // OKAY THIS IS INEFFICIENT BUT BETTER THAN PULLING FROM GCAL SO SUE ME
        var busyEvents = Meteor.users.findOne(Meteor.userId()).profile.calendarEvents;
        var availableEvents = Meteor.users.findOne(Meteor.userId()).profile.availableEvents;
        var addedBusy = [];
        var addedAvailable = [];

        for (var i = 0; i < busyEvents.length; i++) {
          if (busyEvents[i].calendarId === id) addedBusy.push(busyEvents[i]);
        }
        for (i = 0; i < availableEvents.length; i++) {
          if (availableEvents[i].calendarId === id) addedAvailable.push(availableEvents[i]);
        }
        $( '#events-calendar' ).fullCalendar('addEventSource', { id: busyId, events: addedBusy });
        $( '#events-calendar' ).fullCalendar('addEventSource', { id: availableId, events: addedAvailable });
      }

      Meteor.call('updateMeetableTimes', function(error, result) {
        if (error) console.log('updateBusyTimes: ' + error);
      });
    });
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

// Return true if this browser is using a mobile user agent
// used primarily for changing default full calendar view
// instead of manually checking screen size
// source: http://stackoverflow.com/questions/41908295/fullcalendar-change-view-for-mobile-devices
window.mobilecheck = function() {
  var check = false;
  (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
  return check;
};
