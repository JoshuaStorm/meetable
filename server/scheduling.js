// File for our server functions for scheduling OUR meetings/events. (as opposed to Google events)
import Meetings from '/collections/meetings.js';
import Temp from '/collections/temp.js';


Meteor.methods({

  // create the Meeting document for the meeting being scheduled
  // TODO: currently assumes meetings must be within 24 hours of clicking create meeting
  // invitedemails (array of strings): list of email addresses to invite
  // duration (float): length of the meeting in hours
  // windowStart (Moment.js object): earliest possible time to meet
  // windowEnd (Moment.js object): latest possible time to meet
  createMeeting: function(title, invitedEmails, duration, windowStart, windowEnd) {
    var thisUserEmail = Meteor.users.findOne(this.userId).services.google.email;
    // If this is just the user being silly and trying to invite themselves to their own meeting, do nothing
    if (invitedEmails.length === 1 && invitedEmails[0].toLowerCase() === thisUserEmail.toLowerCase()) return;

    var participants = [{
        id: this.userId,
        // name: Meteor.users.findOne(this.userId).services.google.name,
        email: thisUserEmail,
        accepted: true, // creator automatically accepts event??
        selector: false, // creator is  not always the one who picks the final date
        creator: true,
      }];

    // add the invited participants
    // TODO: any special considerations for users that don't have accoutns yet?
    // for now, make their name and id null

    for (var i = 0; i < invitedEmails.length; i++) {
      // Don't allow a user to invite themselves
      if (invitedEmails[i].toLowerCase() === thisUserEmail.toLowerCase()) continue;
      newParticipant = {
        id: null,
        // name: null,
        email: invitedEmails[i],
        accepted: false,
        selector: false,
        creator: false,
      };

      // TODO: why is id missing sometimes?
      // check if a user with this email exists,and if it does, use their personal info
      var user = Meteor.users.findOne({"services.google.email": invitedEmails[i]});
      if (user !== undefined) {
        // newParticipant.name = user.services.google.name;
        newParticipant.id = user._id;
        // Send an email to the user letting them now they have a new meeting invite
        sendNewMeetingEmail(participants[0].email, newParticipant.email, title);
        // TODO: Perhaps we should have a confirmation saying
        // "This user doesn't seem to have an account, would you like to invite them?"
      } else {
        // Otherwise send them a invitation email to join Meetable
        sendInvitationEmail(participants[0].email, newParticipant.email, title);
      }
      // add this newParticipant to the document
      participants.push(newParticipant);
    }

    // if meeting is only two people, the invitee gets to choose the meeting time
    // in meetings of more than two people, the event creator chooses the meeting time
    if (participants.length === 2) {
      participants[1].selector = true;
    }
    else {
      participants[0].selector = true;
    }

    var availableTimes = [{
      startTime: windowStart,
      endTime: windowEnd
    }];

    var busyTimes = findUserBusyTimes(this.userId, windowStart, windowEnd);
    console.log("busyTimes");

    Meteor.users.upsert(this.userId, {
      $set: {
        "profile.busyTimes": busyTimes
      }
    });

    var loggedInUserAvailableTimes = findUserAvailableTimes(busyTimes, windowStart, windowEnd);
    availableTimes = findOverlap(availableTimes, loggedInUserAvailableTimes);

    // TODO: insert this into the Mongo DB
    var meetingId = Meetings.insert({
      title: title, //TODO: pass this as a parameter to createMeeting
      isFinalized: false,
      availableTimes: availableTimes,
      participants: participants,
      duration: duration * 3600 * 1000,
      windowStart: windowStart,
      windowEnd: windowEnd,
      selectedStartTime: null, // will be calculated when all participants have accepted
      readyToFinalize: false
    });

    var sent = Meteor.users.findOne(this.userId).profile.meetingInvitesSent;
    // Create a new set if necessary
    if (!sent) {
      Meteor.users.update(this.userId, { // Now set the values again
        $set: {
          "profile.meetingInvitesSent": [meetingId]
        }
      });
    } else {
      Meteor.users.update(this.userId, { // Now set the values again
        $addToSet: {
          "profile.meetingInvitesSent": meetingId
        }
      });
    }
    // Make sure all the invitees get this meeting associated with their userId
    for (var i = 0; i < participants.length; i++) {
      // The creater sent the invite, therefore is not being invited!
      console.log("Yep, user: " + participants[i].id);
      if (participants[i].creator == true) continue;
      // TODO: Need to associate this with a temporary user!!!!! For now, just skip
      if (participants[i].id == null) {
        var tempUser = Temp.findOne({email: participants[i].email});
        var ids = meetingId
        console.log(tempUser);
        if (!tempUser) {
          Temp.insert({
            email: participants[i].email,
            meetingInvitesReceived: [meetingId]
          });
        } else {
          Temp.update(tempUser._id, {
            $addToSet: {
              meetingInvitesReceived: meetingId
            }
          });
        }
        tempUser = Temp.findOne({email: participants[i].email});
        console.log(tempUser);
        continue; // Skip the rest this loop
      }
      var received = Meteor.users.findOne(participants[i].id).profile.meetingInvitesReceived;
      // Create a new set if necessary
      if (!received) {
        Meteor.users.update(participants[i].id, { // Now set the values again
          $set: {
            "profile.meetingInvitesReceived": [meetingId]
          }
        });
      } else {
        Meteor.users.update(participants[i].id, { // Now set the values again
          $addToSet: {
            "profile.meetingInvitesReceived": meetingId
          }
        });
      }
    }
    console.log("Meeting Invites Sent");
    console.log(Meteor.users.findOne(this.userId).profile.meetingInvitesSent);
    console.log("Meeting Invites Received");
    console.log(Meteor.users.findOne(this.userId).profile.meetingInvitesReceived);
  },

  // DEPRECATED: I am just leaving this here cus it has good boilerplate code
  // Feel free to delete later.
  inviteToMeeting: function(userEmails, title, duration) {
    console.log("inviteToMeeting is DEPRECATED, don't use it!");
    // The email of the person inviting others to meeting
    var inviterEmail = Meteor.user().services.google.email;
    var invitation = {
      inviter: inviterEmail,
      invited: userEmails,
      title: title,
      length: duration
    };

    // Update the inviters sent invites in the DB
    var invites = Meteor.users.findOne(this.userId).profile.meetingInvitesSent; // Pull their meeting invitations
    if (invites === undefined) invites = [];
    invites.push(invitation); // Append
    Meteor.users.update(this.userId, { // Now set the values again
      $set: {
        "profile.meetingInvitesSent": invites
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
        invites = Meteor.users.findOne(user._id).profile.meetingInvitesReceived // Pull their meeting invitations
        if (invites === undefined) invites = [];
        invites.push(invitation); // Append
        Meteor.users.update(user._id, { // Now set the values again
          $set: {
            "profile.meetingInvitesReceived": invites
          }
        });
      }
    }
  },

  // accept a meeting invitation; change the participant's 'accepted' value to true
  acceptInvite: function(meetingId, userId) {
    var thisMeeting = Meetings.findOne({_id:meetingId});
    // iterate through all meeting participants to find index in array for the current user
    // start with index 1 because you can skip the first participant ( creator)
    for (var i = 1; i < thisMeeting.participants.length; i++) {
      var currUser = thisMeeting.participants[i];
      if (currUser.id == userId) { // current user found
        var setModifier = {};
        setModifier['participants.' + i + '.accepted'] = true;
        Meetings.update({_id:meetingId},{$set:setModifier});
      }
    }

    if (checkMeetingReadyToFinalize(meetingId)) {
      findDurationLongMeetingTimes(meetingId);
      console.log("We checked if the meeting is ready to finalize!");
    }
  },

  // TODO: finish lol
  // Decline a meeting invitation
  declineInvite: function(meetingId, userId) {
    var thisMeeting = Meetings.findOne({_id: meetingId});
    var participants = thisMeeting.participants;

    // Remove the decliner from the participants list
    var decliner = null
    for (var i = 0; i < participants.length; i++) {
      if (participants[i].id === userId) {
        decliner = participants[i];
        participants.splice(i, 1); // Remove the element at index, in place
      }
    }
    // Something is funky if the userId isn't in the participants list!
    if (decliner === null) {
      console.log("Error in declineInvite: Decliner isn't a participant");
      return;
    }
    // Update participants
    Meetings.update({_id: meetingId}, {
      $set: {
        "participants" : participants
      }
    });

    // Get details of meeting
    var meetingTitle = thisMeeting.title;
    var meetingCreator = null;
    for (var i = 0; i < participants.length; i++) {
      if (participants[i].creator) meetingCreator = participants[i];
    }

    // If the participants list is now size 1, destroy this meeting
    if (participants.length <= 1) {
      // Remove this from sent meetings in creator's collection
      // NOTE: Pull removes all instances of something from a set
      Meteor.users.update(meetingCreator.id, {
        $pull: {
          "profile.meetingInvitesSent": meetingId
        }
      });
      // Kill this meeting in the meeting collection
      Meetings.remove({_id:meetingId});
    }
    // Remove this from received meetings in decliner's collection
    Meteor.users.update(userId, {
      $pull: {
        "profile.meetingInvitesReceived": meetingId
      }
    });
    // Email the inviter that they got ghosted hardcore
    sendDeclinedEmail(meetingCreator.email, decliner.email, meetingTitle);
  },

  // called on client's submission of select time form
  // given a formValue that maps to an index into suggestedMeetingTimes
  // choose this as the final selected time and save that choice in the database
  selectFinaltime: function(meetingId, formValue) {
    var index = parseInt(formValue);

    var thisMeeting = Meetings.findOne({_id:meetingId});
    var selectedTime = {
      "startTime" : thisMeeting.suggestedMeetingTimes[index].startTime,
      "endTime" : thisMeeting.suggestedMeetingTimes[index].endTime
    };

    Meetings.update({_id:meetingId},{
      $set: {
        "selectedBlock" : selectedTime
      }
    });
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

// Same as above, but text is assuming user got denied hardcore
function sendDeclinedEmail(inviterEmail, inviteeEmail, title) {
  var subject = inviteeEmail + " declined your meeting invitation.";
  var text = inviteeEmail + " declined your meeting invitation for \"" + title + "\"\n" +
            "Perhaps another time! https://www.meetable.us\n\n\n" +
            "You are receiving this email because you tried to schedule a meeting with " + inviteeEmail +
            " on Meetable, but they chose not to accept your invitation.";
  Meteor.call("sendEmail", inviteeEmail, inviterEmail, subject, text);
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
  var calendarTimes = user.profile.calendarEvents;

  var busyTimes = [];

  for (var i = 0; i < calendarTimes.length; i++) {
    var start = new Date(calendarTimes[i].start);
    var end = new Date(calendarTimes[i].end);
    var busyTime = {startTime: 0, endTime: 0};

    // Only include events from windowStart to windowEnd
    // if the end of the event isn't within the window, exclude it
    // if start isn't withing the window, exclude it
    if (end.getTime() < windowStart.getTime()) continue;
    if (start.getTime() > windowEnd.getTime()) continue;

    // If this is the first element to be inserted in the array, the startTime is the window start
    if (busyTimes.length === 0) {
      busyTime.startTime = start;
      if (start.getTime() < windowStart) busyTime.startTime = windowStart;
      busyTime.endTime = end;
      busyTimes.push(busyTime);
    }
    else {
      busyTime.startTime = start;
      busyTime.endTime = end;
      //if (end.getTime() > windowEnd.getTime()) busyTime.endTime = windowEnd;

      // If the startTime of the current event is inside the previous event, this means these two events
      // are partially overlapping. This means the busyTime should be from the startTime of the previous
      // event, to the endTime of the event that lasts longer.
      var oldBusyTime = busyTimes.pop();
      var oldStartTime = oldBusyTime.startTime;
      if ((start.getTime() >= oldBusyTime.startTime.getTime()) && (start.getTime() <= oldBusyTime.endTime.getTime())) {
        busyTime.startTime = oldBusyTime.startTime;
        busyTime.endTime = end;
        if (oldBusyTime.endTime.getTime() > end.getTime()) busyTime.endTime = oldBusyTime.endTime;
      }
      else busyTimes.push(oldBusyTime);

      if (busyTime.endTime.getTime() > windowEnd.getTime()) busyTime.endTime = windowEnd;
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
// TODO: Seems to have some issue? This needs error handling.
function findUserAvailableTimes(busyTimes, windowStart, windowEnd) {
  var availableTimes = [];
  var lastEndTime = windowStart;

  // For loop runs to the last element of the array + 1
  for (var i = 0; i <= busyTimes.length; i++) {
    var availableTime = {startTime: 0, endTime: 0};
    var busy = busyTimes[i];
    // If lastEndTime is undefined, this is the first element of the array. Consequently, the start of
    // the available time should be from windowStart, or in the special case the first busy time starting
    // at windowStart, from the end of that first busyTime
    if (i == 0 && busy) {
      if (busy.startTime.getTime() === windowStart.getTime()) {
        lastEndTime = busy.endTime;
        continue;
      }
    }

    //If b is undefined, this means that the last b was the last element of the array and the last available
    //time should be from that b's endTime to windowEnd.
    if (!busy) {
      //If the end of the last time = the end of the window, then the last available time is the final one
      if (lastEndTime.getTime() === windowEnd.getTime()) continue;

      availableTime.startTime = lastEndTime;
      availableTime.endTime = windowEnd;
    }
    else {
      //Available times is from the last busyTime's endtime to the current busyTimes startTime
      availableTime.startTime = lastEndTime;
      availableTime.endTime = busy.startTime;

      lastEndTime = busy.endTime;
    }

    availableTimes.push(availableTime);
  }

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

  // First double for loop finds the searches for slots of length otherAvailableTimes in user availabeTimes
  for (var i = 0; i < otherAvailableTimes.length; i++) {
    var otherStart = otherAvailableTimes[i].startTime;
    var otherEnd = otherAvailableTimes[i].endTime;

    for (var j = 0; j < userAvailableTimes.length; j++) {
      var userStart = userAvailableTimes[j].startTime;
      var userEnd = userAvailableTimes[j].endTime;

      if (otherStart.getTime() >= userStart.getTime() && otherEnd.getTime() <= userEnd.getTime()) {
        var availableTime = {
          startTime: otherStart,
          endTime: otherEnd
        };

        availableTimes.push(availableTime);
      }
    }
  }
  // The second double for loop looks for slots of userAvailableTimes in otherAvailableTimes
  for (var j = 0; j < userAvailableTimes.length; j++) {
    var userStart = userAvailableTimes[j].startTime;
    var userEnd = userAvailableTimes[j].endTime;

    for (var i = 0; i < otherAvailableTimes.length; i++) {
      var otherStart = otherAvailableTimes[i].startTime;
      var otherEnd = otherAvailableTimes[i].endTime;

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

// check if the meeting with id meetingId is ready to to choose a final time
// currently defined as all users accepting the meeting
// TODO: change this metric for group meetings?
// return and set flag for whether the meeting has been finalized
function checkMeetingReadyToFinalize(meetingId) {
    var thisMeeting = Meetings.findOne({_id:meetingId});
    var finalized = true;
    // iterate through all meeting participants and check if all have accepted
    for (var i = 0; i < thisMeeting.participants.length; i++) {
      var currUser = thisMeeting.participants[i];
      if (currUser.accepted == false) { // current user found
        finalized = false;
      }
    }
    if (finalized == true) {
      Meetings.update({_id:meetingId}, { // Now set the values again
        $set: {
          "readyToFinalize": true
        }
      })
    }
    return finalized;
}

// given a meetingId, look through the availableTimes and find duration long meeting times
// return that new list and also save it to the meeting document
function findDurationLongMeetingTimes(meetingId) {
  var thisMeeting = Meetings.findOne({_id:meetingId});
  var duration = thisMeeting.duration;
  var allAvailableBlocks = thisMeeting.availableTimes;

  // loop through all available times and see how many duration long blocks
  // fit within each available block

  var durationLongBlocks = [];

  for (var i = 0; i < allAvailableBlocks.length; i++) {
    var thisAvailableBlock = allAvailableBlocks[i];

    // set seconds and ms to 0 for round numbrers
    var possibleDurationLongStart = new Date (thisAvailableBlock.startTime.getTime());
    possibleDurationLongStart.setSeconds(0, 0);
    var possibleDurationLongEnd = new Date (possibleDurationLongStart.getTime()+ duration);
    possibleDurationLongEnd.setSeconds(0,0);

    // try to fit as many duration long events into thisAvailableBlock as possible
    while (possibleDurationLongEnd <= thisAvailableBlock.endTime) {
      // save this as a valid block
      durationLongBlocks.push({
        "startTime": possibleDurationLongStart,
        "endTime": possibleDurationLongEnd
      });

      // try the next duration long block
      possibleDurationLongStart = possibleDurationLongEnd;
      possibleDurationLongEnd = new Date (possibleDurationLongStart.getTime() + duration);
      possibleDurationLongEnd.setSeconds(0,0);
    }
  }

  Meetings.update({_id:meetingId},{
    $set: {
      //"durationLongAvailableTimes" : [{"startTime": 2, "endTime": 2}]
      "durationLongAvailableTimes" : durationLongBlocks
    }
  });

  saveSuggestedMeetingTimes(meetingId, durationLongBlocks);

  return durationLongBlocks;

}

// save what we will present as meeting times to the user
// currently the first 5 meeting times chronologically
function saveSuggestedMeetingTimes(meetingId, durationLongBlocks) {
  Meetings.update({_id:meetingId}, {
      $set: {
        "suggestedMeetingTimes": durationLongBlocks.slice(0, 5)
      }
    });
}
