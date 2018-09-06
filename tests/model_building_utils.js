let canvas = "#div_canvas";

function build_div(element_type, num) {
    return element_type + (num) + "\\2e instance";
}

function get_element_div(type, num) {
    return "#\\2f Formalisms\\2f __LanguageSyntax__\\2f SimpleClassDiagram\\2f SimpleClassDiagram\\2e umlIcons\\2f " + (type) + "\\2f " + (num) + "\\2e instance";
}

function get_class_div(num) {
    return get_element_div("ClassIcon", num);
}

function get_assoc_div(num) {

    return get_element_div("AssociationLink", num) + " > text:nth-child(1)";
}

function fix_selector(name) {
    return name.replace(".", "\\.");
}

function create_class(client, x, y, i, element_type) {

    let class_div = "";
    if (element_type != undefined) {
        class_div = this.build_div(element_type, i);
    } else {
        class_div = this.get_class_div(i);
    }

    client
        .moveToElement(canvas, x, y)
        .mouseButtonClick('right')
        .pause(300)
        .waitForElementPresent(class_div, 500, "Created class: " + class_div);

    return class_div;

}

function create_classes(client, x_coords, y_coords, curr_num_elements, element_type) {
    for (let x of x_coords) {
        for (let y of y_coords) {

            this.create_class(client, x, y, curr_num_elements, element_type);

            curr_num_elements++;
        }
    }

    return curr_num_elements;
}

function create_assoc(client, start_div, end_div, relation_div, offset) {

    this.click_off(client);

    this.move_to_element_ratio(client, start_div, 50 + offset, 50 + offset);
    client.mouseButtonDown('right');
    this.move_to_element_ratio(client, end_div, 50 + offset, 50 + offset);
    client.mouseButtonUp('right').pause(300);

    if (relation_div.length > 0) {
        client.waitForElementPresent(relation_div, 1000, "Relation option present: " + relation_div);
        client.click(relation_div);
        client.waitForElementPresent("#dialog_btn", 1000, "Assoc menu opens")
            .click("#dialog_btn")
            .pause(300)
            .waitForElementNotPresent("#dialog_btn", 1000, "Assoc menu closes");
    }

    this.click_off(client);
    client.pause(300);

}

function move_element(client, from_div, to_div, from_offset, to_offset) {

    this.click_off(client);
    this.move_to_element_ratio(client, from_div, from_offset[0], from_offset[1]);
    client.mouseButtonClick('left').pause(300);
    client.mouseButtonDown('left');
    this.move_to_element_ratio(client, to_div, to_offset[0], to_offset[1]);
    client.mouseButtonUp('left').pause(300);
}

function set_attribs(client, num, attrs, element_type, div_suffix, offset) {

    let element_div = "";
    if (element_type != undefined) {
        element_div = this.build_div(element_type, num);
    } else {
        element_div = this.get_class_div(num);
    }

    if (div_suffix != undefined) {
        element_div += div_suffix;
    }

    this.click_off(client);

    if (offset == undefined) {
        offset = [50, 50];
    }

    client.waitForElementPresent(element_div, 1000, "Find element for attrib set: " + element_div);
    this.move_to_element_ratio(client, element_div, offset[0], offset[1]);
    client.mouseButtonClick('middle')
        .waitForElementPresent("#dialog_btn", 1000, "Editing menu opens");

    for (const [key, value] of Object.entries(attrs)) {

        client.element('css selector', key, function (result) {
            //if not found, assume checkbox
            if (result.status == -1) {
                let attrib_name = key.split(" ")[0];
                let checkbox_div = attrib_name + " > td:nth-child(2) > input:nth-child(1)";
                client.click(checkbox_div);
            } else {
                client
                    .clearValue(key)
                    .setValue(key, value);
            }
        });
    }

    client
        .click("#dialog_btn")
        .waitForElementNotPresent("#dialog_btn", 1000, "Editing menu closes")
        .moveToElement(canvas, 0, 100)
        .mouseButtonClick('left')
        .pause(300)
    ;
}

function move_to_element_ratio(client, element, x_ratio, y_ratio) {

    client.getElementSize(element, function (result) {
        let x_pos = Math.trunc(x_ratio / 100 * result.value.width);
        let y_pos = Math.trunc(y_ratio / 100 * result.value.height);
        //console.log("X: " + x_pos + " Y: " + y_pos);
        client.moveToElement(element, x_pos, y_pos);
    });
}

function click_off(client) {
    client
        .moveToElement(canvas, 0, 100)
        .mouseButtonClick('left');
}

