// it took forever to find the correct way to import https://github.com/aldeed/meteor-collection2/#important-note-the-version-in-this-repo-is-deprecated
import SimpleSchema from 'simpl-schema';
import Schemas from './schemas.js';
const Meetings = new Mongo.Collection('meetings');
export default Meetings; // Meetings object must be imported to access in other files

Meetings.allow({
  insert() { return false; },
  update() { return false; },
  remove() { return false; }
});

Meetings.deny({
  insert() { return true; },
  update() { return true; },
  remove() { return true; }
});

Schemas.Meetings = new SimpleSchema({
    // TODO: fix createdAt and updatedAt
    // createdAt: {
    //     type: Date,
    //     label: "Date Meeting Added to System",
    //     autoValue: function() {
    //         if ( this.isInsert ) {
    //             return new Date;
    //         }
    //         if (this.isUpsert) {
    //             return new Date;
    //         }
    //     }
    // },
    // updatedAt: {
    //     type: Date,
    //     label: "When meeting was last updated",
    //     autoValue: function () {
    //         return new Date;
    //     }
    // },

    title: {
        type: String,
        label: "title of meeting"
    },
    duration: {
        type: Number,
        label: "duration of meeting in milliseconds"
    },
    windowStart: {
        type: Date,
        label: "earliest possible time for meeting"
    },
    windowEnd: {
        type: Date,
        label: "latest possible time for meeting"
    },
    isFinalized: {
        type: Boolean,
        label: "is every detail about this meeting finalized"
    },
    readyToFinalize: {
        type: Boolean,
        label: "ready for the picker to pick a final time"
    },
    participants: {
        type: Array
    },
    "participants.$": {
        type: Object
    },
    "participants.$.id": {
        type: String,
        label: "Meteor's generated id for this user if they have an account",
        optional: true
    },
    "participants.$.email": {
        type: String,
        regEx: SimpleSchema.RegEx.Email,
        label: "email of participant"
    },
    "participants.$.accepted": {
        type: Boolean,
        label: "has participant added their info?"
    },
    "participants.$.addedToGCal": {
        type: Boolean,
        label: "has this event been added to the users gcal"
    },
    "participants.$.selector": {
        type: Boolean,
        label: "Does this participant choose the final time?"
    },
    "participants.$.creator": {
        type: Boolean,
        label: "did this participant create this meeting?"
    },
    availableTimes: {
        type: Array
    },
    "availableTimes.$": {
        type: Object
    },
    "availableTimes.$.startTime": {
        type: Date,
        label: "Start time of this available meeting time"
    },
    "availableTimes.$.endTime": {
        type: Date,
        label: "End time of this available meeting time"
    },
    durationLongAvailableTimes: {
        type: Array,
        optional: true
    },
    "durationLongAvailableTimes.$": {
        type: Object
    },
    "durationLongAvailableTimes.$.startTime": {
        type: Date,
        label: "Start time of this duration long meeting block"
    },
    "durationLongAvailableTimes.$.endTime": {
        type: Date,
        label: "End time of this duration long meeting block"
    },
    suggestedMeetingTimes: {
        type: Array,
        optional: true
    },
    suggestedRangeIndex: {
      type: Number,
      label: "The index corresponding to the suggested times being presented from duration available blocks",
      optional: true
    },
    "suggestedMeetingTimes.$": {
        type: Object
    },
    "suggestedMeetingTimes.$.startTime": {
        type: Date,
        label: "Start time of this suggested meeting time"
    },
    "suggestedMeetingTimes.$.endTime": {
        type: Date,
        label: "End time of this suggested meeting time"
    },
    "selectedBlock" : {
        type: Object,
        optional: true // TODO: i don't know if this should be optional
    },
    "selectedBlock.startTime": {
        type: Date,
        label: "Start time of the final meeting time"
    },
    "selectedBlock.endTime": {
        type: Date,
        label: "End time of the final meeting time"
    },

});

Meetings.attachSchema(Schemas.Meetings);
