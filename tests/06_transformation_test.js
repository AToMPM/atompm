//NOTE: REQUIRES DSL FROM PREVIOUS TEST

let test_utils = require('./test_utils');
let model_building_utils = require('./model_building_utils');
let user = "./users/testuser/";

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

    'Create Transformation': function (client) {

        let trans_formalism = "/Formalisms/__Transformations__/Transformation/MoTif.defaultIcons.metamodel";

        test_utils.load_toolbar(client, [trans_formalism]);


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

            let built_div = model_building_utils.create_class(client,
                x_coord, y_coords[num_elements], num_elements, type_prefix + ele + "\\2f ");

            ele_map[ele] = built_div;

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

        let assocs = [
            [0, 1, ""],
            [1, 2, "success"],
            [2, 3, "success"],
            [1, 4, "fail"],
            [2, 4, "fail"]
        ];


        for (let assoc of assocs) {

            let start_ele = to_create[assoc[0]];
            let end_ele = to_create[assoc[1]];

            let start = ele_map[start_ele];
            let end = ele_map[end_ele];

            //TODO: Have path come from check/x mark

            let relation_div = "";
            if (assoc[2] == "success") {
                relation_div = "#choice_\\2f Formalisms\\2f __Transformations__\\2f Transformation\\2f MoTif\\2e defaultIcons\\2f success";
                //start += " > path:nth-child(3)";
            } else if (assoc[2] == "fail") {
                relation_div = "#choice_\\2f Formalisms\\2f __Transformations__\\2f Transformation\\2f MoTif\\2e defaultIcons\\2f fail";
                //start += " > path:nth-child(5)";
            }

            let offset = 5 * (assoc[0] + assoc[1]);
            model_building_utils.create_assoc(client, start, end, relation_div, offset);
        }


        model_building_utils.save_model(client, "autotest", "T_autotest.model");

    },


    after: function (client) {
        client.end();
    },


};

