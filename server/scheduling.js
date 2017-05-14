// File for our server functions for scheduling OUR meetings/events. (as opposed to Google events)
import Meetings from '/collections/meetings.js';
import Temp from '/collections/temp.js';
import moment from 'moment';

Meteor.methods({

  // TODO: currently assumes meetings must be within 24 hours of clicking create meeting
  // invitedemails (array of strings): list of email addresses to invite
  // duration (float): length of the meeting in minutes
  // windowStart (Date object): earliest possible time to meet
  // windowEnd (Date object): latest possible time to meet

  // Creates the meeting document. This function is called when a person clicks save on the schedule tab.
  // The function then creates the unique meeting collection and associates each user in invitedEmails to
  // that collection. It also sets the creator of the meeting and who has accepted
  createMeeting: function(title, invitedEmails, duration, windowStart, windowEnd) {
    check(title, String);
    check(invitedEmails, [String]);
    check(duration, Number);
    check([windowStart, windowEnd], [Date]);

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
      $set: { "profile.busyTimes": busyTimes }
    });

    var loggedInUserAvailableTimes = findUserAvailableTimes(busyTimes, windowStart, windowEnd);
    availableTimes = findOverlap(availableTimes, loggedInUserAvailableTimes);

    // CREATE THE MEETINGS COLLECTION using information above.
    // MeetingId = unique meeting id to be associated with each user in meeting
    var meetingId = Meetings.insert({
      title: title,
      isFinalized: false,
      availableTimes: availableTimes,
      participants: participants,
      duration: duration * 60 * 1000,
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
        $set: { "profile.meetingInvitesSent": [meetingId] }
      });
    } else {
      Meteor.users.update(this.userId, { // Now set the values again
        $addToSet: { "profile.meetingInvitesSent": meetingId }
      });
    }

    // Associate meetingId with all participants involved
    for (var i = 0; i < participants.length; i++) {
      // The creater sent the invite, therefore is not being invited!
      if (participants[i].creator) continue;
      // Associate this email with a temporary user if they don't have an account
      if (!participants[i].id) {
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

    // TODO: Put this somewhere more logical. Perhaps a "checkForNewUser" function
    // If a user does not have a meetingRange
    if (!user.profile.meetRange) {
      // Default to 9am-10pm
      var range = { 'earliest': '09:00', 'latest': '22:00' };
      Meteor.users.update(user, {
        // TODO: Better name for this lol?
        $set: { "profile.meetRange": range }
      });
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

  // accept a meeting invitation; change the participant's 'accepted' value to true
  acceptInvite: function(meetingId, userId) {
    check([meetingId, userId], [String]);

    var thisMeeting = Meetings.findOne({_id:meetingId});
    // iterate through all meeting participants to find index in array for the current user
    for (var i = 0; i < thisMeeting.participants.length; i++) {
      var currUser = thisMeeting.participants[i];
      if (currUser.id === userId) { // current user found
        var setModifier = {};
        setModifier['participants.' + i + '.accepted'] = true;
        Meetings.update(meetingId, {$set:setModifier});
        break;
      }
    }

    // Find overlap between this user and the availableTimes and insert in collection
    var busyTimes = findUserBusyTimes(this.userId, thisMeeting.windowStart, thisMeeting.windowEnd);
    Meteor.users.upsert(this.userId, {
      $set: { "profile.busyTimes": busyTimes }
    });
    var loggedInUserAvailableTimes = findUserAvailableTimes(busyTimes, thisMeeting.windowStart, thisMeeting.windowEnd);
    var availableTimes = findOverlap(thisMeeting.availableTimes, loggedInUserAvailableTimes);

    Meetings.update(meetingId, {
      $set: { 'availableTimes' : availableTimes }
    });

    // Check if meeting is ready to finalize
    if (checkMeetingReadyToFinalize(meetingId)) {
      findDurationLongMeetingTimes(meetingId);
    }
  },

  // Decline a meeting invitation
  declineInvite: function(meetingId, userId) {
    check([meetingId, userId], [String]);

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
      Meetings.remove(meetingId);
    }
    // Remove this from received meetings in decliner's collection
    Meteor.users.update(userId, {
      $pull: {
        "profile.meetingInvitesReceived": meetingId
      }
    });
    // Email the inviter that they got ghosted hardcore
    Meteor.call('sendDeclinedEmail', meetingCreator.email, decliner.email, meetingTitle);
  },

  // called on client's submission of select time form
  // given a formValue that maps to an index into suggestedMeetingTimes
  // choose this as the final selected time and save that choice in the database
  selectFinalTime: function(meetingId, formValue) {
    check([meetingId, formValue], [String]);

    var index = parseInt(formValue);
    var thisMeeting = Meetings.findOne(meetingId);
    var selectedTime = {
      "startTime" : thisMeeting.suggestedMeetingTimes[index].startTime,
      "endTime" : thisMeeting.suggestedMeetingTimes[index].endTime
    };

    Meetings.update(meetingId, {
      $set: {
        "selectedBlock" : selectedTime,
        "isFinalized" : true
      }
    });

    var finalizerEmail = Meteor.users.findOne(this.userId).services.google.email;
    for (var i = 0; i < thisMeeting.participants.length; i++) {
      var thisId = thisMeeting.participants[i].id;
      var user = Meteor.users.findOne(thisId);
      // Add this meeting to each participant's finalizedMeetings
      var finalized = user.profile.finalizedMeetings;

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

      // Email everyone except the finalizer to let them know the event has been finalized
      if (thisId !== this.userId) {
        var userEmail = Meteor.users.findOne(thisId).services.google.email;
        Meteor.call('sendFinalizedEmail', finalizerEmail, userEmail, thisMeeting.title, selectedTime);
      }
    }
  },

  // Same as above, but selected off the visual calendar
  // Not exactly great abstraction that bot these need to exist, but we're running out of time.
  calendarSelectFinalTime: function(meetingId, selectedBlock) {
    check(meetingId, String);
    check(selectedBlock, { startTime: Date, endTime: Date});

    var thisMeeting = Meetings.findOne(meetingId);
    Meetings.update({_id:meetingId},{
      $set: {
        'selectedBlock' : selectedBlock,
        'isFinalized' : true
      }
    });

    var finalizerEmail = Meteor.users.findOne(this.userId).services.google.email;
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

      // Email everyone except the finalizer to let them know the event has been finalized
      if (thisId !== this.userId) {
        var userEmail = Meteor.users.findOne(thisId).services.google.email;
        Meteor.call('sendFinalizedEmail', finalizerEmail, userEmail, thisMeeting.title, selectedBlock);
      }
    }
  },

  readyToFinalize: function(meetingId) {
    check(meetingId, String);
    return checkMeetingReadyToFinalize(meetingId);
  },

  // Set readyToFinalize to false, set the current users accepted to false
  setNotReadyToFinalize: function(meetingId) {
    check(meetingId, String);

    var thisMeeting = Meetings.findOne(meetingId);
    var participants = thisMeeting.participants
    for (var i = 0; i < participants.length; i++) {
      if (participants[i].id === this.userId) {
        participants[i].accepted = false;
        break;
      }
    }

    Meetings.update(meetingId, { // Now set the values again
      $set: { 'participants': participants }
    });
    Meetings.update(meetingId, { // Now set the values again
      $set: { 'readyToFinalize': false }
    });
  },

  // Update a user's busy times so we don't accidentally double schedule
  // NOTE: This should be called anyplace that changes a users availability
  updateMeetableTimes: function() {
    var receivedIds = Meteor.users.findOne(this.userId).profile.meetingInvitesReceived;
    if (!receivedIds) receivedIds = [];
    var sentIds = Meteor.users.findOne(this.userId).profile.meetingInvitesSent;
    if (!sentIds) sentIds = [];
    // ITERATE OVER ALL THE IDS AND UPDATE EACH ONES BUSY-NESS...
    for (var i = 0; i < receivedIds.length; i++) {
      updateBusyTimes(receivedIds[i]);
    }
    for (i = 0; i < sentIds.length; i++) {
      updateBusyTimes(sentIds[i]);
    }
  },

  // Flip to the next page of duration long blocks available, set as suggested times
  getPrevSuggestedTimes: function(meetingId) {
    check(meetingId, String);

    var meeting = Meetings.findOne(meetingId);
    var available = meeting.durationLongAvailableTimes;
    var index = meeting.suggestedRangeIndex;

    if (!index) index = 0;
    else index--;

    if (index < 0) index = 0;

    saveSuggestedMeetingTimes(meetingId, available, index);
  },

  // Flip to the next page of duration long blocks available, set as suggested times
  getNextSuggestedTimes: function(meetingId) {
    check(meetingId, String);

    var meeting = Meetings.findOne(meetingId);
    var available = meeting.durationLongAvailableTimes;
    var index = meeting.suggestedRangeIndex;

    if (!index) index = 1;
    else index++;

    if (index >= (available.length / 5)) index--;

    saveSuggestedMeetingTimes(meetingId, available, index);
  },
});

