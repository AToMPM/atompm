//NOTE: REQUIRES DSL FROM PREVIOUS TEST

let user_utils = require('./user_utils');
let model_building_utils = require('./model_building_utils');
let mouse_tracking = require('./mouse_tracking.js');

let rule_toolbars = [
    "/Formalisms/__Transformations__/TransformationRule/TransformationRule.defaultIcons.metamodel",
    "/autotest/autotest.defaultIcons.pattern.metamodel"
];

// TODO: temporarily disable this test for CI and local runs; re-enable after fixing flakiness
module.exports = {
    '@disabled': true,

    beforeEach: async function (client) {
        await client.url('http://localhost:8124/atompm').pause(300).maximizeWindow();
        mouse_tracking.track_mouse(client);
    },

    'Login': async function (client) {
        await user_utils.login(client);
    },

    'Compile Pattern MM': function (client) {
        let folder_name = "autotest";
        let model_name = "autotest.metamodel";
        model_building_utils.compile_model(client, "pattern", folder_name, model_name);
    },

    'Create Transformation': async function (client) {

        let trans_formalism = "/Formalisms/__Transformations__/Transformation/MoTif.defaultIcons.metamodel";

        model_building_utils.load_toolbar(client, [trans_formalism]);


        //BUILD ELEMENTS

        let x_coord = 300;
        let y_coords = [200, 320, 440, 560, 680];

        let btn_prefix = "#\\2f Formalisms\\2f __Transformations__\\2f Transformation\\2f MoTif\\2e defaultIcons\\2e metamodel\\2f ";
        let type_prefix = "#\\2f Formalisms\\2f __Transformations__\\2f Transformation\\2f MoTif\\2e defaultIcons\\2f ";

        let to_create = ["StartIcon", "FRuleIcon", "ARuleIcon", "EndSuccessIcon", "EndFailIcon"];

        let ele_map = {};
        let num_elements = 0;
        for (let ele of to_create) {
            client.waitForElementPresent(btn_prefix + ele, 2000, "Button present: " + btn_prefix + ele);
            client.click(btn_prefix + ele);

            ele_map[ele] = model_building_utils.create_class(client,
                x_coord, y_coords[num_elements], num_elements, type_prefix + ele + "\\2f ");

            if (ele.includes("Rule")) {
                let rule_name = num_elements + "_" + ele.replace("Icon", "");
                let name_field = "#tr_name > td:nth-child(2) > textarea:nth-child(1)";
                let rule_field = "#tr_rule > td:nth-child(2) > textarea:nth-child(1)";
                let rule_prefix = "/autotest/R_";


                let attribs = {};
                attribs[name_field] = rule_name;
                attribs[rule_field] = rule_prefix + rule_name + ".model";
                model_building_utils.set_attribs(client, num_elements, attribs, type_prefix + ele + "\\2f ");
            }
            num_elements++;
        }

        let top_offset = [0, -20];
        let success_offset = [-40, 30];
        let fail_offset = [40, 30];
        let assocs = [
            [0, 1, "", [0, 0], top_offset],
            [1, 2, "success", success_offset, top_offset],
            [2, 3, "success", success_offset, [0, 0]],
            [1, 4, "fail", fail_offset, [-6, 6]],
            [2, 4, "fail", fail_offset, [6, 6]],
        ];

        let i = 0;
        for (let assoc of assocs) {

            let start_ele = to_create[assoc[0]];
            let end_ele = to_create[assoc[1]];

            let start = ele_map[start_ele];
            let end = ele_map[end_ele];

            let relation_div = "";
            if (assoc[2] == "success") {
                relation_div = "#choice_\\2f Formalisms\\2f __Transformations__\\2f Transformation\\2f MoTif\\2e defaultIcons\\2f success";
                //start += " > path:nth-child(3)";
            } else if (assoc[2] == "fail") {
                relation_div = "#choice_\\2f Formalisms\\2f __Transformations__\\2f Transformation\\2f MoTif\\2e defaultIcons\\2f fail";
                //start += " > path:nth-child(5)";
            }

            model_building_utils.create_assoc(client, start, end, relation_div, assoc[3], assoc[4]);
        }


        model_building_utils.save_model(client, "autotest", "T_autotest.model");

    },

    'Create Rule 1': async function (client) {

        model_building_utils.load_toolbar(client, rule_toolbars);

        // BUILD LHS AND RHS
        let LHS_btn = "#\\2f Formalisms\\2f __Transformations__\\2f TransformationRule\\2f TransformationRule\\2e defaultIcons\\2e metamodel\\2f LHSIcon";
        let RHS_btn = "#\\2f Formalisms\\2f __Transformations__\\2f TransformationRule\\2f TransformationRule\\2e defaultIcons\\2e metamodel\\2f RHSIcon";

        let ele_map = {};

        client.waitForElementPresent(LHS_btn, 2000, "LHS button").click(LHS_btn);
        let LHS_div = "#\\2f Formalisms\\2f __Transformations__\\2f TransformationRule\\2f TransformationRule\\2e defaultIcons\\2f LHSIcon\\2f ";
        ele_map["LHS"] = model_building_utils.create_class(client, 150, 200, 0, LHS_div);

        client.waitForElementPresent(RHS_btn, 2000, "RHS button").click(RHS_btn);
        let RHS_div = "#\\2f Formalisms\\2f __Transformations__\\2f TransformationRule\\2f TransformationRule\\2e defaultIcons\\2f RHSIcon\\2f ";
        ele_map["RHS"] = model_building_utils.create_class(client, 650, 200, 1, RHS_div);

        model_building_utils.deselect_all(client);

        //BUILD ELEMENTS INSIDE
        let c_btn = "#\\2f autotest\\2f autotest\\2e defaultIcons\\2e pattern\\2e metamodel\\2f __pClassCIcon";
        let d_btn = "#\\2f autotest\\2f autotest\\2e defaultIcons\\2e pattern\\2e metamodel\\2f __pClassDIcon";

        client.waitForElementPresent(c_btn, 2000, "C button").click(c_btn);
        let c_div = "#\\2f autotest\\2f autotest\\2e defaultIcons\\2e pattern\\2f __pClassCIcon\\2f ";
        ele_map["C"] = model_building_utils.create_class(client, 50, 200, 2, c_div);

        client.waitForElementPresent(d_btn, 2000, "D button").click(d_btn);
        let d_div = "#\\2f autotest\\2f autotest\\2e defaultIcons\\2e pattern\\2f __pClassDIcon\\2f ";
        ele_map["D"] = model_building_utils.create_class(client, 50, 400, 3, d_div);

        model_building_utils.move_element(client, ele_map["C"] + " > text:nth-child(1)", ele_map["LHS"], [0, 0], [0, 0]);
        model_building_utils.move_element(client, ele_map["D"] + " > text:nth-child(1)", ele_map["RHS"], [0, 0], [0, 0]);


        model_building_utils.save_model(client, "autotest", "R_1_FRule.model");
    },

    'Create Rule 2': async function (client) {

        model_building_utils.load_toolbar(client, rule_toolbars);

        // BUILD LHS AND RHS
        let LHS_btn = "#\\2f Formalisms\\2f __Transformations__\\2f TransformationRule\\2f TransformationRule\\2e defaultIcons\\2e metamodel\\2f LHSIcon";
        let RHS_btn = "#\\2f Formalisms\\2f __Transformations__\\2f TransformationRule\\2f TransformationRule\\2e defaultIcons\\2e metamodel\\2f RHSIcon";

        let ele_map = {};

        client.waitForElementPresent(LHS_btn, 2000, "LHS button").click(LHS_btn);
        let LHS_div = "#\\2f Formalisms\\2f __Transformations__\\2f TransformationRule\\2f TransformationRule\\2e defaultIcons\\2f LHSIcon\\2f ";
        ele_map["LHS"] = model_building_utils.create_class(client, 150, 200, 0, LHS_div);

        client.waitForElementPresent(RHS_btn, 2000, "RHS button").click(RHS_btn);
        let RHS_div = "#\\2f Formalisms\\2f __Transformations__\\2f TransformationRule\\2f TransformationRule\\2e defaultIcons\\2f RHSIcon\\2f ";
        ele_map["RHS"] = model_building_utils.create_class(client, 650, 200, 1, RHS_div);

        model_building_utils.deselect_all(client);

        //BUILD ELEMENTS INSIDE
        let a_btn = "#\\2f autotest\\2f autotest\\2e defaultIcons\\2e pattern\\2e metamodel\\2f __pClassAIcon";
        let a_div = "#\\2f autotest\\2f autotest\\2e defaultIcons\\2e pattern\\2f __pClassAIcon\\2f ";

        //BUILD A
        client.waitForElementPresent(a_btn, 2000, "A button").click(a_btn);
        ele_map["A_lhs"] = model_building_utils.create_class(client, 50, 200, 2, a_div);
        ele_map["A_rhs"] = model_building_utils.create_class(client, 50, 400, 3, a_div);

        model_building_utils.move_element(client, ele_map["A_lhs"] + " > text:nth-child(1)", ele_map["LHS"], [0, 0], [0, -70]);
        model_building_utils.move_element(client, ele_map["A_rhs"] + " > text:nth-child(1)", ele_map["RHS"], [0, 0], [0, -70]);


        model_building_utils.deselect_all(client);

        let b_btn = "#\\2f autotest\\2f autotest\\2e defaultIcons\\2e pattern\\2e metamodel\\2f __pClassBIcon";
        let b_div = "#\\2f autotest\\2f autotest\\2e defaultIcons\\2e pattern\\2f __pClassBIcon\\2f ";

        //BUILD B
        client.waitForElementPresent(b_btn, 2000, "B button").click(b_btn);
        ele_map["B_lhs"] = model_building_utils.create_class(client, 50, 200, 6, b_div);
        ele_map["B_rhs"] = model_building_utils.create_class(client, 50, 400, 7, b_div);

        model_building_utils.move_element(client, ele_map["B_lhs"] + " > text:nth-child(1)", ele_map["LHS"], [0, 0], [0, 100]);
        model_building_utils.move_element(client, ele_map["B_rhs"] + " > text:nth-child(1)", ele_map["RHS"], [0, 0], [0, 100]);

        model_building_utils.deselect_all(client);

        //BUILD ASSOCS
        model_building_utils.create_assoc(client,
            ele_map["A_lhs"] + " > text:nth-child(1)", ele_map["B_lhs"] + " > text:nth-child(1)", "", 0);

        model_building_utils.create_assoc(client,
            ele_map["A_rhs"] + " > text:nth-child(1)", ele_map["B_rhs"] + " > text:nth-child(1)", "", 0);

        let test_field = "#tr_test > td:nth-child(2) > textarea";
        let attrs = {};
        attrs[test_field] = "result = \"bonjour world!\"";
        model_building_utils.set_attribs(client, 3, attrs, a_div, " > text:nth-child(1)", [10, 10]);

        model_building_utils.save_model(client, "autotest", "R_2_ARule.model");
    },

    'Execute Transformation': async function (client) {
        model_building_utils.load_model(client, "autotest", "autotest_instance.model");

        model_building_utils.compile_model(client, "transform", "autotest", "T_autotest.model");

        let run_button = "#\\2f Toolbars\\2f TransformationController\\2f TransformationController\\2e buttons\\2e model\\2f play";

        client.click(run_button);

        let created_D_1 = "#\\2f autotest\\2f autotest\\2e defaultIcons\\2f ClassDIcon\\2f 15\\2e instance";
        let created_D_2 = "#\\2f autotest\\2f autotest\\2e defaultIcons\\2f ClassDIcon\\2f 15\\2e instance";
        client.waitForElementPresent(created_D_1, 5000, "First D element created");
        client.waitForElementPresent(created_D_2, 5000, "Second D element created");

        //TODO:Test for A element's attribute

        //CHECK CONSTRAINT
        let verify_btn = "#\\/Toolbars\\/MainMenu\\/MainMenu\\.buttons\\.model\\/validateM";
        let dialog_btn = "#dialog_btn";

        client.pause(300);

        client.waitForElementPresent(verify_btn, 2000, "Find verify button")
            .click(verify_btn).pause(300)
            .waitForElementPresent(dialog_btn, 2000, "Constraint violation")
            .click(dialog_btn);
    },

    after: function (client) {
        client.end();
    },


};

