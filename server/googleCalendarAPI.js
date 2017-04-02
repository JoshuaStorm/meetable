// include Google's node packages (same syntax as meteor imports)
import google from 'googleapis';
import googleAuth from 'google-auth-library';

// Setup Google API libraries
var gCalendar = google.calendar('v3');
var auth = new googleAuth();

// TODO: save these client secrets in a Meteor settings file (google it)
var oauth2Client = new auth.OAuth2(
  "411203275095-a0a2bbdtm407ue9km22es9jkn28674nq.apps.googleusercontent.com",
  "2VDBkNk8dLg18OL1o3XM7Ev4",
  "http://localhost:3000/"
);


Meteor.methods({
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
  getCalendarInfo: function() {
    // get all calendars and then print the next 10 events from one of them
        getCalendars(printEventList);  
  }
});

// Get an array of all calendars for the given user then
// call 'callback' function after the data is retrieved
// return data: https://developers.google.com/google-apps/calendar/v3/reference/calendarList#resource
// TODO: what if a user doesn't have calendars, permissions issues, other edge cases
//  TODO: on first run, it has no access oken and didn't work until refresh
// TODO: what if someone only has FreeBusy info, but can't see event titles?
function getCalendars(callback) {
    // Get a list of the current user's Google Calendars
    gCalendar.calendarList.list(
        {
            auth: oauth2Client,
            minAccessRole: "freeBusyReader"
        },
        // Callback, wait until the data is received 
        function(err, response) {
            if (err) {
                console.log('getCalendars: The API returned an error: ' + err);
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
                callback(calendars);
            }
        });
}


//TODO: just use the free busy info for now to get a working thing up.
// Print a list of the next 10 events in the calendar specified by id
// !! Print all events from all calendars in calendars array
function printEventList(calendars){
    //console.log("calendars length: " + calendars.length)
    //var i = 0, 
    
        // console.log("calendars["+ i + "]: " + calendars[i].id);
        // console.log("calendars["+ i + "]: " + calendars[i].summary);

        gCalendar.events.list
        ({
            auth: oauth2Client,
            // The specified calendar
            // not working for en.usa#holiday@group.v.calendar.google.com
            calendarId: calendars[0].id,
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