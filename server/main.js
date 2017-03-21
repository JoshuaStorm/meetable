import { Meteor } from 'meteor/meteor';

Meteor.startup(() => {
  // Add Google configuration entry
  ServiceConfiguration.configurations.update(
    { service: "google" },
    { $set: {
        clientId: "411203275095-a0a2bbdtm407ue9km22es9jkn28674nq.apps.googleusercontent.com",
        client_email: "caseyli1209@gmail.com",
        secret: "2VDBkNk8dLg18OL1o3XM7Ev4"
      }
    },
    { upsert: true }
  );

});
