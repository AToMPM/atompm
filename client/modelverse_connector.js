class ModelVerseConnector {


    constructor(address) {
        ModelVerseConnector.taskname = "task_manager";
        ModelVerseConnector.address = (address == undefined) ? "http://127.0.0.1:8001" : address;

        ModelVerseConnector.ERROR = 0;
        ModelVerseConnector.WORKING = 1;
        ModelVerseConnector.OKAY = 2;

        ModelVerseConnector.connected = true;

        ModelVerseConnector.curr_model = null;
        ModelVerseConnector.element_map = {};

        ModelVerseConnector.PM2MV_metamodel_map = {
            "/Formalisms/__LanguageSyntax__/SimpleClassDiagram/SimpleClassDiagram" : "formalisms/SimpleClassDiagrams"
        };

        ModelVerseConnector.MV2PM_metamodel_map = ModelVerseConnector.reverse_dict(ModelVerseConnector.PM2MV_metamodel_map);
    }

    static reverse_dict(dict){
      var ret = {};
      for(let key of Object.keys(dict)){
        ret[dict[key]] = key;
      }
      return ret;
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

    static save_model(model_name, data){

        ModelVerseConnector.set_status(ModelVerseConnector.WORKING);

        console.log("Save model: " + model_name);

        let parsed_data = JSON.parse(data);
        // console.log(parsed_data);
        let m = JSON.parse(parsed_data['data']['m']);
        let mms = JSON.parse(parsed_data['data']['mms']);

        //detect the metamodels
        if (Object.keys(mms).length > 1){
            console.log("Warning: More than one meta-model detected!")
        }

        let primary_mm_PM = Object.keys(mms)[0];
        let primary_mm_MV = ModelVerseConnector.PM2MV_metamodel_map[primary_mm_PM];

        //TODO: Allow user to select meta-model when it is not found
        // console.log("MV PM: " + primary_mm_PM);
        // console.log("MV MM: " + primary_mm_MV);

        if (primary_mm_MV == undefined){
            WindowManagement.openDialog(_ERROR,'Cannot find meta-model in ModelVerse: "' + primary_mm_PM + '"');
            return;
        }

        let model_delete = {
            "data": utils.jsons(["model_delete", model_name])
        };
        let model_create = {
            "data": utils.jsons(["model_add", primary_mm_MV, model_name, ""])
        };

        let model_edit = {
            "data": utils.jsons(["model_modify", model_name, primary_mm_MV])
        };

        ModelVerseConnector.curr_model = model_name;

        ModelVerseConnector.send_command(model_create)
            .then(ModelVerseConnector.get_output)
            .then(ModelVerseConnector.send_command(model_edit))
            .then(ModelVerseConnector.get_output)
            .then(function(data){

                let node_creation_promises = [];
                for (const [key, node] of Object.entries(m.nodes)) {
                    if (node.name == undefined){
                        continue;
                    }

                    if (!(node.linktype == undefined)){
                        continue;
                    }

                    let node_name = node.name.value;
                    let node_type = node.$type.split("/").slice(-1)[0];

                    node_creation_promises.push(ModelVerseConnector.send_command(
                        {"data": utils.jsons(["instantiate_node", node_type, node_name])}
                    ));

                    let set_id = function (id){
                        ModelVerseConnector.element_map[key] = id.split(" ")[1].replace("\"", "");
                    };


                    node_creation_promises.push(ModelVerseConnector.get_output(set_id));
                }

                let simple_type = ["String", "Int", "Float", "Boolean", "Code", "File", "Map", "List", "ENUM"];
                for (let st of simple_type){

                    node_creation_promises.push(ModelVerseConnector.send_command(
                        {"data": utils.jsons(["instantiate_node", "SimpleAttribute", st])}
                    ));
                    node_creation_promises.push(ModelVerseConnector.get_output());
                }




                Promise.all(node_creation_promises).then( function(){

                    let edge_creation_promises = [];
                    for (const [key, node] of Object.entries(m.nodes)) {
                        if (node.name == undefined || node.linktype != undefined) {

                            let node_type = node.$type.split("/").slice(-1)[0];

                            let node_name = null;
                            if (node.name != undefined) {
                                node_name = node.name.value;
                            }else{
                                node_name = node_type + key;
                            }



                            let src = null;
                            let dest = null;

                            for (const [edge_key, edge] of Object.entries(m.edges)) {
                                if (edge['src'] == key) {
                                    let ed = edge['dest'];
                                    dest = ModelVerseConnector.element_map[ed];

                                } else if (edge['dest'] == key) {
                                    let es = edge['src'];
                                    src = ModelVerseConnector.element_map[es];
                                }
                            }

                            let set_id = function (id){
                                ModelVerseConnector.element_map[key] = id.split(" ")[1].replace("\"", "");
                            };


                            edge_creation_promises.push(ModelVerseConnector.send_command(
                                {"data": utils.jsons(["instantiate_edge", node_type, node_name, src, dest])}
                            ));
                            edge_creation_promises.push(ModelVerseConnector.get_output(set_id));
                        }


                    }

                    Promise.all(edge_creation_promises).then(function() {


                        let attrib_creation_promises = [];

                        for (const [key, node] of Object.entries(m.nodes)) {

                            let ele = ModelVerseConnector.element_map[key];
                            let node_type = node.$type.split("/").slice(-1)[0];

                            if (node.abstract != undefined && node.abstract.value){
                                attrib_creation_promises.push(ModelVerseConnector.send_command(
                                    {"data": utils.jsons(["attr_add", ele, "abstract", true])}
                                ));
                                attrib_creation_promises.push(ModelVerseConnector.get_output());
                            }

                            if (node.name != undefined && node_type != "GlobalConstraint"){
                                attrib_creation_promises.push(ModelVerseConnector.send_command(
                                    {"data": utils.jsons(["attr_add", ele, "name", node.name.value])}
                                ));
                                attrib_creation_promises.push(ModelVerseConnector.get_output());
                            }

                            //TODO: Cardinalities

                            if (node.attributes != undefined) {
                                console.log(node);
                                for (const [key, attrib] of Object.entries(node.attributes.value)) {
                                    //console.log(attrib);
                                    let type = attrib.type[0].toUpperCase() + attrib.type.substring(1);

                                    if (type.startsWith("ENUM")){
                                        type = "ENUM";
                                    }
                                    type = type.split("<")[0];

                                    attrib_creation_promises.push(ModelVerseConnector.send_command(
                                        {"data": utils.jsons(["define_attribute", ele, attrib.name, type])}
                                    ));
                                    attrib_creation_promises.push(ModelVerseConnector.get_output());
                                }
                            }


                        }








                        ModelVerseConnector.set_status(ModelVerseConnector.OKAY);
                    });




                });


            });


    }

     static load_MV_model(metamodels, AS) {
        return new Promise(
            function (resolve, reject) {

                console.log("Load MV Model");
                console.log(AS);
                console.log(metamodels);

                let primary_MV_metamodel = metamodels.split(" ")[1].split(",")[0];
                let primary_PM_metamodel = ModelVerseConnector.MV2PM_metamodel_map[primary_MV_metamodel];

                console.log("MV MM: " + primary_MV_metamodel);
                console.log("PM MM: " + primary_PM_metamodel);

                let metamodel = primary_PM_metamodel + ".defaultIcons.metamodel";

                DataUtils.loadmm(metamodel,
                    function(){
                        console.log("Metamodel loaded: " + metamodel);
                    });


                let class_type = "/Formalisms/__LanguageSyntax__/SimpleClassDiagram/SimpleClassDiagram.defaultIcons/ClassIcon";

                let model_classes = [];
                let model_associations = [];
                let model_inheris = [];
                let model_attribs = {};

                // for (let i in AS) {
                //     let obj = AS[i];
                //     let obj_type = obj["__type"];
                //
                //     if (obj_type == "Class") {
                //         model_classes.push(obj["__id"]);
                //
                //     }else if (obj_type == "Association"){
                //         model_associations.push([obj["__source"], obj["__target"], obj["__id"]]);
                //
                //     }else if (obj_type == "Inheritance"){
                //         model_inheris.push([obj["__source"], obj["__target"]]);
                //
                //     }else if (obj_type == "AttributeLink") {
                //         if (model_attribs[obj["__source"]] == undefined){
                //             model_attribs[obj["__source"]] = [];
                //         }
                //         model_attribs[obj["__source"]].push([obj["__target"], obj["__id"]]);
                //     }
                //
                // }
                //
                //
                // let class_locs = {};
                //
                // for (const cs_ele of CS){
                //     if (!(cs_ele["__type"] == "Group")){
                //         continue;
                //     }
                //
                //     let asid = cs_ele["__asid"];
                //     let pos = [cs_ele["x"], cs_ele["y"]];
                //
                //     class_locs[asid] = pos;
                // }
                //
                // let ele_ids = {};
                //
                //
                // __typeToCreate = class_type;
                //
                // let map_promises = [];
                // for (const id of model_classes){
                //
                //     map_promises.push(new Promise(function(resolve, reject){
                //         let updateClass =
                //
                //             function(status, resp){
                //
                //                 let data = JSON.parse(resp);
                //
                //                 let uri = class_type + "/" + data["data"] + ".instance";
                //                 ele_ids[id] = uri;
                //
                //                 let changes = {"name": id};
                //
                //                 if (model_attribs[id] != undefined){
                //                     let attrib_changes = [];
                //
                //                     for (let attrib of model_attribs[id]){
                //                         //console.log(attrib);
                //
                //                         let attrib_change = {
                //                             "name": attrib[1],
                //                             "type" : attrib[0]
                //                         };
                //                         attrib_changes.push(attrib_change);
                //                     }
                //                     changes["attributes"] = attrib_changes;
                //                 }
                //
                //                 DataUtils.update(uri, changes);
                //                 resolve();
                //             };
                //
                //
                //         let pos = class_locs[id];
                //         if (pos == undefined || pos == null){
                //             pos = [100, 100];
                //         }
                //
                //         let vert_offset = 200;
                //         DataUtils.create(pos[0], pos[1] + vert_offset, updateClass);
                //     }));
                // }
                //
                // Promise.all(map_promises).then(function(){
                //
                //     for (const inheri of model_inheris){
                //         let connectionType = "/Formalisms/__LanguageSyntax__/SimpleClassDiagram/SimpleClassDiagram.defaultIcons/InheritanceLink.type";
                //
                //         let source = ele_ids[inheri[0]];
                //         let target = ele_ids[inheri[1]];
                //
                //         if (source == undefined || target == undefined){
                //             console.log("ERROR: Can't create inheritance between " + inheri[0] + " and " + inheri[1]);
                //             continue;
                //         }
                //
                //         HttpUtils.httpReq(
                //              'POST',
                //              HttpUtils.url(connectionType,__NO_USERNAME),
                //              {'src':source,
                //               'dest':target,
                //               'pos':undefined,
                //               'segments':undefined});
                //
                //     }
                //
                // })
                // .then(function(){
                //     let assoc_create_promises = [];
                //
                //     for (const assoc of model_associations){
                //
                //         assoc_create_promises.push(new Promise(function(resolve, reject){
                //         let connectionType = "/Formalisms/__LanguageSyntax__/SimpleClassDiagram/SimpleClassDiagram.defaultIcons/AssociationLink.type";
                //
                //         let source = ele_ids[assoc[0]];
                //         let target = ele_ids[assoc[1]];
                //
                //         if (source == undefined || target == undefined){
                //             console.log("ERROR: Can't create association between " + assoc[0] + " and " + assoc[1]);
                //             resolve();
                //         }
                //
                //         let assoc_create_callback = function(status, resp){
                //             let id = JSON.parse(resp)["data"];
                //             let assoc_id = connectionType.replace(".type", "/") + id + ".instance";
                //             ele_ids[assoc[2]] = assoc_id;
                //
                //             resolve();
                //         };
                //
                //         HttpUtils.httpReq(
                //              'POST',
                //              HttpUtils.url(connectionType,__NO_USERNAME),
                //              {'src':source,
                //               'dest':target,
                //               'pos':undefined,
                //               'segments':undefined},
                //             assoc_create_callback);
                //         }));
                //
                //     }
                //
                //     Promise.all(assoc_create_promises).then(function(){
                //         for (const assoc of model_associations){
                //             let uri = ele_ids[assoc[2]];
                //             let changes = {"name" : assoc[2]};
                //
                //             console.log("Updating " + uri);
                //
                //             DataUtils.update(uri, changes);
                //         }
                //     });
                //
                //
                // });


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

    static get_output(clbk) {
        return new Promise(
            function (resolve, reject) {
                let callback = function (status, resp) {
                    if (utils.isHttpSuccessCode(status)) {
                        console.log("get_output Resolve: " + resp);

                        if (clbk != undefined && typeof clbk == "function"){
                            clbk(resp);
                        }

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


        let username_params = {
            "value": "\"" + username + "\""
        };

        let password_params = {
            "value": "\"" + password + "\""
        };

        let quiet_mode_params = {
            "value": "\"quiet\""
        };

        this.get_output().then(
            function(data){
                data = data.replace(/"/g, "");
                ModelVerseConnector.taskname = data;
            }
        )
            .then(() => this.send_command(username_params)).then(this.get_output)
            .then(() => this.send_command(password_params)).then(this.get_output)
            .then(() => this.send_command(quiet_mode_params)).then(this.get_output)
            .then(this.get_output)
            .then(function () {
                ModelVerseConnector.set_status(ModelVerseConnector.OKAY);
            })
            .catch(
                function () {
                    WindowManagement.openDialog(_ERROR, 'failed to login to the ModelVerse!');
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


    static choose_model(status, model_to_save){

        console.log("Choosing model: ");

        if (status != undefined && status != 200){
            ModelVerseConnector.set_status(ModelVerseConnector.ERROR);
            return;
        };

        let loading_mode = (model_to_save == undefined);

        let folders = [""];
        let files = [];

        ModelVerseConnector.set_status(ModelVerseConnector.WORKING);

        // only exit on load
        if (ModelVerseConnector.curr_model && loading_mode){
            let command = {"data": utils.jsons(["exit"])};
            this.send_command(command).then(this.get_output)
            .then(function(data){
                ModelVerseConnector.curr_model = null;
            });
        }


        let startDir = "/";
        let fileb = FileBrowser.getFileBrowser(ModelVerseConnector.get_files_in_folder, false, !loading_mode, __getRecentDir(startDir));
        let feedback = GUIUtils.getTextSpan('', "feedback");
        let title = "ModelVerse Explorer";

        let callback = function (filenames) {
            if (loading_mode) {
                ModelVerseConnector.load_model(filenames[0]);
            }else{
                ModelVerseConnector.save_model(filenames[0], model_to_save);
            }
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

    static load_model(model_name) {

        let metamodel = "formalisms/SimpleClassDiagrams";

        //fix slashes on filename
        // if (model_name.endsWith("/")){
        //     model_name = model_name.slice(0, -1);
        // }

        if (model_name.startsWith("/")){
            model_name = model_name.slice(1);
        }


        console.log("Loading model: " + model_name);
        ModelVerseConnector.set_status(ModelVerseConnector.WORKING);
        ModelVerseConnector.curr_model = model_name;


        //get AS for model
        let model_types_command = {
            "data": utils.jsons(["model_types", model_name])
        };

        let model_modify = {
            "data": utils.jsons(["model_modify", model_name, metamodel])

        };

        let model_dump = {
            "data": utils.jsons(["JSON"])
        };


        let model_types = null;

        //AS COMMANDS

        this.send_command(model_types_command).then(this.get_output)
        .then(function(data){
            console.log("model_types");
            console.log(data);
            model_types = data;
        })
        .then(this.send_command(model_modify)).then(this.get_output)
        .then(function(data){
            console.log("model_modify");
            console.log(data);
        })
        .then(this.send_command(model_dump)).then(this.get_output)
        .then(function(data){
            data = data.replace("Success: ", "");
            let AS = eval(JSON.parse(data));
            ModelVerseConnector.load_MV_model(model_types, AS)
        })
        .then(function () {
            ModelVerseConnector.set_status(ModelVerseConnector.OKAY);
        })
        .catch(
            function (err) {
                console.log("Error with model loading!");
                console.log(err);

                ModelVerseConnector.set_status(ModelVerseConnector.ERROR);
            }
        );

    }

    /*********END WRAPPER FUNCTIONS**********/




}
