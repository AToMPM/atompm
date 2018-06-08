let canvas = "#div_canvas";

function build_div(element_type, num){
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

function create_classes(client, x_coords, y_coords, curr_num_elements, element_type) {
    for (let x of x_coords) {
        for (let y of y_coords) {

            let class_div = "";
            if (element_type != undefined){
                class_div = element_type + (curr_num_elements) + "\\2e instance";
            } else {
                class_div = this.get_class_div(curr_num_elements);
            }

            client
                .moveToElement(canvas, x, y)
                .mouseButtonClick('right')
                .pause(500)
                .waitForElementPresent(class_div, 500, "Created class: " + class_div);

            curr_num_elements++;
        }
    }

    return curr_num_elements;
}

function set_attribs(client, num, attrs, element_type) {

    let class_div = "";
    if (element_type != undefined){
        class_div = element_type + (num) + "\\2e instance";
    } else {
        class_div = this.get_class_div(num);
    }
    client.moveToElement(class_div, 10, 10)
        .mouseButtonClick('middle')
        .waitForElementPresent("#dialog_btn", 1000, "Editing menu opens");

    for (const [key, value] of Object.entries(attrs)) {
        client
            .clearValue(key)
            .setValue(key, value);
    }
    client
        .click("#dialog_btn")
        .waitForElementNotPresent("#dialog_btn", 1000, "Editing menu closes")
        .moveToElement(canvas, 0, 100)
        .mouseButtonClick('left')
        .pause(500)
    ;
}

function move_to_element_ratio(client, element, x_ratio, y_ratio){

    client.getElementSize(element, function (result) {
        let x_pos = x_ratio/100 * result.value.width;
        let y_pos = y_ratio/100 * result.value.height;
        client.moveToElement(element, x_pos, y_pos);
    });
}

module.exports = {
    '@disabled': true,
    get_element_div,
    get_assoc_div,
    get_class_div,
    build_div,
    create_classes,
    set_attribs,
    move_to_element_ratio
};