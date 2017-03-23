import { Template } from 'meteor/templating';
import { Meteor } from 'meteor/meteor';

import './dashboard-page.html';

Template.dashboard_page.helpers({
   firstName: function(){
    var user = Meteor.user(); 
	    if (user) {
	      return user.services.google.given_name;    
	   	} 
	},
   currentUser: function() {
    	return Meteor.userId();
  	}
});

// I think we have to initiate the call to get the OAuth info from the client
Meteor.call("getAuthInfo", function(error){});

// Not sure if this needs to be called on client or server -- depends how we
// will parse the calendar data
Meteor.call("getCalendarInfo", function(error){});
