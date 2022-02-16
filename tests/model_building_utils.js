const div_utils = require('./div_utils');
const {fix_selector} = require("./div_utils");

async function create_class(client, x, y, i, element_type) {

    let class_div;
    if (element_type == undefined) {
        class_div = div_utils.get_class_div(i);
    } else if (element_type.includes("defaultIcons")) {
        class_div = div_utils.build_div(element_type, i);
    } else {
        class_div = div_utils.get_element_div(element_type, i);
    }

    //const canvas = await client.findElement(div_utils.canvas);
    await client
        .perform(function () {
            const actions = this.actions({async: true});
            return actions
                .move({'x': x, 'y': y})
                .contextClick();
        });

    //client.waitForElementPresent(class_div, 1000, "Created class: " + class_div);

    return class_div;

}

async function create_classes(client, x_coords, y_coords, curr_num_elements, element_type) {
    for (let x of x_coords) {
        for (let y of y_coords) {
            await this.create_class(client, x, y, curr_num_elements, element_type);
            curr_num_elements++;
        }
    }

    return curr_num_elements;
}

async function create_assoc(client, start_div, end_div, relation_div, offset, offset2) {

    await this.deselect_all(client);

    if (offset2 == undefined){
        offset2 = offset;
    }

    const start = await client.findElement(start_div);
    const end = await client.findElement(end_div);
    await client
        .perform(function () {
            const actions = this.actions({async: true});
            return actions
                .move({'origin':start, "x":offset[0], "y":offset[1]})
                .press(2)
                .move({'origin':end, "x":offset2[0], "y":offset2[1]})
                .release(2)
        });


    // this.move_to_element_ratio(client, start_div, 50 + offset, 50 + offset);
    // client.mouseButtonDown('right');
    // this.move_to_element_ratio(client, end_div, 50 + offset, 50 + offset);
    // client.mouseButtonUp('right').pause(300);

    if (relation_div != undefined && relation_div != "") {
        client.waitForElementPresent(relation_div, 1000, "Relation option present: " + relation_div);
        client.click(relation_div);
        client.waitForElementPresent("#dialog_btn", 1000, "Assoc menu opens")
            .click("#dialog_btn")
            .pause(300)
            .waitForElementNotPresent("#dialog_btn", 1000, "Assoc menu closes");
    }

    await this.deselect_all(client);
    client.pause(300);

}

async function move_element(client, from_div, to_div, from_offset, to_offset) {

    await this.deselect_all(client);

    const start = await client.findElement(from_div);
    const end = await client.findElement(to_div);

    await client
        .perform(function () {
            const actions = this.actions({async: true});
            return actions
                .move({"origin": start})
                .click(0)
                .pause(100)
                .press(0)
                .pause(100)
                .move({"origin": end, "x":to_offset[0], "y":to_offset[1]})
                .pause(100)
                .release(0)

            //dragAndDrop(start, end);
        });

    await this.deselect_all(client);
}

async function set_attribs(client, num, attrs, element_type, div_suffix, offset) {

    let element_div = element_type;
    if (element_type == undefined){
        element_div = div_utils.get_class_div(num);
    } else if (!element_type.includes("instance")){
        element_div = div_utils.build_div(element_type, num);
    }

    if (div_suffix != undefined) {
        element_div += div_suffix;
    }

    if (offset == undefined) {
        offset = [0, 0];
    }

    await this.deselect_all(client);

    client.waitForElementPresent(element_div, 1000, "Find element for attrib set: " + element_div);

    const ele = await client.findElement(element_div);
    await client
        .perform(function () {
            const actions = this.actions({async: true});
            return actions
                .move({'origin': ele, "x":offset[0], "y":offset[1]})
                .click()
        });
    await client
        .perform(function () {
            const actions = this.actions({async: true});
            return actions
                .sendKeys(client.Keys.INSERT);
        });
    client.waitForElementPresent("#dialog_btn", 1000, "Editing menu opens");

    for (const [key, value] of Object.entries(attrs)) {
        const ele = await client.findElement(key);

        if (key.includes("checkbox") || key.includes("choice_") || key.includes("boolean"))
            client.click(ele);
        else
            client.updateValue(key, value);
    }

    client
        .click("#dialog_btn")
        .waitForElementNotPresent("#dialog_btn", 1000, "Editing menu closes")

    await deselect_all(client);
}

