# meetable
A lightweight, no-fuss meeting scheduler. Calendar importing saves you the work of cross referencing your calendar with everyone elses, or inputting it by hand.

## April 6, 2017 (Josh)
- Set up basic (ugly) UI to send invitations to meetings.
- Have a basic invitation email being sent, still need to save the invitation to a temporary account and transfer that to the newly invited account if and when they sign up after being invited.
- Saving basic event invitations to both the invited and inviter users.

## April 5, 2017 (Josh)
- Finally have a calendar presented to the user that pulls their Google calendar data. Required a bit of re-formatting data, see the `getFullCalendarEvents` Meteor.method add.
    - Next steps is to save the anonymized event data to a user collection so other users can search for it and we can present them possible meeting times.
- Oops I lied, not next steps I already did it: Saving anonymized event data to the Meteor.users collection. I also put some boilerplate code for retrieving it for reference.

## April 3, 2017 (Josh)
- Done some research on Meteor async behavior. Realized we were doing some stuff very wrong. I posted a wiki article on it.
    - The basic concept is server-side async is all about 'fibers' and client-side async is still callbacks
- Implemented a little bit of the above async stuff. Pulling FreeBusy and CalendarList with fibers and returning that info via callbacks to the client.
- Fixed our SMTP issues where MailGun wouldn't confirm our DNS record even though `dig` would. SendGrid is working like a charm with a better free package.


## April 2, 2017 (Josh)
- Pulling FreeBusy data from GoogleAPIs. Currently just printing it on the server side. This was way more of a hassle than I anticipated...
- Also having trouble pushing the data to the database.
- I'm going to watch some tutorials to try and figure out how Meteor's "subscription based data persistence" works.

## April 1, 2017 (David)
- Print the id and calendar title to Meteor console for all calendars of the logged in with Google.
- Next steps: save this data to the database, associated with a user account in MongoDB

## March 27, 2017
All PRs merged.

TODO at next meeting:
- Plot out the next 2-3 PR goals for each of us so we can all work on our own time.
- Hopefully have time to code!

## March 22, 2017 - Video call meeting  
- To do for rest of spring break:  
  - Everyone: test Casey's and Shayan's pull requests  
  - Josh: manage merge conflicts  
  - Casey: re-organize Flow Router to have Flow Group Routes  
  - David and Shayan: pulling and displaying Google calendar information
- David - started pulling Google Calendar data
  - Currently just prints next 10 events from one of the logged in user’s calendars to the meteor terminal
  - Next step: allow user to choose which calendars to print the events of, and fix errors for certain calendars
     
## March 21, 2017 - Calendar Display (Shayan)
- Did some research on best way to display a calendar. For now the easiest way seems to be to use fullcalendar API
- Downloaded and installed full calendar, added a page that displays a calendar w/ no events and a link on the log in page leading to the calendar.
- Figured out how to add events to said calendar, however was not able to fully integrate w/ David to push the events from the pulled calendar. This is the priority right now.
     
## March 21, 2017 - Email SMTP Setup (Josh)
- Decided to use MailGun due to convenience of Sandbox URL and fairly competitive free package.
- Added a convenient email client-side hook to server-side email delivery (asynchronous)
- Still haven't set up custom domain since we don't have one. I tried using mine but for some reason it won't verify my DNS info... Might be an issue we have to tackle later.
  - Currently can only test by emailing me (jsbecker AT princeton)

## March 21, 2017 - User accounts updates (Casey)
- added an error page for any url that isn't properly routed to (helpful for checking to see if my routes are working) 
- added a dashboard page which pulls the first name of user from Google profile to display a welcome message. ~~Still haven't linked it so that the site automatically goes to this page after signing in.~~ Implemented automatic redirection on sign-in in second commit.
  - one issue with the name feature is that it requires people to have put a first name in their Google profile, which not everyone has (i.e. I never personalized my Princeton account)
- request Cal permissions by doing away with {{> atForm}} and instead rolling out our own Google authentication with Meteor.signinWithGoogle()

## March 21, 2017 - Video call meeting
Merging initial commits with master
Meeting resulting in distributed jobs for Spring Break
- Casey: configure database for user accounts;
- David: Gcal permissions
- Shayan: calendar display
- Josh: configure emails

## March 20, 2017 - Initial website setup (Casey)

Initial commits.
- Basic page with Meteor setup, MongoDB database pre-included
- Google Login and basic use of `useraccounts` package
- No database information saved yet
