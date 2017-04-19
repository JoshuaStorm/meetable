import { FlowRouter } from 'meteor/kadira:flow-router';
import { BlazeLayout } from 'meteor/kadira:blaze-layout';

// Import to load these templates
import '../../ui/layouts/app-body.js';
import '../../ui/pages/login-page.js';
import '../../ui/pages/error-page.js';
import '../../ui/pages/dashboard-page.js';

/*FlowRouter.route('/', {
  name: 'App.home',
  action() {
    BlazeLayout.render('App_body', { main: 'login_page' });
  },
});
*/

// View calendar template
import '../../ui/pages/calViewPage.js';


FlowRouter.route('/', {
  name: 'App.home',
  action: function(params) {
        Tracker.autorun(function() {
            if (!Meteor.userId()) {
                BlazeLayout.render('App_body', { main: 'login_page' });
            } else {
                FlowRouter.go('/dashboard');
            }
        });
      }
});

FlowRouter.route('/dashboard', {
  name: 'App.dashboard',
  action() {
    BlazeLayout.render('App_body', { main: 'dashboard_page' });
  },
});

FlowRouter.route('/error', {
  name: 'App.error',
  action() {
    BlazeLayout.render('App_body', { main: 'error_page' });
  },
});

FlowRouter.route('/cal', {
	name: 'App.calendar',
	action() {
		BlazeLayout.render('App_body', {main: 'calViewPage'});
	},
});

// the App_notFound template is used for unknown routes and missing lists
FlowRouter.notFound = {
  action() {
    BlazeLayout.render('App_body', { main: 'error_page' });
  },
};
