let user_utils = require('./user_utils');
let model_building_utils = require('./model_building_utils');
const mouse_tracking = require("./mouse_tracking");

module.exports = {

    '@disabled': true,
    beforeEach: async function (client) {
        await client.url('http://localhost:8124/atompm').pause(300).maximizeWindow();
        mouse_tracking.track_mouse(client);
    },

    'Login': async function (client) {
        await user_utils.login(client);
    },

    'Check undo of deletion': async function (client) {
        let filename = '/Formalisms/__LanguageSyntax__/SimpleClassDiagram/SimpleClassDiagram.umlIcons.metamodel';
        model_building_utils.load_toolbar(client, [filename]);

        let classIcon = "#\\/Formalisms\\/__LanguageSyntax__\\/SimpleClassDiagram\\/SimpleClassDiagram\\.umlIcons\\.metamodel\\/ClassIcon";
        client
            .waitForElementPresent(classIcon, 2000, "Check for class icon...")
            .click(classIcon);

        //BUILD CLASS
        let class_div = await model_building_utils.create_class(client, 50, 200, 0);

        //DELETE CLASS
        await model_building_utils.delete_element(client, class_div);

        //CHECK FOR PRESENCE
        client.waitForElementNotPresent(class_div, 1000, "Class deleted");

        //UNDO
        let undoBtn = "#\\/Toolbars\\/MainMenu\\/MainMenu\\.buttons\\.model\\/undo";
        client.waitForElementPresent(undoBtn, 2000, "Check for undo button...");
        client.click(undoBtn);
        client.waitForElementPresent(class_div, 1000, "Class restored");

        //SECOND DELETE
        await model_building_utils.delete_element(client, class_div);

        //SECOND CHECK FOR PRESENCE
        client.waitForElementNotPresent(class_div, 1000, "Class deleted for second time")
    },

    after: function (client) {
        client.end();
    },

};