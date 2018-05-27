
function loadModel(client, fnames){

    for (const name of fnames) {

        console.log("Loading: " + name);
        client.execute(
            function (fname) {
                _loadModel(fname);
            }, [name], null
        );

        client.pause(1000);

        client.getTitle(function(title) {
            this.assert.ok(title.includes(name), "File: " + name + " is opened");
        });
    }

}

module.exports = {

    beforeEach : function (client) {
        client.url('http://localhost:8124/atompm').pause(300);


    },

    'Login' : function (client) {

        client.execute(
            function() {
                UserManagement.login('testuser');
            }, [], null
        );

        client.pause(300);

        client.getTitle(function(title) {
            this.assert.ok(title.includes("AToMPM - [Unnamed]"), "AToMPM is opened");
        });
    },

    'Load model' : function (client) {

        let filename = 'Formalisms/ClassicDEVS/ClassicDEVS.model';


        loadModel(client, [filename]);

    },

    //fails due to issue #28
    'Load two models' : function (client) {

        let filenames = [
            'Formalisms/ClassicDEVS/ClassicDEVS.model',
            'Formalisms/Annotation/AnnotationMM.model'
        ];

        loadModel(client, filenames);
    },


    after : function (client) {
        client.end();
    },

};