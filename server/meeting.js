// File for our server functions for serving OUR meetings/events to client.
// As opposed to scheduling meetings (scheduling.js) or pulling from Google (googleCalendarApi.js)
import Meetings from '/collections/meetings.js';

Meteor.methods({
  // Return an array of the current users finalized events in the FullCalendar format
  // Return null if user does not have any finalized
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
  }
});
