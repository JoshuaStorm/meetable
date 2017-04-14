// include Google's node packages (same syntax as meteor imports)
import google from 'googleapis';
import googleAuth from 'google-auth-library';

// Setup Google API libraries
var gCalendar = google.calendar('v3'); // wrapper to HTTP module ot make requests
var auth = new googleAuth(); // used to authentication requests sent by gCalendar

// TODO: save these client secrets in a Meteor settings file (google it)
// Client secrets, etc. from David's (or Casey's?) Google Developer Console project

var oauth2Client = new auth.OAuth2(
  "940955231388-i5aj301rucberlsfrsje07fj685jm9j7.apps.googleusercontent.com",
  "hv93jvDPACddBk4sbOV9EJH2",
  "http://localhost:3000/"
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
      return null;
    }
  },

  // Get an array of all calendars for the current user
  // return data format: https://developers.google.com/google-apps/calendar/v3/reference/calendarList#resource
  getCalendarList: function() {
    return wrappedGetCalendarsList({minAccessRole: "freeBusyReader"});
  },

  // Return an array of event dates in the FullCalendar format
  // Updated to use all calendars in the calendarList :)
  getFullCalendarEvents: function() {
    var calendarList = wrappedGetCalendarsList({minAccessRole: "freeBusyReader"});
    // Many users have multiple calendars, let's use them all for now
    // TODO: Include a preference to not include a certain calendar
    var fullCalEvents = [];
    var lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7); // This actually works how we want it to!
    for (var i = 0; i < calendarList.items.length; i++) {
      // Holiday list creates SERIOUS problems for GoogleAPI (ironically), just avoid at all cost.
      // This seems to be a known problem, oddly enough. Regexp to the rescue!
      var holidayRE = new RegExp('.*holiday@group.v.calendar.google.com');
      if (holidayRE.test(calendarList.items[i].id)) continue;

      var gCalEvents = wrappedGetEventList({
          // The specified calendar
          calendarId: calendarList.items[i].id,
          timeMin: lastWeek.toISOString(),
          // TODO: Need to decide how to handle this maxResults query... How many should we actually max out?
          maxResults: 50,
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
          calendarEvents: events
        }
      });
    } catch(e) {
      throw "Error in updateEventsInDB" + e;
    }
  },

  // Okay, actually I'll leave this function, it's useful for debugging
  printFromDB: function() {
    console.log(Meteor.users.findOne(this.userId).calendarEvents);
  },

  // Add a method to get Google FreeBusy info
  // startTime (Date): Minimum time to consider
  // endTime (Date): Maximum time to consider
  // zone (string): Timezone to return response in
  // NOTE: Something seems wonky about using future dates...
  getFreeBusy: function (startTime, endTime, zone) {
    check([startTime, endTime], [Date])
    check(zone, String)
    var calendarList = wrappedGetCalendarsList({minAccessRole: "freeBusyReader"});

    return wrappedGetFreeBusy({
      headers: { "content-type" : "application/json" },
      // needed to include resource instead of sending the params directly.
      resource: {
        // TODO: Use something other than the first ID
        items: [{"id" : calendarList.items[0].id}],
        timeMin: startTime.toISOString(),
        timeMax: endTime.toISOString(),
        timeZone: zone
      }
    });
  }
});

// Wrapping up async function for Meteor fibers. Confused? See:
// https://github.com/JoshuaStorm/meetable/wiki/Meteor-Async
var wrappedGetCalendarsList = Meteor.wrapAsync(gCalendar.calendarList.list);
var wrappedGetFreeBusy = Meteor.wrapAsync(gCalendar.freebusy.query);
var wrappedGetEventList = Meteor.wrapAsync(gCalendar.events.list);

// Below here is legacy stuff that isn't Fiber wrapped. Do we still need these?

// TODO: what if a user doesn't have calendars, permissions issues, other edge cases
// TODO: on first run, it has no access oken and didn't work until refresh
// TODO: what if someone only has FreeBusy info, but can't see event titles?

// Print a list of the next 10 events in the calendar specified by calendarI
function printEventList(calendarId) {
  gCalendar.events.list
  ({
    // The specified calendar
    // not working for en.usa#holiday@group.v.calendar.google.com
    calendarId: calendarId,

    // Assumes we are only reading events from now onwards
    timeMin: (new Date()).toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime'
  }, function(err, response)
  {
    if (err) {
        console.log('printEventList: The API returned an error: ' + err);
        return;
    }

    var events = response.items;
    if (events.length == 0) {
        console.log('No upcoming events found.');
    } else
    {
        console.log('Upcoming 10 events:');
        for (var i = 0; i < events.length; i++)
        {
            var event = events[i];
            var start = event.start.dateTime || event.start.date;
            console.log('%s - %s', start, event.summary);
        }
   }
  });
}
