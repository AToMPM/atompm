let test_utils = require('./test_utils');
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

    'Load two models' : function (client) {

        let filenames = [
            'Formalisms/ClassicDEVS/ClassicDEVS.model',
            'Formalisms/Annotation/AnnotationMM.model'
        ];

        test_utils.load_model(client, filenames);
    },

    after : function (client) {
        client.end();
    },

};