// Update the busy and therefore available times of all users within the input meeting
// Update the meetings durationLongBlock and suggestedMeetingTimes
function updateBusyTimes(meetingId) {
  var meeting = Meetings.findOne(meetingId);
  var participants = meeting.participants;

  var availableTimes = [{
    startTime: meeting.windowStart,
    endTime: meeting.windowEnd
  }];
  // Recalculate the available times based off every participant who has accepted
  for (var i = 0; i < participants.length; i++) {
    var thisParticipant = participants[i];
    if (thisParticipant.accepted) {
      var thisBusyTimes = findUserBusyTimes(thisParticipant.id, meeting.windowStart, meeting.windowEnd);
      Meteor.users.upsert(thisParticipant.id, {
        $set: { 'profile.busyTimes': thisBusyTimes }
      });
      var thisAvailableTimes = findUserAvailableTimes(thisBusyTimes, meeting.windowStart, meeting.windowEnd);
      availableTimes = findOverlap(availableTimes, thisAvailableTimes);
    }
  }

  Meetings.update(meetingId, {
    $set: { 'availableTimes' : availableTimes }
  });

  if (checkMeetingReadyToFinalize(meetingId)) findDurationLongMeetingTimes(meetingId);
}

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
      if (user) {
        newParticipant.id = user._id;
        // Send an email to the user letting them now they have a new meeting invite
        Meteor.call('sendNewMeetingEmail', participants[0].email, newParticipant.email, emailTitle);
      } else {
        // Otherwise send them a invitation email to join Meetable
        Meteor.call('sendInvitationEmail', participants[0].email, newParticipant.email, emailTitle);
      }
      // add this newParticipant to the document
      participants.push(newParticipant);
    }
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


