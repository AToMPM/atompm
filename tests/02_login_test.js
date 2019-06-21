module.exports = {

    beforeEach : function (client) {
        client.url('http://localhost:8124/atompm').pause(300);
    },

    'Signup user' : function (client) {

        client.execute(
            function() {
                UserManagement.validateCredentials('testuser', 'test');
            }, [], null
        );


        var user_exists = false;
        client.getText('div[id=div_login_error]', function (result) {
            user_exists = result.value.includes('login failed');

        });

        if (user_exists == false) {
            client.execute(
                function() {
                    UserManagement.signup('testuser', 'test');
                }, [], null
            );

        }

        client.execute(
            function() {
                UserManagement.login('testuser');
            }, [], null
        );

        client.pause(500);
        client.getTitle(function(title) {
            this.assert.ok(title.includes("AToMPM - [Unnamed]"), "AToMPM is opened");
        });
    },

    after : function (client) {
        client.end();
    },

};