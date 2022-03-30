/*
 * This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
 * Copyright 2011 by the AToMPM team and licensed under the LGPL
 * See COPYING.lesser and README.md in the root of this project for full details
 */

let user_utils = require('./user_utils');
let model_building_utils = require('./model_building_utils');
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

module.exports = {

    beforeEach: function (client, done) {
        client.url('http://localhost:8124/atompm').pause(300).maximizeWindow(done);
    },

    'Collaboration test' : async function (client) {

        //==========================================================
        client.verify.ok(true, 'Step 1: Client A joins Server');

        let username = 'aaa';
        let user_pass = 'aaa';

        let user_exists = user_utils.user_exists(client, username, user_pass);

        if (!user_exists) {
            user_utils.create_user(client, username, user_pass);
        }

        user_utils.login(client, username);

        client.pause(500);

        //==========================================================

        client.verify.ok(true, 'Step 2a: Client A loads Toolbar');

        // SimpleClassDiagram is a stand-in for the MindMap
        // as the MindMap formalism is not available for newly-created users
        let filename = '/Formalisms/__LanguageSyntax__/SimpleClassDiagram/SimpleClassDiagram.umlIcons.metamodel';
        model_building_utils.load_toolbar(client, [filename]);

        client.pause(500);

        //==========================================================
        client.verify.ok(true, 'Step 2b: Client A creates instance');

        let classIcon = "#\\/Formalisms\\/__LanguageSyntax__\\/SimpleClassDiagram\\/SimpleClassDiagram\\.umlIcons\\.metamodel\\/ClassIcon";
        client.waitForElementPresent(classIcon, 2000, "Check for class icon...");
        client.click(classIcon);

        client.waitForElementPresent(div_utils.canvas, 1000, "Checking for canvas...");

        let start_x = 50;
        let start_y = 200;
        model_building_utils.create_class(client, start_x, start_y, 0);

        client.pause(500);

        //==========================================================
        client.verify.ok(true, 'Step 2c: Client A changes name of instance');

        let class_name = "ClassA";
        let attrs = {};
        let name_field = "#tr_name > td:nth-child(2) > textarea";
        attrs[name_field] = class_name;
        model_building_utils.set_attribs(client, 0, attrs);

        //SAVE MODEL
        let model_name = "collab.model";
        let folder_name = "collab";
        model_building_utils.save_model(client, folder_name, model_name);

        //==========================================================
        client.verify.ok(true, 'Step 3a: Client B joins through screen sharing');


        let screen_share_selector = "#a_screenshare";

        client.getAttribute(screen_share_selector, "href", function (result) {
            //client.verify.ok(true, "Screenshare link: " + result.value);

            let screen_share_url = decodeHtml(result.value);
            //client.verify.ok(true, "Screenshare url: " + result.value);

            //const paragraph = 'http://localhost:8124/atompm?cswid=1&host=aaa';
            const regex = /http.*/g;
            screen_share_url = screen_share_url.match(regex);

            //client.verify.ok(true, "Screenshare url small: " + screen_share_url);

            client.openNewWindow('window', function (result) {

                client.pause(2000);
                client.windowHandles(function (result) {
                    let b_window_handle = result.value[1];
                    client.pause(5000);
                    client.verify.ok(true, "Window handle: " + b_window_handle.toString());
                    client.switchWindow(b_window_handle);
                    client.pause(5000);
                    client.url(screen_share_url, function (result) {
                        client.verify.ok(true, "Navigated to: " + result.toString());
                    });
                    client.verify.ok(true, "Navigating to: " + screen_share_url);


                    //this.pause();

                });

            });


            client.pause(3000);
        });


        //==========================================================
        client.verify.ok(true, 'Step 3b: Client C joins through model sharing');

        let model_share_selector = "#a_modelshare";
        let model_share_url = "http://localhost:8124/atompm?cswid=0&aswid=1&host=aaa";

        //==========================================================
        client.verify.ok(true, 'Step 4a: Client A changes name of instance (with B and C listening)');

        //==========================================================
        client.verify.ok(true, 'Step 5: Client A creates second instance');

        //==========================================================
        client.verify.ok(true, 'Step 6: Client A creates link between elements');

        //==========================================================
        client.verify.ok(true, 'Step 7: Client A deletes the second instance');

        //==========================================================
        client.verify.ok(true, 'Step 8: Client A disconnects');

    },

    after : function (client) {
        client.end();
    },

};
