/* This file holds the code for rendering SimpleClassDiagrams from the ModelVerse.

1) The rendering meta-model and transformation are sent to the ModelVerse.
2) The transformation executes, creating the rendered model and returning the JSON.
3) 'model_CS' will then contain the rendered concrete syntax

This method is dependent on the meta-model being SimpleClassDiagrams.
Therefore, this code should be put aside until a more robust rendering
system in the ModelVerse is created.

For example, it would be ideal to have a render transformation explicitly defined
for each metamodel in the ModelVerse. Then the render_model command could just
return the JSON for the rendered model (or just the updated portion).

 */

class ModelVerseRenderer {

    static get_CS(model_name) {

        //get CS for model

        let SCD = "formalisms/SimpleClassDiagrams";
        let MM_render = "formalisms/SCD_graphical";
        let render_trans_model = "models/render_SCD";
        let render_MM = this.get_render_mm();
        let render_trans_code = this.get_render_trans();
        let render_model_add = {
            'data': encodeURIComponent(utils.jsons(["model_add", SCD, MM_render, render_MM]))
        };

        let transformation_between = {
            'data': encodeURIComponent(utils.jsons(["transformation_add_AL", "rendered", MM_render, "abstract", SCD, "", "rendered", MM_render, "", render_trans_model]))
        };

        let transformation_data = {
            'data': encodeURIComponent(utils.jsons(["transformation_add_AL", render_trans_code]))
        };

        let model_rendered = {
            'data': encodeURIComponent(utils.jsons(["model_render", model_name, render_trans_model, "models/rendered_model"]))
        };

        //CS COMMANDS

        let model_CS = null;

        //TODO: only need to add models if not present
        ModelVerseConnector.send_command(render_model_add).then(ModelVerseConnector.get_output)
            .then(ModelVerseConnector.send_command(transformation_between)).then(ModelVerseConnector.get_output)
            .then(ModelVerseConnector.send_command({})).then(ModelVerseConnector.get_output)
            .then(ModelVerseConnector.send_command(transformation_data)).then(ModelVerseConnector.get_output)
            .then(ModelVerseConnector.send_command(model_rendered)).then(ModelVerseConnector.get_output)

            .then(function(data){
                // console.log("Data before: ");
                // console.log(data);
                data = data.replace("Success: ", "");
                // console.log("Data after:");
                // console.log(data);
                model_CS = eval(JSON.parse(data));
            });

    }

    static get_render_mm() {
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

    static get_render_trans() {
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