// Helper function to remove all the events from calendars users said not to consider
function removeUnconsideredEvents(events, considerations) {
  var consideredEvents = [];
  for (var i = 0; i < events.length; i++) {
    var thisId = events[i].calendarId;
    // If this event is in a calendar marked as considered, add to consideredEvents
    if (considerations[thisId].considered) consideredEvents.push(events[i]);
  }
  return consideredEvents;
}

// Find users busy times using calendar info and additional busy times and stores them
// chronologically in easy to use format from windowStart to windowEnd
function findUserBusyTimes(userId, windowStart, windowEnd) {
  var user = Meteor.users.findOne(userId);
  var calendarConsiderations = user.profile.calendars;

  var calendarTimes = user.profile.calendarEvents;
  if (!calendarTimes) calendarTimes = [];
  calendarTimes = removeUnconsideredEvents(calendarTimes, calendarConsiderations);
  calendarTimes = formatAllDayEvents(userId, calendarTimes);
  var additionalBusyTimes = Meteor.users.findOne(userId).profile.additionalBusyTimes;
  if (!additionalBusyTimes) additionalBusyTimes = [];
  var meetingTimes = getFinalizedMeetingTimes(userId);
  if (!meetingTimes) meetingTimes = [];
  var outsideMeetRange = getOutsideMeetRangeTimes(userId, windowStart, windowEnd);
  var thePast = getBusyFromThenToNow(userId, windowStart);

  calendarTimes = calendarTimes.concat(meetingTimes);
  calendarTimes = calendarTimes.concat(additionalBusyTimes);
  calendarTimes = calendarTimes.concat(outsideMeetRange);
  calendarTimes = calendarTimes.concat(thePast);

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
    if (i === 0 && busy) {
      if (busy.startTime.getTime() === windowStart.getTime()) {
        lastEndTime = busy.endTime;
        continue;
      }
    }

    // If b is undefined, this means that the last b was the last element of the array and the last available
    // time should be from that b's endTime to windowEnd.
    if (!busy) {
      // If the end of the last time = the end of the window, then the last available time is the final one
      if (lastEndTime.getTime() === windowEnd.getTime()) continue;

      availableTime.startTime = lastEndTime;
      availableTime.endTime = windowEnd;
    }
    else {
      // Available times is from the last busyTime's endtime to the current busyTimes startTime
      availableTime.startTime = lastEndTime;
      availableTime.endTime = busy.startTime;

      lastEndTime = busy.endTime;
    }

    availableTimes.push(availableTime);
  }

  return availableTimes;
}

