// it took forever to find the correct way to import https://github.com/aldeed/meteor-collection2/#important-note-the-version-in-this-repo-is-deprecated
import SimpleSchema from 'simpl-schema'; 
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

const Schemas = {};

Schemas.Meetings = new SimpleSchema({
    createdAt: {
        type: Date,
        label: "Date Meeting Added to System",
        autoValue: function() {
            if ( this.isInsert ) {
                return new Date;
            } 
        }
    },
    participants: {
        type: Array
    },
    "participants.$": {
        type: Object
    },
    "participants.$.name": {
        type: String,
        label: "First and Last Name of participant"
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
    "participants.$.selector": {
        type: Boolean,
        label: "Does this participant choose the final time?"
    },
    availableTimes: {
        type: Array
    },
    "availableTimes.$": {
        type: Object
    },
    "availableTimes.$.startTime": {
        type: Number,
        label: "Start time of this available meeting time in UNIX time in milliseconds"
    },
    "availableTimes.$.endTime": {
        type: Number,
        label: "End time of this available meeting time in UNIX time in milliseconds"
    },
    "availableTimes.$.timeZone": {
        type: String,
        label: "what timezone this available meeting is in"
    },
    "availableTimes.$.selected": {
        type: Boolean,
        label: "Did the selector choose this as the meeting time"
    },
});

Meetings.attachSchema(Schemas.Meetings);