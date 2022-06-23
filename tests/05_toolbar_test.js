
let user_utils = require('./user_utils');
let model_building_utils = require('./model_building_utils')
let mouse_tracking = require('./mouse_tracking.js');

module.exports = {

    beforeEach : async function (client) {
        await client.url('http://localhost:8124/atompm').pause(300).maximizeWindow();
        await user_utils.login(client);
        mouse_tracking.track_mouse(client);
    },

    'Load main menu toolbar': function (client) {
        let filename = 'Toolbars/MainMenu/MainMenu.buttons.model';
        model_building_utils.load_toolbar(client, [filename]);
    },

    after: function (client) {
        client.end();
    },


};


