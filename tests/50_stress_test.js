let user_utils = require('./user_utils');
let user = "./users/testuser/";

let glob = require('glob');

let getFiles = function (client, dir, pattern, load_function, files_to_skip) {
    glob(dir + pattern, callback(client, load_function, files_to_skip));
};

function callback(client, load_function, files_to_skip) {
    return function (err, res) {
        if (err) {
            client.assert(false, "Error in reading directory: " + user + "Toolbars");
        } else {

            let filenames = [];
            for (let i in res) {
                let fn = res[i];
                fn = "\/" + fn.replace(user, "");

                //skip files we know will fail
                if (files_to_skip == undefined || !files_to_skip.includes(fn)) {
                    filenames.push(fn);
                }
            }

            //console.log(filenames);
            load_function(client, filenames);
        }
    };
}

// performs the long-running and exhaustive tests
module.exports = {
    '@disabled': true,

    beforeEach : function (client) {
        client.url('http://localhost:8124/atompm').pause(1000);
    },

    'Login' : function (client) {
        user_utils.login(client);
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