import { Meteor } from 'meteor/meteor';

// Set SMTP server URL
process.env.MAIL_URL = Meteor.settings.private.smtp.url;

Meteor.startup(() => {
  // Add Google configuration entry
  ServiceConfiguration.configurations.update(
    { service: "google" },
    { $set: {
        clientId: Meteor.settings.private.oAuth.google.clientId,
        client_email: "timewarptrio11@gmail.com",
        secret: Meteor.settings.private.oAuth.google.secret
      }
    },
    { upsert: true }
  );
});
