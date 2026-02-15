let _fs = require('fs');
const user_utils = require("./user_utils");

let deleteFolderRecursive = function (path) {
    if (_fs.existsSync(path)) {
        _fs.readdirSync(path).forEach(function (file, index) {
            let curPath = path + "/" + file;
            // console.log("Deleting: " + curPath);

            if (_fs.lstatSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
            } else { // delete file
                _fs.unlinkSync(curPath);
            }
        });
        _fs.rmdirSync(path);
    }
};

module.exports = {

    '@disabled': true,
    'Signup userremove user': async function (client) {

        client.url('http://localhost:8124/atompm').pause(300);

        let username = 'userremove';
        let user_pass = 'test';

        let user_exists = await user_utils.user_exists(client, username, user_pass);
        if (!user_exists) {
            await user_utils.create_user(client, username, user_pass);
        }
        //client.pause(1000);
        //await user_utils.login(client, username, user_pass);

        //needed to ensure everything is loaded
        client.pause(1000);
    },

    'Load Missing Toolbar': function (client) {

        let filename = './toolbars/missing.metamodel';
        client.execute(
            function () {
                DataUtils.loadbm('./toolbars/missing.metamodel');
            }, [], null
        );

        client.pause(1000);
        client.waitForElementPresent("#dialog_btn", 2000, "Check for toolbar loading error: " + filename);

        client.element('css selector', '#dialog_btn', function (result) {
            if (result.status != -1) {
                //Dialog has popped up, so check the text and click the button
                client.assert.textContains("#div_dialog_0", "File not found");
                client.click("#dialog_btn");

                client.verify.ok(true, "Toolbar: " + filename + " failed to load!"); //don't stop testing
            }
        });

        client.pause(1000);

    },

    'Load Missing Model': function (client) {

        let filename = './test/missing.model';
        client.execute(
            function () {
                DataUtils.loadm('./test/missing.model');
            }, [], null
        );

        client.waitForElementPresent("#dialog_btn", 2000, "Check for model loading error: " + filename);
        client.element('css selector', '#dialog_btn', function (result) {
            if (result.status != -1) {
                //Dialog has popped up, so check the text and click the button
                client.assert.textContains("#div_dialog_0", "File cannot be read");
                client.click("#dialog_btn");

                client.verify.ok(true, "Model: " + filename + " failed to load!"); //don't stop testing
            }
        });

    },

    'Delete and Click Toolbar': function (client) {
        client.pause(500);
        let path = "./users/userremove";
        console.log("Deleting: " + path);
        deleteFolderRecursive(path);

        client.pause(2000);

        let load_button = "#\\2f Toolbars\\2f MainMenu\\2f MainMenu\\2e buttons\\2e model\\2f loadModel";
        client.waitForElementPresent(load_button, 1000, "Looking for load button")
            .click(load_button)
            .waitForElementPresent("#dialog_btn", 1000, "Load menu opens");


        client.waitForElementPresent("#dialog_btn", 2000, "Check for file list loading error");
        client.element('css selector', '#dialog_btn', function (result) {
            if (result.status != -1) {
                //Dialog has popped up, so check the text and click the button
                client.assert.textContains("#div_dialog_0", "Cannot load file list");
                client.click("#dialog_btn");

                client.verify.ok(true, "File list failed to load!"); //don't stop testing
            }
        });
    },

    after: function (client) {
        client.end();
    },
};