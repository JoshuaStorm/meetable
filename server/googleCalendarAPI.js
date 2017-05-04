// include Google's node packages (same syntax as meteor imports)
import GoogleApis from 'googleapis';
import googleAuth from 'google-auth-library';

// Setup Google API libraries
var gCalendarApi = GoogleApis.calendar('v3'); // wrapper to HTTP module ot make requests
var auth = new googleAuth(); // used to authentication requests sent by gCalendar

// TODO: save these client secrets in a Meteor settings file (google it)
// Client secrets, etc. from David's (or Casey's?) Google Developer Console project

var oauth2Client = new auth.OAuth2(
  "940955231388-9d1gt4nnsftrnn4su8l1jkr4d27cooeo.apps.googleusercontent.com",
  "mKa01x_C9W_MnlIuHVJRupb3",
  "http://localhost:3000"
);

// set auth for all Google requests; instead of doing it for each request function
GoogleApis.options({
  auth: oauth2Client
});

Meteor.methods({

  // Get auth info from the Meteor.users DB and setup oauth2Client to use it
  getAuthInfo : function() {
    try {
      // get authentication info, which was retrieved from Meteor.loginWithGoogle()
      const user = Meteor.users.findOne(this.userId);
      const googleService = Meteor.users.findOne(this.userId).services.google;

      const clientId = "940955231388-9d1gt4nnsftrnn4su8l1jkr4d27cooeo.apps.googleusercontent.com";
      const secret = "mKa01x_C9W_MnlIuHVJRupb3";

      // declare oauth2 client and set credentials
      const oauth2Client = new GoogleApis.auth.OAuth2(clientId, secret);
      // get user access token
      const tokens = getAccessToken(user);
      oauth2Client.setCredentials(tokens);
    } catch(e) {
      console.log(e);
      return null;
    }
},

  // Get an array of all calendars for the current user
  // Update the users calendars collection
  // return data format: https://developers.google.com/google-apps/calendar/v3/reference/calendarList#resource
  getCalendarList: function() {
    var calendarList = wrappedGetCalendarsList({minAccessRole: "freeBusyReader"});
    var user = Meteor.users.findOne(this.userId);
    var userCalendars = user.profile.calendars;
    if (!userCalendars) userCalendars = {};
    // If we find any new calendars we don't recognize, add to considered
    var gCalIds = [];
    for (var i = 0; i < calendarList.items.length; i++) {
      // NOTE: Need to remove dots from ids to store them in Mongo
      var holidayRE = new RegExp('.*holiday@group.v.calendar.google.com');
      if (holidayRE.test(calendarList.items[i].id)) continue;

      var thisId = calendarList.items[i].id.split('.').join();
      gCalIds.push(thisId);
      if (!userCalendars[thisId]) {
        userCalendars[thisId] = {
          'title': calendarList.items[i].summary,
          'considered': true
        };
      }
    }
    // Make sure we remove calendars that a user may have removed
    var updatedUserCalendars = {};
    for (var id in userCalendars) {
      if (gCalIds.indexOf(id) !== -1) updatedUserCalendars[id] = userCalendars[id];
    }

    Meteor.users.update(this.userId, {
      $set: { 'profile.calendars': updatedUserCalendars }
    });

    return calendarList;
  },

  // Flip the considered boolean of the given calendarId, return the updated calendars
  setCalendarConsideration: function(calendarId) {
    var user = Meteor.users.findOne(this.userId);
    var userCalendars = user.profile.calendars;
    if (!userCalendars) {
      console.log('Error in userCalendars: somehow trying to flip consideration of no calendars');
      return;
    }
    console.log(userCalendars[calendarId].considered);
    userCalendars[calendarId].considered = !userCalendars[calendarId].considered;
    console.log(userCalendars[calendarId].considered);

    Meteor.users.update(this.userId, {
      $set: { 'profile.calendars': userCalendars }
    });

    console.log(Meteor.users.findOne(this.userId).profile.calendars);

    return Meteor.users.findOne(this.userId).profile.calendars;
  },

  // Get current users gCal events in the FullCalendar format
  // Return format is a {calendarId: { busy: [arrayOfFullCalEvents], available: [arrayOfFullCalEvents] }}
  getFullCalendarEvents: function() {
    // make sure we have a working access token
    const user = Meteor.users.findOne(this.userId);
    const tokens = getAccessToken(user);
    oauth2Client.setCredentials(tokens);

    var calendarList = wrappedGetCalendarsList({minAccessRole: "freeBusyReader"});
    var calendarConsiderations = Meteor.users.findOne(this.userId).profile.calendars;

    // NOTE: Grabbing up to four weeks in to the future.
    // TODO: Make this grab more if a user views beyond 4 weeks into the future.
    var lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    var nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 28);

    var idToBusyAvailable = {};
    for (var i = 0; i < calendarList.items.length; i++) {
      var busyEvents = [];
      var availableEvents = [];
      // Holiday list creates SERIOUS problems for GoogleAPI (ironically), just avoid at all cost.
      // This seems to be a known problem, oddly enough. Regexp to the rescue!
      var holidayRE = new RegExp('.*holiday@group.v.calendar.google.com');
      if (holidayRE.test(calendarList.items[i].id)) continue;

      var calendarId = calendarList.items[i].id;
      var strippedDots = calendarId.split('.').join(); // CalendarId without dots so we can store it in Mongo

      var gCalEvents = wrappedGetEventList({
          'calendarId': calendarId,
          'timeMin': lastWeek.toISOString(),
          'timeMax': nextWeek.toISOString(),
          'singleEvents': true,
          'orderBy': 'startTime'
      });
      // Need to skip calendars that Google makes but aren't actually event holding
      if (gCalEvents === "Not Found")     continue;
      if (gCalEvents.items === undefined) continue;

      for (var j = 0; j < gCalEvents.items.length; j++) {
        var thisGCalEvent = gCalEvents.items[j];
        // Per the GCal spec, if start has a date property, it's a full day event
        var thisFullCalEvent = {};
        if (thisGCalEvent.start.hasOwnProperty('date')) {
          thisFullCalEvent = {
            allDay: true,
            title: thisGCalEvent.summary,
            start: thisGCalEvent.start.date,
            end: thisGCalEvent.end.date,
            timeZone: thisGCalEvent.start.timeZone,
            calendarId: strippedDots
          };
        } else if (thisGCalEvent.start.hasOwnProperty('dateTime')) {
          thisFullCalEvent = {
            title: thisGCalEvent.summary,
            start: thisGCalEvent.start.dateTime,
            end: thisGCalEvent.end.dateTime,
            timeZone: thisGCalEvent.start.timeZone,
            calendarId: strippedDots
          };
        }
        // Events that are "transparent" are set to "available" (ie. shouldn't be considered for our busy times)
        if (thisGCalEvent.hasOwnProperty('transparency') && thisGCalEvent.transparency === "transparent") {
          thisFullCalEvent.color = '#00ba3e'; // Green
          availableEvents.push(thisFullCalEvent);
        } else {
          busyEvents.push(thisFullCalEvent);
        }
      }
      idToBusyAvailable[strippedDots] = { 'busy': busyEvents, 'available': availableEvents };
    }
    return idToBusyAvailable;
  },

  // Same as `getFullCalendarEvents` but only for calendars that are marked `considered` for this user
  // NOTE: Must call `getCalendarList` to populate considerations first
  // Get current users gCal events in the FullCalendar format
  // Return format is a {calendarId: { busy: [arrayOfFullCalEvents], available: [arrayOfFullCalEvents] }}
  getFullCalendarConsidered: function() {
    var idToEvents = Meteor.call('getFullCalendarEvents');
    var calendarConsiderations = Meteor.users.findOne(this.userId).profile.calendars;

    var idToConsidered = {};
    for (var id in idToEvents) {
      if (calendarConsiderations[id].considered) idToConsidered[id] = idToEvents[id];
    }

    return idToConsidered;
  },

  // Updates datebase with 'busy' gCalEvents in the fullCal format for current user
  updateEventsInDB: function() {
    try {
      var idToEvents = Meteor.call('getFullCalendarEvents');
      var busyEvents = [];
      var availableEvents = [];
      for (var id in idToEvents) {
        busyEvents = busyEvents.concat(idToEvents[id].busy);
        availableEvents = availableEvents.concat(idToEvents[id].available);
      }

      Meteor.users.update(this.userId, {
        $set: { 'profile.calendarEvents': busyEvents }
      });
      Meteor.users.update(this.userId, {
        $set: { 'profile.availableEvents': availableEvents }
      });
    } catch(e) {
      throw 'Error in updateEventsInDB' + e;
    }
  },

  // Adds the input event to data into a gCal event on the current user primary calendar.
  // Only adds to the current user since we NEVER want to add to another users calendar without their DIRECT consent.
  // NOTE: I put this here to keep it separate from our user data handling.
  //       hence why we have addMeetingToUserCalendar and this.
  // title (String): Name of the event
  // start (Date): The start time for the event
  // end (Date): The end time for the event
  addGCalEvent: function(title, start, end) {
    // make sure we have a working access token
    const user = Meteor.users.findOne(this.userId);
    const tokens = getAccessToken(user);
    oauth2Client.setCredentials(tokens);

    var timeZone = Meteor.users.findOne(this.userId).timeZone;
    var email = Meteor.users.findOne(this.userId).services.google.email
    var objectifiedEmail = { 'email': email };

    var event = {
      'summary': title,
      'start': {
        'dateTime': start,
        'timeZone': timeZone, // TODO: Actually set timezone
      },
      'end': {
        'dateTime': end,
        'timeZone': timeZone,
      },
      'attendees': [objectifiedEmail],
    };
    var params = {
      calendarId: 'primary',
      resource: event
    };

    wrappedPutEvent(params);
  },

  // Okay, actually I'll leave this function, it's useful for debugging
  printFromDB: function() {
    console.log(Meteor.users.findOne(this.userId).profile.calendarEvents);
  },
});

