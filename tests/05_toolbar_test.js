
let user_utils = require('./user_utils');
let model_building_utils = require('./model_building_utils')

let user = "./users/testuser/";

module.exports = {

    beforeEach: function (client) {
        client.url('http://localhost:8124/atompm').pause(300);
    },

    'Login': function (client) {

        user_utils.login(client);
    },

    'Load main menu toolbar': function (client) {
        let filename = 'Toolbars/MainMenu/MainMenu.buttons.model';
        model_building_utils.load_toolbar(client, [filename]);
    },

    after: function (client) {
        client.end();
    },


};


