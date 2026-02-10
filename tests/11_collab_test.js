/*
 * This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
 * Copyright 2011 by the AToMPM team and licensed under the LGPL
 * See COPYING.lesser and README.md in the root of this project for full details
 */

let user_utils = require('./user_utils');
let model_building_utils = require('./model_building_utils');
let mouse_tracking = require('./mouse_tracking.js');
const div_utils = require("./div_utils");

function decodeHtml(html) {
    let ret = html;
    ret = ret.replace(/%3A/g, ":");
    ret = ret.replace(/%2F/g, "/");
    ret = ret.replace(/%3F/g, "?");
    ret = ret.replace(/%3D/g, "=");
    ret = ret.replace(/%26/g, "&");
    ret = ret.replace(/%0A/g, "\n");
    return ret;
}

// TODO: temporarily disable this test for CI and local runs; re-enable after fixing flakiness
module.exports = {
    '@disabled': true,

    beforeEach : async function (client) {
        await client.url('http://localhost:8124/atompm').pause(300).maximizeWindow();
        mouse_tracking.track_mouse(client);
    },

    'Collaboration test' : async function (client) {

        // store the window handles to switch between
        let tab_a = null;
        let tab_b = null;
        let tab_c = null

        // the divs of the classes created
        let first_class_div = null;
        let second_class_div = null;

        //==========================================================
        client.verify.ok(true, 'Step 1: Client A joins Server');

        let username = 'aaa';
        let user_pass = 'aaa';

        let user_exists = await user_utils.user_exists(client, username, user_pass);
        client.verify.ok(true, 'User exists:' + user_exists);

        if (!user_exists) {
            client.verify.ok(true, 'Creating user: ' + username + " pass: " + user_pass);
            await user_utils.create_user(client, username, user_pass);
        }

        client.pause(500);
        await client.windowHandles(function (result) {
            tab_a = result.value[0];
        })
        client.pause(1500);
        client.verify.ok(true, 'Tab A\'s Handle: \'' + tab_a + "'");

        //==========================================================

        client.verify.ok(true, 'Step 2a: Client A loads Toolbar');

        // SimpleClassDiagram is a stand-in for the MindMap
        // as the MindMap formalism is not available for newly-created users
        let filename = '/Formalisms/__LanguageSyntax__/SimpleClassDiagram/SimpleClassDiagram.umlIcons.metamodel';
        model_building_utils.load_toolbar(client, [filename]);

        client.pause(500);

        let name_field = "#tr_name > td:nth-child(2) > textarea";

        //==========================================================
        client.verify.ok(true, 'Step 2b: Client A creates instance');

        let classIcon = "#\\/Formalisms\\/__LanguageSyntax__\\/SimpleClassDiagram\\/SimpleClassDiagram\\.umlIcons\\.metamodel\\/ClassIcon";
        client.waitForElementPresent(classIcon, 2000, "Check for class icon...");
        client.click(classIcon);

        client.waitForElementPresent(div_utils.canvas, 1000, "Checking for canvas...");

        let start_x = 50;
        let start_y = 200;
        first_class_div = model_building_utils.create_class(client, start_x, start_y, 0);

        client.pause(500);

        //==========================================================
        client.verify.ok(true, 'Step 2c: Client A changes name of instance');

        let class_name = "ClassA";
        let attrs = {};

        attrs[name_field] = class_name;
        model_building_utils.set_attribs(client, 0, attrs);

        //SAVE MODEL
        let model_name = "collab.model";
        let folder_name = "collab";
        model_building_utils.save_model(client, folder_name, model_name);

        //==========================================================
        client.verify.ok(true, 'Step 3a: Client B joins through screen sharing');
        let collab_button = "#\\2f Toolbars\\2f MainMenu\\2f MainMenu\\2e buttons\\2e model\\2f collab";
        client.waitForElementPresent('css selector', collab_button, 1000, "Checking for collab button...");
        client.click(collab_button);

        let screen_share_selector = "#screenShareLink > a";
        client.getAttribute(screen_share_selector, "href", function (result) {

            let screen_share_url = result.value;

            const regex = /http.*/g;
            screen_share_url = screen_share_url.match(regex).toString();
            client.verify.ok(true, "Navigating to: " + screen_share_url);

            client.openNewWindow('window').pause(500)
                .url(screen_share_url);

            client.windowHandles(function (result) {
                tab_b = result.value[1];
            });
            client.pause(500);
            client.verify.ok(true, 'Tab B\'s Handle: \'' + tab_b + "'");
        });

        // wait to ensure that B is created
        client.pause(1000);

        //==========================================================
        client.verify.ok(true, 'Step 3b: Client C joins through model sharing');

        await client.switchToWindow(tab_a.toString())

        client.pause(500);

        let model_share_selector = "#modelShareLink > a";
        client.getAttribute(model_share_selector, "href", function (result) {

            let model_share_url = decodeHtml(result.value);

            const regex = /http.*/g;
            model_share_url = model_share_url.match(regex).toString();
            client.verify.ok(true, "Navigating to: " + model_share_url);

            client.openNewWindow('window').pause(500)
                .url(model_share_url);

            client.windowHandles(function (result) {
                    tab_c = result.value[2];
                })
            client.pause(500);
            client.verify.ok(true, 'Tab C\'s Handle: \'' + tab_c + "'");
        });

        // wait to ensure that B and C are created
        client.pause(1000);

        //==========================================================
        client.verify.ok(true, 'Step 4a: Client A changes name of instance (with B and C listening)');

        await client.switchToWindow(tab_a.toString())
        client.pause(500);

        client.waitForElementPresent("#dialog_btn", 2000, "Looking for close")
            .click("#dialog_btn");
        client.pause(500);

        attrs = {};
        attrs[name_field] = "MainTopic";
        model_building_utils.set_attribs(client, 0, attrs);
        client.pause(300);

        //==========================================================
        client.verify.ok(true, 'Step 5: Client A creates second instance');
        start_x = 300;
        start_y = 200;
        second_class_div = model_building_utils.create_class(client, start_x, start_y, 1);
        client.pause(300);

        //==========================================================
        client.verify.ok(true, 'Step 6: Client A creates link between elements');

        let assoc_relation = "#div_dialog_0 > select > option:nth-child(1)";
        //tiny offset to not hit other arrows
        let offset = [3, 5];
        let offset2 = [4, 5];

        model_building_utils.deselect_all(client);
        model_building_utils.create_assoc(client, first_class_div, second_class_div, assoc_relation, offset, offset2);
        client.pause(300);

        //==========================================================
        client.verify.ok(true, 'Step 7: Client A moves the second element');
        model_building_utils.move_element(client, second_class_div, second_class_div, [-60, -60], [60, 60]);
        client.pause(300);

        //==========================================================
        client.verify.ok(true, 'Step 8: Client A deletes the second instance');
        model_building_utils.delete_element(client, first_class_div);
        client.pause(300);

        //==========================================================
        client.verify.ok(true, 'Step 9: Client A switches concrete syntax');
        // NOTE: This invalidates the divs of the created elements!
        let toolbar_filename = '/Formalisms/__LanguageSyntax__/SimpleClassDiagram/SimpleClassDiagram.defaultIcons.metamodel';
        model_building_utils.load_toolbar(client, [toolbar_filename]);
        client.pause(300);

        //==========================================================
        client.verify.ok(true, 'Step 10: Client A disconnects');
        await client.closeWindow();
        client.pause(1000);
    },

    after : function (client) {
        client.end();
    },

};
