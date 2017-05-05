// File for additional business we add to our users (as opposed to gCal business or scheduling).
import Meetings from '/collections/meetings.js';
import Temp from '/collections/temp.js';

Meteor.methods({
  // Add an additional busy time to the users additional collection.
  addBusyTimes: function(busyTime) {
    // We make the busyTime an array so we can use the mongo modifier $each, which adds
    // each nonrecurring element of the array passed to. Makes processing for recurring busyTimes much easier.
    if (!(busyTime instanceof Array)) busyTime = [busyTime];

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
  deleteBusyTimes: function(busyTime) {
    var busy = Meteor.users.findOne(user).profile.additionalBusyTimes;
    if (!busy) throw 'deleteBusyTimes error';

    Meteor.users.update(this.userId, {
      $pull: { "profile.additionalBusyTimes": busyTime }
    });
  },

  // Set the `dontMeetBefore` and `dontMeetAfter` values
  setMeetRange: function(before, after) {
    // TODO: REFORMAT IF NECESSARY?
    var range = { 'earliest': before, 'latest': after };
    Meteor.users.update(this.userId, {
      // TODO: Better name for this lol?
      $set: { "profile.meetRange": range }
    });
  },

  // Adds the busyTime multiple times based on type inside windowStart and windowEnd.
  // Type can be: "daily." If windowStart is null, it is automatically set to 1 week
  // before the current date. WindowEnd === null, automatically 4 weeks ahead of date.
  // type === null, automatically daily.
  // IMPORTANT: BUSYTIME MUST ONLY CONTAIN A START TIME AND ENDTIME NOT A DATE
  addRecurringBusyTimes: function(busyTime, windowStart, windowEnd, type) {
    if (windowStart === undefined) {
      windowStart = new Date();
      windowStart.setDate(windowStart.getDate() - 7);
    }
    if (windowEnd === undefined) {
      windowEnd = new Date();
      windowEnd.setDate(windowEnd.getDate() + 28)
    }
    console.log(windowStart);
     type = type || "daily";

     //split the start and end time to get hours, minutes and seconds
     var start = busyTime.startTime.split(":");
     var end = busyTime.endTime.split(":");
     var times = [];

    if (type === "daily") {
      console.log(type);
      var startTime = new Date();
      startTime.setHours(start[0], start[1]);
      var endTime = new Date();
      endTime.setHours(end[0], end[1]);
      console.log("hello");

      //the start and end time can not be equal
      //if (endTime.getTime() == startTime.getTime()) throw "Start time and end time cannot be the same";
      console.log("hello2");
      //if endTime is less than startTime, that means it must be the next day
      // i.e. startTime = 22:00, endTime = 8:00. EndTime is 8:00 the next day not the current day!
      if (endTime.getTime() < startTime.getTime()) {
        endTime.setDate(endTime.getDate() + 1);
      }


      var time = {start: startTime, end: endTime};
      times.push(time);
      console.log(time);

      // Increment the busyTime and add it to the busyTime array until it reaches windowEnd
      var incrementedTime = {start: new Date(time.start.getTime()), end: new Date(time.end.getTime())};
      while (incrementedTime.start.getTime() < windowEnd.getTime()) {
        incrementedTime.start.setDate(incrementedTime.start.getDate() + 1);
        incrementedTime.end.setDate(incrementedTime.end.getDate() + 1);
        times.push(incrementedTime);
        var incrementedTime = {start: new Date(incrementedTime.start.getTime()), end: new Date(incrementedTime.end.getTime())};
      }

      // decrement the busyTime and add it to the busyTime array until it reaches windowEnd
      var decrementedTime = {start: new Date(time.start.getTime()), end: new Date(time.end.getTime())};
      while (decrementedTime.start.getTime() > windowStart.getTime()) {
        decrementedTime.start.setDate(decrementedTime.start.getDate() - 1);
        decrementedTime.end.setDate(decrementedTime.end.getDate() - 1);
        times.push(decrementedTime);
        var decrementedTime = {start: new Date(decrementedTime.start.getTime()), end: new Date(decrementedTime.end.getTime())};
      }
    }
    else throw "Type must be of type 'daily'";
    console.log(times);

    //add times to additional busyTimes database
    Meteor.call('addBusyTimes', times);

  },

});
