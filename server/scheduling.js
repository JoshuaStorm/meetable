// File for our server functions for scheduling OUR meetings/events. (as opposed to Google events)
import Meetings from '/collections/meetings.js'


Meteor.methods({

  // Add the meeting to the user
  // meeting (fullCalMeeting): The meeting to add to t
  // addMeeting: function(meeting) {
  //   var meetings = Meteor.users.findOne(this.userId).meetingEvents;
  //   if (meetings === undefined) meetings = [];
  //
  //   meetings.push(meeting);
  //
  //   Meteor.users.update(this.userId, {
  //     $set: {
  //       meetingEvents: meetings
  //     }
  //   });
  // },

  // create the Meeting document for the meeting being scheduled
  // TODO: currently assumes meetings must be within 24 hours of clicking create meeting
  // invitedemails (array of strings): list of email addresses to invite
  // duration (float): length of the meeting in hours
  // windowStart (Moment.js object): earliest possible time to meet
  // windowEnd (Moment.js object): latest possible time to meet


  createMeeting: function(invitedEmails, duration, windowStart, windowEnd) {
    var meeting = {
      participants: [{
        id: this.userId,
        name: Meteor.users.findOne(this.userId).services.google.name,
        email: Meteor.users.findOne(this.userId).services.google.email,
        accepted: true, // creator automatically accepts event?? 
        selector: false // creator is not always the one who picks the final date
      }],
      duration: duration * 3600 * 1000,
      windowStart: windowStart,
      windowEnd: windowEnd,
      selectedStartTime: null // will be calculated when all participants have accepted
    };

    // add the invited participants
    // TODO: any special considerations for users that don't have accoutns yet?
    // for now, make their name and id null
    for (var i = 0; i < invitedEmails.length; i++) {
      newParticipant = {
        id: null,
        name: null,
        email: invitedEmails[i],
        accepted: false,
        selector: false
      };

      // check if a user with this email exists,and if it does, use their personal info
      var user = Meteor.users.findOne({"services.google.email": invitedEmails[i]});
      if (user !== undefined)
      {
        newParticipant.name = user.services.google.name;
        newParticipant.id = user.id;
        // TODO: Perhaps we should have a modal confirmation saying
        // "This user doesn't seem to have an account, would you like to invite them?"
        
        // TODO: PROBLEM!!!!!! We need to associate this event with an account that DOES NOT YET EXIST
        // Not TOO hard to handle, just need to create a new collection.        
      } 

      // add this newParticipant to the document
      meeting.participants.push(newParticipant);
    }

    // if meeting is only two people, the invitee gets to choose the meeting time
    // in meetings of more than two people, the event creator chooses the meeting time
    if (meeting.participants.length === 2) {
      meeting.participants[1].selector = true;
    }
    else {
      meeting.participants[0].selector = true;
    }

    var availableTimes = [{
      startTime: windowStart,
      endTime: windowEnd
    }];

    meeting.availableTimes = availableTimes;

    // console.log("meeting document:");
    // console.log(meeting);

    var busyTimes = findUserBusyTimes(this.userId, windowStart, windowEnd);

    var loggedInUserAvailableTimes = findUserAvailableTimes(busyTimes, windowStart, windowEnd);
    meeting.availableTimes = findOverlap(availableTimes, loggedInUserAvailableTimes);

    console.log("busyTimes");
    console.log(busyTimes);

    console.log("loggedInUserAvailableTimes");
    console.log(loggedInUserAvailableTimes);

    console.log("overlapped times:");
    console.log(meeting.availableTimes);

    // TODO: insert this into the Mongo DB

    // var calendarList = Meteor.call("getCalendarList");

    // var gcalEvents = Meteor.call("getEventListTest", windowStart, windowEnd);

    // TODO: check currently gives Exception while invoking method 'createMeeting' Error: Match error: Unknown key in field participants

    //check(meeting, Meetings.simpleSchema());
  },

  // Send out an invitation to a meeting/event
  // userEmails ([emails]): An array of the emails to schedule this meeting with
  // title (String): Title of the event/meeting
  // duration (float): Length of the event/meeting
  // TODO: Handle more than Google account
  inviteToMeeting: function(userEmails, title, duration) {
    // The email of the person inviting others to meeting
    var inviterEmail = Meteor.user().services.google.email;
    var invitation = {
      inviter: inviterEmail,
      invited: userEmails,
      title: title,
      length: duration
    };

    // Update the inviters sent invites in the DB
    var invites = Meteor.users.findOne(this.userId).meetingInvitesSent; // Pull their meeting invitations
    if (invites === undefined) invites = [];
    invites.push(invitation); // Append
    Meteor.users.update(this.userId, { // Now set the values again
      $set: {
        meetingInvitesSent: invites
      }
    });

    for (var i = 0; i < userEmails.length; i++) {
      // The user being invited
      var user = Meteor.users.findOne({"services.google.email": userEmails[i]});
      // If the user DNE, invite them! :)
      if (user === undefined) {
        // TODO: Perhaps we should have a modal confirmation saying
        // "This user doesn't seem to have an account, would you like to invite them?"
        sendInvitationEmail(inviterEmail, userEmails[i], title);

        // TODO: PROBLEM!!!!!! We need to associate this event with an account that DOES NOT YET EXIST
        // Not TOO hard to handle, just need to create a new collection.
      } else {
        sendNewMeetingEmail(inviterEmail, userEmails[i], title);
        // Also need to add this invitation to their DB point so they can actually schedule it
        invites = Meteor.users.findOne(user._id).meetingInvitesReceived // Pull their meeting invitations
        if (invites === undefined) invites = [];
        invites.push(invitation); // Append
        Meteor.users.update(user._id, { // Now set the values again
          $set: {
            meetingInvitesReceived: invites
          }
        });
      }
    }

  }
});