// Use a given userId's meetRange to produce busy times outside the meetrange within the input window
function getOutsideMeetRangeTimes(userId, windowStart, windowEnd) {
  var user = Meteor.users.findOne(userId);
  var range = user.profile.meetRange;
  var offsetMillisec = user.profile.timeZoneOffset * 60 * 1000; // Client side offset

  var earliestHour = parseInt(range.earliest.split(':')[0]);
  var earliestMin = parseInt(range.earliest.split(':')[1]);
  var latestHour = parseInt(range.latest.split(':')[0]);
  var latestMin = parseInt(range.latest.split(':')[1]);

  var MILLISECONDS_IN_DAY = 1000 * 60 * 60 * 24;

  // Millisecond time
  var current = new Date();
  var serverOffset = current.getTimezoneOffset() * 60 * 1000;
  var trueEnd = new Date();
  // Go back and ahead an extra day just to be safe (saves more annoying handling)
  current.setTime(windowStart.getTime() - MILLISECONDS_IN_DAY);
  trueEnd.setTime(windowEnd.getTime() + 2 * MILLISECONDS_IN_DAY);

  var busyTimes = [];
  while (current < trueEnd) {
    var start = new Date(current);
    var end = new Date(current);
    // Need special handling for the weird circumstance of 8pm-7pm stuff.
    // Ie. don't skip to next date if latest < earliest
    if (latestHour > earliestHour || latestHour === earliestHour && latestMin > earliestMin) {
      end.setTime(current.getTime() + MILLISECONDS_IN_DAY);
    }
    start.setHours(latestHour);
    start.setMinutes(latestMin);
    start.setTime(start.getTime() + offsetMillisec - serverOffset)

    end.setHours(earliestHour);
    end.setMinutes(earliestMin);
    end.setTime(end.getTime() + offsetMillisec - serverOffset);

    busyTimes.push({
      'start': start,
      'end': end
    });

    current.setTime(current.getTime() + MILLISECONDS_IN_DAY);
  }

  return busyTimes;
}

