let test_utils = require('./test_utils');
let user = "./users/testuser/";

// performs the long-running and exhaustive tests
module.exports = {

    beforeEach : function (client) {
        client.url('http://localhost:8124/atompm').pause(1000);
    },

    'Login' : function (client) {
        test_utils.login(client);
    },

    'Load all toolbars': function (client) {

        // console.log("Testing toolbars...");
        // test_utils.getFiles(client, user, '/**/*.buttons.model', test_utils.load_toolbar);
        //
        // console.log("Testing metamodels...");
        // test_utils.getFiles(client, user, '/**/*Icons.metamodel', test_utils.load_toolbar);
        //
        // console.log("Testing pattern metamodels...");
        // test_utils.getFiles(client, user, '/**/*Icons.pattern.metamodel', test_utils.load_toolbar);
    },

    'Load all models' : function (client) {
        // test_utils.getFiles(client, user, '/**/*.model', test_utils.load_model);
    },

    after : function (client) {
        client.end();
    },


};