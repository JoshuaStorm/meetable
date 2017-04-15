import { Meteor } from 'meteor/meteor';
import { Email } from 'meteor/email';

// Set SMTP server URL
process.env.MAIL_URL = "smtp://apikey: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@smtp.sendgrid.net:587"; // TODO: Set port to 465 if it works

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


  // Add a method to send emails!
  Meteor.methods({
    sendEmail: function (to, from, subject, text) {
      check([to, from, subject, text], [String]);
      // Let other method calls from the same client start running,
      // without waiting for the email sending to complete.
      this.unblock();
      console.log("Shoulda sent an email to " + to);
      Email.send({
        to: to,
        from: from,
        subject: subject,
        text: text
      });
    },
  });
});
