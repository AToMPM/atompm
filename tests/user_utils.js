/*
 * This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
 * Copyright 2011 by the AToMPM team and licensed under the LGPL
 * See COPYING.lesser and README.md in the root of this project for full details
 */

function login(client) {
    client.execute(
        function () {
            UserManagement.login('testuser');
        }, [], null
    );

    client.pause(500);

    client.getTitle(function (title) {
        this.assert.ok(title.includes("AToMPM - [Unnamed]"), "AToMPM is opened");
    });
}

module.exports = {
    '@disabled': true,
    login,
};