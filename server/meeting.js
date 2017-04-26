// File for our server functions for serving OUR meetings/events to client.
// As opposed to scheduling meetings (scheduling.js) or pulling from Google (googleCalendarApi.js)
import Meetings from '/collections/meetings.js';

Meteor.methods({
  // Return an array of the current users finalized events in the FullCalendar format
  getFullCalendarFinalized: function() {
    var finalizedIds = Meteor.users.findOne(this.userId).profile.finalizedMeetings;
    var events = [];

    for (var i = 0; i < finalizedIds.length; i++) {
      var thisMeeting = Meetings.findOne(finalizedIds[i]);
      if (!thisMeeting) {
        console.log("Error in getFullCalendarFinalized: Meeting Id exists on user but now in Meetings");
        return;
      }
      console.log("Found finalized!: " + thisMeeting.title);
      console.log(thisMeeting.selectedBlock.startTime);
      console.log(thisMeeting.selectedBlock.endTime);
      var thisEvent = {
        title: thisMeeting.title,
        start: thisMeeting.selectedBlock.startTime,
        end:   thisMeeting.selectedBlock.endTime,
        color: 0xff0000
      };
      events.push(thisEvent);
    }
    return events;
  },
});