// Send an invitation email to the inviteeEmail. THIS IS ONLY USED TO INVITED NEW USERS
// inviterEmail (emailString): The email address of the inviter TODO: Make this a name?
// inviteeEmail (emailString): The email address of the person being invited
// title (String): The event title in which a user is being invited.
function sendInvitationEmail(inviterEmail, inviteeEmail, title) {
  var subject = inviterEmail + " wants to meet with you! Join Meetable to schedule it now!";
  var text = inviterEmail + " wants to meet with you for a meeting \"" + title + "\"\n\n" +
            "Schedule your meeting now with Meetable. Forget filling out when you're available by hand, " +
            "Meetable compares your free time from your Google Calendar so you just have to pick one time that " +
            "you already know works for everyone!\n\n" +
            "Join now! https://www.meetable.us\n\n\n" +
            "You are receiving this email because " + inviterEmail + " tried to invite you to Meetable.";
  Meteor.call("sendEmail", inviteeEmail, inviterEmail, subject, text);
}

// Same as above, but text is assuming user already has account... Not the best modularity but whatevs
function sendNewMeetingEmail(inviterEmail, inviteeEmail, title) {
  var subject = inviterEmail + " wants to meet with you! Login to Meetable to schedule it now!";
  var text = inviterEmail + " wants to meet with you for a meeting \"" + title + "\"\n" +
            "Login to schedule it now! https://www.meetable.us\n\n\n" +
            "You are receiving this email because " + inviterEmail + " tried to invite you to Meetable.";
  Meteor.call("sendEmail", inviteeEmail, inviterEmail, subject, text);
}

function toUnixDate(date) {
  var unixTime = new Date(date);

  return unixTime.getTime();
}

function toDate(date) {
  var date = new Date(date);

  return date;
}


// inserts time into the array of times, times, in chronological order. Pass by refrence.
// Assumes times is already chronological (otherwise this would be a sorting function #neverAgain)
function insertInOrder(times, time) {
  var oldTimes = [];

  // Loop through the times stack and remove items one by one until the place of time is found
  // Store popped times in oldTimes array so they may be restored after completion
  while (times.length > 0) {
    var oldTime = times.pop();

    // If the current time is greater than the previous time, that means the current time has
    // found its place in the stack and must be inserted right after the oldTime
    if (time.startTime.getTime() > oldTime.startTime.getTime()) {
      times.push(oldTime);
      break;
    }
    oldTimes.push(oldTime);
  }

  times.push(time);

  //restore the stack after inserting the time in proper place
  while (oldTimes.length > 0) {
    times.push(oldTimes.pop());
  }

}


