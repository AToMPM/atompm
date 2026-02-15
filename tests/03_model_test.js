let user_utils = require('./user_utils');
let model_building_utils = require('./model_building_utils');
let mouse_tracking = require('./mouse_tracking.js');

module.exports = {
    beforeEach: async function (client) {
        await client.url('http://localhost:8124/atompm').pause(300);
        mouse_tracking.track_mouse(client);
    },

    'Login': async function (client) {
        await user_utils.login(client);
    },

    'Load model': function (client) {

        let filename = 'Formalisms/ClassicDEVS/ClassicDEVS.model';
        model_building_utils.load_multiple_models(client, [filename]);
    },

    'Load and save model': function (client) {

        let filename = 'Formalisms/ClassicDEVS/ClassicDEVS.model';
        let new_filename = 'ClassicDEVS2.model';
        model_building_utils.load_multiple_models(client, [filename]);
        model_building_utils.save_model(client, "Models", new_filename)
    },

    'Load two models': function (client) {

        let filenames = [
            'Formalisms/ClassicDEVS/ClassicDEVS.model',
            'Formalisms/Annotation/AnnotationMM.model'
        ];

        model_building_utils.load_multiple_models(client, filenames);
    },

    'Rename model': function (client) {

        let filename = 'Formalisms/ClassicDEVS/ClassicDEVS.model';
        let old_filename = 'Test.model';
        let new_filename = 'Test2.model';
        model_building_utils.load_multiple_models(client, [filename]);
        model_building_utils.save_model(client, "~", old_filename)
        model_building_utils.rename_model(client, "~", old_filename, new_filename)
    },

    after: function (client) {
        client.end();
    },

};