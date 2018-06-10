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
        .pause(500)
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

function set_attribs(client, num, attrs, element_type) {

    let element_div = "";
    if (element_type != undefined) {
        element_div = this.build_div(element_type, num);
    } else {
        element_div = this.get_class_div(num);
    }

    client
        .waitForElementPresent(element_div, 1000, "Find element for attrib set: " + element_div)
        .moveToElement(element_div, 10, 10)
        .mouseButtonClick('middle')
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
        .pause(500)
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

function save_model(client, folder_name, model_name) {
    let save_button = "#\\2f Toolbars\\2f MainMenu\\2f MainMenu\\2e buttons\\2e model\\2f saveModel";
    let new_file_text = "#new_file";

    client.waitForElementPresent(save_button, 1000, "Looking for save button")
        .click(save_button)
        .waitForElementPresent("#dialog_btn", 1000, "Save menu opens");

    let root_button = "#navbar_\\2f";
    client.waitForElementPresent(root_button, 1000, "Find root button")
        .click(root_button);

    let folder_name_div = "#" + folder_name;
    client.element('css selector', folder_name_div, function (result) {
            if (result.status == -1) {
                let new_folder_btn = "#new_folder";
                client.click(new_folder_btn)
                    .setAlertText(folder_name)
                    .acceptAlert();
            }
            client.click(folder_name_div);

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
    );
}

function compile_model(client, compile_type, folder_name, model_name) {


    let button = "";
    let button_name = compile_type;

    if (button_name == "AS") {
        button = "#\\2f Toolbars\\2f CompileMenu\\2f CompileMenu\\2e buttons\\2e model\\2f compileToASMM";
    } else if (button_name == "CS") {
        button = "#\\2f Toolbars\\2f CompileMenu\\2f CompileMenu\\2e buttons\\2e model\\2f compileToCSMM";
    }


    client.waitForElementPresent(button, 1000, "Looking for " + button_name + " button")
        .click(button)
        .waitForElementPresent("#dialog_btn", 2000, button_name + " menu opens");

    let root_button = "#navbar_\\2f";
    client.waitForElementPresent(root_button, 1000, "Find root button")
        .click(root_button);

    let folder_div = "#" + folder_name;
    client.element('css selector', folder_div, function (result) {
        if (result.status != -1) {
            client.click(folder_div);
        }
    });

    let new_file_text = "#new_file";
    client.element('css selector', "#" + model_name, function (result) {
            if (result.status == -1) {
                client.click(new_file_text)
                    .clearValue(new_file_text)
                    .setValue(new_file_text, model_name)
                    .click("#dialog_btn");
            } else {
                client.click("#" + model_name)
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

    client.pause(1000);
}


module.exports = {
    '@disabled': true,
    get_element_div,
    get_assoc_div,
    get_class_div,
    build_div,
    create_class,
    create_classes,
    delete_element,
    set_attribs,
    move_to_element_ratio,
    click_off,
    save_model,
    compile_model,
    scroll_geometry_element
};