// Given the available times in the meetings collection, and the availableTimes
// of a single user,
// return another availableTimes array which contains the times where available times and
// and busy times DONT intersect. I.E. where there are overlaps in
function findOverlap(otherAvailableTimes, userAvailableTimes) {
  // hold available times that work for all users
  var availableTimes = [];
  var startTimesSeen = {};

  // each availableTimes array has a start time and end time, both in unix
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

        if (!startTimesSeen[availableTime.startTime]) {
          availableTimes.push(availableTime);
          startTimesSeen[availableTime.startTime] = true;
        }
      }
      else if ((otherStart.getTime() >= userStart.getTime() && otherStart.getTime() <= userEnd.getTime()) && otherEnd.getTime() >= userEnd.getTime()) {
        var availableTime = {
          startTime: otherStart,
          endTime: userEnd
        };

        if (!startTimesSeen[availableTime.startTime]) {
          availableTimes.push(availableTime);
          startTimesSeen[availableTime.startTime] = true;
        }
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
        if (!startTimesSeen[availableTime.startTime]) {
          availableTimes.push(availableTime);
          startTimesSeen[availableTime.startTime] = true;
        }
      }
      else if ((userStart.getTime() >= otherStart.getTime() && userStart.getTime() <= otherEnd.getTime()) && userEnd.getTime() >= otherEnd.getTime()) {
        var availableTime = {
          startTime: userStart,
          endTime: otherEnd
        };
        if (!startTimesSeen[availableTime.startTime]) {
          availableTimes.push(availableTime);
          startTimesSeen[availableTime.startTime] = true;
        }
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
  var thisMeeting = Meetings.findOne(meetingId);
  // Meeting may be deleted
  if (!thisMeeting) return false;

  var finalized = true;
  var creatorEmail = "";
  // iterate through all meeting participants and check if all have accepted
  for (var i = 0; i < thisMeeting.participants.length; i++) {
    var currUser = thisMeeting.participants[i];
    if (!currUser.accepted) {
      finalized = false;
      break;
    }
    if (currUser.creator) creatorEmail = currUser.email;
  }

  if (finalized && !thisMeeting.readyToFinalize) {
    Meetings.update(meetingId, {
      $set: { 'readyToFinalize': true }
    });

    // If this is a group meeting, send an email to the creator to let them know its ready to finalize
    if (thisMeeting.participants.length > 2) Meteor.call('sendReadyToFinalizeEmail', creatorEmail, thisMeeting.title);
  }
  return finalized;
}

// given a meetingId, look through the availableTimes and find duration long meeting times
// return that new list and also save it to the meeting document
function findDurationLongMeetingTimes(meetingId) {
  var thisMeeting = Meetings.findOne(meetingId);
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

  Meetings.update(meetingId, {
    $set: { "durationLongAvailableTimes" : durationLongBlocks }
  });

  saveSuggestedMeetingTimes(meetingId, durationLongBlocks, 0);

  return durationLongBlocks;
}

// save what we will present as meeting times to the user
// currently the first 5 meeting times chronologically
function saveSuggestedMeetingTimes(meetingId, durationLongBlocks, range) {
  Meetings.update(meetingId, {
    $set: { 'suggestedRangeIndex': range }
  });
  Meetings.update(meetingId, {
    $set: { "suggestedMeetingTimes": durationLongBlocks.slice(range * 5, (range + 1) * 5) }
  });
}

// Look through the input events array for allDay events
// Format them to match generic events
function formatAllDayEvents(userId, events) {
  var user = Meteor.users.findOne(userId);
  var clientOffset = user.profile.timeZoneOffset * 60 * 1000;
  var serverOffset = new Date().getTimezoneOffset() * 60 * 1000;

  for (var i = 0; i < events.length; i++) {
    if (events[i].allDay) {
      var splitStart = events[i].start.split("-");
      var splitEnd = events[i].end.split("-");
      // NOTE: month - 1 because string is such that January is 01, whereas new Date wants January = 00
      events[i].start = new Date(parseInt(splitStart[0]), parseInt(splitStart[1]) - 1, parseInt(splitStart[2]), 0, 0, 0, 0);
      events[i].end = new Date(parseInt(splitEnd[0]), parseInt(splitEnd[1]) - 1, parseInt(splitEnd[2]), 0, 0, 0, 0);
      // Ensure we don't get timezone offsetting issues
      events[i].start.setTime(events[i].start.getTime() + clientOffset - serverOffset);
      events[i].end.setTime(events[i].end.getTime() + clientOffset - serverOffset);
    }
  }
  return events;
}

// Get a busy block from the input 'then' to the current time. Return as an array for convenience in findUserBusyTimes
function getBusyFromThenToNow(userId, then) {
  var event = {
    start: then,
    end: new Date()
  }
  return [event];
}
