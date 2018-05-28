function loadToolbar(client, fnames) {

    for (let name of fnames) {

        client.execute(
            function (fname) {
                _loadToolbar(fname);
            }, [name], null
        );

        let toolbar_name = name.replace(/\//g, "\\2f ").replace(/\./g, "\\2e ");
        toolbar_name = "#div_toolbar_" + toolbar_name;

        client.waitForElementPresent(toolbar_name, 1000, "Check for toolbar: " + name);
    }

}

let user = "./users/testuser/";
let glob = require('glob');

let getFiles = function (client, dir, pattern) {
    glob(dir + pattern, callback(client));
};

function callback(client) {
    return function (err, res) {
        if (err) {
            assert(false, "Error in reading directory: " + user + "Toolbars");
        } else {

            let filenames = [];
            for (let i in res) {
                let fn = res[i];
                filenames.push("\/" + fn.replace(user, ""));
            }

            //console.log(filenames);
            loadToolbar(client, filenames);
        }
    }
}


module.exports = {

    beforeEach: function (client) {
        client.url('http://localhost:8124/atompm').pause(300);

    },

    'Login': function (client) {

        client.execute(
            function () {
                UserManagement.login('testuser');
            }, [], null
        );

        client.pause(300);

        client.getTitle(function (title) {
            this.assert.ok(title.includes("AToMPM - [Unnamed]"), "AToMPM is opened");
        });
    },

    'Load main menu toolbar': function (client) {
        let filename = 'Toolbars/MainMenu/MainMenu.buttons.model';
        loadToolbar(client, [filename]);
    },

    'Load all toolbars': function (client) {
        getFiles(client, user, '/**/*.buttons.model');
    },

    // 'Load all metamodels' : function (client) {
    //     getFiles(client, user, '/**/*Icons.metamodel');
    // },

    // 'Load all pattern metamodels' : function (client) {
    //     getFiles(client, user, '/**/*Icons.pattern.metamodel');
    //     // let filename = '\\/Formalisms/__LanguageSyntax__/SimpleClassDiagram/SimpleClassDiagram.defaultIcons.metamodel';
    //      //loadToolbar(client, [filename]);
    //
    // },

    after: function (client) {
        client.end();
    },


};


