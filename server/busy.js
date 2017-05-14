// File for additional business we add to our users (as opposed to gCal business or scheduling).
import Meetings from '/collections/meetings.js';
import Temp from '/collections/temp.js';

// Sanitization pattterns
const BUSY_TIME_ARRAY = Match.OneOf([{ start: Date, end: Date }], [{ start: String, end: String }]);
const BUSY_TIME = Match.OneOf({ start: Date, end: Date }, { start: String, end: String });

Meteor.methods({
  // Add an additional busy time to the users additional collection.
  addBusyTimes: function(busyTime) {
    // We make the busyTime an array so we can use the mongo modifier $each, which adds
    // each nonrecurring element of the array passed to. Makes processing for recurring busyTimes much easier.
    if (!(busyTime instanceof Array)) busyTime = [busyTime];
    check(busyTime, BUSY_TIME_ARRAY);

    var busy = Meteor.users.findOne(this.userId).profile.additionalBusyTimes;
    // Create a new set if necessary
    if (!busy) {
      Meteor.users.update(this.userId, { // Now set the values again
        $set: {
          "profile.additionalBusyTimes": busyTime
        }
      });
    } else {
      Meteor.users.update(this.userId, { // Now set the values again
        $addToSet: {
          "profile.additionalBusyTimes": {
            $each: busyTime
          }
        }
      });
    }
  },

  // Delete the given busyTime from the additionalBusyTimes collection
  deleteBusyTime: function(busyTime) {
    check(busyTime, BUSY_TIME);

    var busy = Meteor.users.findOne(this.userId).profile.additionalBusyTimes;
    if (!busy) throw 'deleteBusyTimes error';

    Meteor.users.update(this.userId, {
      $pull: { "profile.additionalBusyTimes": busyTime }
    });
  },

  // Set the `dontMeetBefore` and `dontMeetAfter` values
  setMeetRange: function(before, after) {
    check([before, after], [String]);

    var range = { 'earliest': before, 'latest': after };
    Meteor.users.update(this.userId, {
      $set: { 'profile.meetRange': range }
    });
  },

  // Set the user's timezone offset.
  // NOTE: THIS NEEDS TO COME FROM CLIENT SIDE SO IT'S THE USERS OFFSET, NOT THE SERVERS
  setUserTimeZoneOffset: function(offset) {
    check(offset, Number);    
    Meteor.users.update(this.userId, { // Now set the values again
      $set: { 'profile.timeZoneOffset': offset }
    });
  }

});
