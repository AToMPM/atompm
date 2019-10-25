let test_utils = require('./test_utils');
let model_building_utils = require('./model_building_utils');
let user = "./users/testuser/";

let folder_name = "Formalisms/__LanguageSyntax__/SimpleClassDiagram";

module.exports = {

    beforeEach : function (client) {
        client.url('http://localhost:8124/atompm').pause(300);
    },

    'Login' : function (client) {
        test_utils.login(client);
    },

    'Compile AS' : function (client) {
        let filename = 'Formalisms/__LanguageSyntax__/SimpleClassDiagram/SimpleClassDiagramMM.model';
        test_utils.load_model(client, [filename]);
        model_building_utils.compile_model(client, "AS", folder_name, "classDiagram.metamodel");
    },

    'Compile CS' : function (client) {
        let filename = 'Formalisms/__LanguageSyntax__/SimpleClassDiagram/SimpleClassDiagram.umlIcons.model';
        test_utils.load_model(client, [filename]);
        model_building_utils.compile_model(client, "CS", folder_name, "classDiagram.umlIcons.metamodel");
    },

    after : function (client) {
        client.end();
    },

};