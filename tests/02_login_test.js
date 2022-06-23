let user_utils = require('./user_utils')
let mouse_tracking = require('./mouse_tracking.js');

module.exports = {

    beforeEach : function (client) {
        client.url('http://localhost:8124/atompm').pause(300);

        mouse_tracking.track_mouse(client);
    },

    'Login user' : async function (client) {

        let username = 'testuser';
        let user_pass = 'test';

        let user_exists = user_utils.user_exists(client, username, user_pass);

        if (!user_exists) {
            await user_utils.create_user(client, username, user_pass);
        }

        //await user_utils.login(client, username);
    },

    after : function (client) {
        client.end();
    },

};