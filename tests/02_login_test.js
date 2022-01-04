let user_utils = require('./user_utils')

module.exports = {

    beforeEach : function (client) {
        client.url('http://localhost:8124/atompm').pause(300);
    },

    'Login user' : function (client) {

        let username = 'testuser';
        let user_pass = 'test';

        let user_exists = user_utils.user_exists(client, username, user_pass);

        if (!user_exists) {
            user_utils.create_user(client, username, user_pass);
        }

        user_utils.login(client, username);
    },

    after : function (client) {
        client.end();
    },

};