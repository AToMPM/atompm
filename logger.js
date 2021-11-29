/* This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
*  Copyright 2011 by the AToMPM team and licensed under the LGPL
*  See COPYING.lesser and README.md in the root of this project for full details
*/


/**
 * A simple logger, somewhat copied from the API of Winston
 * https://github.com/winstonjs/winston#logging-levels
 * Future work could be to import Winston directly
 */

let curr_log_level = 2;

const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    HTTP: 3,
    VERBOSE: 4,
    DEBUG: 5,
    SILLY: 6
}

function set_level(new_level) {
    curr_log_level = new_level
}

function log(log_level, msg) {
    if (log_level.toLowerCase() === "ERROR") {
        error(msg);
    } else if (log_level.toLowerCase() === "WARN") {
        warn(msg);
    } else if (log_level.toLowerCase() === "INFO") {
        info(msg);
    } else if (log_level.toLowerCase() === "HTTP") {
        http(msg);
    } else if (log_level.toLowerCase() === "VERBOSE") {
        verbose(msg);
    } else if (log_level.toLowerCase() === "DEBUG") {
        debug(msg);
    } else if (log_level.toLowerCase() === "SILLY") {
        silly(msg);
    }
}

function _get_stack_loc() {
    const e = new Error();
    const stack = e.stack.split("\n");
    let loc = stack[4].split("/")
    loc = loc[loc.length - 1].split(":")
    return loc[0] + "(" + loc[1].padStart(4, ' ') + ")"
}

function _get_prefix() {
    return _get_stack_loc() + "::"
}

function error(msg) {
    if (curr_log_level < LOG_LEVELS.ERROR) {
        return
    }
    console.error(_get_prefix() + msg);
}

function warn(msg) {
    if (curr_log_level < LOG_LEVELS.WARN) {
        return
    }
    console.warn(_get_prefix() + msg);
}

function info(msg) {
    if (curr_log_level < LOG_LEVELS.INFO) {
        return
    }
    console.log(_get_prefix() + msg);
}

function http(msg) {
    if (curr_log_level < LOG_LEVELS.HTTP) {
        return
    }
    console.log(_get_prefix() + "%c" + msg, 'color: #006400');
}

function verbose(msg) {
    if (curr_log_level < LOG_LEVELS.VERBOSE) {
        return
    }
    console.log(_get_prefix() + "%c" + msg, 'color: #00008B');
}

function debug(msg) {
    if (curr_log_level < LOG_LEVELS.DEBUG) {
        return
    }
    console.log(_get_prefix() + "%c" + msg, 'color: #808080');
}

function silly(msg) {
    if (curr_log_level < LOG_LEVELS.SILLY) {
        return
    }
    console.log(_get_prefix() + "%c" + msg, 'color: #C71585');
}

module.exports = {
    LOG_LEVELS,
    set_level,
    log,
    error,
    warn,
    info,
    http,
    verbose,
    debug,
    silly
}
