import { Template } from 'meteor/templating';
import './calViewPage.html';

import { Meteor } from 'meteor/meteor';

Template.calViewPage.onRendered( () => {
  $( '#events-calendar' ).fullCalendar({
    header: {
        center: 'month,agendaFourDay' // buttons for switching between views
    },
    views: {
        agendaFourDay: {
            type: 'agenda',
            duration: { days: 7 },
            buttonText: 'Weekly'
        }
    }
});
});