function navigate_to_folder(client, folder_name) {

    let root_button = "#navbar_\\2f";
    client.waitForElementPresent(root_button, 1000, "Find root button")
        .click(root_button)
        .pause(1000);

    let folder_path = folder_name.split("/");

    for (let f of folder_path) {
        let folder_name_div = "#" + f;
        client.click(folder_name_div);
        client.pause(500);
    }

}

function load_model(client, folder_name, model_name) {

    let load_button = "#\\2f Toolbars\\2f MainMenu\\2f MainMenu\\2e buttons\\2e model\\2f loadModel";

    client.waitForElementPresent(load_button, 1000, "Looking for load button")
        .click(load_button)
        .waitForElementPresent("#dialog_btn", 1000, "Load menu opens");

    navigate_to_folder(client, folder_name);

    client.click("#" + fix_selector(model_name))
        .pause(200)
        .click("#dialog_btn");

    client.waitForElementNotPresent("#dialog_btn", 1000, "Save menu closes");

}

function save_model(client, folder_name, model_name) {
    let save_button = "#\\2f Toolbars\\2f MainMenu\\2f MainMenu\\2e buttons\\2e model\\2f saveModel";
    let new_file_text = "#new_file";

    client.waitForElementPresent(save_button, 1000, "Looking for save button")
        .click(save_button)
        .waitForElementPresent("#dialog_btn", 1000, "Save menu opens");

    navigate_to_folder(client, folder_name);

    client.element('css selector', "#" + model_name, function (result) {
            if (result.status == -1) {
                client.click(new_file_text)
                    .clearValue(new_file_text)
                    .setValue(new_file_text, model_name)
                    .pause(200)
                    .click("#dialog_btn");
            } else {
                client.click("#" + model_name)
                    .pause(200)
                    .click("#dialog_btn");
            }

            client.waitForElementNotPresent("#dialog_btn", 1000, "Save menu closes");
        }
    );
}

function load_transformation(client, folder_name, model_name) {
    compile_model(client, "transform", folder_name, model_name)
}

function compile_model(client, compile_type, folder_name, model_name) {

    let button = "";
    let button_name = compile_type;

    if (button_name == "AS") {
        button = "#\\2f Toolbars\\2f CompileMenu\\2f CompileMenu\\2e buttons\\2e model\\2f compileToASMM";
    } else if (button_name == "CS") {
        button = "#\\2f Toolbars\\2f CompileMenu\\2f CompileMenu\\2e buttons\\2e model\\2f compileToCSMM";
    } else if (button_name == "pattern") {
        button = "#\\2f Toolbars\\2f CompileMenu\\2f CompileMenu\\2e buttons\\2e model\\2f compileToPatternMM";
    } else if (button_name == "transform") {
        button = "#\\2f Toolbars\\2f TransformationController\\2f TransformationController\\2e buttons\\2e model\\2f load";
    }

    client.waitForElementPresent(button, 1000, "Looking for " + button_name + " button")
        .click(button)
        .waitForElementPresent("#dialog_btn", 2000, button_name + " menu opens");

    navigate_to_folder(client, folder_name);

    let new_file_text = "#new_file";
    let model_div = "#" + fix_selector(model_name);
    client.element('css selector', model_div, function (result) {

            if (result.status == -1) {
                //don't create new file with pattern compilation
                if (button_name == "pattern" || button_name == "transform") {
                    client.assert.ok(false, "File found: " + model_name);
                }

                client.click(new_file_text)
                    .clearValue(new_file_text)
                    .setValue(new_file_text, model_name)
                    .click("#dialog_btn");
            } else {
                client.click(model_div)
                    .click("#dialog_btn");
            }

            client.waitForElementNotPresent("#dialog_btn", 2000, button_name + " menu closes");
        }
    );
}

function delete_element(client, element) {
    client.moveToElement(element, 10, 10);
    client.mouseButtonClick('left');
    client.keys(client.Keys.DELETE);
    this.click_off(client);
}

function scroll_geometry_element(client, element, scrollAmount, scrollTimes) {
    client.waitForElementPresent(element, 2000, element + " present");
    this.move_to_element_ratio(client, element, 50, 50);
    client.execute(function (btn_div, scrollAmount, scrollTimes) {
        let element = $(btn_div);
        for (let i = 0; i < scrollTimes; i++) {
            element.get(0).onwheel(scrollAmount);
        }
    }, [element, scrollAmount, scrollTimes], null);

    client.pause(300);
}


module.exports = {
    '@disabled': true,
    canvas,
    get_element_div,
    get_assoc_div,
    get_class_div,
    build_div,
    create_class,
    create_classes,
    create_assoc,
    delete_element,
    set_attribs,
    move_to_element_ratio,
    click_off,
    save_model,
    load_model,
    compile_model,
    load_transformation,
    scroll_geometry_element,
    move_element
};