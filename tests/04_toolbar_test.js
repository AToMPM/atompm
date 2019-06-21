
let test_utils = require('./test_utils');
let user = "./users/testuser/";

module.exports = {

    beforeEach: function (client) {
        client.url('http://localhost:8124/atompm').pause(300);
    },

    'Login': function (client) {

        test_utils.login(client);
    },

    'Load main menu toolbar': function (client) {
        let filename = 'Toolbars/MainMenu/MainMenu.buttons.model';
        test_utils.load_toolbar(client, [filename]);
    },

    after: function (client) {
        client.end();
    },


};


