class ModelVerseConnector {


    constructor(address) {
        ModelVerseConnector.taskname = this.guid();
        ModelVerseConnector.address = (address == undefined) ? "http://127.0.0.1:8001" : address;

        ModelVerseConnector.ERROR = 0;
        ModelVerseConnector.WORKING = 1;
        ModelVerseConnector.OKAY = 2;
    }

    guid() {
        return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        )
    }

    static set_status(status) {

        let red = "rgb(220,20,60)";
        let yellow = "rgb(218,165,32)";
        let green = "rgb(50,205,50)";

        let colours = [red, yellow, green];

        let set_colour = function (colour) {
            let mv_toolbar = $('#div_toolbar_\\2f Toolbars\\2f ModelVerse\\2f ModelVerse\\2e buttons\\2e model');

            mv_toolbar.css("background-color", colour)
        };

        set_colour(colours[status]);
    }

     static load_MV_model(data) {
        return new Promise(
            function (resolve, reject) {

                data = data.replace("Success: ", "");
                data = eval(JSON.parse(data));

                // for (let i in resp) {
                //     console.log(resp[i]);
                // }

                resolve();
            });

    }


    /*********COMMUNICATION FUNCTIONS**********/
    static send_command(param_dict) {
        return new Promise(
            function (resolve, reject) {
                let callback = function (status, resp) {
                    if (utils.isHttpSuccessCode(status)) {
                        console.log("send_command Resolve: " + resp);
                        resolve(resp);
                    } else {
                        console.log("send_command Reject: " + resp);
                        reject(resp);
                    }
                };

                if (!("op" in param_dict)) {
                    param_dict["op"] = "set_input";
                }

                if (!("taskname" in param_dict)) {
                    param_dict["taskname"] = ModelVerseConnector.taskname;
                }

                let params = "";
                for (const [key, value] of Object.entries(param_dict)) {
                    params += key + "=" + value + "&";
                }

                //take off last &
                params = params.slice(0, -1);

                //console.log(params);
                HttpUtils.httpReq("POST", ModelVerseConnector.address,
                    params,
                    callback
                );
            });
    }

    static get_output() {
        return new Promise(
            function (resolve, reject) {
                let callback = function (status, resp) {
                    if (utils.isHttpSuccessCode(status)) {
                        console.log("get_output Resolve: " + resp);
                        resolve(resp);
                    } else {
                        console.log("get_output reject: " + resp);
                        reject(resp);
                    }
                };
                let params = "op=get_output&taskname=" + ModelVerseConnector.taskname;

                HttpUtils.httpReq("POST", ModelVerseConnector.address,
                    params,
                    callback
                );
            }
        );
    }

    /*********END COMMUNICATION FUNCTIONS**********/

    /*********WRAPPER FUNCTIONS**********/
    static connect(username_param, password_param) {
        console.log("Connecting to: " + ModelVerseConnector.address);
        ModelVerseConnector.set_status(ModelVerseConnector.WORKING);

        let username = username_param || "admin";
        let password = password_param || "admin";

        let init_params = {
            "value": "\"" + ModelVerseConnector.taskname + "\"",
            "taskname": 'task_manager'
        };

        let username_params = {
            "value": "\"" + username + "\""
        };

        let password_params = {
            "value": "\"" + password + "\""
        };

        let quiet_mode_params = {
            "value": "\"quiet\""
        };

        this.send_command(init_params).then(this.get_output)
            .then(this.send_command(username_params)).then(this.get_output)
            .then(this.send_command(password_params)).then(this.get_output)
            .then(this.send_command(quiet_mode_params)).then(this.get_output)
            .then(function () {
                ModelVerseConnector.set_status(ModelVerseConnector.OKAY);
            })
            .catch(
                function () {
                    console.log("Error with login!");
                    ModelVerseConnector.set_status(ModelVerseConnector.ERROR);
                }
            );


    };

    static model_list(data){

        return new Promise(function(resolve, reject) {

            let folders = data[0];
            let files = data[1];

            let model_types = {
                "data": utils.jsons(["model_list", folder_name])
            };

            console.log("Listing models in: " + folder_name);

            ModelVerseConnector.send_command(model_types).then(ModelVerseConnector.get_output)
                .then(function (data) {
                    console.log("model_list");

                    data = data.replace("Success: ", "");
                    let new_files = JSON.parse(data).split("\n");
                    console.log(new_files);

                    for (let i in new_files) {
                        let file = new_files[i];

                        console.log("Found file: " + file);

                        if (file.endsWith("/")) {
                            folders.push(file);
                        }
                        files.push(file);
                    }

                    resolve([folders, files]);
                });

        });
    }


    static choose_model(){

        console.log("Choosing model: ");

        let folders = [""];
        let files = [];

        ModelVerseConnector.set_status(ModelVerseConnector.WORKING);

        this.model_list(folders[0]).then(
            function(data){
                console.log("DATA");
                console.log(data);
            }
        );

        // while (folders.length > 0) {
        //
        //
        //     let folder_name = folders[0].replace("/", "");
        // }

        ModelVerseConnector.set_status(ModelVerseConnector.OKAY);

        console.log("Folders");
        console.log(folders);
        console.log("Files");
        console.log(files);
    }

    static dump_model() {

        this.choose_model();

        return;


        let model_name = "formalisms/SimpleClassDiagrams";
        console.log("Dumping model: " + model_name);
        ModelVerseConnector.set_status(ModelVerseConnector.WORKING);

        let model_types = {
            "data": utils.jsons(["model_types", model_name])
        };

        let model_modify = {
            "data": utils.jsons(["model_modify", model_name, model_name])
        };

        let model_dump = {
            "data": utils.jsons(["JSON"])
        };

        this.send_command(model_types).then(this.get_output)
            .then(function(data){
                console.log("model_types");
                console.log(data);
            })
            .then(this.send_command(model_modify)).then(this.get_output)
            .then(function(data){
                console.log("model_modify");
                console.log(data);
            })
            .then(this.send_command(model_dump)).then(this.get_output)
            .then(ModelVerseConnector.load_MV_model)
            .then(function () {
                ModelVerseConnector.set_status(ModelVerseConnector.OKAY);
            })
            .catch(
                function () {
                    console.log("Error with model dump!");
                    ModelVerseConnector.set_status(ModelVerseConnector.ERROR);
                }
            );

    }

    /*********END WRAPPER FUNCTIONS**********/

}