// Find users busy times using calendar info and additional busy times and stores them
// chronologically in easy to use format from windowStart to windowEnd
function findUserBusyTimes(userId, windowStart, windowEnd) {
  var user = Meteor.users.findOne(userId);
  var calendarTimes = user.calendarEvents;

  var busyTimes = [];

  for (var i = 0; i < calendarTimes.length; i++) {
    var start = toDate(calendarTimes[i].start);
    var end = toDate(calendarTimes[i].end);
    var busyTime = {startTime: 0, endTime: 0};

    // Only include events from windowStart to windowEnd
    //if the end of the event isn't within the window, exclude it
    //if start isn't withing the window, exclude it
    if (end.getTime() <= windowStart.getTime()) continue;
    if (start.getTime() >= windowEnd.getTime()) continue;

    // If this is the first element to be inserted in the array, the startTime is the window start
    if (busyTimes.length == 0) {
      busyTime.startTime = start;
      if (start.getTime() < windowStart) busyTime.startTime = windowStart;
      busyTime.endTime = end;
      busyTimes.push(busyTime);
    }

    else {
      busyTime.startTime = start;
      busyTime.endTime = end;
      if (end.getTime() > windowEnd.getTime()) busyTime.endTime = windowStart;

      // If the startTime of the current event is inside the previous event, this means these two events
      // are partially overlapping. This means the busyTime should be from the startTime of the previous
      // event, to the endTime of the event that lasts longer.
      var oldBusyTime = busyTimes.pop();
      var oldStartTime = oldBusyTime.StartTime;
      if ((start.getTime() >= oldBusyTime.startTime.getTime()) && (start.getTime() <= oldBusyTime.endTime.getTime())) {
        busyTime.startTime = oldBusyTime.startTime;
        busyTime.endTime = end;
        if (oldBusyTime.endTime.getTime() > end.getTime()) busyTime.endTime = oldBusyTime.endTime;
      }
      else busyTimes.push(oldBusyTime);
    

    // if the current start time is greater than or equal to the previous, the the event is already chronological
    // otherwise, it needs to be placed in the array in chronological order
    if (start.getTime() >= oldStartTime) busyTimes.push(busyTime);
    else insertInOrder(busyTimes, busyTime);
    }
  }

  return busyTimes;
}

// given a userId, find the available times of the person based on their
// google calendar stored in database and additional busy times (both are stored in database) 
function findUserAvailableTimes(busyTimes, windowStart, windowEnd) {
  //var user = Meteor.users.findOne(userId);

  var availableTimes = [];
 // var additionalTimes = user.additionalTimes;

  // TODO: add way to add additional busy times
  // for (i in additionalTimes) {
  //   availableTimes.push(i);
  // }

  // loop through calendarEvents, and find inverse times
  //var calendarTimes = user.calendarEvents;
  var last = 0;

  for (var i = 0; i < busyTimes.length; i++) {
    var startRange = windowStart;
    
    // first availableTime is from windowStart - busyTimes[0].start
    if (windowStart.getTime() > busyTimes[i].startTime.getTime() || busyTimes[i].endTime.getTime() > windowEnd.getTime()) {
      continue;
    }
    last = i;
    // find inverse of times
    if (i != 0) {
      startRange = (busyTimes[i - 1].endTime);
    }

    var endRange = busyTimes[i].startTime;

    var availableTime = {
      startTime: (startRange),
      endTime: (endRange)
    };

    availableTimes.push(availableTime);
  }

  // final available time
  var availableTime = {
    startTime: (busyTimes[last].endTime),
    endTime: windowEnd
  };
  availableTimes.push(availableTime);

  return availableTimes;
}

// Given the available times in the meetings collection, and the availableTimes
// of a single user, 
// return another availableTimes array which contains the times where available times and 
// and busy times DONT intersect. I.E. where there are overlaps in 
function findOverlap(otherAvailableTimes, userAvailableTimes) {
  // hold available times that work for all users
  var availableTimes = [];

  //each availableTimes array has a start time and end time, both in unix

  //first double for loop finds the searches for slots of length otherAvailableTimes in user availabeTimes
  for (var i = 0; i < otherAvailableTimes.length; i++) {
    var o = otherAvailableTimes[i];
    var otherStart = o.startTime;
    var otherEnd = o.endTime;

    for (var j = 0; j < userAvailableTimes.length; j++) {
    var u = userAvailableTimes[j];
      var userStart = u.startTime;
      var userEnd = u.endTime;

      if (otherStart.getTime() >= userStart.getTime() && otherEnd.getTime() <= userEnd.getTime()) {
        var availableTime = {
          startTime: otherStart,
          endTime: otherEnd
        };
      
        availableTimes.push(availableTime);

      }
    }
  }

    //The second double for loop looks for slots of userAvailableTimes in otherAvailableTimes
  for (var j = 0; j < userAvailableTimes.length; j++) {
    var u = userAvailableTimes[j];  
    var userStart = u.startTime;
    var userEnd = u.endTime;

    for (var i = 0; i < otherAvailableTimes.length; i++) {
    var o = otherAvailableTimes[i];
      var otherStart = o.startTime;
      var otherEnd = o.endTime;

      if (userStart.getTime() >= otherStart.getTime() && userEnd.getTime() <= otherEnd.getTime()) {
        var availableTime = {
          startTime: userStart,
          endTime: userEnd
        };
      
        availableTimes.push(availableTime);

      }
    }
  }

    return availableTimes;

  }
