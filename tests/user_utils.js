/*
 * This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
 * Copyright 2011 by the AToMPM team and licensed under the LGPL
 * See COPYING.lesser and README.md in the root of this project for full details
 */

async function user_exists(client, username, password) {
    await client.execute(
        function (username, password) {
            UserManagement.validateCredentials(username, password);
        }, [username, password], null
    );

    let user_exists = false;
    client.getText('div[id=div_login_error]', function (result) {
        user_exists = !result.value.includes('login failed');
    });
    client.pause(1000);
    return user_exists;
}

async function create_user(client, username, password) {
    await client.execute(
        function (username, password) {
            UserManagement.signup(username, password);
        }, [username, password], null
    );
}

async function login(client, username, pass) {

    //set default value
    username = username ? username : 'testuser';
    pass = pass ? pass : 'test';

    client.updateValue("#input_username", username);
    client.updateValue("#input_password", pass);
    client.click("#login_button");

    client.pause(500);

    client.getTitle(function (title) {
        this.assert.ok(title.includes("AToMPM - [Unnamed]"), "AToMPM is opened - '" + title + "'");
    });
}

module.exports = {
    '@disabled': true,
    user_exists,
    create_user,
    login,
};