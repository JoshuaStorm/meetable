import { Meteor } from 'meteor/meteor';
import { Email } from 'meteor/email';

// Set SMTP server URL
process.env.MAIL_URL = "smtp://apikey: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@smtp.sendgrid.net:587"; // TODO: Set port to 465 if it works

Meteor.startup(() => {
  // Add Google configuration entry
  ServiceConfiguration.configurations.update(
    { service: "google" },
    { $set: {
        clientId: "940955231388-9d1gt4nnsftrnn4su8l1jkr4d27cooeo.apps.googleusercontent.com",
        client_email: "timewarptrio11@gmail.com",
        secret: "mKa01x_C9W_MnlIuHVJRupb3"
      }
    },
    { upsert: true }
  );
});