// source: http://stackoverflow.com/questions/32764769/meteor-accounts-google-token-expires
// given a user Meteor object, return an object to pass into the oauth2client as credentials
// will refresh tokens if the saved one is expired
// needs to be called before every gCalendarApi call
function getAccessToken(user) {
  // get data saved in DB about google auth
  const googleService = user.services.google;

  // if token won't expire in the next minute, use it
  if (googleService.expiresAt > Date.now() + 60 * 1000) {
    // then just return the currently stored token
    return {
      access_token: googleService.accessToken,
      token_type: 'Bearer',
      id_token: googleService.idToken,
      expiry_date: googleService.expiresAt,
      refresh_token: googleService.refreshToken,
    };
  }

  const oauth2Client = new GoogleApis.auth.OAuth2("940955231388-9d1gt4nnsftrnn4su8l1jkr4d27cooeo.apps.googleusercontent.com", "mKa01x_C9W_MnlIuHVJRupb3");
  // set the Oauth2 client credentials from the user refresh token
  oauth2Client.setCredentials({
    refresh_token: user.services.google.refreshToken,
  });
  // declare a synchronous version of the oauth2Client method refreshing access tokens
  const refreshAccessTokenSync = Meteor.wrapAsync(oauth2Client.refreshAccessToken, oauth2Client);
  // refresh tokens
  const tokens = refreshAccessTokenSync();
  // update the user document with the fresh token
  Meteor.users.update(user._id, {
    $set: {
      'services.google.accessToken': tokens.access_token,
      'services.google.idToken': tokens.id_token,
      'services.google.expiresAt': tokens.expiry_date,
      'services.google.refreshToken': tokens.refresh_token,
    },
  });

  // return the newly refreshed access token
  return tokens;
}

// Wrapping up async function for Meteor fibers. Confused? See:
// https://github.com/JoshuaStorm/meetable/wiki/Meteor-Async
var wrappedGetCalendarsList = Meteor.wrapAsync(gCalendarApi.calendarList.list);
var wrappedGetFreeBusy = Meteor.wrapAsync(gCalendarApi.freebusy.query);
var wrappedGetEventList = Meteor.wrapAsync(gCalendarApi.events.list);
var wrappedPutEvent = Meteor.wrapAsync(gCalendarApi.events.insert);