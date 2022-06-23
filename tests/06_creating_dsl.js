let user_utils = require('./user_utils');
let model_building_utils = require('./model_building_utils');
let mouse_tracking = require('./mouse_tracking.js');
const div_utils = require("./div_utils");

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
        "      \"type\": \"list<int>\",\n" +
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
        "   }" +
        "]";
}

function get_all_attrs3() {
    return "[\n" +
        "   {\n" +
        "      \"name\": \"test\",\n" +
        "      \"type\": \"string\",\n" +
        "      \"default\": \"hello\"\n" +
        "   }" +
        "]";
}

let assocs = [
    //from, to, name, isContain, out_card, in_card, offset, offset2


    [1, 3, "oneToOne", false,
        [{
            "dir": "out",
            "type": "oneToOne",
            "min": "1",
            "max": "1"
        }],
        [{
            "dir": "in",
            "type": "oneToOne",
            "min": "1",
            "max": "1"
        }],
        [3, 3], [0, 0]
    ],
    [0, 1, "testAssoc", false, null, null, [0, 0], [-3, -3]],
    [4, 5, "ManyToOne", false,
        null,
        [{
            "dir": "in",
            "type": "ManyToOne",
            "min": "0",
            "max": "1"
        }],
        [0, 0], [0, 0]
    ],
    [6, 7, "Containment", true,
        null, null,
        [0, 0], [0, 0]
    ],
    [8, 8, "self", false,
        null, null,
        [-3, -3], [3, 3]
    ]
];