function move_to_element_ratio(client, element, x_ratio, y_ratio) {

    client.getElementSize(element, function (result) {
        let x_pos = Math.trunc(x_ratio / 100 * result.value.width);
        let y_pos = Math.trunc(y_ratio / 100 * result.value.height);
        //console.log("X: " + x_pos + " Y: " + y_pos);
        client.moveToElement(element, x_pos, y_pos);
    });
}

async function delete_element(client, element) {
    await this.deselect_all(client);

    const ele = await client.findElement(element);
    await client
        .perform(function () {
            const actions = this.actions({async: true});
            return actions
                .move({'origin': ele})
                .click()
        });
    client.pause(200);
    await client
        .perform(function () {
            const actions = this.actions({async: true});
            return actions
                .sendKeys(client.Keys.DELETE);
        });

    client.waitForElementNotPresent(element, 2000, "Deleted element");

    await this.deselect_all(client);
}

async function hit_control_element(client, element) {
    //await this.deselect_all(client);

    const ele = await client.findElement(element);
    await client
        .perform(function () {
            const actions = this.actions({async: true});
            return actions
                .move({'origin': ele})
                .click()
        });
    client.pause(200);
    await client
        .perform(function () {
            const actions = this.actions({async: true});
            return actions
                .sendKeys(client.Keys.CONTROL);
        });

    //client.waitForElementNotPresent(element, 2000, "Deleted element");

    //await this.deselect_all(client);
}



async function deselect_all(client) {
    await client
        .perform(function () {
            const actions = this.actions({async: true});
            return actions
                .sendKeys(client.Keys.ESCAPE);
        });
    client.pause(200);
}

function navigate_to_folder(client, folder_name) {

    let root_button = "#navbar_\\2f";
    client.waitForElementPresent(root_button, 2000, "Find root button")
        .click(root_button);

    if (folder_name === "~") {
        return;
    }

    let new_folder_selector = "#new_folder";
    let folder_path = folder_name.split("/");

    for (let f of folder_path) {
        let folder_name_div = "#" + f;

        client.element('css selector', folder_name_div, function (result) {
            // folder not created, so create it
            if (result.status == -1) {
                client.click(new_folder_selector)
                    .pause(500)
                    .setAlertText(f)
                    .acceptAlert()
                    .pause(500);
            }

            client.waitForElementPresent(folder_name_div, 2000, "Find folder: " + folder_name_div)
                .click(folder_name_div);
        });

    }

}

function load_model(client, folder_name, model_name) {

    let load_button = "#\\2f Toolbars\\2f MainMenu\\2f MainMenu\\2e buttons\\2e model\\2f loadModel";

    client.waitForElementPresent(load_button, 1000, "Looking for load button")
        .click(load_button)
        .waitForElementPresent("#dialog_btn", 1000, "Load menu opens");

    navigate_to_folder(client, folder_name);

    let model_name_div = "#" + div_utils.fix_selector(model_name);
    client.waitForElementPresent(model_name_div, 2000, "Looking for model: " + model_name_div)
        .click(model_name_div);
    client.waitForElementPresent("#dialog_btn", 2000, "Looking for close")
        .click("#dialog_btn");
    client.waitForElementNotPresent("#dialog_btn", 2000, "Load menu closes");

}

function save_model(client, folder_name, model_name) {
    let save_button = "#\\2f Toolbars\\2f MainMenu\\2f MainMenu\\2e buttons\\2e model\\2f saveModelAs";
    let new_file_text = "#new_file";

    client.waitForElementPresent(save_button, 1000, "Looking for save button")
        .click(save_button)
        .waitForElementPresent("#dialog_btn", 1000, "Save menu opens");

    navigate_to_folder(client, folder_name);


    let model_selector = "#" + model_name;
    client.element('css selector', model_selector, function (result) {
            if (result.status == -1) {
                client.click(new_file_text)
                    .clearValue(new_file_text)
                    .setValue(new_file_text, '\u0008') // Send a backspace
                    .setValue(new_file_text, model_name);

                client.assert.ok(true, "Saving model with name: '" + model_name + "'");
            } else {
                client.click(model_selector);
            }

            client.waitForElementPresent("#dialog_btn", 2000, "Looking for close")
                .pause(200)
                .click("#dialog_btn")
                .pause(200)
                .waitForElementNotPresent("#dialog_btn", 2000, "Save menu closes");

        }
    );
}

