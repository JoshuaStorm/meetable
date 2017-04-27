// include Google's node packages (same syntax as meteor imports)
import google from 'googleapis';
import googleAuth from 'google-auth-library';

// Setup Google API libraries
var gCalendar = google.calendar('v3'); // wrapper to HTTP module ot make requests
var auth = new googleAuth(); // used to authentication requests sent by gCalendar

// TODO: save these client secrets in a Meteor settings file (google it)
// Client secrets, etc. from David's (or Casey's?) Google Developer Console project

var oauth2Client = new auth.OAuth2(
  "940955231388-9d1gt4nnsftrnn4su8l1jkr4d27cooeo.apps.googleusercontent.com",
  "mKa01x_C9W_MnlIuHVJRupb3"
);

// set auth for all Google requests; instead of doing it for each request function
google.options({
  auth: oauth2Client
});

Meteor.methods({

    // Get auth info from the Meteor.users DB and setup oauth2Client to use it
    getAuthInfo : function() {
      try {
        // get authentication info, which was retrieved from Meteor.loginWithGoogle()
        var user = Meteor.users.findOne(this.userId);
        var googleService = Meteor.users.findOne(this.userId).services.google;
        var accessToken = googleService.accessToken;
        var refreshToken = googleService.refreshToken;
        var expiryDate =  googleService.expiresAt;

        // TODO add a way to manuarlly refresh the token if it expires
        oauth2Client.setCredentials({
          access_token: accessToken,
          refresh_token: refreshToken,
          expiry_date: expiryDate
          
        });
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

  // Return an array of current users gCal events in the FullCalendar format
  getFullCalendarEvents: function() {
    var calendarList = wrappedGetCalendarsList({minAccessRole: "freeBusyReader"});
    // Many users have multiple calendars, let's use them all for now
    // TODO: Include a preference to not include a certain calendar
    var fullCalEvents = [];
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
        // TODO: Reconsider how to handle full day events, for now just throw them away
        if (thisGCalEvent.start.dateTime !== undefined) { // If there is no start.dateTime, it's a full day event
          var thisFullCalEvent = {
            title: thisGCalEvent.summary,
            start: thisGCalEvent.start.dateTime,
            end: thisGCalEvent.end.dateTime,
            timeZone: thisGCalEvent.start.timeZone
          };
          fullCalEvents.push(thisFullCalEvent);
        }
      }
    }
    return fullCalEvents;
  },

  // Updates datebase with gCalEvents in the fulLCal format for CURRENT USER
  updateEventsInDB: function() {
    try {
      var events = Meteor.call("getFullCalendarEvents");
      Meteor.users.update(this.userId, {
        $set: {
          "profile.calendarEvents": events
        }
      });
    } catch(e) {
      throw "Error in updateEventsInDB" + e;
    }
  },

  // Okay, actually I'll leave this function, it's useful for debugging
  printFromDB: function() {
    console.log(Meteor.users.findOne(this.userId).profile.calendarEvents);
  },
});

// Wrapping up async function for Meteor fibers. Confused? See:
// https://github.com/JoshuaStorm/meetable/wiki/Meteor-Async
var wrappedGetCalendarsList = Meteor.wrapAsync(gCalendar.calendarList.list);
var wrappedGetFreeBusy = Meteor.wrapAsync(gCalendar.freebusy.query);
var wrappedGetEventList = Meteor.wrapAsync(gCalendar.events.list);
var wrappedGetRefreshTokens = Meteor.wrapAsync(oauth2Client.refreshAccessToken);
