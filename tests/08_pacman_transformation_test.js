//NOTE: REQUIRES DSL FROM PREVIOUS TEST

let user_utils = require('./user_utils');
let model_building_utils = require('./model_building_utils');
let mouse_tracking = require('./mouse_tracking.js');

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

    'Execute Transformation': function (client) {
        model_building_utils.load_model(client, "Formalisms/Pacman", "sample.model");

        model_building_utils.load_transformation(client, "Formalisms/Pacman/OpSem", "T_Pacman_Simulation.model");

        let run_button = "#\\2f Toolbars\\2f TransformationController\\2f TransformationController\\2e buttons\\2e model\\2f play";
        client.click(run_button);

        client.pause(5000);

        let pacman = "//*[@id=\"/Formalisms/Pacman/Pacman.defaultIcons/PacmanIcon/55.instance\"]";
        client.waitForElementNotPresent("xpath", pacman, 60000, "Pacman killed");

    },

    after: function (client) {
        client.end();
    },


};

