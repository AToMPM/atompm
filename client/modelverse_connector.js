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

                let class_types = ["class", "Class", "SimpleAttribute"];
                for (let i in AS) {
                    let obj = AS[i];
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


                let class_locs = {};

                for (const cs_ele of CS){
                    if (!(cs_ele["__type"] == "Group")){
                        continue;
                    }

                    let asid = cs_ele["__asid"];
                    let pos = [cs_ele["x"], cs_ele["y"]];

                    class_locs[asid] = pos;
                }


                __typeToCreate = class_type;
                for (const id of model_classes){

                    let updateClass = function(status, resp){

                        let data = JSON.parse(resp);

                        let uri = class_type + "/" + data["data"] + ".instance";
                        let changes = {"name": id};
                        DataUtils.update(uri, changes);
                    };

                    let pos = class_locs[id];
                    if (pos == undefined || pos == null){
                        pos = [100, 100];
                    }

                    let vert_offset = 200;
                    DataUtils.create(pos[0], pos[1] + vert_offset, updateClass);
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
