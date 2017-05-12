// Allow Schemas to be imported easily to all of our collections.
const Schemas = {};
export default Schemas;

// Make users subscribe-able
if (Meteor.isServer) {
  // This code only runs on the server
  Meteor.publish('Users', function tempPublication() {
    return Meteor.users.find();
  });
}
