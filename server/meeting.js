// File for our server functions for serving OUR meetings/events to client.
// As opposed to scheduling meetings (scheduling.js) or pulling from Google (googleCalendarApi.js)
import Meetings from '/collections/meetings.js';

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

      for (var j = 0; j < thisMeeting.participants.length; j++) {
        var thisParticipant = thisMeeting.participants[j];
        // Do not include events added to GCal to avoid presenting them twice to user
        if (thisParticipant.id === this.userId && thisParticipant.addedToGCal) continue;
      }

      var thisEvent = {
        title: thisMeeting.title,
        start: thisMeeting.selectedBlock.startTime,
        end:   thisMeeting.selectedBlock.endTime,
        color: "#b30000"
      };
      events.push(thisEvent);
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
    // Remove from each user in this meeting
    for (var i = 0; i < participants.length; i++) {
      var userId = Meteor.users.findOne(participants[i].id);
      // Remove from the users sent and and received
      Meteor.users.update(userId, {
        $pull: { 'profile.meetingInvitesSent': meetingId }
      });
      Meteor.users.update(userId, {
        $pull: { 'profile.meetingInvitesReceived': meetingId }
      });
      Meteor.users.update(userId, {
        $pull: { 'profile.finalizedMeetings': meetingId }
      });
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
});
