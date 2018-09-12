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

        let SCD = "formalisms/SimpleClassDiagrams";
        let model_delete = {
            "data": utils.jsons(["model_delete", model_name])
        };
        let model_create = {
            "data": utils.jsons(["model_add", SCD, model_name, ""])
        };

        let model_edit = {
            "data": utils.jsons(["model_modify", model_name, SCD])
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

     static load_MV_model(AS, CS) {
        return new Promise(
            function (resolve, reject) {

                console.log("Load MV Model");
                console.log(AS);
                console.log(CS);

                let metamodel = "Formalisms/__LanguageSyntax__/SimpleClassDiagram/SimpleClassDiagram.defaultIcons.metamodel";


                let class_type = "/Formalisms/__LanguageSyntax__/SimpleClassDiagram/SimpleClassDiagram.defaultIcons/ClassIcon";

                DataUtils.loadmm(metamodel,
                    function(){
                        console.log("Metamodel loaded: " + metamodel);
                    });

                let model_classes = [];
                let model_associations = [];
                let model_inheris = [];
                let model_attribs = {};

                for (let i in AS) {
                    let obj = AS[i];
                    let obj_type = obj["__type"];

                    if (obj_type == "Class") {
                        model_classes.push(obj["__id"]);

                    }else if (obj_type == "Association"){
                        model_associations.push([obj["__source"], obj["__target"], obj["__id"]]);

                    }else if (obj_type == "Inheritance"){
                        model_inheris.push([obj["__source"], obj["__target"]]);

                    }else if (obj_type == "AttributeLink") {
                        if (model_attribs[obj["__source"]] == undefined){
                            model_attribs[obj["__source"]] = [];
                        }
                        model_attribs[obj["__source"]].push([obj["__target"], obj["__id"]]);
                    }

                }


                let class_locs = {};

                for (const cs_ele of CS){
                    if (!(cs_ele["__type"] == "Group")){
                        continue;
                    }

                    let asid = cs_ele["__asid"];
                    let pos = [cs_ele["x"], cs_ele["y"]];

                    class_locs[asid] = pos;
                }

                let ele_ids = {};


                __typeToCreate = class_type;

                let map_promises = [];
                for (const id of model_classes){

                    map_promises.push(new Promise(function(resolve, reject){
                        let updateClass =

                            function(status, resp){

                                let data = JSON.parse(resp);

                                let uri = class_type + "/" + data["data"] + ".instance";
                                ele_ids[id] = uri;

                                let changes = {"name": id};

                                if (model_attribs[id] != undefined){
                                    let attrib_changes = [];

                                    for (let attrib of model_attribs[id]){
                                        //console.log(attrib);

                                        let attrib_change = {
                                            "name": attrib[1],
                                            "type" : attrib[0]
                                        };
                                        attrib_changes.push(attrib_change);
                                    }
                                    changes["attributes"] = attrib_changes;
                                }

                                DataUtils.update(uri, changes);
                                resolve();
                            };


                        let pos = class_locs[id];
                        if (pos == undefined || pos == null){
                            pos = [100, 100];
                        }

                        let vert_offset = 200;
                        DataUtils.create(pos[0], pos[1] + vert_offset, updateClass);
                    }));
                }

                Promise.all(map_promises).then(function(){

                    for (const inheri of model_inheris){
                        let connectionType = "/Formalisms/__LanguageSyntax__/SimpleClassDiagram/SimpleClassDiagram.defaultIcons/InheritanceLink.type";

                        let source = ele_ids[inheri[0]];
                        let target = ele_ids[inheri[1]];

                        if (source == undefined || target == undefined){
                            console.log("ERROR: Can't create inheritance between " + inheri[0] + " and " + inheri[1]);
                            continue;
                        }

                        HttpUtils.httpReq(
                             'POST',
                             HttpUtils.url(connectionType,__NO_USERNAME),
                             {'src':source,
                              'dest':target,
                              'pos':undefined,
                              'segments':undefined});

                    }

                })
                .then(function(){
                    let assoc_create_promises = [];

                    for (const assoc of model_associations){

                        assoc_create_promises.push(new Promise(function(resolve, reject){
                        let connectionType = "/Formalisms/__LanguageSyntax__/SimpleClassDiagram/SimpleClassDiagram.defaultIcons/AssociationLink.type";

                        let source = ele_ids[assoc[0]];
                        let target = ele_ids[assoc[1]];

                        if (source == undefined || target == undefined){
                            console.log("ERROR: Can't create association between " + assoc[0] + " and " + assoc[1]);
                            resolve();
                        }

                        let assoc_create_callback = function(status, resp){
                            let id = JSON.parse(resp)["data"];
                            let assoc_id = connectionType.replace(".type", "/") + id + ".instance";
                            ele_ids[assoc[2]] = assoc_id;

                            resolve();
                        };

                        HttpUtils.httpReq(
                             'POST',
                             HttpUtils.url(connectionType,__NO_USERNAME),
                             {'src':source,
                              'dest':target,
                              'pos':undefined,
                              'segments':undefined},
                            assoc_create_callback);
                        }));

                    }

                    Promise.all(assoc_create_promises).then(function(){
                        for (const assoc of model_associations){
                            let uri = ele_ids[assoc[2]];
                            let changes = {"name" : assoc[2]};

                            console.log("Updating " + uri);

                            DataUtils.update(uri, changes);
                        }
                    });


                });


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
        //
        // if (model_name.startsWith("/")){
        //     model_name = model_name.slice(1);
        // }


        console.log("Loading model: " + model_name);
        ModelVerseConnector.set_status(ModelVerseConnector.WORKING);
        ModelVerseConnector.curr_model = model_name;






        //get CS for model
        let SCD = "formalisms/SimpleClassDiagrams";
        let MM_render = "formalisms/SCD_graphical";
        let render_trans_model = "models/render_SCD";
        let render_MM = this.get_render_mm();
        let render_trans_code = this.get_render_trans();
        let render_model_add = {
            'data': encodeURIComponent(utils.jsons(["model_add", SCD, MM_render, render_MM]))};

        let transformation_between = {
            'data' : encodeURIComponent(utils.jsons(["transformation_add_AL", "rendered", MM_render, "abstract", SCD, "", "rendered", MM_render, "", render_trans_model]))
        };

        let transformation_data = {
            'data' : encodeURIComponent(utils.jsons(["transformation_add_AL", render_trans_code]))
        };

        let model_rendered = {
            'data' : encodeURIComponent(utils.jsons(["model_render", model_name, render_trans_model, "models/rendered_model"]))
        };

        //get AS for model
        let model_types = {
            "data": utils.jsons(["model_types", model_name])
        };

        let model_modify = {
            "data": utils.jsons(["model_modify", model_name, metamodel])

        };

        let model_dump = {
            "data": utils.jsons(["JSON"])
        };

        let model_CS = null;

        //CS COMMANDS
        //TODO: only need to add models if not present
        this.send_command(render_model_add).then(this.get_output)
            .then(this.send_command(transformation_between)).then(this.get_output)
            .then(this.send_command({})).then(this.get_output)
            .then(this.send_command(transformation_data)).then(this.get_output)
            .then(this.send_command(model_rendered)).then(this.get_output)

            .then(function(data){
                data = data.replace("Success: ", "");
                model_CS = eval(JSON.parse(data));
            })

            //AS COMMANDS

            .then(this.send_command(model_types)).then(this.get_output)
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
            .then(function(data){
                data = data.replace("Success: ", "");
                let AS = eval(JSON.parse(data));
                ModelVerseConnector.load_MV_model(AS, model_CS)
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


    static get_render_mm(){
        let mm = "include \"primitives.alh\"\n" +
        "\n" +
        "SimpleAttribute Natural {}\n" +
        "SimpleAttribute String {}\n" +
        "SimpleAttribute Boolean {}\n" +
        "\n" +
        "Class GraphicalElement {\n" +
        "    x : Natural\n" +
        "    y : Natural\n" +
        "    layer : Natural\n" +
        "}\n" +
        "\n" +
        "Class Group : GraphicalElement {\n" +
        "    __asid : String\n" +
        "    dirty : Boolean\n" +
        "}\n" +
        "\n" +
        "Association ConnectingLine (Group, Group) {\n" +
        "    offsetSourceX : Natural\n" +
        "    offsetSourceY : Natural\n" +
        "    offsetTargetX : Natural\n" +
        "    offsetTargetY : Natural\n" +
        "    lineWidth : Natural\n" +
        "    lineColour : String\n" +
        "    arrow : Boolean\n" +
        "    __asid : String\n" +
        "    dirty : Boolean\n" +
        "    layer : Natural\n" +
        "}\n" +
        "\n" +
        "Class LineElement : GraphicalElement {\n" +
        "    lineWidth : Natural\n" +
        "    lineColour : String\n" +
        "}\n" +
        "\n" +
        "Class Text : LineElement {\n" +
        "    text : String\n" +
        "}\n" +
        "\n" +
        "Class Line : LineElement {\n" +
        "    targetX : Natural\n" +
        "    targetY : Natural\n" +
        "    arrow : Boolean\n" +
        "}\n" +
        "\n" +
        "Class Shape : LineElement {\n" +
        "    fillColour : String\n" +
        "    width : Natural\n" +
        "    height : Natural\n" +
        "}\n" +
        "\n" +
        "Class Figure : GraphicalElement {\n" +
        "    width : Natural\n" +
        "    height : Natural\n" +
        "}\n" +
        "\n" +
        "Class SVG {\n" +
        "    data : String\n" +
        "}\n" +
        "\n" +
        "Class Rectangle : Shape {\n" +
        "}\n" +
        "\n" +
        "Class Ellipse : Shape {\n" +
        "}\n" +
        "\n" +
        "Association contains (Group, GraphicalElement) {}\n" +
        "Association renders (Figure, SVG) {\n" +
        "    source_lower_cardinality = 1\n" +
        "    target_lower_cardinality = 1\n" +
        "    target_upper_cardinality = 1\n" +
        "}"
        ;

        return mm;
    }

    static get_render_trans(){
        let trans = "include \"primitives.alh\"\n" +
        "include \"modelling.alh\"\n" +
        "include \"object_operations.alh\"\n" +
        "include \"utils.alh\"\n" +
        "\n" +
        "Boolean function main(model : Element):\n" +
        "\tElement elements\n" +
        "\tString class\n" +
        "\tElement attrs\n" +
        "\tElement attr_keys\n" +
        "\tString attr_key\n" +
        "\tString group\n" +
        "\tString elem\n" +
        "\tInteger loc\n" +
        "\tInteger text_loc\n" +
        "\tElement related_groups\n" +
        "\tloc = 10\n" +
        "\n" +
        "\tElement groups\n" +
        "\tgroups = dict_create()\n" +
        "\n" +
        "\telements = allInstances(model, \"rendered/Group\")\n" +
        "\twhile (set_len(elements) > 0):\n" +
        "\t\tgroup = set_pop(elements)\n" +
        "\t\tif (set_len(allIncomingAssociationInstances(model, group, \"TracabilityClass\")) == 0):\n" +
        "\t\t\tElement to_remove\n" +
        "\t\t\tString elem_to_remove\n" +
        "\t\t\tto_remove = allAssociationDestinations(model, group, \"rendered/contains\")\n" +
        "\t\t\twhile (set_len(to_remove) > 0):\n" +
        "\t\t\t\telem_to_remove = set_pop(to_remove)\n" +
        "\t\t\t\tif (read_type(model, elem_to_remove) == \"rendered/Group\"):\n" +
        "\t\t\t\t\tset_add(to_remove, elem_to_remove)\n" +
        "\t\t\t\telse:\n" +
        "\t\t\t\t\tmodel_delete_element(model, elem_to_remove)\n" +
        "\t\t\tmodel_delete_element(model, group)\n" +
        "\n" +
        "\telements = allInstances(model, \"abstract/Class\")\n" +
        "\twhile (set_len(elements) > 0):\n" +
        "\t\tclass = set_pop(elements)\n" +
        "\t\t\n" +
        "\t\tInteger x\n" +
        "\t\tInteger y\n" +
        "\t\tx = loc\n" +
        "\t\ty = 10\n" +
        "\n" +
        "\t\t// Check if there is already an associated element\n" +
        "\t\tif (set_len(allOutgoingAssociationInstances(model, class, \"TracabilityClass\")) > 0):\n" +
        "\t\t\t// Yes, but is it still clean?\n" +
        "\t\t\tBoolean dirty\n" +
        "\t\t\tdirty = False\n" +
        "\n" +
        "\t\t\trelated_groups = allAssociationDestinations(model, class, \"TracabilityClass\")\n" +
        "\t\t\twhile (set_len(related_groups) > 0):\n" +
        "\t\t\t\tgroup = set_pop(related_groups)\n" +
        "\t\t\t\tif (value_eq(read_attribute(model, group, \"dirty\"), True)):\n" +
        "\t\t\t\t\t// No, so mark all as dirty\n" +
        "\t\t\t\t\tdirty = True\n" +
        "\t\t\t\t\tbreak!\n" +
        "\t\t\t\telse:\n" +
        "\t\t\t\t\t// Yes, so just ignore this!\n" +
        "\t\t\t\t\tcontinue!\n" +
        "\n" +
        "\t\t\tif (bool_not(dirty)):\n" +
        "\t\t\t\tdict_add(groups, class, group)\n" +
        "\t\t\t\tcontinue!\n" +
        "\t\t\telse:\n" +
        "\t\t\t\trelated_groups = allAssociationDestinations(model, class, \"TracabilityClass\")\n" +
        "\t\t\t\tElement to_remove\n" +
        "\t\t\t\tString elem_to_remove\n" +
        "\t\t\t\twhile (set_len(related_groups) > 0):\n" +
        "\t\t\t\t\tgroup = set_pop(related_groups)\n" +
        "\t\t\t\t\tto_remove = allAssociationDestinations(model, group, \"rendered/contains\")\n" +
        "\t\t\t\t\tx = create_value(read_attribute(model, group, \"x\"))\n" +
        "\t\t\t\t\ty = create_value(read_attribute(model, group, \"y\"))\n" +
        "\t\t\t\t\twhile (set_len(to_remove) > 0):\n" +
        "\t\t\t\t\t\telem_to_remove = set_pop(to_remove)\n" +
        "\t\t\t\t\t\tif (read_type(model, elem_to_remove) == \"rendered/Group\"):\n" +
        "\t\t\t\t\t\t\tset_add(to_remove, elem_to_remove)\n" +
        "\t\t\t\t\t\telse:\n" +
        "\t\t\t\t\t\t\tmodel_delete_element(model, elem_to_remove)\n" +
        "\t\t\t\t\tmodel_delete_element(model, group)\n" +
        "\n" +
        "\t\tattr_keys = dict_keys(getAttributeList(model, class))\n" +
        "\t\ttext_loc = 5\n" +
        "\n" +
        "\t\tgroup = instantiate_node(model, \"rendered/Group\", \"\")\n" +
        "\t\tinstantiate_attribute(model, group, \"x\", x)\n" +
        "\t\tinstantiate_attribute(model, group, \"y\", y)\n" +
        "\t\tinstantiate_attribute(model, group, \"__asid\", list_read(string_split_nr(class, \"/\", 1), 1))\n" +
        "\t\tinstantiate_attribute(model, group, \"layer\", 0)\n" +
        "\t\tdict_add(groups, class, group)\n" +
        "\t\tloc = loc + 200\n" +
        "\n" +
        "\t\telem = instantiate_node(model, \"rendered/Rectangle\", \"\")\n" +
        "\t\tinstantiate_attribute(model, elem, \"x\", 0)\n" +
        "\t\tinstantiate_attribute(model, elem, \"y\", 0)\n" +
        "\t\tinstantiate_attribute(model, elem, \"height\", 40 + set_len(getInstantiatableAttributes(model, class, \"abstract/AttributeLink\")) * 20)\n" +
        "\t\tinstantiate_attribute(model, elem, \"width\", 150)\n" +
        "\t\tinstantiate_attribute(model, elem, \"lineWidth\", 2) \n" +
        "\t\tinstantiate_attribute(model, elem, \"lineColour\", \"black\")\n" +
        "\t\tinstantiate_attribute(model, elem, \"fillColour\", \"white\")\n" +
        "\t\tinstantiate_attribute(model, elem, \"layer\", 1)\n" +
        "\t\tinstantiate_link(model, \"rendered/contains\", \"\", group, elem)\n" +
        "\n" +
        "\t\tString multiplicities\n" +
        "\t\tString lower_card\n" +
        "\t\tString upper_card\n" +
        "\t\tif (element_eq(read_attribute(model, class, \"lower_cardinality\"), read_root())):\n" +
        "\t\t\tlower_card = \"*\"\n" +
        "\t\telse:\n" +
        "\t\t\tlower_card = cast_value(read_attribute(model, class, \"lower_cardinality\"))\n" +
        "\t\tif (element_eq(read_attribute(model, class, \"upper_cardinality\"), read_root())):\n" +
        "\t\t\tupper_card = \"*\"\n" +
        "\t\telse:\n" +
        "\t\t\tupper_card = cast_value(read_attribute(model, class, \"upper_cardinality\"))\n" +
        "\t\tmultiplicities = (((\"[\" + lower_card) + \"..\") + upper_card) + \"]\"\n" +
        "\n" +
        "\t\telem = instantiate_node(model, \"rendered/Text\", \"\")\n" +
        "\t\tinstantiate_attribute(model, elem, \"x\", 5)\n" +
        "\t\tinstantiate_attribute(model, elem, \"y\", 3)\n" +
        "\t\tinstantiate_attribute(model, elem, \"lineWidth\", 1)\n" +
        "\t\tinstantiate_attribute(model, elem, \"lineColour\", \"black\")\n" +
        "\t\tif (element_neq(read_attribute(model, class, \"name\"), read_root())):\n" +
        "\t\t\tinstantiate_attribute(model, elem, \"text\", string_join(read_attribute(model, class, \"name\"), \"  \" + multiplicities))\n" +
        "\t\telse:\n" +
        "\t\t\tinstantiate_attribute(model, elem, \"text\", \"(unnamed) \" + multiplicities)\n" +
        "\t\tinstantiate_attribute(model, elem, \"layer\", 2)\n" +
        "\t\tinstantiate_link(model, \"rendered/contains\", \"\", group, elem)\n" +
        "\n" +
        "\t\telem = instantiate_node(model, \"rendered/Line\", \"\")\n" +
        "\t\tinstantiate_attribute(model, elem, \"x\", 0)\n" +
        "\t\tinstantiate_attribute(model, elem, \"y\", 20)\n" +
        "\t\tinstantiate_attribute(model, elem, \"targetX\", 150)\n" +
        "\t\tinstantiate_attribute(model, elem, \"targetY\", 20)\n" +
        "\t\tinstantiate_attribute(model, elem, \"lineWidth\", 1)\n" +
        "\t\tinstantiate_attribute(model, elem, \"lineColour\", \"black\")\n" +
        "\t\tinstantiate_attribute(model, elem, \"arrow\", False)\n" +
        "\t\tinstantiate_attribute(model, elem, \"layer\", 2)\n" +
        "\t\tinstantiate_link(model, \"rendered/contains\", \"\", group, elem)\n" +
        "\n" +
        "\t\tattrs = getInstantiatableAttributes(model, class, \"abstract/AttributeLink\")\n" +
        "\t\tattr_keys = dict_keys(attrs)\n" +
        "\t\twhile (dict_len(attr_keys) > 0):\n" +
        "\t\t\tattr_key = set_pop(attr_keys)\n" +
        "\t\t\telem = instantiate_node(model, \"rendered/Text\", \"\")\n" +
        "\t\t\tinstantiate_attribute(model, elem, \"x\", 5)\n" +
        "\t\t\tinstantiate_attribute(model, elem, \"y\", text_loc + 20)\n" +
        "\t\t\tinstantiate_attribute(model, elem, \"lineWidth\", 1)\n" +
        "\t\t\tinstantiate_attribute(model, elem, \"lineColour\", \"black\")\n" +
        "\t\t\tinstantiate_attribute(model, elem, \"text\", (attr_key + \" : \") + cast_string(list_read(string_split_nr(attrs[attr_key], \"/\", 1), 1)))\n" +
        "\t\t\tinstantiate_attribute(model, elem, \"layer\", 2)\n" +
        "\t\t\tinstantiate_link(model, \"rendered/contains\", \"\", group, elem)\n" +
        "\t\t\ttext_loc = text_loc + 15\n" +
        "\n" +
        "\t\tinstantiate_link(model, \"TracabilityClass\", \"\", class, group)\n" +
        "\n" +
        "\t// Flush all associations\n" +
        "\telements = allInstances(model, \"rendered/ConnectingLine\")\n" +
        "\twhile (set_len(elements) > 0):\n" +
        "\t\tclass = set_pop(elements)\n" +
        "\t\tmodel_delete_element(model, class)\n" +
        "\n" +
        "\t// Rerender associations\n" +
        "\telements = allInstances(model, \"abstract/Association\")\n" +
        "\twhile (set_len(elements) > 0):\n" +
        "\t\tclass = set_pop(elements)\n" +
        "\n" +
        "\t\tattr_keys = dict_keys(getAttributeList(model, class))\n" +
        "\n" +
        "\t\telem = instantiate_link(model, \"rendered/ConnectingLine\", \"\", groups[readAssociationSource(model, class)], groups[readAssociationDestination(model, class)])\n" +
        "\t\tinstantiate_attribute(model, elem, \"offsetSourceX\", 75)\n" +
        "\t\tinstantiate_attribute(model, elem, \"offsetSourceY\", 30)\n" +
        "\t\tinstantiate_attribute(model, elem, \"offsetTargetX\", 75)\n" +
        "\t\tinstantiate_attribute(model, elem, \"offsetTargetY\", 30)\n" +
        "\t\tinstantiate_attribute(model, elem, \"lineWidth\", 1)\n" +
        "\t\tinstantiate_attribute(model, elem, \"lineColour\", \"black\")\n" +
        "\t\tinstantiate_attribute(model, elem, \"arrow\", True)\n" +
        "\t\tinstantiate_attribute(model, elem, \"__asid\", list_read(string_split_nr(class, \"/\", 1), 1))\n" +
        "\t\tinstantiate_attribute(model, elem, \"layer\", 0)\n" +
        "\t\tlog(\"Real ASID: \" + cast_value(class))\n" +
        "\t\tlog(\"Found ASID \" + cast_value(list_read(string_split_nr(class, \"/\", 1), 1)))\n" +
        "\t\tinstantiate_link(model, \"rendered/contains\", \"\", group, elem)\n" +
        "\n" +
        "\treturn True!";

        return trans;
    }

}