module.exports = {

    beforeEach : async function (client) {
        await client.url('http://localhost:8124/atompm').pause(300).maximizeWindow();
        mouse_tracking.track_mouse(client);
    },

    'Login' : async function (client) {
        await user_utils.login(client);
    },

    'Create AS model': function (client) {

        let filename = '/Formalisms/__LanguageSyntax__/SimpleClassDiagram/SimpleClassDiagram.umlIcons.metamodel';
        model_building_utils.load_toolbar(client, [filename]);

        let classIcon = "#\\/Formalisms\\/__LanguageSyntax__\\/SimpleClassDiagram\\/SimpleClassDiagram\\.umlIcons\\.metamodel\\/ClassIcon";
        client.waitForElementPresent(classIcon, 2000, "Check for class icon...");
        client.click(classIcon);

        client.waitForElementPresent(div_utils.canvas, 1000, "Checking for canvas...");

        let name_field = "#tr_name > td:nth-child(2) > textarea";
        let num_elements = 0;

        //BUILD CLASSES
        let start_x = 30;
        let x_diff = 350;
        let x_coords = [start_x, start_x + x_diff, start_x + 2 * x_diff];

        let start_y = 100;
        let y_diff = 150;
        let y_coords = [start_y, start_y + y_diff, start_y + 2 * y_diff];

        let num_classes = x_coords.length * y_coords.length;

        num_elements = model_building_utils.create_classes(client, x_coords, y_coords, num_elements);

        let abstract_class = 4;

        // for speedup of testing
        let skip_attribs = false;
        if (!skip_attribs) {
            // SET NAMES FOR CLASSES
            for (let i = 0; i < num_classes; i++) {
                let class_name = "Class" + String.fromCharCode(65 + i);
                let attrs = {};
                attrs[name_field] = class_name;
                model_building_utils.set_attribs(client, i, attrs);
            }

            // SET ATTRIBUTES
            //let class_div = div_utils.get_class_div(8);
            let attr_div = "#tr_attributes > td:nth-child(2) > textarea";
            let attrs = {}
            attrs[attr_div] = get_all_attrs();
            model_building_utils.set_attribs(client, 8, attrs);

            attrs[attr_div] = get_all_attrs3();
            model_building_utils.set_attribs(client, 0, attrs);

            let checkbox_div = "#tr_abstract > td:nth-child(2) > input[type=\"checkbox\"]";
            attrs = {};
            attrs[attr_div] = get_all_attrs2();
            attrs[checkbox_div] = "";
            model_building_utils.set_attribs(client, abstract_class, attrs);
        }


        //SET ASSOCS
        client.pause(100);

        // for debugging
        let skip_assocs = false;
        if (!skip_assocs) {

            //CREATE INHERITANCE
            let inheri_classes = [
                [abstract_class, abstract_class + 1],
                [abstract_class, abstract_class + 3]];

            for (let inheri_set of inheri_classes) {
                //tiny offset to not hit other arrows
                let offset = [4 * inheri_set[0], 5 * inheri_set[0]];
                let offset2 = [4 * inheri_set[1], 5 * inheri_set[1]];

                let sup = div_utils.get_class_div(inheri_set[0]);
                let sub = div_utils.get_class_div(inheri_set[1]);

                let inheri_relation = "#div_dialog_0 > select > option:nth-child(2)";

                model_building_utils.create_assoc(client, sub, sup, inheri_relation, offset, offset2);

                num_elements++;
            }

            let assoc_num = 0;
            for (let assoc of assocs) {

                // console.log("Creating assoc:");
                // console.log(assoc);

                let from_ele = div_utils.get_class_div(assoc[0]);
                let to_ele = div_utils.get_class_div(assoc[1]);
                let name = assoc[2];
                let isContain = assoc[3];
                let out_card = assoc[4];
                let in_card = assoc[5];

                let cardinality_field = "#tr_cardinalities > td:nth-child(2) > textarea";

                let assoc_div = div_utils.get_assoc_div(num_elements);
                assoc_num++;
                num_elements++;

                let attrib_offset = [4, 4];
                if (out_card) {
                    let attrs = {};
                    attrs[cardinality_field] = JSON.stringify(out_card);
                    model_building_utils.set_attribs(client, 0, attrs, from_ele, undefined, attrib_offset);
                }

                if (in_card) {
                    let attrs = {};
                    attrs[cardinality_field] = JSON.stringify(in_card);
                    model_building_utils.set_attribs(client, 0, attrs, to_ele, undefined, attrib_offset);
                }

                client.pause(300);

                let assoc_relation = "#div_dialog_0 > select > option:nth-child(1)";
                //tiny offset to not hit other arrows
                let offset = [3 * assoc[0], 5 * assoc[1]];
                let offset2 = [4 * assoc[1], 5 * assoc[1]];

                model_building_utils.create_assoc(client, from_ele, to_ele, assoc_relation, offset, offset2);

                let attrs = {};
                attrs[name_field] = name;
                if (isContain) {
                    let contain_opt = "#choice_containment";
                    attrs[contain_opt] = "";
                }

                model_building_utils.set_attribs(client, 0, attrs, assoc_div, undefined, attrib_offset);



            }
        }

        //CREATE CONSTRAINT
        let constraint_type = "GlobalConstraintIcon";
        let constraint_div = div_utils.get_element_div(constraint_type, num_elements);
        let constraintIcon = "#\\2f Formalisms\\2f __LanguageSyntax__\\2f SimpleClassDiagram\\2f SimpleClassDiagram\\2e umlIcons\\2e metamodel\\2f GlobalConstraintIcon";
        client.waitForElementPresent(constraintIcon, 2000, "Check for constraint icon...");
        client.click(constraintIcon);

        model_building_utils.create_class(client, start_x + 3 * x_diff, start_y, num_elements, constraint_type);

        //let pre_create_opt = "#tr_event > td:nth-child(2) > select > option:nth-child(2)";
        let code_field = "#tr_code > td:nth-child(2) > textarea";
        let validate_choice = "#choice_validate";
        let constraint_code = "let C_classes = getAllNodes(['/autotest/autotest/ClassC']);\n" +
            "C_classes.length <= 2;";

        let attrs = {};
        attrs[name_field] = "max-two-instances";
        attrs[validate_choice] = "";
        attrs[code_field] = constraint_code;
        model_building_utils.set_attribs(client, 0, attrs, constraint_div);

        //SAVE MODEL
        let model_name = "autotest.model";
        let folder_name = "autotest";
        model_building_utils.save_model(client, folder_name, model_name);


        //COMPILE TO ASMM
        let metamodel_name = "autotest.metamodel";
        model_building_utils.compile_model(client, "AS", folder_name, metamodel_name);

        client.pause(300);
    },


    'Create CS model': function (client) {
        let filename = '/Formalisms/__LanguageSyntax__/ConcreteSyntax/ConcreteSyntax.defaultIcons.metamodel';
        model_building_utils.load_toolbar(client, [filename]);

        let classIcon = "#\\/Formalisms\\/__LanguageSyntax__\\/ConcreteSyntax\\/ConcreteSyntax\\.defaultIcons\\.metamodel\\/IconIcon";
        client.waitForElementPresent(classIcon, 2000, "Check for class icon...")
        client.click(classIcon);

        let canvas = "#div_canvas";
        client.waitForElementPresent(canvas, 1000, "Checking for canvas...");

        let name_field = "#tr_typename > td:nth-child(2) > textarea";
        let num_elements = 0;

        //BUILD CLASSES
        let icon_type = "#\\/Formalisms\\/__LanguageSyntax__\\/ConcreteSyntax\\/ConcreteSyntax\\.defaultIcons\\/IconIcon\\/";

        let start_x = 100;
        let x_diff = 225;
        let x_coords = [start_x, start_x + x_diff, start_x + 2 * x_diff];

        let start_y = 150;
        let y_diff = 180;
        let y_coords = [start_y, start_y + y_diff, start_y + 2 * y_diff];

        let num_classes = x_coords.length * y_coords.length;

        num_elements = model_building_utils.create_classes(client, x_coords, y_coords, num_elements, icon_type);

        //SET NAMES FOR CLASSES
        for (let i = 0; i < num_classes; i++) {
            let class_name = "Class" + String.fromCharCode(65 + i) + "Icon";
            let attrs = {};
            attrs[name_field] = class_name;
            model_building_utils.set_attribs(client, i, attrs, icon_type);
        }

        // BUILD TEXT FOR ICONS
        let textIcon = "#\\/Formalisms\\/__LanguageSyntax__\\/ConcreteSyntax\\/ConcreteSyntax\\.defaultIcons\\.metamodel\\/TextIcon";
        let textType = "#\\/Formalisms\\/__LanguageSyntax__\\/ConcreteSyntax\\/ConcreteSyntax\\.defaultIcons\\/TextIcon\\/";
        let textContent_field = "#tr_textContent > td:nth-child(2) > textarea";

        client.waitForElementPresent(textIcon, 2000, "Check for text icon...");
        client.click(textIcon);

        for (let i = 0; i < num_classes; i++) {

            let text = "Class" + String.fromCharCode(65 + i);

            let textDiv = div_utils.build_div(textType, num_elements);
            let iconDiv = div_utils.build_div(icon_type, i);

            let attrs = {};
            attrs[textContent_field] = text;

            model_building_utils.create_class(client, 20, 200, num_elements, textType);
            model_building_utils.set_attribs(client, num_elements, attrs, textType);

            num_elements++;

            model_building_utils.move_element(client, textDiv, iconDiv, [0, 0], [0, 40]);

            //inner link counts as an element
            num_elements++;
        }


        // BUILD SYMBOLS FOR ICONS
        let symbols = ["PathIcon", "CircleIcon", "StarIcon", "PolygonIcon", "EllipseIcon", "EllipseIcon", "RectangleIcon", "ImageIcon"];
        let getIcon = function (type) {
            return "#\\/Formalisms\\/__LanguageSyntax__\\/ConcreteSyntax\\/ConcreteSyntax\\.defaultIcons\\.metamodel\\/" + type;
        };
        let getType = function (type) {
            return "#\\/Formalisms\\/__LanguageSyntax__\\/ConcreteSyntax\\/ConcreteSyntax\\.defaultIcons\\/" + type + "\\/";
        };

        for (let i = 0; i < num_classes; i++) {

            let currSymbol = symbols[i % symbols.length];
            client.waitForElementPresent(getIcon(currSymbol), 2000, "Check for symbol icon...");
            client.click(getIcon(currSymbol));

            let symbolDiv = div_utils.build_div(getType(currSymbol), num_elements);
            let iconDiv = div_utils.build_div(icon_type, i);

            model_building_utils.create_class(client, 20, 200, num_elements, getType(currSymbol));
            model_building_utils.deselect_all(client);

            num_elements++;

            model_building_utils.move_element(client, symbolDiv, iconDiv, [0, 0], [0, -40]);

            //inner link counts as an element
            num_elements++;

            client.pause(200);
        }

        // BUILD LINKS
        let linkIcon = "#\\/Formalisms\\/__LanguageSyntax__\\/ConcreteSyntax\\/ConcreteSyntax\\.defaultIcons\\.metamodel\\/LinkIcon";
        let linkType = "#\\/Formalisms\\/__LanguageSyntax__\\/ConcreteSyntax\\/ConcreteSyntax\\.defaultIcons\\/LinkIcon\\/";
        let link_typename_field = "#tr_typename > td:nth-child(2) > textarea";

        let link_y_coords = [];
        let link_x_coords = [start_x + 3 * x_diff, start_x + 4 * x_diff];

        for (let i = 0; i < assocs.length / 2; i++) {
            link_y_coords.push(start_y + i * y_diff);
        }

        client.waitForElementPresent(linkIcon, 2000, "Check for link icon...");
        client.click(linkIcon);

        let num_elements_before = num_elements;
        model_building_utils.create_classes(client, link_x_coords, link_y_coords, num_elements, linkType);

        //SET NAMES FOR LINKS
        for (let i = 0; i < assocs.length; i++) {
            let link_name = assocs[i][2] + "Link";
            let attrs = {};
            attrs[link_typename_field] = link_name;
            model_building_utils.set_attribs(client, num_elements_before + i, attrs, linkType);
        }

        //remove unneeded elements
        model_building_utils.delete_element(client, div_utils.build_div(icon_type, 4));

        model_building_utils.delete_element(client, div_utils.build_div(linkType, 50));


        let folder_name = "autotest";
        model_building_utils.save_model(client, folder_name, "autotestCS.model");

        model_building_utils.compile_model(client, "CS", folder_name, "autotest.defaultIcons.metamodel");

        client.pause(300);
    },

    'Create model': function (client) {

        let test_toolbar = '/autotest/autotest.defaultIcons.metamodel';
        model_building_utils.load_toolbar(client, [test_toolbar]);

        let class_names = [];
        for (let i = 0; i < 9; i++) {
            let class_name = "Class" + String.fromCharCode(65 + i) + "Icon";

            if (class_name == "ClassEIcon") {
                continue; //skip ClassEIcon
            }
            class_names.push(class_name);
        }

        //BUILD CLASSES
        let class_icon = "#\\2f autotest\\2f autotest\\2e defaultIcons\\2e metamodel\\2f ";
        let class_type = "#\\2f autotest\\2f autotest\\2e defaultIcons\\2f ";

        let start_x = 200;
        let x_diff = 300;
        let x_coords = [start_x, start_x + x_diff, start_x + 2 * x_diff];

        let start_y = 150;
        let y_diff = 180;
        let y_coords = [start_y, start_y + y_diff, start_y + 2 * y_diff];

        let coords = [];
        for (let x of x_coords) {
            for (let y of y_coords) {
                coords.push([x, y]);
            }
        }

        let num_elements = 0;
        let element_map = {};

        for (let i = 0; i < class_names.length; i++) {
            let class_name = class_names[i];
            let class_btn = class_icon + class_name;

            client.waitForElementPresent(class_btn, 2000, "Check for class icon: " + class_btn)
                .click(class_btn);

            let class_div = class_type + class_name + "\\2f ";
            element_map[class_name] = model_building_utils.create_class(client, coords[i][0], coords[i][1], num_elements, class_div);

            num_elements++;

        }

        model_building_utils.deselect_all(client);

        // BUILD ASSOCIATIONS
        for (let assoc of assocs) {
            let from_class_name = "Class" + String.fromCharCode(65 + assoc[0]) + "Icon";
            let to_class_name = "Class" + String.fromCharCode(65 + assoc[1]) + "Icon";

            if (from_class_name == "ClassEIcon") {
                from_class_name = "ClassHIcon";
            }

            if (to_class_name == "ClassEIcon") {
                from_class_name = "ClassFIcon";
            }

            //select the text of the class
            let text_div = " > text:nth-child(1)";
            let from_class_div = element_map[from_class_name] + text_div;
            let to_class_div = element_map[to_class_name] + text_div;

            // console.log(from_class_div);
            // console.log(to_class_div);


            let isContainAssoc = assoc[3];
            if (!isContainAssoc) {
                //let assoc_relation = "#div_dialog_0 > select > option:nth-child(1)";
                //tiny offset to not hit other arrows
                let offset = assoc[6];
                let offset2 = assoc[7];

                model_building_utils.create_assoc(client, from_class_div, to_class_div, undefined, offset, offset2);
            } else {
                model_building_utils.move_element(client, to_class_div, from_class_div, [0, 0], [0, 0])
            }

            num_elements++;

            model_building_utils.deselect_all(client);

        }



        //SCALE AND ROTATE TESTS
        let scale_element_div = "#\\/autotest\\/autotest\\.defaultIcons\\/ClassDIcon\\/3\\.instance";
        model_building_utils.hit_control_element(client, scale_element_div);
        //client.mouseButtonClick('left').pause(300);
        //client.setValue(scale_element_div, client.Keys.CONTROL);
        //TODO: Can't send CONTROL key
        // client.execute(function () {
        //     GeometryUtils.showGeometryControlsOverlay();
        // }, [], null);


        let resize_btn_div = "#resize_btn";
        let resizeH_btn_div = "#resizeH_btn";
        let resizeW_btn_div = "#resizeW_btn";
        let rotate_btn_div = "#rotate_btn";
        let ok_btn_div = "#ok_btn";

        model_building_utils.scroll_geometry_element(client, resize_btn_div, 120, 8);
        model_building_utils.scroll_geometry_element(client, resizeH_btn_div, -120, 4);
        model_building_utils.scroll_geometry_element(client, resizeW_btn_div, -120, 4);
        model_building_utils.scroll_geometry_element(client, rotate_btn_div, 120, 8);
        client.click(ok_btn_div).pause(500);

        model_building_utils.deselect_all(client);

        //SET ATTRIBUTES

        let IClass = "#\\/autotest\\/autotest\\.defaultIcons\\/ClassIIcon\\/";

        let AAttribs = {};
        AAttribs['int'] = 123;
        AAttribs['string'] = "bonjour";
        AAttribs['float'] = "123.456";
        AAttribs['boolean'] = false;

        let attribs = {};
        for (let [key, value] of Object.entries(AAttribs)) {
            let attrib_type = "textarea";
            if (key == "boolean") attrib_type = "input";
            let new_key = "#tr_" + key + " > td:nth-child(2) > "+attrib_type+":nth-child(1)";
            attribs[new_key] = value;
        }
        //TODO: Set other attribs
        let div_suffix = " > text";
        model_building_utils.set_attribs(client, 7, attribs, IClass, div_suffix, [5, 5]);

        //client.pause(500000)

        // VERIFY MODEL
        let verify_btn = "#\\/Toolbars\\/MainMenu\\/MainMenu\\.buttons\\.model\\/validateM";
        let dialog_btn = "#dialog_btn";

        client.waitForElementPresent(verify_btn, 2000, "Find verify button")
            .click(verify_btn)
            .waitForElementNotPresent(dialog_btn, 500, "No constraint violation");

        let new_x = start_x + 3 * x_diff;
        let class_btn = class_icon + "ClassCIcon";
        let CClass_type = "#\\/autotest\\/autotest\\.defaultIcons\\/ClassCIcon\\/";
        client.click(class_btn).pause(100);

        model_building_utils.create_class(client, new_x, start_y, num_elements, CClass_type);
        model_building_utils.create_class(client, new_x, start_y + y_diff, num_elements, CClass_type);

        client.click(verify_btn)
            .waitForElementPresent(dialog_btn, 2000, "Constraint violation")
            .click(dialog_btn);

        model_building_utils.deselect_all(client);


        // SAVE INSTANCE MODEL
        let folder_name = "autotest";
        model_building_utils.save_model(client, folder_name, "autotest_instance.model");

        client.pause(300);


    },


    after: function (client) {
        client.end();
    },


};


