// File for our server functions for serving OUR meetings/events to client.
// As opposed to scheduling meetings (scheduling.js) or pulling from Google (googleCalendarApi.js)
import Meetings from '/collections/meetings.js';
import Temp from '/collections/temp.js';

Meteor.methods({
  // Return an array of the current users finalized events in the FullCalendar format
  // NOTE: This will NOT return the finalized meetings pushed to GCal.
  getFullCalendarFinalized: function() {
    var finalizedIds = Meteor.users.findOne(this.userId).profile.finalizedMeetings;
    // A user may not have any finalized meetings
    if (!finalizedIds || !finalizedIds.length) return [];
    var events = [];

    for (var i = 0; i < finalizedIds.length; i++) {
      var thisMeeting = Meetings.findOne(finalizedIds[i]);
      if (!thisMeeting) {
        console.log("Error in getFullCalendarFinalized: Meeting Id exists on user but now in Meetings");
        return;
      }

      // Don't give back events that have been added to gCal
      var addToCal = true;
      for (var j = 0; j < thisMeeting.participants.length; j++) {
        var thisParticipant = thisMeeting.participants[j];
        // Do not include events added to GCal to avoid presenting them twice to user
        if (thisParticipant.id === this.userId && thisParticipant.addedToGCal) addToCal = false;
      }

      var thisEvent = {
        title: thisMeeting.title,
        start: thisMeeting.selectedBlock.startTime,
        end:   thisMeeting.selectedBlock.endTime,
        color: "#b30000"
      };
      if (addToCal) events.push(thisEvent);
    }
    return events;
  },

  getFullCalendarAdditional: function() {
    var additionals = Meteor.users.findOne(this.userId).profile.additionalBusyTimes;
    if (!additionals) return [];
    var events = [];

    for (var i = 0; i < additionals.length; i++) {
      var additional = additionals[i];

      var thisEvent = {
        title: "User added busy time",
        start: additional.start,
        end: additional.end,
        borderColor: "#b21503",
        backgroundColor: "rgba(188, 183, 183, 0.5)",
        textColor: "#000000",
      };
      events.push(thisEvent);
    }
    return events;
  },

  deleteMeeting: function(meetingId) {
    var meeting = Meetings.findOne(meetingId);
    var participants = meeting.participants;

    // Get the hosts email
    var hostEmail = "";
    for (var i = 0; i < participants.length; i++) {
      if (participants[i].creator) hostEmail = participants[i].email;
    }

    // Remove from each user in this meeting
    for (i = 0; i < participants.length; i++) {
      // If this wasn't deleted by the creator, inform the creator it was deleted via email
      if (participants[i].creator && participants[i].id !== this.userId) {
        var deleterEmail = Meteor.users.findOne(this.userId).services.google.email;
        Meteor.call('sendDeletedEmail', participants[i].email, deleterEmail, meeting.title);
      } else if (participants[i].id !== this.userId) { // If this was deleted by the creator, inform everyone else
        Meteor.call('sendDeletedGroupEmail', participants[i].email, hostEmail, meeting.title);
      }

      // The user isn't temp
      if (participants[i].id) {
        Meteor.users.update(participants[i].id, {
          $pull: { 'profile.meetingInvitesSent': meetingId }
        });
        Meteor.users.update(participants[i].id, {
          $pull: { 'profile.meetingInvitesReceived': meetingId }
        });
        Meteor.users.update(participants[i].id, {
          $pull: { 'profile.finalizedMeetings': meetingId }
        });
      } else { // Remove from temp user
        var tempUser = Temp.findOne({ email: participants[i].email });
        Temp.update(tempUser._id, {
          $pull: { 'meetingInvitesReceived': meetingId }
        });
      }
    }
    // Remove the event itself
    Meetings.remove(meetingId);
  },

  // Add the given meeting ID to the curren users calendar, mark it as added to GCal
  // meetingId (String): The meetingId
  addMeetingToUserCalendar: function(meetingId) {
    var thisMeeting = Meetings.findOne(meetingId);
    Meteor.call('addGCalEvent', thisMeeting.title, thisMeeting.selectedBlock.startTime, thisMeeting.selectedBlock.endTime);
    // Mark this as added to GCal for the current user in the participant array of this meeting
    for (var i = 0; i < thisMeeting.participants.length; i++) {
      var thisParticipant = thisMeeting.participants[i];
      if (thisParticipant.id === this.userId) {
        var setModifier = {};
        setModifier['participants.' + i + '.addedToGCal'] = true;
        Meetings.update(meetingId, {
          $set: setModifier
        });
        break;
      }
    }
  },

  // Check all meetings associated with this user, if they're expired delete them.
  deleteOldMeetings: function() {
    var user = Meteor.users.findOne(this.userId);
    var receivedIds = user.profile.meetingInvitesReceived;
    if (!receivedIds) receivedIds = [];
    var sentIds = user.profile.meetingInvitesSent;
    if (!sentIds) sentIds = [];
    var finalizedIds = user.profile.finalizedMeetings;
    if (!finalizedIds) finalizedIds = [];

    var now = new Date();
    var meetingIdsToDelete = [];
    // Add to a delete array, otherwise array would change length during iteration === bad
    for (var i = 0; i < receivedIds.length; i++) {
      var thisMeeting = Meetings.findOne(receivedIds[i]);
      if (thisMeeting.windowEnd.getTime() < now.getTime()) {
        meetingIdsToDelete.push(receivedIds[i]);
      }
    }
    for (i = 0; i < sentIds.length; i++) {
      var thisMeeting = Meetings.findOne(sentIds[i]);
      if (thisMeeting.windowEnd.getTime() < now.getTime()) {
        meetingIdsToDelete.push(sentIds[i]);
      }
    }
    for (i = 0; i < finalizedIds.length; i++) {
      var thisMeeting = Meetings.findOne(finalizedIds[i]);
      if (thisMeeting.selectedBlock.endTime.getTime() < now.getTime()) {
        meetingIdsToDelete.push(finalizedIds[i]);
      }
    }
    // EXTERMINATE
    for (i = 0; i < meetingIdsToDelete.length; i++) {
      Meteor.call('deleteMeeting', meetingIdsToDelete[i]);
    }
  },

  // Get the available duration long blocks in the full calendar format for this meeting
  getFullCalendarAvailable: function(meetingId) {
    var meeting = Meetings.findOne(meetingId);
    // Can only get available if meeting is ready to finalize
    if (!meeting.readyToFinalize) return [];
    var events = meeting.durationLongAvailableTimes;

    var thisId = meetingId + '-AVAILABLE';
    var fullCalEvents = [];
    for (var i = 0; i < events.length; i++) {
      var thisEvent = events[i];
      var thisFullCalEvent = {
        'title': meeting.title,
        'start': thisEvent.startTime,
        'end': thisEvent.endTime,
        'calendarId': thisId,
        'color': '#00ba3e'
      };
      fullCalEvents.push(thisFullCalEvent);
    }
    return fullCalEvents;
  }
});
