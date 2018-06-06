
let test_utils = require('./test_utils');
let user = "./users/testuser/";

module.exports = {

    beforeEach: function (client) {
        client.url('http://localhost:8124/atompm').pause(300);
    },

    'Login': function (client) {

        test_utils.login(client);
    },

    'Create model': function (client) {
        let filename = '/Formalisms/__LanguageSyntax__/SimpleClassDiagram/SimpleClassDiagram.umlIcons.metamodel';
        test_utils.load_toolbar(client, [filename]);

        let classIcon = "#\\/Formalisms\\/__LanguageSyntax__\\/SimpleClassDiagram\\/SimpleClassDiagram\\.umlIcons\\.metamodel\\/ClassIcon";
        client.waitForElementPresent(classIcon, 2000, "Check for class icon...");
        client.click(classIcon);

        console.log("Moving");
        let canvas = "#div_canvas";
        client.waitForElementPresent(canvas, 1000, "Checking for canvas...");

        let start_x = 50;
        let x_diff = 350;
        let x_coords = [start_x, start_x + x_diff, start_x + 2 * x_diff];

        let start_y = 200;
        let y_diff = 150;
        let y_coords = [start_y, start_y + y_diff, start_y + 2 * y_diff];

        for (let x of x_coords){
            for (let y of y_coords){
                client
                .moveToElement(canvas, x, y)
                .mouseButtonClick('right')
                .pause(500);
            }
        }

        let name_field = "#tr_name > td:nth-child(2) > textarea";
        for (let i = 0; i < 9; i++){
            let class_name = "Class" + String.fromCharCode(65 + i);
            let class_div = "#div_canvas > svg > g:nth-child(" + (3 + i) +")";

            client.waitForElementPresent(class_div, 1000, "Looking for class");

            client.moveToElement(class_div, 10, 10)
                .mouseButtonClick('middle')
                .waitForElementPresent("#dialog_btn", 1000, "Editing menu opens")
                .clearValue(name_field)
                .setValue(name_field, class_name)
                .click("#dialog_btn")
                .waitForElementNotPresent("#dialog_btn", 1000, "Editing menu closes")
                .moveToElement(canvas, 0, 100)
                .mouseButtonClick('left')
                .pause(1000)
                ;
        }

        // let element = ;
        // let element2 = "#div_canvas > svg > g:nth-child(4)";
        //
        // client.pause(100)
        //     .moveToElement(element, 10, 10)
        //     .mouseButtonClick('middle');

        //client.pause(000);
    },

    after: function (client) {
        client.end();
    },


};


