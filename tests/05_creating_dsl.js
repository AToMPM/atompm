let test_utils = require('./test_utils');
let user = "./users/testuser/";

function get_all_attrs() {
    return "[\n" +
        "   {\n" +
        "      \"name\": \"int\",\n" +
        "      \"type\": \"int\",\n" +
        "      \"default\": 0\n" +
        "   },\n" +
        "   {\n" +
        "      \"name\": \"string\",\n" +
        "      \"type\": \"string\",\n" +
        "      \"default\": \"hello\"\n" +
        "   },\n" +
        "   {\n" +
        "      \"name\": \"float\",\n" +
        "      \"type\": \"float\",\n" +
        "      \"default\": 0\n" +
        "   },\n" +
        "   {\n" +
        "      \"name\": \"boolean\",\n" +
        "      \"type\": \"boolean\",\n" +
        "      \"default\": true\n" +
        "   },\n" +
        "   {\n" +
        "      \"name\": \"code\",\n" +
        "      \"type\": \"code\",\n" +
        "      \"default\": \"\"\n" +
        "   },\n" +
        "   {\n" +
        "      \"name\": \"file_html\",\n" +
        "      \"type\": \"file<*.html>\",\n" +
        "      \"default\": \"\"\n" +
        "   },\n" +
        "   {\n" +
        "      \"name\": \"map_int_string\",\n" +
        "      \"type\": \"map<int,string>\"\n" +
        "   },\n" +
        "   {\n" +
        "      \"name\": \"list_int\",\n" +
        "      \"type\": \"lis<int>\",\n" +
        "      \"default\": [\n" +
        "         1,\n" +
        "         2\n" +
        "      ]\n" +
        "   },\n" +
        "   {\n" +
        "      \"name\": \"enum\",\n" +
        "      \"type\": \"ENUM(Red,Green,Blue)\"\n" +
        "   },\n" +
        "   {\n" +
        "      \"name\": \"enum2\",\n" +
        "      \"type\": \"ENUM(Four,Five,Six,Seven)\"\n" +
        "   }\n" +
        "]";
}

function get_all_attrs2() {
    return "[\n" +
        "   {\n" +
        "      \"name\": \"name\",\n" +
        "      \"type\": \"string\",\n" +
        "      \"default\": \"test\"\n" +
        "   },\n" +
        "   {\n" +
        "      \"name\": \"\",\n" +
        "      \"type\": \"\",\n" +
        "      \"default\": \"\"\n" +
        "   }\n" +
        "]";
}

function get_class_div(num) {
    return "#\\2f Formalisms\\2f __LanguageSyntax__\\2f SimpleClassDiagram\\2f SimpleClassDiagram\\2e umlIcons\\2f ClassIcon\\2f " + (num) + "\\2e instance";
}

function get_assoc_div(num) {
    return "#\\2f Formalisms\\2f __LanguageSyntax__\\2f SimpleClassDiagram\\2f SimpleClassDiagram\\2e umlIcons\\2f AssociationLink\\2f " + (num) + "\\2e instance > text:nth-child(1)";
}

