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
  "localhost:3000/"
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
        getCalendars(printList);  
  }
});

// Get an array of all calendars for the given user then
// call 'callback' function after the data is retrieved
// return data: https://developers.google.com/google-apps/calendar/v3/reference/calendarList#resource
// TODO: what if a user doesn't have calendars, permissions issues, other edge cases
function getCalendars(callback) {
    // Get a list of the current user's Google Calendars
    gCalendar.calendarList.list(
        {
            auth: oauth2Client,
        },
        // Callback, wait until the data is received 
        function(err, response) {
            if (err) {
                console.log('The API returned an error: ' + err);
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
                    
                callback(calendars[0].id);
            }
        });
}

// Print a list of the next 10 events in the calendar specified by id
function printList(id){
    gCalendar.events.list
    ({
        auth: oauth2Client,
        // The specified calendar
        calendarId: id,
        timeMin: (new Date()).toISOString(),
        maxResults: 10,
        singleEvents: true,
        orderBy: 'startTime'
    }, function(err, response)
    {
        if (err) {
            console.log('The API returned an error: ' + err);
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