let user_utils = require('./user_utils');
let model_building_utils = require('./model_building_utils');
let mouse_tracking = require('./mouse_tracking.js');

let folder_name = "Formalisms/__LanguageSyntax__/SimpleClassDiagram";

module.exports = {

    beforeEach: async function (client) {
        await client.url('http://localhost:8124/atompm').pause(300).maximizeWindow();
        mouse_tracking.track_mouse(client);
    },

    'Login': async function (client) {
        await user_utils.login(client);
    },

    'Compile AS': function (client) {
        let filename = 'Formalisms/__LanguageSyntax__/SimpleClassDiagram/SimpleClassDiagramMM.model';
        model_building_utils.load_multiple_models(client, [filename]);
        model_building_utils.compile_model(client, "AS", folder_name, "classDiagram.metamodel");
    },

    'Compile CS': function (client) {
        let filename = 'Formalisms/__LanguageSyntax__/SimpleClassDiagram/SimpleClassDiagram.umlIcons.model';
        model_building_utils.load_multiple_models(client, [filename]);
        model_building_utils.compile_model(client, "CS", folder_name, "classDiagram.umlIcons.metamodel");
    },

    after: function (client) {
        client.end();
    },

};