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
