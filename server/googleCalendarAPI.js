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
  // SIDE EFFECT: Update database entry for this users events
  // anonymize (boolean): Whether to return the data anonymized or not
  getFullCalendarEvents: function(anonymize) {
    var calendarList = wrappedGetCalendarsList({minAccessRole: "freeBusyReader"});
    var gcalEvents = wrappedGetEventList({
        // The specified calendar
        // not working for en.usa#holiday@group.v.calendar.google.com
        // TODO: Don't just do the first ID
        calendarId: calendarList.items[0].id,
        // Assumes we are only reading events from now onwards
        // TODO: Take more than just from now on? Maybe maybe not
        timeMin: (new Date()).toISOString(),
        maxResults: 100,
        singleEvents: true,
        orderBy: 'startTime'
    });

    anonCalEvents = [];
    fullCalEvents = [];
    for (var i = 0; i < gcalEvents.items.length; i++) {
      var thisGCalEvent = gcalEvents.items[i];

      var thisAnonCalEvent = {
        title: "Unknown",
        start: thisGCalEvent.start.dateTime,
        end: thisGCalEvent.end.dateTime,
        timeZone: thisGCalEvent.start.timeZone
      };
      var thisFullCalEvent = {
        title: thisGCalEvent.summary,
        start: thisGCalEvent.start.dateTime,
        end: thisGCalEvent.end.dateTime,
        timeZone: thisGCalEvent.start.timeZone
      };
      anonCalEvents.push(thisAnonCalEvent);
      fullCalEvents.push(thisFullCalEvent);
    }
    // Update this users events in the database with anonymized events
    Meteor.users.update(this.userId, {
      $set: {
        calendarEvents: anonCalEvents
      }
    });
    if (anonymize) return anonCalEvents;
    return fullCalEvents;
  },

  // DEBUG FUNCTION ONLY THIS SHOULDN'T MAKE IT TO MY PR
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
