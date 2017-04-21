import SimpleSchema from 'simpl-schema';
import Schemas from './schemas.js';
const Temp = new Mongo.Collection('temp');
export default Temp; // Meetings object must be imported to access in other files

Temp.allow({
  insert() { return false; },
  update() { return false; },
  remove() { return false; }
});

Temp.deny({
  insert() { return true; },
  update() { return true; },
  remove() { return true; }
});

Schemas.Temp = new SimpleSchema({
  email: {
    type: String,
    regEx: SimpleSchema.RegEx.Email,
    label: "email of temp user"
  },
  meetingInvitesReceived: {
    type: Array,
    optional: true,
    label: "collection of meeting IDs for meetings this email was invited to."
  },
  "meetingInvitesReceived.$": {
    type: String,
    label: "Meeting invite ID",
    optional: true
  }
});

Temp.attachSchema(Schemas.Temp);
