// Add a method to send emails!
Meteor.methods({
  sendEmail: function (to, from, subject, text) {
    check([to, from, subject, text], [String]);
    // Let other method calls from the same client start running,
    // without waiting for the email sending to complete.
    this.unblock();
    console.log(" ------------------ PRETENDING TO EMAIL ------------------ ");
    console.log(to);
    console.log(subject);
    console.log(text);
    // Email.send({
    //   to: to,
    //   from: from,
    //   subject: subject,
    //   text: text
    // });
  },

  // Send an invitation email to the inviteeEmail. THIS IS ONLY USED TO INVITED NEW USERS
  // inviterEmail (emailString): The email address of the inviter TODO: Make this a name?
  // inviteeEmail (emailString): The email address of the person being invited
  // title (String): The event title in which a user is being invited.
  sendInvitationEmail: function(inviterEmail, inviteeEmail, title) {
    var subject = inviterEmail + " wants to meet with you! Join Meetable to schedule it now!";
    var text = inviterEmail + " wants to meet with you for a meeting \"" + title + "\"\n\n" +
              "Schedule your meeting now with Meetable. Forget filling out when you're available by hand, " +
              "Meetable compares your free time from your Google Calendar so you just have to pick one time that " +
              "you already know works for everyone!\n\n" +
              "Join now! https://meetable-us.herokuapp.com/\n\n\n" +
              "You are receiving this email because " + inviterEmail + " tried to invite you to Meetable.";
    Meteor.call("sendEmail", inviteeEmail, "do-not-reply@becker.codes", subject, text);
  },

  // Same as above, but text is assuming user already has account... Not the best modularity but whatevs
  sendNewMeetingEmail: function(inviterEmail, inviteeEmail, title) {
    var subject = inviterEmail + " wants to meet with you! Login to Meetable to schedule it now!";
    var text = inviterEmail + " wants to meet with you for a meeting \"" + title + "\"\n" +
              "Login to schedule it now! https://meetable-us.herokuapp.com/\n\n\n" +
              "You are receiving this email because " + inviterEmail + " tried to invite you to Meetable.";
    Meteor.call("sendEmail", inviteeEmail, "do-not-reply@becker.codes", subject, text);
  },

  // Same as above, but text is assuming user got denied hardcore
  sendDeclinedEmail: function(inviterEmail, inviteeEmail, title) {
    var subject = inviteeEmail + " declined your meeting invitation.";
    var text = inviteeEmail + " declined your meeting invitation for \"" + title + "\"\n" +
              "Perhaps another time! https://meetable-us.herokuapp.com/\n\n\n" +
              "You are receiving this email because you tried to schedule a meeting with " + inviteeEmail +
              " on Meetable, but they chose not to accept your invitation.";
    Meteor.call("sendEmail", inviterEmail, "do-not-reply@becker.codes", subject, text);
  },

  // Same as above, but text is assuming the meeting got deleted since no acceptable times were found
  sendDeletedEmail: function(inviterEmail, deleterEmail, title) {
    var subject = deleterEmail + " deleted your meeting invitation.";
    var text = deleterEmail + " deleted your meeting invitation for \"" + title + "\" as no meetable times were found.\n" +
              "Try rescheduling with a different scheduling range. https://meetable-us.herokuapp.com/\n\n\n" +
              "You are receiving this email because you tried to schedule a meeting with " + deleterEmail +
              " on Meetable, but no meetable times were found between the two of you based on your calendar times.";
    Meteor.call("sendEmail", inviterEmail, "do-not-reply@becker.codes", subject, text);
  },

  // Same as above, but text is assuming meeting got deleted by host
  sendDeletedGroupEmail: function(invitedEmail, host, title) {
    var subject = host + " deleted your meeting invitation.";
    var text = host + " deleted your meeting invitation for \"" + title + "\" for one reason or another.\n" +
              "Perhaps another time! https://meetable-us.herokuapp.com/\n\n\n" +
              "You are receiving this email because " + host + " tried to schedule a meeting with you"
              " on Meetable, but they deleted the invitation.";
    Meteor.call("sendEmail", invitedEmail, "do-not-reply@becker.codes", subject, text);
  },

  // Same as above, but text is to inform user that a group meeting is ready to finalize
  sendReadyToFinalizeEmail: function(inviterEmail, title) {
    var subject = "\"" + title + "\"" + " is ready to finalize!";
    var text ="Your meeting invitation for \"" + title + "\" is ready to finalize!\n" +
              "Log on to Meetable to schedule the final time now. https://meetable-us.herokuapp.com/\n\n\n" +
              "You are receiving this email because you tried to schedule a group meeting" +
              " on Meetable, and all of the invited users accepted your invite.";
    Meteor.call("sendEmail", inviterEmail, "do-not-reply@becker.codes", subject, text);
  },

  // Same as above, but text is to inform user there meeting was finalized
  sendFinalizedEmail: function(finalizerEmail, otherEmail, title, scheduledTime) {
    var start = scheduledTime.startTime;
    var end = scheduledTime.endTime;
    var subject = "Your meeting for " + "\"" + title + "\"" + " has been finalized!";
    var text ="Your meeting for \"" + title + "\" has been finalized!\n" +
              "It has been scheduled for " + start + "-" + end + ".\n\n https://meetable-us.herokuapp.com/\n\n\n" +
              "You are receiving this email because you tried to schedule a meeting" +
              " on Meetable, and the time has been finalized.";
    Meteor.call("sendEmail", otherEmail, "do-not-reply@becker.codes", subject, text);
  },
});
