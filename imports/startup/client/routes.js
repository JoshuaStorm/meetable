import { FlowRouter } from 'meteor/kadira:flow-router';
import { BlazeLayout } from 'meteor/kadira:blaze-layout';

// Import to load these templates
import '../../ui/layouts/app-body.js';
import '../../ui/pages/login-page.js';

// View calendar template
import '../../ui/pages/calViewPage.js';


FlowRouter.route('/', {
  name: 'App.home',
  action() {
    BlazeLayout.render('App_body', { main: 'login-page' });
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
    BlazeLayout.render('App_body', { main: 'login-page' });
  },
};
