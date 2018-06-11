//NOTE: REQUIRES DSL FROM PREVIOUS TEST

let test_utils = require('./test_utils');
let model_building_utils = require('./model_building_utils');
let user = "./users/testuser/";

let rule_toolbars = [
    "/Formalisms/__Transformations__/TransformationRule/TransformationRule.defaultIcons.metamodel",
    "/autotest/autotest.defaultIcons.pattern.metamodel"
];

module.exports = {

    beforeEach: function (client, done) {
        client.url('http://localhost:8124/atompm').pause(300).maximizeWindow(done);
    },

    'Login': function (client) {

        test_utils.login(client);
    },

    'Compile Pattern MM' : function (client) {

        let folder_name = "autotest";
        let model_name = "autotest.metamodel";
        model_building_utils.compile_model(client, "pattern", folder_name, model_name);
    },
    //
    // 'Create Transformation': function (client) {
    //
    //     let trans_formalism = "/Formalisms/__Transformations__/Transformation/MoTif.defaultIcons.metamodel";
    //
    //     test_utils.load_toolbar(client, [trans_formalism]);
    //
    //
    //     //BUILD ELEMENTS
    //
    //     let x_coord = 300;
    //     let y_coords = [200, 320, 440, 560, 680];
    //
    //     let btn_prefix = "#\\2f Formalisms\\2f __Transformations__\\2f Transformation\\2f MoTif\\2e defaultIcons\\2e metamodel\\2f ";
    //     let type_prefix = "#\\2f Formalisms\\2f __Transformations__\\2f Transformation\\2f MoTif\\2e defaultIcons\\2f ";
    //
    //     let to_create = ["StartIcon", "FRuleIcon", "ARuleIcon", "EndSuccessIcon", "EndFailIcon"];
    //
    //     let ele_map = {};
    //     let num_elements = 0;
    //     for (let ele of to_create) {
    //         client.waitForElementPresent(btn_prefix + ele, 2000, "Button present: " + btn_prefix + ele);
    //         client.click(btn_prefix + ele);
    //
    //         let built_div = model_building_utils.create_class(client,
    //             x_coord, y_coords[num_elements], num_elements, type_prefix + ele + "\\2f ");
    //
    //         ele_map[ele] = built_div;
    //
    //         if (ele.includes("Rule")) {
    //             let rule_name = num_elements + "_" + ele.replace("Icon", "");
    //             let name_field = "#tr_name > td:nth-child(2) > textarea:nth-child(1)";
    //             let rule_field = "#tr_rule > td:nth-child(2) > textarea:nth-child(1)";
    //             let rule_prefix = "/autotest/R_";
    //
    //
    //             let attribs = {};
    //             attribs[name_field] = rule_name;
    //             attribs[rule_field] = rule_prefix + rule_name + ".model";
    //             model_building_utils.set_attribs(client, num_elements, attribs, type_prefix + ele + "\\2f ");
    //         }
    //         num_elements++;
    //     }
    //
    //     let assocs = [
    //         [0, 1, ""],
    //         [1, 2, "success"],
    //         [2, 3, "success"],
    //         [1, 4, "fail"],
    //         [2, 4, "fail"]
    //     ];
    //
    //
    //     for (let assoc of assocs) {
    //
    //         let start_ele = to_create[assoc[0]];
    //         let end_ele = to_create[assoc[1]];
    //
    //         let start = ele_map[start_ele];
    //         let end = ele_map[end_ele];
    //
    //         //TODO: Have path come from check/x mark
    //
    //         let relation_div = "";
    //         if (assoc[2] == "success") {
    //             relation_div = "#choice_\\2f Formalisms\\2f __Transformations__\\2f Transformation\\2f MoTif\\2e defaultIcons\\2f success";
    //             //start += " > path:nth-child(3)";
    //         } else if (assoc[2] == "fail") {
    //             relation_div = "#choice_\\2f Formalisms\\2f __Transformations__\\2f Transformation\\2f MoTif\\2e defaultIcons\\2f fail";
    //             //start += " > path:nth-child(5)";
    //         }
    //
    //         let offset = 5 * (assoc[0] + assoc[1]);
    //         model_building_utils.create_assoc(client, start, end, relation_div, offset);
    //     }
    //
    //
    //     model_building_utils.save_model(client, "autotest", "T_autotest.model");
    //
    // },

    // 'Create Rule 1': function (client) {
    //
    //     test_utils.load_toolbar(client, rule_toolbars);
    //
    //     // BUILD LHS AND RHS
    //     let LHS_btn = "#\\2f Formalisms\\2f __Transformations__\\2f TransformationRule\\2f TransformationRule\\2e defaultIcons\\2e metamodel\\2f LHSIcon";
    //     let RHS_btn = "#\\2f Formalisms\\2f __Transformations__\\2f TransformationRule\\2f TransformationRule\\2e defaultIcons\\2e metamodel\\2f RHSIcon";
    //
    //     let ele_map = {};
    //
    //     client.waitForElementPresent(LHS_btn, 2000, "LHS button").click(LHS_btn);
    //     let LHS_div = "#\\2f Formalisms\\2f __Transformations__\\2f TransformationRule\\2f TransformationRule\\2e defaultIcons\\2f LHSIcon\\2f ";
    //     ele_map["LHS"] = model_building_utils.create_class(client, 150, 200, 0, LHS_div);
    //
    //      client.waitForElementPresent(RHS_btn, 2000, "RHS button").click(RHS_btn);
    //     let RHS_div = "#\\2f Formalisms\\2f __Transformations__\\2f TransformationRule\\2f TransformationRule\\2e defaultIcons\\2f RHSIcon\\2f ";
    //     ele_map["RHS"] = model_building_utils.create_class(client, 650, 200, 1, RHS_div);
    //
    //     model_building_utils.click_off(client);
    //
    //     //BUILD ELEMENTS INSIDE
    //     let c_btn = "#\\2f autotest\\2f autotest\\2e defaultIcons\\2e pattern\\2e metamodel\\2f __pClassCIcon";
    //     let d_btn = "#\\2f autotest\\2f autotest\\2e defaultIcons\\2e pattern\\2e metamodel\\2f __pClassDIcon";
    //
    //     client.waitForElementPresent(c_btn, 2000, "C button").click(c_btn);
    //     let c_div = "#\\2f autotest\\2f autotest\\2e defaultIcons\\2e pattern\\2f __pClassCIcon\\2f ";
    //     ele_map["C"] = model_building_utils.create_class(client, 50, 200, 2, c_div);
    //
    //     client.waitForElementPresent(d_btn, 2000, "D button").click(d_btn);
    //     let d_div = "#\\2f autotest\\2f autotest\\2e defaultIcons\\2e pattern\\2f __pClassDIcon\\2f ";
    //     ele_map["D"] = model_building_utils.create_class(client, 50, 400, 3, d_div);
    //
    //     model_building_utils.move_element(client, ele_map["C"] + " > text:nth-child(1)", ele_map["LHS"], [50, 50], [50, 50]);
    //     model_building_utils.move_element(client, ele_map["D"] + " > text:nth-child(1)", ele_map["RHS"], [50, 50], [50, 50]);
    //
    //
    //     model_building_utils.save_model(client, "autotest", "R_1_FRule.model");
    // },

    'Create Rule 2': function (client) {

        test_utils.load_toolbar(client, rule_toolbars);

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

        model_building_utils.click_off(client);

        //BUILD ELEMENTS INSIDE
        let a_btn = "#\\2f autotest\\2f autotest\\2e defaultIcons\\2e pattern\\2e metamodel\\2f __pClassAIcon";
        let a_div = "#\\2f autotest\\2f autotest\\2e defaultIcons\\2e pattern\\2f __pClassAIcon\\2f ";

        //BUILD INSIDE LHS
        client.waitForElementPresent(a_btn, 2000, "A button").click(a_btn);
        ele_map["A_lhs_1"] = model_building_utils.create_class(client, 50, 200, 2, a_div);
        ele_map["A_lhs_2"] = model_building_utils.create_class(client, 50, 400, 3, a_div);

        model_building_utils.move_element(client, ele_map["A_lhs_1"] + " > text:nth-child(1)", ele_map["LHS"], [50, 50], [50, 20]);
        model_building_utils.move_element(client, ele_map["A_lhs_2"] + " > text:nth-child(1)", ele_map["LHS"], [50, 50], [50, 70]);

        // //BUILD INSIDE RHS
        // ele_map["I_rhs_1"] = model_building_utils.create_class(client, 50, 200, 4, i_div);
        // ele_map["I_rhs_2"] = model_building_utils.create_class(client, 50, 400, 5, i_div);
        //
        // model_building_utils.move_element(client, ele_map["I_rhs_1"] + " > text:nth-child(1)", ele_map["RHS"], [50, 50], [50, 20]);
        // model_building_utils.move_element(client, ele_map["I_rhs_2"] + " > text:nth-child(1)", ele_map["RHS"], [50, 50], [50, 70]);
        //
        // //BUILD ASSOCS
        // client.pause(300);
        // model_building_utils.create_assoc(client,
        //     ele_map["I_lhs_1"]  + " > text:nth-child(1)", ele_map["I_lhs_2"]  + " > text:nth-child(1)", "", 0);
        //
        // client.pause(300);
        // model_building_utils.create_assoc(client,
        //     ele_map["I_rhs_1"]  + " > text:nth-child(1)", ele_map["I_rhs_2"]  + " > text:nth-child(1)", "", 0);


        model_building_utils.save_model(client, "autotest", "R_2_ARule.model");
    },

    after: function (client) {
        client.end();
    },


};

