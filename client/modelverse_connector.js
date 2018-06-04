class ModelVerseConnector {


    constructor(address) {
        ModelVerseConnector.taskname = this.guid();
        ModelVerseConnector.address = (address == undefined) ? "http://127.0.0.1:8001" : address;

        ModelVerseConnector.ERROR = 0;
        ModelVerseConnector.WORKING = 1;
        ModelVerseConnector.OKAY = 2;

        ModelVerseConnector.curr_model = null;
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
                let metamodel = "Formalisms/__LanguageSyntax__/SimpleClassDiagram/SimpleClassDiagram.defaultIcons.metamodel";


                let class_type = "/Formalisms/__LanguageSyntax__/SimpleClassDiagram/SimpleClassDiagram.defaultIcons/ClassIcon";

                DataUtils.loadmm(metamodel,
                    function(){
                        console.log("Metamodel loaded: " + metamodel);
                    });

                let model_classes = [];
                let model_associations = [];

                let class_types = ["class", "Class", "SimpleAttribute"];
                for (let i in data) {
                    let obj = data[i];
                     console.log(obj);

                    if (class_types.includes(obj["__type"])) {

                        model_classes.push(obj["__id"]);
                    }
                    // elif "__source" in k and "__target" in k:
                    //     print(k)
                    //     self.associations.append((k["__source"], k["__target"], k["id"], k["type"]))
                    // else:
                    //     print(k)





                }

                __typeToCreate = class_type;
                for (const id of model_classes){

                    let updateClass = function(status, resp){

                        let data = JSON.parse(resp);

                        let uri = class_type + "/" + data["data"] + ".instance";
                        let changes = {"name": id};
                        DataUtils.update(uri, changes);
                    };

                    DataUtils.create(100, 100, updateClass);
                }

                resolve();
            });

    }


    /*********COMMUNICATION FUNCTIONS**********/
    static send_command(param_dict) {
        return new Promise(
            function (resolve, reject) {
                let callback = function (status, resp) {
                    if (utils.isHttpSuccessCode(status)) {
                        //console.log("send_command Resolve: " + resp);
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

                console.log("Sending: " + params);

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
                        //console.log("get_output Resolve: " + resp);
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


    //TODO: Cache this data if too slow
    static async get_files_in_folder(folder_name){
        return await ModelVerseConnector.model_list(folder_name);
    }

    static model_list(folder_name){

        return new Promise(function(resolve, reject) {


            console.log("Listing models in: '" + folder_name + "'");

            let folder_param = folder_name;

            //fix slashes on filename
            if (folder_param.endsWith("/")){
                folder_param = folder_param.slice(0, -1);
            }

            if (folder_param.startsWith("/")){
                folder_param = folder_param.slice(1);
            }


            let model_types = {
                "data": utils.jsons(["model_list", folder_param])
            };

            ModelVerseConnector.send_command(model_types).then(ModelVerseConnector.get_output)
                .then(function (data) {
                    let files = [];

                    data = data.replace("Success: ", "");
                    let new_files = JSON.parse(data).split("\n");

                    for (let i in new_files) {
                        let file = new_files[i];

                        files.push(folder_name + file);
                    }

                    files.sort();
                    resolve(files);
                });

        });
    }


    static choose_model(){

        console.log("Choosing model: ");

        let folders = [""];
        let files = [];

        ModelVerseConnector.set_status(ModelVerseConnector.WORKING);

        if (ModelVerseConnector.curr_model){
            let command = {"data": utils.jsons(["drop"])};
            this.send_command(command).then(this.get_output)
            .then(function(data){
                //console.log(command);
                //console.log(data);

                ModelVerseConnector.curr_model = null;
            });
        }

        let startDir = "/";
        let fileb = FileBrowser.getFileBrowser(ModelVerseConnector.get_files_in_folder, false, false, __getRecentDir(startDir));
        let feedback = GUIUtils.getTextSpan('', "feedback");
        let title = "ModelVerse Explorer";

        let callback = function (filenames) {
            ModelVerseConnector.load_model(filenames[0]);
        };

        GUIUtils.setupAndShowDialog(
                    [fileb['filebrowser'], null, null, feedback],
                    function () {
                        let value = [fileb['getselection']()];
                        if (value.length > 0 && value[0] != "" && startDir) {
                            __setRecentDir(startDir, value[0].substring(0, value[0].lastIndexOf('/') + 1));
                        }
                        return value;
                    },
                    __TWO_BUTTONS,
                    title,
                    callback);

        ModelVerseConnector.set_status(ModelVerseConnector.OKAY);

    }

    static load_model(filename) {

        let model_name = filename;
        let metamodel = "formalisms/SimpleClassDiagrams";

        //fix slashes on filename
        if (model_name.endsWith("/")){
            model_name = model_name.slice(0, -1);
        }

        if (model_name.startsWith("/")){
            model_name = model_name.slice(1);
        }


        console.log("Loading model: " + model_name);
        ModelVerseConnector.set_status(ModelVerseConnector.WORKING);
        ModelVerseConnector.curr_model = filename;

        let model_types = {
            "data": utils.jsons(["model_types", model_name])
        };

        let model_modify = {
            "data": utils.jsons(["model_modify", model_name, metamodel])
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
                function (err) {
                    console.log("Error with model dump!");
                    console.log(err);
                    ModelVerseConnector.set_status(ModelVerseConnector.ERROR);
                }
            );

    }

    /*********END WRAPPER FUNCTIONS**********/

}
