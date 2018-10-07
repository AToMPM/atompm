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
            "/Formalisms/__LanguageSyntax__/SimpleClassDiagram/SimpleClassDiagram" : "formalisms/SimpleClassDiagrams",
        };

        ModelVerseConnector.MV2PM_metamodel_map = ModelVerseConnector.reverse_dict(ModelVerseConnector.PM2MV_metamodel_map);
    }

    static reverse_dict(dict){
      let ret = {};
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
            //WindowManagement.openDialog(_ERROR,'Meta-model may not exist in ModelVerse: "' + primary_mm_PM + '"');
            //return;

            if (primary_mm_PM.startsWith("/")){
                primary_mm_PM = primary_mm_PM.slice(1);
            }

            primary_mm_MV = primary_mm_PM;
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
            .then(function (data) {
                if (data.includes("Model not found")){
                    ModelVerseConnector.set_status(ModelVerseConnector.ERROR);
                    WindowManagement.openDialog(_ERROR,data);
                    return;
                }
            })
            .then(ModelVerseConnector.send_command(model_edit))
            .then(ModelVerseConnector.get_output)
            .then(function(data){

                //find edges
                //these have srcs and dests in the edge list
                let edge_map = {};
                for (const [key, node] of Object.entries(m.nodes)) {

                    let src = null;
                    let dest = null;

                    for (const [edge_key, edge] of Object.entries(m.edges)) {

                        //iterate through each pair of edges
                        if (edge_key == m.edges.length - 1){
                            continue;
                        }

                        //only look at pairs
                        if (parseInt(edge_key) % 2 == 1){
                            continue;
                        }

                        let next_edge = m.edges[parseInt(edge_key) + 1];

                        //see if the links overlap -> this node is an edge

                        if (edge["dest"] == next_edge["src"] && next_edge["src"] == key){
                            src = edge['src'];
                            dest = next_edge['dest']
                        }
                    }

                    if (src == null || dest == null){
                        continue;
                    }

                    edge_map[key] = [src, dest];
                }

                //for detecting duplications
                let nodes_names = [];

                let node_creation_promises = [];
                for (const [key, node] of Object.entries(m.nodes)) {
                    // if (node.name == undefined){
                    //     continue;
                    // }

                    // console.log("Node creation:");
                    // console.log(node);

                    if (!(node.linktype == undefined)){
                        continue;
                    }

                    if (Object.keys(edge_map).includes(key)){
                        continue;
                    }

                    let node_name = key;
                    if (node.name != undefined){
                        node_name = node.name.value;
                    }

                    if (nodes_names.includes((node_name))){
                        node_name += "_" + key;
                    }
                    nodes_names.push(node_name);

                    let node_type = node.$type.split("/").slice(-1)[0];

                    node_creation_promises.push(ModelVerseConnector.send_command(
                        {"data": utils.jsons(["instantiate_node", node_type, node_name])}
                    ));

                    let set_id = function (id){

                        if (id.includes("Success")){
                            ModelVerseConnector.element_map[key] = id.split(" ")[1].replace("\"", "");
                        }

                    };


                    node_creation_promises.push(ModelVerseConnector.get_output(set_id));
                }

                //TODO: Only for SimpleClassDiagrams?
                let simple_type = ["String", "Int", "Float", "Boolean", "Code", "File", "Map", "List", "ENUM"];
                for (let st of simple_type){

                    node_creation_promises.push(ModelVerseConnector.send_command(
                        {"data": utils.jsons(["instantiate_node", "SimpleAttribute", st])}
                    ));
                    node_creation_promises.push(ModelVerseConnector.get_output());
                }

                //get cardinalities
                let card_dict = {};
                let attrib_creation_promises = [];
                // console.log("Cardinalities");
                for (const [key, node] of Object.entries(m.nodes)) {

                    if (node.cardinalities == undefined || node.cardinalities.value.length == 0){
                        continue;
                    }

                    //console.log(node);
                    for (const card of node.cardinalities.value){
                        //console.log(card);
                        let cardname = card["type"] + card["dir"];

                        card_dict[cardname] = [card["min"], card["max"]];
                        // console.log(card_dict);
                    }
                }

                Promise.all(node_creation_promises).then( function(){

                    let edge_creation_promises = [];
                    for (const [key, node] of Object.entries(m.nodes)) {

                        if (!(Object.keys(edge_map).includes(key))){
                            continue;
                        }

                        // console.log("Creating edge:");
                        // console.log(node);

                        let node_type = node.$type.split("/").slice(-1)[0];

                        let node_name = null;
                        if (node.name != undefined) {
                            node_name = node.name.value;
                        }else{
                            node_name = node_type + key;
                        }

                        let es = edge_map[key][0];
                        let ed = edge_map[key][1];

                        let src = ModelVerseConnector.element_map[es];
                        let dest = ModelVerseConnector.element_map[ed];

                        let set_id = function (id){
                            if (id.includes("Success")){
                               ModelVerseConnector.element_map[key] = id.split(" ")[1].replace("\"", "");

                            }
                        };


                        if (src != null && dest != null) {
                            edge_creation_promises.push(ModelVerseConnector.send_command(
                                {"data": utils.jsons(["instantiate_edge", node_type, node_name, src, dest])}
                            ));
                            edge_creation_promises.push(ModelVerseConnector.get_output(set_id));
                        }
                    }


                    Promise.all(edge_creation_promises).then(function() {


                        // Add attributes
                        console.log("Adding attributes");
                        for (const [key, node] of Object.entries(m.nodes)) {

                            console.log(node);

                            let ele = ModelVerseConnector.element_map[key];
                            let node_type = node.$type.split("/").slice(-1)[0];

                            if (node.abstract != undefined && node.abstract.value){
                                attrib_creation_promises.push(ModelVerseConnector.send_command(
                                    {"data": utils.jsons(["attr_add", ele, "abstract", true])}
                                ));
                                attrib_creation_promises.push(ModelVerseConnector.get_output());
                            }

                            for (const [attrib_key, attrib_value] of Object.entries(node)){
                                if (attrib_key.startsWith("__") || attrib_value.value == undefined){
                                    continue;
                                }

                                attrib_creation_promises.push(ModelVerseConnector.send_command(
                                    {"data": utils.jsons(["attr_add", ele, attrib_key, attrib_value.value])}
                                ));
                                attrib_creation_promises.push(ModelVerseConnector.get_output());
                            }

                            if (node.name != undefined){

                                // console.log(Object.keys(card_dict));
                                let src_card = card_dict[node.name.value + "out"];
                                let trgt_card = card_dict[node.name.value + "in"];

                                // console.log("Src:");
                                // console.log(src_card);

                                if (src_card != undefined){
                                    attrib_creation_promises.push(ModelVerseConnector.send_command(
                                        {"data": utils.jsons(["attr_add", ele, "source_lower_cardinality", src_card[0]])}
                                    ));
                                    attrib_creation_promises.push(ModelVerseConnector.get_output());

                                    attrib_creation_promises.push(ModelVerseConnector.send_command(
                                        {"data": utils.jsons(["attr_add", ele, "source_upper_cardinality", src_card[1]])}
                                    ));
                                    attrib_creation_promises.push(ModelVerseConnector.get_output());
                                }

                                // console.log("Trgt:");
                                // console.log(trgt_card);

                                if (trgt_card != undefined){
                                    attrib_creation_promises.push(ModelVerseConnector.send_command(
                                        {"data": utils.jsons(["attr_add", ele, "target_lower_cardinality", trgt_card[0]])}
                                    ));
                                    attrib_creation_promises.push(ModelVerseConnector.get_output());

                                    attrib_creation_promises.push(ModelVerseConnector.send_command(
                                        {"data": utils.jsons(["attr_add", ele, "target_upper_cardinality", trgt_card[1]])}
                                    ));
                                    attrib_creation_promises.push(ModelVerseConnector.get_output());
                                }
                            }



                            if (node.attributes != undefined) {
                                //console.log(node);
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

                if (primary_PM_metamodel == undefined){
                    console.log("Warning: No metamodel known for " + primary_MV_metamodel);
                    primary_PM_metamodel = primary_MV_metamodel;
                }

                console.log("MV MM: " + primary_MV_metamodel);
                console.log("PM MM: " + primary_PM_metamodel);

                let csmetamodel = ".defaultIcons";

                //this concrete syntax is better
                if (primary_MV_metamodel == "formalisms/SimpleClassDiagrams"){
                    csmetamodel = ".umlIcons";
                }

                let metamodel = primary_PM_metamodel + csmetamodel + ".metamodel";



                DataUtils.loadmm(metamodel,
                    function(){
                        console.log("Metamodel loaded: " + metamodel);
                    });



                let model_elements = [];
                let model_links = [];
                let model_links_dict = {};

                let model_attrib_types = [];
                let model_attribs = {};

                //class name, etc.
                let model_properties = {};

                for (const obj of Object.values(AS)) {
                    let obj_type = obj["__type"];

                    let name = obj["__id"];
                    // if (name == undefined){
                    //     name = obj["name"];
                    // }

                    if (obj_type == "SimpleAttribute"){
                        model_attrib_types.push(name);
                        continue;
                    }

                    let src = obj["__source"];
                    let trgt =  obj["__target"];

                    let add_properties = true;

                    // console.log("obj " + obj_type + " " + name + " = " + src + " - " + trgt);

                    if (src == undefined && trgt == undefined){
                        model_elements.push([name, obj_type]);
                    }else{

                        if (obj_type == "AttributeLink"){//model_attrib_types.includes(trgt)){

                            if (model_attribs[src] == undefined){
                                model_attribs[src] = [];
                            }

                            model_attribs[src].push([name, trgt]);

                            add_properties = false;

                        }else{
                            model_links.push([obj_type, src, trgt, obj["__id"]]);
                            model_links_dict[obj["__id"]] = [src, trgt];
                        }

                    }

                    if (add_properties) {
                        for (let [prop_name, prop_value] of Object.entries(obj)) {

                            // console.log(name + " :: " + prop_name + ' = ' + prop_value);
                            if (prop_name.startsWith("__")) {
                                continue;
                            }

                            if (prop_value == null){
                                continue;
                            }

                            if (model_properties[name] == undefined) {
                                model_properties[name] = [];
                            }

                            if (prop_name.endsWith("_cardinality")){

                                if (!(Object.keys(model_links_dict).includes(name))){
                                    continue;
                                }

                                let dest = undefined;
                                let lower_upper = prop_name.split("_")[1];
                                lower_upper = (lower_upper == "lower")? "min":"max";

                                if (prop_name.startsWith("source")){
                                    dest = model_links_dict[name][0];
                                    prop_name = "cardinality_" + lower_upper + "_" + name + "_out_";
                                }else if (prop_name.startsWith("target")){
                                    dest = model_links_dict[name][1];
                                    prop_name = "cardinality_" + lower_upper + "_" + name + "_in_";
                                }

                                if (model_properties[dest] == undefined) {
                                    model_properties[dest] = [];
                                }
                                model_properties[dest].push([prop_name, prop_value]);

                                continue;

                            }

                            // console.log(name + " :: " + prop_name + ' = ' + prop_value);
                            model_properties[name].push([prop_name, prop_value]);
                        }
                    }

                }

                let ele_ids = {};


                //TODO: Replace with better layout
                let start_x = 100;
                let start_y = 100;

                let x_offset = 250;
                let max_x = 4;

                let y_offset = 200;

                let i = 0;

                let element_promises = [];
                for (const [name, obj_type] of model_elements){

                    let class_type = primary_PM_metamodel + csmetamodel + "/" + obj_type + "Icon";
                    __typeToCreate = class_type;

                    element_promises.push(new Promise(function(resolve, reject){
                        let updateClass =

                            function(status, resp){

                                if (Math.floor(status / 100) != 2){
                                    resolve();
                                    return;
                                }
                                // console.log(status);
                                // console.log(resp);
                                let data = JSON.parse(resp);

                                let uri = class_type + "/" + data["data"] + ".instance";
                                ele_ids[name] = uri;

                                resolve();
                            };


                        let x_pos = start_x + Math.floor(i % max_x) * x_offset;
                        let y_pos = start_y + Math.floor(i / max_x) * y_offset;

                        DataUtils.create(x_pos, y_pos, updateClass);
                        i +=1;
                    }));
                }

                Promise.all(element_promises).then(function(){

                    console.log("Starting link promises");

                    let link_promises = [];

                    for (const [obj_type, src, trgt, obj_id] of model_links){

                        // console.log("Link:");
                        // console.log(obj_type + " " + src + " " + trgt + " " + obj_id);

                        link_promises.push(new Promise(function(resolve, reject) {
                            let source_element = ele_ids[src];
                            let target_element = ele_ids[trgt];

                            //skip attribute links
                            if (obj_type == "AttributeLink"){
                                resolve();
                                return;
                            }

                            if (source_element == undefined || target_element == undefined) {
                                console.log("ERROR: Can't create link '" + obj_type + "' between " + src + " and " + trgt);
                                resolve();
                                return;
                            }

                            let connectionType = primary_PM_metamodel + csmetamodel + "/" + obj_type + "Link.type";

                            let link_create_callback = function(status, resp){
                                // console.log(status);
                                // console.log(resp);
                                let id = JSON.parse(resp)["data"];
                                let assoc_id = connectionType.replace(".type", "/") + id + ".instance";

                                // console.log(obj_id + " = " + assoc_id);
                                ele_ids[obj_id] = assoc_id;

                                resolve();
                            };

                            console.log("Building " + connectionType + " between "
                                + source_element + " (" + src + ") and " + target_element + " (" + trgt + ")");

                            HttpUtils.httpReq(
                                'POST',
                                HttpUtils.url(connectionType, __NO_USERNAME),
                                {
                                    'src': source_element,
                                    'dest': target_element,
                                    'pos': undefined,
                                    'segments': undefined
                                },
                                link_create_callback);

                        }));

                    }

                    Promise.all(link_promises).then(function(){

                        console.log("Start properties");
                        for (const [ele, properties] of Object.entries(model_properties)) {

                            let uri = ele_ids[ele];

                            if (uri == undefined) {
                                console.log("Uri not found for element: " + ele);
                                continue;
                            }

                            // console.log("Element: " + ele + " = uri: " + uri);

                            let changes = {};

                            let cardinalities = [];
                            let card_dict = {};

                            for (const [key, value] of Object.entries(properties)) {
                                // console.log(value[0] + " = ");
                                // console.log(value[1]);

                                //TODO: Fix this
                                if (value[0].includes("constraint")) {
                                    continue;
                                }

                                if (value[0].startsWith("cardinality")) {

                                    let minmax = value[0].split("_")[1];
                                    let assoc_name = value[0].split("_")[2];
                                    let dir = value[0].split("_")[3];

                                    // console.log("Card:");
                                    // console.log(minmax + " " + assoc_name + " " + dir);

                                    let found_card = false;

                                    for (let [key, existing_card] of Object.entries(cardinalities)){
                                        if (existing_card["type"] == assoc_name){
                                            found_card = true;
                                            cardinalities[key][minmax] = value[1];
                                        }
                                    }

                                    if (!found_card)
                                    {
                                        let new_card = {
                                            "dir" : dir,
                                            "type" : assoc_name
                                        };
                                        new_card[minmax] = value[1];
                                        cardinalities.push(new_card);
                                    }
                                }else {
                                    //all other properties
                                    changes[value[0]] = value[1];
                                }
                            }

                            if (cardinalities.length > 0) {
                                changes["cardinalities"] = cardinalities;
                            }
                            DataUtils.update(uri, changes);

                        }


                        console.log("Start attributes");

                        for (const [ele, attributes] of Object.entries(model_attribs)){

                            let uri = ele_ids[ele];

                            if (uri == undefined){
                                console.log("Uri not found for element: " + ele);
                                continue;
                            }

                            let attrib_changes = [];

                            // console.log("Element: " + ele + " = uri: " + uri);

                            for (const[key, value] of attributes){
                                //TODO: Make attributes valid PM types

                                let pm_value = value.toLowerCase();
                                if (pm_value == "natural" || pm_value == "integer"){
                                    pm_value = "int";
                                }

                                // console.log(key + " = " + pm_value);

                                let attrib_change = {
                                        "name": key,
                                        "type" : pm_value
                                };
                                attrib_changes.push(attrib_change);

                            }

                            DataUtils.update(uri, {"attributes" : attrib_changes});

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

        //if editing a model, exit it
        if (ModelVerseConnector.curr_model){
            let command = {"data": utils.jsons(["exit"])};
            ModelVerseConnector.send_command(command).then(this.get_output)
            .then(function(data){
                ModelVerseConnector.curr_model = null;
            });
        }


        let startDir = "/";
        let fileb = FileBrowser.getFileBrowser(ModelVerseConnector.get_files_in_folder, false, !loading_mode, startDir);
        let feedback = GUIUtils.getTextSpan('', "feedback");
        let title = "ModelVerse Explorer";

        let callback = function (filenames) {

            //fix slashes on filename
            // if (filenames[0].endsWith("/")){
            //     filenames[0] = filenames[0].slice(0, -1);
            // }

            if (filenames[0].startsWith("/")){
                filenames[0] = filenames[0].slice(1);
            }

            if (loading_mode) {
                ModelVerseConnector.load_model(filenames[0]);
            }else{
                ModelVerseConnector.save_model(filenames[0], model_to_save);
            }
        };

        let folder_buttons = $('<div>');
        let new_folder_b = $('<button>');
        new_folder_b.attr('id', 'new_folder')
            .html('new folder')
            .click(function (ev) {
                let folder_name = prompt("please fill in a name for the folder");
                if (folder_name == null) {
                    return;
                }
                folder_name = folder_name.replace(/^\s+|\s+$/g, ''); // trim
                if (!folder_name.match(/^[a-zA-Z0-9_\s]+$/i)) {
                    feedback.html("invalid folder name: " + folder_name);
                } else {
                    let full_folder_name = fileb['getcurrfolder']() + folder_name;
                    console.log("Creating: " + full_folder_name);

                    let mk_folder_command = {
                        "data": utils.jsons(["folder_create", full_folder_name])
                    };

                    ModelVerseConnector.send_command(mk_folder_command).then(ModelVerseConnector.get_output)
                    .then(function (data) {
                        console.log("Got data: " + data);
                    });

                }

            });
        folder_buttons.append(new_folder_b);

        GUIUtils.setupAndShowDialog(
                    [fileb['filebrowser'], loading_mode?null:folder_buttons, null, feedback],
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

        //TODO: Allow user to choose metamodel
        let metamodel = "formalisms/SimpleClassDiagrams";
        if (model_name.includes("autotest") && model_name != "autotest/autotest"){
            metamodel = "autotest/autotest";
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
