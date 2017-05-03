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
  // return data format: https://developers.google.com/google-apps/calendar/v3/reference/calendarList#resource
  getCalendarList: function() {
    return wrappedGetCalendarsList({minAccessRole: "freeBusyReader"});
  },

  // Get current users gCal events in the FullCalendar format
  // Return format is a { busy: [arrayOfFullCalEvents], available: [arrayOfFullCalEvents] }
  getFullCalendarEvents: function() {
    // make sure we have a working access token
    const user = Meteor.users.findOne(this.userId);
    const tokens = getAccessToken(user);
    oauth2Client.setCredentials(tokens);

    var calendarList = wrappedGetCalendarsList({minAccessRole: "freeBusyReader"});
    // Many users have multiple calendars, let's use them all for now
    // TODO: Include a preference to not include a certain calendar
    var busyEvents = [];
    var availableEvents = [];

    var lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    var nextWeek = new Date();
    // NOTE: Grabbing up to four weeks in to the future.
    // TODO: Make this grab more if a user views beyond 4 weeks into the future.
    nextWeek.setDate(nextWeek.getDate() + 28);
    for (var i = 0; i < calendarList.items.length; i++) {
      // Holiday list creates SERIOUS problems for GoogleAPI (ironically), just avoid at all cost.
      // This seems to be a known problem, oddly enough. Regexp to the rescue!
      var holidayRE = new RegExp('.*holiday@group.v.calendar.google.com');
      if (holidayRE.test(calendarList.items[i].id)) continue;

      var gCalEvents = wrappedGetEventList({
          calendarId: calendarList.items[i].id,
          timeMin: lastWeek.toISOString(),
          timeMax: nextWeek.toISOString(),
          singleEvents: true,
          orderBy: 'startTime'
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
            timeZone: thisGCalEvent.start.timeZone
          };
        } else if (thisGCalEvent.start.hasOwnProperty('dateTime')) {
          thisFullCalEvent = {
            title: thisGCalEvent.summary,
            start: thisGCalEvent.start.dateTime,
            end: thisGCalEvent.end.dateTime,
            timeZone: thisGCalEvent.start.timeZone
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
    }
    return { 'busy': busyEvents, 'available': availableEvents };
  },

  // Updates datebase with 'busy' gCalEvents in the fullCal format for current user
  updateEventsInDB: function() {
    try {
      var events = Meteor.call("getFullCalendarEvents");
      Meteor.users.update(this.userId, {
        $set: {
          "profile.calendarEvents": events.busy
        }
      });
    } catch(e) {
      throw "Error in updateEventsInDB" + e;
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