function login(client) {
    client.execute(
        function () {
            UserManagement.login('testuser');
        }, [], null
    );

    client.pause(500);

    client.getTitle(function (title) {
        this.assert.ok(title.includes("AToMPM - [Unnamed]"), "AToMPM is opened");
    });
}

function load_model(client, fnames) {

    for (const name of fnames) {
        client.execute(
            function (fname) {
                _loadModel(fname);
            }, [name], null
        );

        client.pause(1000);

        client.element('css selector', '#dialog_btn', function (result) {
            if (result.status != -1) {
                //Dialog has popped up, so check the text and click the button
                client.assert.containsText("#div_dialog_0", "File not found");
                client.click("#dialog_btn");

                //client.verify.ok(false, "File: " + name + " failed to load!"); //don't stop testing
                console.error("File: " + name + " failed to load!");

            } else {
                //Model loaded, so check the title
                client.getTitle(function (title) {
                    this.assert.ok(title.includes(name), "Check for model: " + name);
                });
            }
        });

    }

}

function load_toolbar(client, fnames) {

    for (let name of fnames) {

        client.execute(
            function (fname) {
                _loadToolbar(fname);
            }, [name], null
        );

        let toolbar_name = name.replace(/\//g, "\\2f ").replace(/\./g, "\\2e ");
        toolbar_name = "#div_toolbar_" + toolbar_name;

        client.element('css selector', '#dialog_btn', function (result) {
            if (result.status != -1) {
                //Dialog has popped up, so check the text and click the button
                client.assert.containsText("#div_dialog_0", "File not found");
                client.click("#dialog_btn");

                //client.verify.ok(false, "File: " + name + " failed to load!"); //don't stop testing
                console.error("File: " + name + " failed to load!");
            } else {
                //Toolbar loaded, so check for it
                client.waitForElementPresent(toolbar_name, 2000, "Check for toolbar: " + name);
            }
        });

            }

}

let user = "./users/testuser/";
let glob = require('glob');

let getFiles = function (client, dir, pattern, load_function, files_to_skip) {
    glob(dir + pattern, callback(client, load_function, files_to_skip));
};

function callback(client, load_function, files_to_skip) {
    return function (err, res) {
        if (err) {
            assert(false, "Error in reading directory: " + user + "Toolbars");
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
    }
}

module.exports = {
    '@disabled': true,
    login,
    load_model,
    load_toolbar,
    getFiles
};