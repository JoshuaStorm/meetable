// include Google's node packages (same syntax as meteor imports)
import google from 'googleapis';
import googleAuth from 'google-auth-library';

// Setup Google API libraries
var gCalendar = google.calendar('v3'); // wrapper to HTTP module ot make requests
var auth = new googleAuth(); // used to authentication requests sent by gCalendar

// TODO: save these client secrets in a Meteor settings file (google it)
// Client secrets, etc. from David's (or Casey's?) Google Developer Console project

var oauth2Client = new auth.OAuth2(
  "411203275095-a0a2bbdtm407ue9km22es9jkn28674nq.apps.googleusercontent.com",
  "2VDBkNk8dLg18OL1o3XM7Ev4",
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

  // gets a list of the users calendars and then immediately prints
  // the first event from that list
  getCalendarInfo: function() {
        getCalendars(printEventList, {});
  },

  // Add a method to get Google FreeBusy info
  // minTime (Date): Minimum time to consider
  // maxtime (Date): Maximum time to consider
  // zone (string): Timezone to return response in
  // NOTE: Something seems wonky about using future dates...
  getFreeBusy: function (minTime, maxTime, zone) {
    check([minTime, maxTime], [Date])
    check(zone, String)
    getCalendars(printFreeBusy, { "minTime": minTime,  "maxTime": maxTime, "zone": zone });
  }
});

// TODO: what if a user doesn't have calendars, permissions issues, other edge cases
// TODO: on first run, it has no access oken and didn't work until refresh
// TODO: what if someone only has FreeBusy info, but can't see event titles?

// Get an array of all calendars for the given user then
// call 'callback' function after the data is retrieved
// return data format: https://developers.google.com/google-apps/calendar/v3/reference/calendarList#resource

function getCalendars(callback, callbackArgs) {
    // Get a list of the current user's Google Calendars
    gCalendar.calendarList.list(
        {
            minAccessRole: "freeBusyReader"
        },
        // Callback, wait until the data is received
        function(err, response) {
            if (err) {
                console.log('getCalendars: The API returned an error: ' + err);
                console.log(err);
                return;
            }
            var calendars = response.items;

            if (calendars.length == 0)
                console.log("No calendars found!");
            else {
                // TODO: may need to check for read permissions for each calendar?
                // I assume all of these calendars can be read..

                // TODO: loop through all calendars and print their events
                // currently results in weird problems with responses not returning on time
                for (var i = 0; i < calendars.length; i++)
                {
                    console.log("calendars["+ i + "]: " + calendars[i].id);
                    console.log("calendars["+ i + "]: " + calendars[i].summary);
                }
                callback(calendars[0].id, callbackArgs);
            }
        });
}

// Just print the free busy data. TODO: Save this stuff to the database?
function printFreeBusy(calendarId, args) {
  var minTime = args.minTime.toISOString();
  var maxTime = args.maxTime.toISOString();
  var zone = args.zone;

  gCalendar.freebusy.query({
    headers: { "content-type" : "application/json" },
    // needed to include resource instead of sending the params directly.
    resource: {
      items: [{"id" : calendarId}],
      timeMin: minTime,
      timeMax: maxTime,
      timeZone: zone
    }
  }, function(err, response) {
    if (err) {
      console.log('getfreebusy: The API returned an error: ' + err);
      return;
    }
    var calendars = response.calendars;
    for (var calId in calendars) {
      // This will just print the ARRAY of objects { start: "ISO time", end: "ISO time" }
      console.log(calendars[calId].busy);
    }
  });
}

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
