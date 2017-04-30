// File for our server functions for scheduling OUR meetings/events. (as opposed to Google events)
import Meetings from '/collections/meetings.js';
import Temp from '/collections/temp.js';

Meteor.methods({

  // TODO: currently assumes meetings must be within 24 hours of clicking create meeting
  // invitedemails (array of strings): list of email addresses to invite
  // duration (float): length of the meeting in hours
  // windowStart (Moment.js object): earliest possible time to meet
  // windowEnd (Moment.js object): latest possible time to meet

  // Creates the meeting document. This function is called when a person clicks save on the schedule tab.
  // The function then creates the unique meeting collection and associates each user in invitedEmails to
  // that collection. It also sets the creator of the meeting and who has accepted
  createMeeting: function(title, invitedEmails, duration, windowStart, windowEnd) {
    var thisUserEmail = Meteor.users.findOne(this.userId).services.google.email;

    // If this is just the user being silly and trying to invite themselves to their own meeting, do nothing
    if (invitedEmails.length === 1 && invitedEmails[0].toLowerCase() === thisUserEmail.toLowerCase()) return;

    // Initializes participants array and sets the first participant as the creator
    // This participants array will then go in the participants slot of this meeting collection
    var participants = [{
        id: this.userId,
        email: thisUserEmail,
        accepted: true, // creator automatically accepts event??
        selector: false, // creator is  not always the one who picks the final date
        creator: true,
        addedToGCal: false
      }];

    // Add the rest of the participants
    addInvitedParticipants(thisUserEmail, participants, invitedEmails, title);

    // if meeting is only two people, the invitee gets to choose the meeting time
    // in meetings of more than two people, the event creator chooses the meeting time
    if (participants.length === 2) {
      participants[1].selector = true;
    } else {
      participants[0].selector = true;
    }

    var availableTimes = [{
      startTime: windowStart,
      endTime: windowEnd
    }];

    var busyTimes = findUserBusyTimes(this.userId, windowStart, windowEnd);

    Meteor.users.upsert(this.userId, {
      $set: {
        "profile.busyTimes": busyTimes
      }
    });

    var loggedInUserAvailableTimes = findUserAvailableTimes(busyTimes, windowStart, windowEnd);
    var availableTimes = findOverlap(availableTimes, loggedInUserAvailableTimes);

    // CREATE THE MEETINGS COLLECTION using information above.
    // MeetingId = unique meeting id to be associated with each user in meeting
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

    // Associate creator with meetingId
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


    // Associate meetingId with all participants involved
    for (var i = 0; i < participants.length; i++) {
      // The creater sent the invite, therefore is not being invited!
      if (participants[i].creator == true) continue;
      // Associate this email with a temporary user if they don't have an account
      if (participants[i].id == null) {
        updateTempUser(participants[i].email, meetingId);
        continue; // Skip rest of this for loop
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
  },

  // Check if the current user has temp data associated with their email.
  // If they do, associate temp data with actual user. Destroy temp item.
  // Update all meetings they are a participant in to add their ids
  attachTempUser: function() {
    var user = Meteor.users.findOne(this.userId);
    if (!user || !user.services) return;
    var email = Meteor.users.findOne(this.userId).services.google.email;
    if (!email) {
      console.log("Error in attachTempUser: userId has no email");
      return;
    }
    var tempUser = Temp.findOne({ 'email': email });
    // If there is a tempUser, attach it. Otherwise do nothing :)
    if (!tempUser) return;
    var received = tempUser.meetingInvitesReceived;
    for (var i = 0; i < received.length; i++) {
      // Add this received to the real user collection
      Meteor.users.update(this.userId, {
        $addToSet: { 'profile.meetingInvitesReceived': received[i] }
      });

      // Update meeting this user is associated with to contain their id
      var thisMeeting = Meetings.findOne(received[i]);
      if (!thisMeeting) {
        console.log("attachTempUser: Weird missing meeting");
        continue;
      }
      var participants = thisMeeting.participants;
      for (var j = 0; j < participants.length; j++) {
        if (participants[j].email === email) {
          // Set this this user as a participant in the meetings ID
          var setModifier = {};
          setModifier['participants.' + j + '.id'] = this.userId;
          Meetings.update(received[i], {
            $set: setModifier
          });
          break;
        }
      }
      // Destroy Temp element for this user.
      Temp.remove({ 'email' : email });
    }
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

  // Add an additional busy time to the users additional collection.
  addBusyTimes: function(busyTime) {
    var user = this.userId;

    var busy = Meteor.users.findOne(user).profile.additionalBusyTimes;
    // Create a new set if necessary
    if (!busy) {
      Meteor.users.update(user, { // Now set the values again
        $set: {
          "profile.additionalBusyTimes": [busyTime]
        }
      });
    } else {
      Meteor.users.update(user, { // Now set the values again
        $addToSet: {
          "profile.additionalBusyTimes": busyTime
        }
      });
    }
},

// Delete the given busyTime from the additionalBusyTimes collection
deleteBusyTimes: function(busyTime) {
  var user = this.userId;

  var busy = Meteor.users.findOne(user).profile.additionalBusyTimes;
  if (!busy) throw error;

  Meteor.users.update(user, {
    $pull: {
      "profile.additionalBusyTimes": busyTime
    }
  });

},

  // accept a meeting invitation; change the participant's 'accepted' value to true
  acceptInvite: function(meetingId, userId) {
    console.log(meetingId);
    var thisMeeting = Meetings.findOne({_id:meetingId});
    // iterate through all meeting participants to find index in array for the current user
    for (var i = 0; i < thisMeeting.participants.length; i++) {
      var currUser = thisMeeting.participants[i];
      if (currUser.id == userId) { // current user found
        var setModifier = {};
        setModifier['participants.' + i + '.accepted'] = true;
        Meetings.update({_id:meetingId}, {$set:setModifier});
        break;
      }
    }

    // Find overlap between this user and the availableTimes and insert in collection
    var busyTimes = findUserBusyTimes(this.userId, thisMeeting.windowStart, thisMeeting.windowEnd);
    Meteor.users.upsert(this.userId, {
      $set: {
        "profile.busyTimes": busyTimes
      }
    });
    var loggedInUserAvailableTimes = findUserAvailableTimes(busyTimes, thisMeeting.windowStart, thisMeeting.windowEnd);
    var availableTimes = findOverlap(thisMeeting.availableTimes, loggedInUserAvailableTimes);

    Meetings.update({_id: meetingId}, {
      $set: {
        "availableTimes" : availableTimes
      }
    });

    // Check if meeting is ready to finalize
    if (checkMeetingReadyToFinalize(meetingId)) {
      findDurationLongMeetingTimes(meetingId);
    }
  },

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
        break;
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
  selectFinalTime: function(meetingId, formValue) {
    var index = parseInt(formValue);

    var thisMeeting = Meetings.findOne({_id:meetingId});
    var selectedTime = {
      "startTime" : thisMeeting.suggestedMeetingTimes[index].startTime,
      "endTime" : thisMeeting.suggestedMeetingTimes[index].endTime
    };

    Meetings.update({_id:meetingId},{
      $set: {
        "selectedBlock" : selectedTime,
        "isFinalized" : true
      }
    });

    for (var i = 0; i < thisMeeting.participants.length; i++) {
      thisId = thisMeeting.participants[i].id
      user = Meteor.users.findOne(thisId);
      // Add this meeting to each participant's finalizedMeetings
      finalized = user.profile.finalizedMeetings;

      if (finalized === undefined) {
        Meteor.users.update(thisId, {
          $set: { "profile.finalizedMeetings": [meetingId] }
        });
      } else {
        Meteor.users.update(thisId, {
          $addToSet: { "profile.finalizedMeetings": meetingId }
        });
      }
      // Remove it from their received and sent
      Meteor.users.update(thisId, {
        $pull: { "profile.meetingInvitesReceived": meetingId }
      });
      Meteor.users.update(thisId, {
        $pull: { "profile.meetingInvitesSent": meetingId }
      });
      user = Meteor.users.findOne(thisId);
    }
  },
  readyToFinalize: function(meetingId) {
    return checkMeetingReadyToFinalize(meetingId);
  }
});

// Adds the participants indicated by array of emails, invitedEmails, to the the participants array
// (which will later be added to the correct meetings collection).
function addInvitedParticipants(currentUserEmail, participants, invitedEmails, emailTitle) {
    // add the invited participants
    for (var i = 0; i < invitedEmails.length; i++) {
      // Don't allow a user to invite themselves
      if (invitedEmails[i].toLowerCase() === currentUserEmail.toLowerCase()) continue;

      newParticipant = {
        id: null,
        email: invitedEmails[i],
        accepted: false,
        selector: false,
        creator: false,
        addedToGCal: false
      };

      // TODO: why is name missing sometimes?
      // check if a user with this email exists,and if it does, use their personal info
      var user = Meteor.users.findOne({"services.google.email": invitedEmails[i]});
      if (user !== undefined) {
        newParticipant.id = user._id;
        // Send an email to the user letting them now they have a new meeting invite
        sendNewMeetingEmail(participants[0].email, newParticipant.email, emailTitle);
      } else {
        // Otherwise send them a invitation email to join Meetable
        sendInvitationEmail(participants[0].email, newParticipant.email, emailTitle);
      }
      // add this newParticipant to the document
      participants.push(newParticipant);
    }
}

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
  Meteor.call("sendEmail", inviteeEmail, "do-not-reply@becker.codes", subject, text);
}

// Same as above, but text is assuming user already has account... Not the best modularity but whatevs
function sendNewMeetingEmail(inviterEmail, inviteeEmail, title) {
  var subject = inviterEmail + " wants to meet with you! Login to Meetable to schedule it now!";
  var text = inviterEmail + " wants to meet with you for a meeting \"" + title + "\"\n" +
            "Login to schedule it now! https://www.meetable.us\n\n\n" +
            "You are receiving this email because " + inviterEmail + " tried to invite you to Meetable.";
  Meteor.call("sendEmail", inviteeEmail, "do-not-reply@becker.codes", subject, text);
}

// Same as above, but text is assuming user got denied hardcore
function sendDeclinedEmail(inviterEmail, inviteeEmail, title) {
  var subject = inviteeEmail + " declined your meeting invitation.";
  var text = inviteeEmail + " declined your meeting invitation for \"" + title + "\"\n" +
            "Perhaps another time! https://www.meetable.us\n\n\n" +
            "You are receiving this email because you tried to schedule a meeting with " + inviteeEmail +
            " on Meetable, but they chose not to accept your invitation.";
  Meteor.call("sendEmail", inviterEmail, "do-not-reply@becker.codes", subject, text);
}

// Update a tempUser of the given email with the given meetingId.
// Create new tempUser if necessary
function updateTempUser(email, meetingId) {
  var tempUser = Temp.findOne({ email: email });
  if (!tempUser) {
    Temp.insert({
      'email': email,
      'meetingInvitesReceived': [meetingId]
    });
  } else {
    Temp.update(tempUser._id, {
      $addToSet: { 'meetingInvitesReceived': meetingId }
    });
  }
  tempUser = Temp.findOne({ 'email': email });
}

// Return an array of input users finalized meeting times from Meetable
function getFinalizedMeetingTimes(userId) {
  var finalizedIds = Meteor.users.findOne(userId).profile.finalizedMeetings;
  // A user may not have any finalized meetings
  if (!finalizedIds || !finalizedIds.length) return [];
  var times = [];

  for (var i = 0; i < finalizedIds.length; i++) {
    var meeting = Meetings.findOne(finalizedIds[i]);
    var time = {
      start: new Date(meeting.selectedBlock.startTime),
      end: new Date(meeting.selectedBlock.endTime)
    };
    times.push(time);
  }
  return times;
}

// Find users busy times using calendar info and additional busy times and stores them
// chronologically in easy to use format from windowStart to windowEnd
function findUserBusyTimes(userId, windowStart, windowEnd) {
  var user = Meteor.users.findOne(userId);
  var calendarTimes = user.profile.calendarEvents;
  var additionalBusyTimes = Meteor.users.findOne(userId).profile.additionalBusyTimes;
  if (!additionalBusyTimes) additionalBusyTimes = [];
  var meetingTimes = getFinalizedMeetingTimes(userId);

  calendarTimes = calendarTimes.concat(meetingTimes);
  calendarTimes = calendarTimes.concat(additionalBusyTimes);

  // Sort the times based on startTime
  calendarTimes.sort(function(time1, time2) {
    var key1 = new Date(time1.start);
    var key2 = new Date(time2.start);

    if (key1 < key2) return -1;
    if (key1 > key2) return 1;
    return 0;
  });

  var busyTimes = [];

  // Add all the busy times in a proper format, ensure within the window
  for (var i = 0; i < calendarTimes.length; i++) {
    var start = calendarTimes[i].start;
    var end = calendarTimes[i].end;
    // All day events need to be reformatted so JS data doesn't timezone shift them extranouesly
    if (calendarTimes[i].allDay) {
      var splitStart = start.split("-");
      var splitEnd = end.split("-");
      var start = new Date(splitStart[0], splitStart[1], splitStart[2], 0, 0, 0, 0);
      var end = new Date(splitEnd[0], splitEnd[1], splitEnd[2], 0, 0, 0, 0);
    }
    // Slight deviations in how we store Dates, ensure they're consistent here.
    // TODO: Store our data consistently such that we don't need to do this.
    if (!(start instanceof Date)) start = new Date(start);
    if (!(end instanceof Date)) end = new Date(end);

    var busyTime = {startTime: 0, endTime: 0};

    // Only include events from windowStart to windowEnd
    // if the end of the event isn't within the window, exclude it
    // if start isn't withing the window, exclude it
    if (end < windowStart) continue;
    if (start > windowEnd) continue;

    if (start < windowStart) start = windowStart;
    if (end > windowEnd)     end = windowEnd;

    busyTime.startTime = start;
    busyTime.endTime = end;

    if (busyTimes.length !== 0) {
      var prevBusyTime = busyTimes.pop();
      var prevStartTime = prevBusyTime.startTime;
      // If the startTime of the current event is inside the previous event, this means these two events
      // are partially overlapping. Coalesce them.
      if ((start >= prevBusyTime.startTime) && (start <= prevBusyTime.endTime)) {
        busyTime.startTime = prevBusyTime.startTime;
        if (prevBusyTime.endTime > end) busyTime.endTime = prevBusyTime.endTime;
      } else {
        busyTimes.push(prevBusyTime);
      }
    }
    busyTimes.push(busyTime);
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
        // This if statement says "if availableTimes does not contain an availableTime with the current availableTime startTime,
        // add the current availableTime". Basically if this availableTime is not a duplicate.
        if (availableTimes.filter(e => e.startTime == availableTime.startTime).length === 0) availableTimes.push(availableTime);
      }
      else if ((otherStart.getTime() >= userStart.getTime() && otherStart.getTime() <= userEnd.getTime()) && otherEnd.getTime() >= userEnd.getTime()) {
        var availableTime = {
          startTime: otherStart,
          endTime: userEnd
        };
        if (availableTimes.filter(e => e.startTime == availableTime.startTime).length === 0) availableTimes.push(availableTime);
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
        if (availableTimes.filter(e => e.startTime == availableTime.startTime).length === 0) availableTimes.push(availableTime);
      }
      else if ((userStart.getTime() >= otherStart.getTime() && userStart.getTime() <= otherEnd.getTime()) && userEnd.getTime() >= otherEnd.getTime()) {
        var availableTime = {
          startTime: userStart,
          endTime: otherEnd
        };
        if (availableTimes.filter(e => e.startTime == availableTime.startTime).length === 0) availableTimes.push(availableTime);
      }
    }
  }

  console.log(availableTimes);
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
