/*
 * This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
 * Copyright 2011 by the AToMPM team and licensed under the LGPL
 * See COPYING.lesser and README.md in the root of this project for full details
 */


const _utils = require("./utils");
const _sio = require("socket.io");
const logger = require("./logger");
const _url = require("url");
const _cp = require("child_process");
const _path = require("path");
const _uuid = require("uuid");

/* an array of WebWorkers
	... each has its own mmmk instance */
let workers = [];

/* an array of response objects
  ...	for workers to write on when they complete requests */
let responses = [];

/* a map of client IDs to their csworker wid */
let clientIDs2csids = {};

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

                    logger.http("socketio _ 'message' <br/>" + msg.method + " " + JSON.stringify(url['query']) + "<br/>" + url.pathname,{'from':'client','to':"session_mngr"});

                    /* the client asks to create a new session */
                    /* the session manager then has a map from client ID to the worker ID */
                    if (msg.method == 'POST' && url.pathname.match(/createSession/)) {
                        let wid = __createNewWorker('/csworker');
                        let cid = url['query']['cid'];

                        if (cid == undefined) {
                            __send(socket, 400, 'invalid client id :: ' + url['query']['cid']);
                        } else {

                            // map the worker to client socket
                            workerIds2socketIds[wid].push(socket.id);

                            // map the client ID to their worker
                            clientIDs2csids[cid] = wid;

                            logger.http("socket _ 'resp wid'+ <br/>" + ''+wid ,{'from':"session_mngr",'to': 'client', 'type':"-)"});

                            /* respond worker id (used to identify associated worker) */
                            __send(socket, 201, undefined, {'wid': wid});
                        }
                        return;
                    }

                    /* check for worker id and it's validity */
                    if( url['query'] === undefined ||
                        url['query']['wid'] === undefined ){
                        return __send(socket,400,'missing worker id');
                    }

                    let wid = url['query']['wid'];

                    if( workers[wid] === undefined ) {
                        __send(socket,400,'unknown worker id :: '+wid);
                    }
                    /* register socket for requested worker */
                    else if( msg.method === 'POST' && url.pathname.match(/changeListener$/) )
                    {
                        logger.http("Socket " + socket.id + " now listening to worker " + wid, {'at': 'session_mngr'});

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

function __createNewWorker(workerType){
    /* setup and store new worker */
    let worker = _cp.fork(_path.join(__dirname, '__worker.js'));

    let wid = workers.push(worker)-1;

    workerIds2socketIds[wid] = [];
    workerIds2workerType[wid] = workerType;

    worker.on('message',
        function(msg)
        {
            /* push changes (if any) to registered sockets... even empty
                changelogs are pushed to facilitate sequence number-based
                ordering */
            if( msg['changelog'] !== undefined )
            {
                send_to_all(wid, msg);
            }

            /* respond to a request */
            if( msg['respIndex'] !== undefined )
                _utils.respond(
                    responses[msg['respIndex']],
                    msg['statusCode'],
                    msg['reason'],
                    JSON.stringify(
                        {'headers':
                                (msg['headers'] ||
                                    {'Content-Type': 'text/plain',
                                        'Access-Control-Allow-Origin': '*'}),
                            'data':msg['data'],
                            'sequence#':msg['sequence#']}),
                    {'Content-Type': 'application/json'});
        });

    let msg = {'workerType':workerType, 'workerId':wid};
    logger.http("process _ 'init'+ <br/>" + JSON.stringify(msg),{'from':"session_mngr",'to': workerType + wid, 'type':"-)"});
    worker.send(msg);

    logger.http("http _ 'resp on worker creation: wid:'"+ wid, {'at':"session_mngr"});
    return wid
}

function handle_http_message(url, req, resp){

    logger.http("fcn call _ 'message'",{'from': 'server', 'to':"session_mngr"});

    /* create new client ID and return it */
    if (req.method == 'POST' && url.pathname == '/newCID'){
        let cid = _uuid.v4()
        logger.http("http _ 'resp cid'+ <br/>" + ''+cid ,{'from':"session_mngr",'to': 'client', 'type':"-)"});
        _utils.respond(
            resp,
            201,
            '',
            ''+cid);
    }
    /* spawn new worker */
    else if( (url.pathname == '/csworker' || url.pathname == '/asworker')
        && req.method == 'POST' )
    {
        let wid = __createNewWorker(url.pathname);

        /* respond worker id (used to identify associated worker) */
        _utils.respond(
            resp,
            201,
            '',
            ''+wid);
    }

    /* check for worker id and it's validity */
    else if( url['query'] == undefined ||
        url['query']['wid'] == undefined )
        _utils.respond(resp, 400, 'missing worker id');

    else if( workers[url['query']['wid']] == undefined )
        _utils.respond(resp, 400, 'invalid worker id :: '+url['query']['wid']);

    /* save resp object and forward request to worker (if request is PUT or
          POST, recover request data first)

        TBI:: only registered sockets should be allowed to speak to worker
                ... one way of doing this is forcing request urls to contain
                cid=socket.id## */
    else if( req.method == 'PUT' || req.method == 'POST' )
    {
        let reqData = '';
        req.addListener("data", function(chunk) {reqData += chunk;});
        req.addListener("end",
            function()
            {
                workers[url['query']['wid']].send(
                    {'method':req.method,
                        'uri':url.pathname,
                        'reqData':(reqData == '' ?
                            undefined :
                            eval('('+reqData+')')),
                        'uriData':url['query'],
                        'respIndex':responses.push(resp)-1});
            });
    }
    else {
        workers[url['query']['wid']].send(
            {
                'method': req.method,
                'uri': url.pathname,
                'uriData': url['query'],
                'respIndex': responses.push(resp) - 1
            });
    }
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
    handle_http_message,
    send_to_all,
}