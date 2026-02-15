const div_utils = require('./div_utils');
const { fix_selector } = require("./div_utils");

function create_class(client, x, y, i, element_type) {

    let class_div;
    if (element_type == undefined) {
        class_div = div_utils.get_class_div(i);
    } else if (element_type.includes("defaultIcons")) {
        class_div = div_utils.build_div(element_type, i);
    } else {
        class_div = div_utils.get_element_div(element_type, i);
    }

    //const canvas = client.findElement(div_utils.canvas);
    client.perform(function () {
        const actions = this.actions({ async: false });
        return actions
            .move({ 'x': x, 'y': y })
            .contextClick();
    });

    //client.waitForElementPresent(class_div, 1000, "Created class: " + class_div);
    client.pause(300);

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

function create_assoc(client, start_div, end_div, relation_div, offset, offset2) {

    this.deselect_all(client);

    if (offset2 == undefined) {
        offset2 = offset;
    }

    let start, end;

    client.findElement(start_div, response => {
        start = response.value;
    })
        .findElement(end_div, response => {
            end = response.value;
        })
        .perform(function () {
            const actions = this.actions({ async: false });
            return actions
                .move({ 'origin': start, "x": offset[0], "y": offset[1] })
                .press(2)
                .move({ 'origin': end, "x": offset2[0], "y": offset2[1] })
                .release(2)
        })


        // this.move_to_element_ratio(client, start_div, 50 + offset, 50 + offset);
        // client.mouseButtonDown('right');
        // this.move_to_element_ratio(client, end_div, 50 + offset, 50 + offset);
        // client.mouseButtonUp('right').pause(300);

        .perform(function () {
            if (relation_div != undefined && relation_div != "") {
                client.waitForElementPresent(relation_div, 2000, "Relation option present: " + relation_div)
                    .click(relation_div)
                    .waitForElementPresent("#dialog_btn", 1000, "Assoc menu opens")
                    .click("#dialog_btn")
                    .pause(300)
                    .waitForElementNotPresent("#dialog_btn", 1000, "Assoc menu closes");
            }
        });
    this.deselect_all(client);
    client.pause(300);

}

function move_element(client, from_div, to_div, from_offset, to_offset) {

    this.deselect_all(client);

    let start, end;
    client.findElement(from_div, response => {
        start = response.value;
    })
        .findElement(to_div, response => {
            end = response.value;
        })

        .perform(function () {
            const actions = this.actions({ async: false });
            return actions
                .move({ "origin": start, "x": from_offset[0], "y": from_offset[1] })
                .click(0)
                .pause(100)
                .press(0)
                .pause(100)
                .move({ "origin": end, "x": to_offset[0], "y": to_offset[1] })
                .pause(100)
                .release(0)

            //dragAndDrop(start, end);
        });

    this.deselect_all(client);
}

function set_attribs(client, num, attrs, element_type, div_suffix, offset) {

    let element_div = element_type;
    if (element_type == undefined) {
        element_div = div_utils.get_class_div(num);
    } else if (!element_type.includes("instance")) {
        element_div = div_utils.build_div(element_type, num);
    }

    if (div_suffix != undefined) {
        element_div += div_suffix;
    }

    if (offset == undefined) {
        offset = [0, 0];
    }

    this.deselect_all(client);
    let ele;

    client.waitForElementPresent(element_div, 2000, "Find element for attrib set: " + element_div)
        .findElement(element_div, response => {
            ele = response.value;
        })
        .perform(function () {
            const actions = this.actions({ async: false });
            return actions
                .move({ 'origin': ele, "x": offset[0], "y": offset[1] })
                .click()
                .pause(300)
                .sendKeys(client.Keys.INSERT);
        })
        .waitForElementPresent("#dialog_btn", 2000, "Editing menu opens")
        .perform((function (attrs) {
            let ele2;
            for (const [key, value] of Object.entries(attrs)) {
                client.findElement(key, response => {
                    ele2 = response.value;
                })
                    .perform(function () {
                        if (key.includes("checkbox") || key.includes("choice_") || key.includes("boolean")) {
                            client.moveToElement(ele2, offset[0], offset[1])
                                .click(ele2);
                        } else
                            client.updateValue(key, value);
                    })
            }
        }).call(this, attrs))
        .click("#dialog_btn")
        .waitForElementNotPresent("#dialog_btn", 1000, "Editing menu closes")

    deselect_all(client);
}

function move_to_element_ratio(client, element, x_ratio, y_ratio) {

    client.getElementSize(element, function (result) {
        let x_pos = Math.trunc(x_ratio / 100 * result.value.width);
        let y_pos = Math.trunc(y_ratio / 100 * result.value.height);
        //console.log("X: " + x_pos + " Y: " + y_pos);
        client.moveToElement(element, x_pos, y_pos);
    });
}

function delete_element(client, element) {
    this.deselect_all(client);

    let ele;
    client.findElement(element, response => {
        ele = response.value;
    })
        .perform(function () {
            const actions = this.actions({ async: false });
            return actions
                .move({ 'origin': ele })
                .click()
        })
        .pause(200)
        .perform(function () {
            const actions = this.actions({ async: false });
            return actions
                .sendKeys(client.Keys.DELETE);
        })
        .waitForElementNotPresent(element, 2000, "Deleted element");

    this.deselect_all(client);
}

function hit_control_element(client, element) {
    //this.deselect_all(client);

    let ele;
    client.findElement(element, response => {
        ele = response.value;
    })
        .perform(function () {
            const actions = this.actions({ async: false });
            return actions
                .move({ 'origin': ele })
                .click()
        })
        .pause(200)
        .perform(function () {
            const actions = this.actions({ async: false });
            return actions
                .sendKeys(client.Keys.CONTROL);
        });

    //client.waitForElementNotPresent(element, 2000, "Deleted element");

    //this.deselect_all(client);
}



function deselect_all(client) {
    // Perform twice to make sure
    client
        .perform(function () {
            const actions = this.actions({ async: false });
            return actions
                .sendKeys(client.Keys.ESCAPE)
                .pause(200)
                .sendKeys(client.Keys.ESCAPE)
        });
    client.pause(300);
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

    client.pause(300);

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


    let model_selector = "#" + fix_selector(model_name);
    client.elements('css selector', model_selector, function (result) {
        if (!result.value || result.value.length === 0) {
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
    client.elements('css selector', model_selector, function (result) {
        if (!result.value || result.value.length === 0) {
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
            }, [name]);

        client.pause(1000);

        client.elements('css selector', '#dialog_btn', function (result) {
            if (result.value && result.value.length > 0) {
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

    client.waitForElementPresent(div_utils.canvas, 2000, "Canvas loaded")
        .perform(function () {
            for (let name of fnames) {
                let toolbar_name = name.replace(/\//g, "\\2f ").replace(/\./g, "\\2e ");
                toolbar_name = "#div_toolbar_" + toolbar_name;

                client.execute(
                    function (fname) {
                        _loadToolbar(fname);
                    }, [name])

                    //client.verify.ok(true, "Checking for Toolbar: " + toolbar_name);

                    .elements('css selector', '#dialog_btn', function (result) {
                        if (result.value && result.value.length > 0) {
                            //Dialog has popped up, so check the text and click the button
                            client.assert.textContains("#div_dialog_0", "File not found")
                                .click("#dialog_btn")

                                .verify.ok(true, "Toolbar: " + toolbar_name + " failed to load!"); //don't stop testing
                        } else {
                            //Toolbar loaded, so check for it
                            client.waitForElementPresent(toolbar_name, 2000, "Check for toolbar: " + name);
                        }
                    });
            }
        })
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
    }, [element, scrollAmount, scrollTimes]);

    client.pause(300);
}


module.exports = {
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