function rename_model(client, folder_name, old_filename, new_filename) {
    let load_button = "#\\2f Toolbars\\2f MainMenu\\2f MainMenu\\2e buttons\\2e model\\2f loadModel";

    client.waitForElementPresent(load_button, 1000, "Looking for load button")
        .click(load_button)
        .waitForElementPresent("#dialog_btn", 1000, "Load menu opens");

    navigate_to_folder(client, folder_name);

    let rename_file_text = "#rename_file";
    let model_selector = "#" + fix_selector(old_filename);
    client.element('css selector', model_selector, function (result) {
            if (result.status == -1) {
                client.assert.ok(false, "Could not find file with name: '" + old_filename + "'");
            } else {
                client.click(model_selector);
            }

            client.click(rename_file_text)
                .pause(500)
                .setAlertText(new_filename)
                .acceptAlert();

            client.assert.ok(true, "Renaming model to name: '" + new_filename + "'");

            client.waitForElementPresent("#dialog_cancel_btn", 2000, "Looking for close")
                .pause(200)
                .click("#dialog_cancel_btn")
                .pause(200)
                .waitForElementNotPresent("#dialog_cancel_btn", 2000, "Load menu closes");

        }
    );
}

function load_multiple_models(client, fnames) {

    client.waitForElementPresent(div_utils.canvas, 2000, "Canvas loaded");

    client.pause(500);

    for (const name of fnames) {

        client.execute(
            function (fname) {
                _loadModel(fname);
            }, [name], null
        );

        client.pause(1000);

        client.element('css selector', '#dialog_btn', function (result) {
            if (result.status != -1) {
                //Dialog has popped up, so check the text and click the button
                client.assert.textContains("#div_dialog_0", "File not found");
                client.click("#dialog_btn");

                //client.verify.ok(false, "File: " + name + " failed to load!"); //don't stop testing
                console.error("File: " + name + " failed to load!");

            } else {
                //Model loaded, so check the title
                client.getTitle(function (title) {
                    this.assert.ok(title.includes(name), "Check for model: " + name);
                });
            }
        });

    }

}

function load_toolbar(client, fnames) {

    client.waitForElementPresent(div_utils.canvas, 2000, "Canvas loaded");

    for (let name of fnames) {
        client.execute(
            function (fname) {
                _loadToolbar(fname);
            }, [name], null
        );

        let toolbar_name = name.replace(/\//g, "\\2f ").replace(/\./g, "\\2e ");
        toolbar_name = "#div_toolbar_" + toolbar_name;

        //client.verify.ok(true, "Checking for Toolbar: " + toolbar_name);

        client.element('css selector', '#dialog_btn', function (result) {
            if (result.status != -1) {
                //Dialog has popped up, so check the text and click the button
                client.assert.textContains("#div_dialog_0", "File not found");
                client.click("#dialog_btn");

                client.verify.ok(true, "Toolbar: " + toolbar_name + " failed to load!"); //don't stop testing
            } else {
                //Toolbar loaded, so check for it
                client.waitForElementPresent(toolbar_name, 2000, "Check for toolbar: " + name);
            }
        });

    }

}


function load_transformation(client, folder_name, model_name) {
    compile_model(client, "transform", folder_name, model_name);
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
                    .pause(200)
                    .clearValue(new_file_text)
                    .pause(200)
                    .setValue(new_file_text, '\u0008') // Send a backspace
                    .setValue(new_file_text, '\u0008') // Send a backspace
                    .setValue(new_file_text, model_name)
                    .pause(200)
                    .click("#dialog_btn");
            } else {
                client.click(model_div)
                    .pause(200)
                    .click("#dialog_btn");
            }

            client.waitForElementNotPresent("#dialog_btn", 2000, button_name + " menu closes");
        }
    );
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
    create_class,
    create_classes,
    create_assoc,
    delete_element,
    set_attribs,
    move_to_element_ratio,
    deselect_all,
    save_model,
    load_model,
    load_multiple_models,
    rename_model,
    compile_model,
    load_toolbar,
    load_transformation,
    scroll_geometry_element,
    move_element,
    hit_control_element
};