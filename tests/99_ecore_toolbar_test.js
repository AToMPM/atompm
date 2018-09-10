let test_utils = require('./test_utils');
let model_building_utils = require('./model_building_utils');
let user = "./users/testuser/";

let fs = require('fs');

let ecore_dir  = "./exported_to_ecore/";

// tests the ecore toolbar
module.exports = {

    beforeEach : function (client) {
        client.url('http://localhost:8124/atompm').pause(1000);
    },

    'Login' : function (client) {
        test_utils.login(client);
    },


    'Export MM test': function (client) {
        model_building_utils.load_model(client, "autotest", "autotest.model");

        test_utils.load_toolbar(client, ["Toolbars/Ecore/Export2Ecore.buttons.model"]);

        let MMbutton = "#Toolbars\\2f Ecore\\2f Export2Ecore\\2e buttons\\2e model\\2f ExportMM2Ecore";
        client.waitForElementPresent(MMbutton, 2000, "Load MM Button");
        client.click(MMbutton);

        let dialog_btn = "#dialog_btn";
        client.waitForElementPresent(dialog_btn, 2000, "Load MM Menu");
        client.click(dialog_btn);

        let ecore_path = ecore_dir + "autotestMetamodel.ecore";
        client.verify.ok(fs.existsSync(ecore_dir), "Check folder existance: '" + ecore_dir + "'");
        client.verify.ok(fs.existsSync(ecore_path), "Check file existance: '" + ecore_path + "'");

    },

    'Export M test': function (client) {
        model_building_utils.load_model(client, "autotest", "autotest_instance.model");

        test_utils.load_toolbar(client, ["Toolbars/Ecore/Export2Ecore.buttons.model"]);

        let Mbutton = "#Toolbars\\2f Ecore\\2f Export2Ecore\\2e buttons\\2e model\\2f ExportM2Ecore";
        client.waitForElementPresent(Mbutton, 2000, "Load M Button");
        client.click(Mbutton);

        let dialog_btn = "#dialog_btn";
        client.waitForElementPresent(dialog_btn, 2000, "Load M Menu");
        client.click(dialog_btn);


        let ecore_path = ecore_dir + "autotest_instanceModel.xmi";
        client.verify.ok(fs.existsSync(ecore_dir), "Check folder existance: '" + ecore_dir + "'");
        client.verify.ok(fs.existsSync(ecore_path), "Check file existance: '" + ecore_path + "'");

    },

    after : function (client) {
        client.end();
    },


};