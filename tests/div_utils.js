/*
 * This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
 * Copyright 2011 by the AToMPM team and licensed under the LGPL
 * See COPYING.lesser and README.md in the root of this project for full details
 */

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

module.exports = {
    '@disabled': true,
    canvas,
    get_element_div,
    get_assoc_div,
    get_class_div,
    build_div,
    fix_selector,
};