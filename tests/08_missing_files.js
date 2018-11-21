let _fs = require('fs');

let deleteFolderRecursive = function (path) {
    if (_fs.existsSync(path)) {
        _fs.readdirSync(path).forEach(function (file, index) {
            let curPath = path + "/" + file;
            console.log("Deleting: " + curPath);

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


    'Signup user': function (client) {

        client.url('http://localhost:8124/atompm').pause(300);

        client.execute(
            function () {
                UserManagement.validateCredentials('userremove', 'test');
            }, [], null
        );

        client.pause(500);

        let user_exists = false;
        client.getText('div[id=div_login_error]', function (result) {
            user_exists = result.value.includes('login failed');

        });

        if (user_exists == false) {
            client.execute(
                function () {
                    UserManagement.signup('userremove', 'test');
                }, [], null
            );

        }

        client.pause(500);

        client.execute(
            function () {
                UserManagement.login('userremove');
            }, [], null
        );

        client.pause(500);
        client.getTitle(function (title) {
            this.assert.ok(title.includes("AToMPM - [Unnamed]"), "AToMPM is opened");
        });

    },

    'Load Missing Toolbar': function (client) {

        let filename = './toolbars/missing.metamodel';
        client.execute(
            function () {
                DataUtils.loadbm('./toolbars/missing.metamodel');
            }, [], null
        );

        client.waitForElementPresent("#dialog_btn", 2000, "Check for toolbar loading error: " + filename);
        client.element('css selector', '#dialog_btn', function (result) {
            if (result.status != -1) {
                //Dialog has popped up, so check the text and click the button
                client.assert.containsText("#div_dialog_0", "File not found");
                client.click("#dialog_btn");

                client.verify.ok(true, "Toolbar: " + filename + " failed to load!"); //don't stop testing
            }
        });

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
                client.assert.containsText("#div_dialog_0", "File cannot be read");
                client.click("#dialog_btn");

                client.verify.ok(true, "Model: " + filename + " failed to load!"); //don't stop testing
            }
        });

    },

    'Delete and Click Toolbar': function (client) {
        client.pause(500);
        deleteFolderRecursive("./users/userremove");

        client.pause(1000);

        let load_button = "#\\2f Toolbars\\2f MainMenu\\2f MainMenu\\2e buttons\\2e model\\2f loadModel";
        client.waitForElementPresent(load_button, 1000, "Looking for load button")
            .click(load_button)
            .waitForElementPresent("#dialog_btn", 1000, "Load menu opens");


        client.waitForElementPresent("#dialog_btn", 2000, "Check for file list loading error");
        client.element('css selector', '#dialog_btn', function (result) {
            if (result.status != -1) {
                //Dialog has popped up, so check the text and click the button
                client.assert.containsText("#div_dialog_0", "Cannot load file list");
                client.click("#dialog_btn");

                client.verify.ok(true, "File list failed to load!"); //don't stop testing
            }
        });
    },

    after: function (client) {
        client.end();
    },
};