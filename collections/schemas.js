// Allow Schemas to be imported easily to all of our collections.
const Schemas = {};
export default Schemas;

// Make the CURRENT user subscribe-able
if (Meteor.isServer) {
  Meteor.publish('Users', function tempPublication() {
    return Meteor.users.find(this.userId);
  });
}
