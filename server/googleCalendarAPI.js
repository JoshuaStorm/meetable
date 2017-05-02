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
  "mKa01x_C9W_MnlIuHVJRupb3",
  "http://localhost:3000"
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

  // Get current users gCal events in the FullCalendar format
  // Return format is a {calendarId: { busy: [arrayOfFullCalEvents], available: [arrayOfFullCalEvents] }}
  getFullCalendarEvents: function() {
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

  // Updates datebase with 'busy' gCalEvents in the fullCal format for current user
  updateEventsInDB: function() {
    try {
      var idToEvents = Meteor.call('getFullCalendarEvents');
      var busyEvents = [];
      for (var id in idToEvents) {
        busyEvents = busyEvents.concat(idToEvents[id].busy);
      }

      Meteor.users.update(this.userId, {
        $set: {
          'profile.calendarEvents': busyEvents
        }
      });
    } catch(e) {
      throw 'Error in updateEventsInDB' + e;
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
