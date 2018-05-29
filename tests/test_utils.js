function login(client) {
    client.execute(
        function () {
            UserManagement.login('testuser');
        }, [], null
    );

    client.pause(300);

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

        client.pause(500);

        client.getTitle(function (title) {
            this.assert.ok(title.includes(name), "Check for model: " + name);
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

        client.waitForElementPresent(toolbar_name, 2000, "Check for toolbar: " + name);
    }

}

let user = "./users/testuser/";
let glob = require('glob');

let getFiles = function (client, dir, pattern, load_function, failing_files) {
    glob(dir + pattern, callback(client, load_function, failing_files));
};

function callback(client, load_function, failing_files) {
    return function (err, res) {
        if (err) {
            assert(false, "Error in reading directory: " + user + "Toolbars");
        } else {

            let filenames = [];
            for (let i in res) {
                let fn = res[i];
                fn = "\/" + fn.replace(user, "");

                //skip files we know will fail
                if (failing_files == undefined || !failing_files.includes(fn)) {
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