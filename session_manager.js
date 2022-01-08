/*
 * This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
 * Copyright 2011 by the AToMPM team and licensed under the LGPL
 * See COPYING.lesser and README.md in the root of this project for full details
 */


const _utils = require("./utils");


/* an array of WebWorkers
	... each has its own mmmk instance */
let workers = [];

/* an array of response objects
  ...	for workers to write on when they complete requests */
let responses = [];

/* a map of worker ids to socket.io socket session ids
	... each socket is registered to exactly one worker
 	... several sockets may be registered to the same worker */
let workerIds2socketIds = {};

/* a map of worker ids to the type of worker
 * used for logging
 */
let workerIds2workerType = {};

/*********************************** GLOBALS **********************************/

/** Syntactic sugar to build and send a socket.io message **/
function __send(socket, statusCode, reason, data, headers)
{
    let log_data = _utils.clone(data);

    // simplify the data before logging
    if (data && typeof data === 'object'){
        if ("changelog" in data) {
            log_data['changelog'] = _utils.collapse_changelog(data["changelog"])
        }
        if ("sequence#" in data){
            delete log_data["sequence#"];
        }
        if ("hitchhiker" in data){
            log_data['hitchhiker'] = _utils.collapse_hitchhiker(data['hitchhiker'])
        }
    }
    let log_statusCode = (statusCode === undefined)? "": statusCode + "<br/>";
    let log_headers = (headers === undefined)? "": headers + "<br/>";

    //logger.http("socketio _ 'message' <br/>" + log_statusCode + log_headers + JSON.stringify(log_data) ,{'from':"server",'to':'client'});

    socket.emit('message',
        {'statusCode':statusCode,
            'reason':reason,
            'headers':(headers || {'Content-Type': 'text/plain'}),
            'data':data});
}


module.exports = {
    workers,
    responses,
    workerIds2socketIds,
    workerIds2workerType,
    __send,
}