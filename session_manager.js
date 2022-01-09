/*
 * This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
 * Copyright 2011 by the AToMPM team and licensed under the LGPL
 * See COPYING.lesser and README.md in the root of this project for full details
 */


const _utils = require("./utils");
const _sio = require("socket.io");
const logger = require("./logger");
const _url = require("url");


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

/* the socket server which listens to the main http server (in httpwsd.js) */
let socket_server = null;

/** Syntactic sugar to build and send a socket.io message **/
function __send(socket, statusCode, reason, data, headers)
{
    // let log_data = _utils.clone(data);

    // simplify the data before logging
    // if (data && typeof data === 'object'){
    //     if ("changelog" in data) {
    //         log_data['changelog'] = _utils.collapse_changelog(data["changelog"])
    //     }
    //     if ("sequence#" in data){
    //         delete log_data["sequence#"];
    //     }
    //     if ("hitchhiker" in data){
    //         log_data['hitchhiker'] = _utils.collapse_hitchhiker(data['hitchhiker'])
    //     }
    // }
    // let log_statusCode = (statusCode === undefined)? "": statusCode + "<br/>";
    // let log_headers = (headers === undefined)? "": headers + "<br/>";

    // logger.http("socketio _ 'message' <br/>" + log_statusCode + log_headers + JSON.stringify(log_data) ,{'from':"server",'to':'client'});

    socket.emit('message',
        {'statusCode':statusCode,
            'reason':reason,
            'headers':(headers || {'Content-Type': 'text/plain'}),
            'data':data});
}

function init_session_manager(httpserver){
    socket_server = new _sio.Server(httpserver);

    socket_server.sockets.on('connection',
        function(socket)
        {
            /* unregister this socket from the specified worker ... when a worker
                  has no more registered sockets, terminate it */
            function unregister(wid)
            {
                logger.http("socketio _ 'unregister'" ,{'at':"session_mngr"});
                let i = workerIds2socketIds[wid].indexOf(socket.id);
                if( i === -1 ){
                    __send(socket,403,'already unregistered from worker');
                }else
                {
                    workerIds2socketIds[wid].splice(i,1);
                    if( workerIds2socketIds[wid].length === 0 )
                    {
                        workers[wid].kill();
                        workers[wid] = undefined;
                        delete workerIds2socketIds[wid];
                    }

                    __send(socket,200);
                }
            }


            /* onmessage : on reception of data from client */
            socket.on('message',
                function(msg/*{method:_,url:_}*/)
                {
                    let url = _url.parse(msg.url,true);

                    /* check for worker id and it's validity */
                    if( url['query'] === undefined ||
                        url['query']['wid'] === undefined ){
                        return __send(socket,400,'missing worker id');
                    }

                    let wid = url['query']['wid'];
                    logger.http("socketio _ 'message' <br/>" + msg.method + " " + JSON.stringify(url['query']) + "<br/>" + url.pathname,{'from':'client','to':"session_mngr"});

                    if( workers[wid] === undefined ) {
                        __send(socket,400,'unknown worker id :: '+wid);
                    }
                    /* register socket for requested worker */
                    else if( msg.method === 'POST' && url.pathname.match(/changeListener$/) )
                    {
                        if( workerIds2socketIds[wid].indexOf(socket.id) > -1 ) {
                            __send(socket,403,'already registered to worker');
                        }else
                        {
                            workerIds2socketIds[wid].push(socket.id);
                            __send(socket,201);
                        }
                    }

                    /* unregister socket for requested worker */
                    else if( msg.method === 'DELETE' &&
                        url.pathname.match(/changeListener$/) ) {
                        unregister(wid);
                    }

                    /* unsupported request */
                    else {
                        __send(socket,501);
                    }
                });

            /* ondisconnect : on disconnection of socket */
            socket.on('disconnect',
                function()
                {
                    logger.http("socketio _ 'disconnect'",{'at':"session_mngr"});
                    for( let wid in workerIds2socketIds )
                        for( let i in workerIds2socketIds[wid] )
                            if( workerIds2socketIds[wid][i] === socket.id )
                            {
                                unregister(wid);
                                return;
                            }
                });
        });
}

function send_to_all(wid, msg){
    let _msg = {'changelog':msg['changelog'],
        'sequence#':msg['sequence#'],
        'hitchhiker':msg['hitchhiker']};

    // simplify the msg for logging
    let log_data = {'changelog':_utils.collapse_changelog(msg["changelog"]), 'hitchhiker':_utils.collapse_hitchhiker(msg['hitchhiker'])};

    workerIds2socketIds[wid].forEach(
        function(sid)
        {
            logger.http("socketio _ 'sending chglg'+ <br/>" + JSON.stringify(log_data) ,{'at': workerIds2workerType[wid] + wid});
            __send(
                socket_server.sockets.sockets.get(sid),
                undefined,
                undefined,
                _msg);
        });
}

module.exports = {
    workers,
    responses,
    workerIds2socketIds,
    workerIds2workerType,
    socket_server,
    init_session_manager,
    send_to_all,
}