module.exports = {

    beforeEach: function (client, done) {
        client.url('http://localhost:8124/atompm').pause(300).maximizeWindow(done);
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

        let canvas = "#div_canvas";
        client.waitForElementPresent(canvas, 1000, "Checking for canvas...");

        let name_field = "#tr_name > td:nth-child(2) > textarea";
        let num_elements = 0;

        //BUILD CLASSES
        let start_x = 50;
        let x_diff = 350;
        let x_coords = [start_x, start_x + x_diff, start_x + 2 * x_diff];

        let start_y = 200;
        let y_diff = 150;
        let y_coords = [start_y, start_y + y_diff, start_y + 2 * y_diff];

        let num_classes = x_coords.length * y_coords.length;

        let i = 0;
        for (let x of x_coords) {
            for (let y of y_coords) {

                let class_div = get_class_div(i);
                i++;

                client
                    .moveToElement(canvas, x, y)
                    .mouseButtonClick('right')
                    .pause(500)
                    .waitForElementPresent(class_div, 500, "Created class: " + class_div);

                num_elements++;
            }
        }

        //SET NAMES FOR CLASSES
        for (let i = 0; i < num_classes; i++) {
            let class_name = "Class" + String.fromCharCode(65 + i);
            let class_div = get_class_div(i);

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

        //SET ATTRIBUTES
        let class_div = get_class_div(0);
        let attrib_field = "#tr_attributes > td:nth-child(2) > textarea";

        client.moveToElement(class_div, 10, 10)
            .mouseButtonClick('middle')
            .waitForElementPresent("#dialog_btn", 1000, "Editing menu opens")
            .clearValue(attrib_field)
            .setValue(attrib_field, get_all_attrs())
            .click("#dialog_btn")
            .waitForElementNotPresent("#dialog_btn", 1000, "Editing menu closes")
            .moveToElement(canvas, 0, 100)
            .mouseButtonClick('left')
            .pause(1000)
        ;


        let abstract_class = 4;
        let class_div2 = get_class_div(abstract_class);
        let attrib_field2 = "#tr_attributes > td:nth-child(2) > textarea";
        let checkbox = "#tr_abstract > td:nth-child(2) > input[type=\"checkbox\"]";
        client.moveToElement(class_div2, 10, 10)
            .mouseButtonClick('middle')
            .waitForElementPresent("#dialog_btn", 1000, "Editing menu opens")
            .clearValue(attrib_field2)
            .setValue(attrib_field2, get_all_attrs2())
            .moveToElement(checkbox, 0, 0)
            .mouseButtonClick('left')
            .click("#dialog_btn")
            .waitForElementNotPresent("#dialog_btn", 1000, "Editing menu closes")
            .moveToElement(canvas, 0, 100)
            .mouseButtonClick('left')
            .pause(1000)
        ;

        //CREATE INHERITANCE
        let inheri_classes = [
            [abstract_class, abstract_class + 1],
            [abstract_class, abstract_class + 3]];

        for (let inheri_set of inheri_classes) {
            let sup = get_class_div(inheri_set[0]);
            let sub = get_class_div(inheri_set[1]);

            let inheri_relation = "#div_dialog_0 > select > option:nth-child(2)";
            //tiny offset to not hit other arrows
            let offset = 2 * inheri_set[1];
            client
                .moveToElement(sub, 50, 50)
                .mouseButtonDown('right')
                .moveToElement(sup, 50 + offset, 50 + offset)
                .mouseButtonUp('right')
                .pause(500)
                .click(inheri_relation)
                .waitForElementPresent("#dialog_btn", 1000, "Inheri menu opens")
                .click("#dialog_btn")
                .pause(500)
                .waitForElementNotPresent("#dialog_btn", 1000, "Inheri menu closes")
                .moveToElement(canvas, 0, 100)
                .mouseButtonClick('left')
                .pause(500)
            ;

            num_elements++;
        }

        //SET ASSOCS
        let assocs = [
            //from, to, name, isContain, out_card, in_card

            [0, 1, "testAssoc", false, null, null],
            [2, 3, "oneToOne", false,
                [{
                    "dir": "out",
                    "type": "OneToOne",
                    "min": "1",
                    "max": "1"
                }],
                [{
                    "dir": "in",
                    "type": "OneToOne",
                    "min": "1",
                    "max": "1"
                }]
            ],
            [4, 5, "ManyToOne", false,
                null,
                [{
                    "dir": "in",
                    "type": "ManyToOne",
                    "min": "0",
                    "max": "1"
                }]
            ],
            [6, 7, "Containment", true,
                null, null
            ],
            [8, 8, "self", false,
                null, null
            ]
        ];

        client.pause(500);

        let assoc_num = 0;
        for (let assoc of assocs) {

            let from_ele = get_class_div(assoc[0]);
            let to_ele = get_class_div(assoc[1]);
            let name = assoc[2];
            let isContain = assoc[3];
            let out_card = assoc[4];
            let in_card = assoc[5];

            let cardinality_field = "#tr_cardinalities > td:nth-child(2) > textarea";

            let assoc_div = get_assoc_div(num_elements);
            assoc_num++;
            num_elements++;

            let assoc_relation = "#div_dialog_0 > select > option:nth-child(1)";
            //tiny offset to not hit other arrows
            let offset = 2 * assoc[0] + 2 * assoc[1];

            client
                .moveToElement(from_ele, 20, 20)
                .mouseButtonDown('right')
                .moveToElement(to_ele, 20 + offset, 20 + offset)
                .mouseButtonUp('right')
                .pause(500)
                .click(assoc_relation)
                .waitForElementPresent("#dialog_btn", 1000, "Assoc menu opens")
                .click("#dialog_btn")
                .pause(500)
                .waitForElementNotPresent("#dialog_btn", 1000, "Assoc menu closes")
                .moveToElement(canvas, 0, 100)
                .mouseButtonClick('left')
                .pause(1000)
                .waitForElementPresent(assoc_div, 3000, "Assoc name present: " + assoc_div);

            if (out_card) {

                client
                    .moveToElement(from_ele, 10, 10)
                    .mouseButtonClick('middle')
                    .waitForElementPresent("#dialog_btn", 1000, "Out card menu opens")
                    .clearValue(cardinality_field)
                    .setValue(cardinality_field, JSON.stringify(out_card))
                    .click("#dialog_btn")
                    .waitForElementNotPresent("#dialog_btn", 1000, "Out card menu closes")
                    .moveToElement(canvas, 0, 100)
                    .mouseButtonClick('left')
                    .pause(1000);
            }

            if (in_card) {
                client
                    .moveToElement(to_ele, 10, 10)
                    .mouseButtonClick('middle')
                    .waitForElementPresent("#dialog_btn", 1000, "Out card menu opens")
                    .clearValue(cardinality_field)
                    .setValue(cardinality_field, JSON.stringify(in_card))
                    .click("#dialog_btn")
                    .waitForElementNotPresent("#dialog_btn", 1000, "Out card menu closes")
                    .moveToElement(canvas, 0, 100)
                    .mouseButtonClick('left')
                    .pause(1000);
            }
            client.getElementSize(assoc_div, function (result) {
                client
                    .moveToElement(assoc_div, result.value.width / 2, result.value.height / 2)
                    .mouseButtonClick('middle')
                    .waitForElementPresent("#dialog_btn", 5000000, "Editing assoc name opens")
                    .clearValue(name_field)
                    .setValue(name_field, name);

                if (isContain) {
                    let contain_opt = "#tr_linktype > td:nth-child(2) > select > option:nth-child(2)";

                    client
                        .moveToElement(contain_opt, 0, 0)
                        .mouseButtonClick('left');
                }


                client
                    .click("#dialog_btn")
                    .waitForElementNotPresent("#dialog_btn", 1000, "Editing assoc name closes")
                    .moveToElement(canvas, 0, 100)
                    .mouseButtonClick('left')
                    .pause(500);
            })

            ;
        }

        //CREATE CONSTRAINT
        let div_id = num_elements;
        let constraint_div = get_class_div(div_id).replace("ClassIcon", "GlobalConstraintIcon");

        let constraintIcon = "#\\2f Formalisms\\2f __LanguageSyntax__\\2f SimpleClassDiagram\\2f SimpleClassDiagram\\2e umlIcons\\2e metamodel\\2f GlobalConstraintIcon";
        client.waitForElementPresent(constraintIcon, 2000, "Check for constraint icon...");
        client.click(constraintIcon);

        client
            .moveToElement(canvas, 100, 150)
            .mouseButtonClick('right')
            .pause(500)
            .waitForElementPresent(constraint_div, 500, "Created class: " + constraint_div);

        let pre_create_opt = "#tr_event > td:nth-child(2) > select > option:nth-child(2)";
        let code_field = "#tr_code > td:nth-child(2) > textarea";
        let constraint_code = "let C_classes = getAllNodes(['Formalisms/__LanguageSyntax__/SimpleClassDiagram/SimpleClassDiagram/umlIcons/ClassIcon']);\n" +
            "C_classes.length <= 2;";
        client
            .moveToElement(constraint_div, 10, 10)
            .mouseButtonClick('middle')
            .waitForElementPresent("#dialog_btn", 1000, "Constraint menu opens")
            .clearValue(name_field)
            .setValue(name_field, "max-two-instances")
            .moveToElement(pre_create_opt, 0, 0)
            .mouseButtonClick('left')
            .clearValue(code_field)
            .setValue(code_field, constraint_code)
            .click("#dialog_btn")
            .waitForElementNotPresent("#dialog_btn", 1000, "Constraint menu closes")
            .moveToElement(canvas, 0, 100)
            .mouseButtonClick('left')
            .pause(1000);


        client.pause(200000);
    },

    after: function (client) {
        client.end();
    },


};


