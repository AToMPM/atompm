let test_utils = require('./test_utils');
let model_building_utils = require('./model_building_utils');
let user = "./users/testuser/";

module.exports = {

    beforeEach : function (client) {
        client.url('http://localhost:8124/atompm').pause(300);
    },

    'Login' : function (client) {
        test_utils.login(client);
    },

    'Check undo of deletion' : function (client) {
        let filename = '/Formalisms/__LanguageSyntax__/SimpleClassDiagram/SimpleClassDiagram.umlIcons.metamodel';
        test_utils.load_toolbar(client, [filename]);


        let classIcon = "#\\/Formalisms\\/__LanguageSyntax__\\/SimpleClassDiagram\\/SimpleClassDiagram\\.umlIcons\\.metamodel\\/ClassIcon";
        client.waitForElementPresent(classIcon, 2000, "Check for class icon...");
        client.click(classIcon);

        let canvas = "#div_canvas";
        client.waitForElementPresent(canvas, 1000, "Checking for canvas...");

        let num_elements = 0;

        //BUILD CLASS
        let class_div = model_building_utils.create_class(client, 50, 200, 0);

        //DELETE CLASS
        model_building_utils.delete_element(client, class_div);

        //CHECK FOR PRESENCE
        client.waitForElementNotPresent(class_div, 1000, "Class deleted");

        //UNDO
        let undoBtn = "#\\/Toolbars\\/MainMenu\\/MainMenu\\.buttons\\.model\\/undo";
        client.waitForElementPresent(undoBtn, 2000, "Check for undo button...");
        client.click(undoBtn);
        client.pause(1000);
        client.click(undoBtn);
        client.waitForElementPresent(class_div, 1000, "Class restored");

        //SECOND DELETE
        model_building_utils.delete_element(client, class_div);

        //SECOND CHECK FOR PRESENCE
        client.waitForElementNotPresent(class_div, 1000, "Class deleted for second time")
    },

    after : function (client) {
        client.end();
    },

};