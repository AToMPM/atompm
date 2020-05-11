let test_utils = require('./test_utils');
let model_building_utils = require('./model_building_utils');
let user = "./users/testuser/";

module.exports = {

    beforeEach : function (client) {
        client.url('http://localhost:8124/atompm').pause(300);
    },

    'Login' : function (client) {
        test_utils.login(client);
    },

    'Load model' : function (client) {

        let filename = 'Formalisms/ClassicDEVS/ClassicDEVS.model';
        test_utils.load_model(client, [filename]);
    },

    'Load and save model' : function (client) {

        let filename = 'Formalisms/ClassicDEVS/ClassicDEVS.model';
        let new_filename = 'ClassicDEVS2.model';
        test_utils.load_model(client, [filename]);
        model_building_utils.save_model(client, "Models", new_filename)
    },

    'Load two models' : function (client) {

        let filenames = [
            'Formalisms/ClassicDEVS/ClassicDEVS.model',
            'Formalisms/Annotation/AnnotationMM.model'
        ];

        test_utils.load_model(client, filenames);
    },

    'Rename model' : function (client) {

        let filename = 'Formalisms/ClassicDEVS/ClassicDEVS.model';
        let old_filename = 'Test.model';
        let new_filename = 'Test2.model';
        test_utils.load_model(client, [filename]);
        model_building_utils.save_model(client, "~", old_filename)
        model_building_utils.rename_model(client, "~", old_filename, new_filename)
    },

    after : function (client) {
        client.end();
    },

};