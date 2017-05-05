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

  // Add a method to send emails!
  Meteor.methods({
    sendEmail: function (to, from, subject, text) {
      check([to, from, subject, text], [String]);
      // Let other method calls from the same client start running,
      // without waiting for the email sending to complete.
      this.unblock();

      // TODO: UNCOMMENT FOR DEPLOYMENT!!!!!
      console.log("Woohoo, pretending to email people");
      // Email.send({
      //   to: to,
      //   from: from,
      //   subject: subject,
      //   text: text
      // });
    },
  });
});
