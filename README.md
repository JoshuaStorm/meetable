# meetable
A lightweight, no-fuss meeting scheduler. Calendar importing saves you the work of cross referencing your calendar with everyone elses, or inputting it by hand.

## April 25, 2017 (Casey)
- UI overhaul! 
- David implemented a new UI design with two columns, left one for actions and right one to display calendar
- Switched to using Material Design for our front end theme, and made adjustments to the spacing/alignment of our various tabs
- Add animated alerts to confirm success/failure of actions

## April 23, 2017 (Josh)
- Finish up some lingering issues with handling group meetings. Just need the front-end stuff figured out to get them working now! (and probably some bug fixes)

## April 22, 2017 (Josh)
- Set up Temp user collection so you can invite emails who do not have current accounts and all those invites will attach to their new account when they signup.

## April 18, 2017 (Casey)
- 'Incoming' tab: implement dynamic templates so that on clicking accept, the user will see the div change to reflect that
- finalizing meetings: if a user is the selector, they can pick from radio buttons and finalize the meeting time; otherwise, displays a message saying to wait for meeting selector to choose time
- minor change to 'Schedule a Meeting' which centers the form inputs

## April 18, 2017 (David)
- wrote functions to find meeting blocks of the correct duration that work for every user, and save them to the Meetings collection
- wrote function to save selected meeting time to the DB

## April 17, 2017 (Casey)
- Josh reworked the database so that all the invitation data is now in the user profile
- connected front end to database for all three tabs: 'incoming', 'outgoing', 'finalized'
- began work on acceptInvite() function, but stuck on how to modify a database value from the client side. 

## April 16, 2017 (Meeting)
- Everyone gave updates on their work so far
- Decided to move 'meetingInvitesReceived/Sent' and other information to go under the user 'profile', because we were having trouble pulling it from the client side
- Finalized what to do if a user rejects a meeting (notify meeting creator, remove them from meeting, and if they were only other person, delete the meeting)
- Goal: V1 deployed by Wednesday
- Go through issues and assign to people

## April 16, 2017 (Josh)
- Fix issues where we were saving in user collection, but we should have been doing user.profile (Meteor thing).
- Switch from saving meetings on each users respective id in the users collection to just saving to the meetings collection and saving reference ids to the users collection.

## April 16, 2017 (Casey)
- Figured out how to connect from meetings collection in the database to our front-end using spacebars, under the 'invites' tab. 
- For now, it just shows the inviter, duration, and title for all the meetings in the database. Still need to filter this so that it just displays the invites for the current user. 


## April 15, 2017 (David)
- Updated Meetings collection schema again to further match what we decided in our Wiki page

## April 15, 2017 (Josh)
- Resolved some pretty hefty merge conflicts in `meetings` PR. I ended up just individually checking out files instead of doing a huge rebase. Worked out pretty well!
- Bug fixed a few functions in the `meetings` PR. Notably a handful of corner case issues when we passed in a busy array of size 0.
- Got deployment up to master! Worked quite painlessly too :)

## April 15, 2017 (Casey)
- Merge UI update into the 'meetings' branch. The update adds three tabs, 'Schedule a Meeting', 'Invites', 'Meetings' which fold out upon being clicked. It also inlines the modal for scheduling a meeting.

## April 14, 2017 (David)
- Save the meeting document created in `createMeeting()` to the Meeting collection.
- Edit the Meeting schema

## April 14, 2017 (Josh)
- Resolved OAuth problem, we had a race condition with authentication that I was missing.
- Realized the massive `meetings` PR was really funky due to re-committing old code since some of us were up to date with master and others were not. Going to have to do a really large (37 commits...) `git rebase`. Small PRs == Good PRs

## April 13, 2017 (David)
- Setup basic Meetings collection and the schema, but it needs to be chagned a bit.
- start `createMeeting()` function that runs when a user tries to set up a meeting. Currently it just sets up the meeting object but doesn't insert it to the database

## April 13, 2017 (Josh)
- Refactored getFullCalendarEvents by David's request. Separated getting and putting into the database. Considers all calendars by default.
- Made progress (?) on fixing our Heroku OAuth problem. Getting some weirdness going on where it works fine on my machine but not on others. Not sure what's going on.

## April 11, 2017 (Josh)
- Set up basic Heroku deployment. Seems quite painless, just need to update the Google OAuth authorized URIs.
- Need to change the name: https://meetable-us.herokuapp.com/ is pretty gross.
- Need to update the wiki with a guide on how to update the repo deployed Heroku App

## April 9, 2017 - Group Meeting
- decided to require Cindy to click a link before we pull her calendar, if we already had access to it
- planned strategy to finish prototype by Friday

## April 8, 2017 (David)
- Set up bare bones of `Meeting` collection schema
- Working on function to create a Meeting object; stuck on issue with MomentJS objects being invalid. May want to avoid using MomentJS but there is an elegant range interation function that should be able to help us find all possible meeting times given a range of times, so it would be nice..
- Added packages: moment-range, momentjs, simple-schema, collections2-core

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
