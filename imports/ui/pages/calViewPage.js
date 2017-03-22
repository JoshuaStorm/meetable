import { Template } from 'meteor/templating';
import './calViewPage.html';

import { Meteor } from 'meteor/meteor';

Template.calViewPage.onRendered( () => {
  $( '#events-calendar' ).fullCalendar();
});