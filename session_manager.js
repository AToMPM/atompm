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
const {jsons} = require("./utils");

/* an array of WebWorkers
	... each has its own mmmk instance */
let workers = [];

/* an array of response objects
  ...	for workers to write on when they complete requests */
let responses = [];

/* a map of client IDs to their worker wids */
let clientIDs2csids = {};
let clientIDs2asids = {};

/* a map of socket IDs to the client/worker IDs who are listening
   this is to aid debugging
 */
let socketIds2Ids = {};

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
    let s = "socketio <br/>" + statusCode;
    if (reason != undefined) s += " " + reason;

    let id = socketIds2Ids[socket.id];
    let to = "client";
    if (id != undefined && id.includes("worker")) to = id;
    s += "<br/>" + " to : "+id;
    if (data != undefined && data['changelog'] == undefined) s += "<br/>" + jsons(data);
    logger.http( s,{'from':"session_mngr", "to": to});

    socket.emit('message',
        {'statusCode':statusCode,
            'reason':reason,
            'headers':(headers || {'Content-Type': 'text/plain'}),
            'data':data});
}

function init_session_manager(httpserver){

    function allow_request(req, callback){
        callback(null, true);
    }
    socket_server = new _sio.Server(httpserver,
        {
            "allowRequest": allow_request,
            "cors": {
                origin: "*",
            }
        }
        );

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

                        // TODO: Delete worker from clientIDs2csids
                    }

                    __send(socket,200);
                }
            }


            /* onmessage : on reception of data from client or csworker*/
            socket.on('message',
                function(msg/*{method:_,url:_}*/)
                {
                    let url = _url.parse(msg.url,true);

                    let loc = {'at':"session_mngr"};
                    if (url['query'] != undefined && url['query']['id'] != undefined && url['query']['id'].includes("worker")){
                        loc = {'from':url['query']['id'],'to':"session_mngr"};
                    }

                    logger.http("socketio _ 'message' <br/>" + msg.method + " " + JSON.stringify(url['query']) + "<br/>" + url.pathname,loc);

                    /* the client asks to create a new session or join a session */
                    /* the session manager then has a map from client ID to the worker ID */
                    if (msg.method == 'POST' && (url.pathname.match(/createSession/)) || url.pathname.match(/joinSession/)) {

                        let cid = url['query']['cid'];

                        if (cid == undefined) {
                            logger.http("socketio <br/> 400 : invalid client id"+ url['query']['cid'] ,{'from':"session_mngr", 'to':'client'});
                            __send(socket, 400, 'invalid client id :: ' + url['query']['cid']);
                            return;
                        }

                        // determine whether to create or join a session
                        // and whether to do screenshare or modelshare
                        let existingcwid = url['query']['cswid'];
                        let existingawid = url['query']['aswid'];

                        let isScreenshare = existingcwid != undefined && existingawid == undefined;
                        let isModelshare = existingcwid != undefined && existingawid != undefined;

                        let cwid = undefined;
                        let awid = undefined;

                        // normal case, not sharing
                        if (!isScreenshare && !isModelshare){
                            // create a new csworker and asworker
                            cwid = __createNewWorker('/csworker');
                            awid = __createNewWorker('/asworker');

                            // set up client-csworker comms
                            __registerListener(cwid, socket.id, cid);
                            clientIDs2csids[cid] = [cwid];
                            clientIDs2asids[cid] = awid;

                            // set up the csworker listening to the asworker
                            let params = {'aswid': awid};
                            workers[cwid].send(
                                {
                                    'method': 'PUT',
                                    'uri': '/aswSubscription',
                                    'reqData': params
                                });
                        }else if (isScreenshare){
                            // no workers created

                            // set up client-csworker comms
                            __registerListener(existingcwid, socket.id, cid);
                            clientIDs2csids[cid] = [existingcwid];
                            clientIDs2asids[cid] = existingawid;

                            cwid = existingcwid;

                        } else if (isModelshare){
                            // create a new csworker
                            cwid = __createNewWorker('/csworker');

                            // set up client-csworker comms
                            __registerListener(cwid, socket.id, cid);
                            clientIDs2csids[cid] = [cwid];
                            clientIDs2asids[cid] = existingawid;

                            /* TODO: Has to be done by the client in init.js
                               to avoid a race condition with the client
                               asking for csworker state too early
                            */
                            // set up the csworker listening to the asworker
                            // clones the existing csworker
                            // let params = {'aswid': existingawid, 'cswid': existingcwid};
                            // workers[cwid].send(
                            //     {
                            //         'method': 'PUT',
                            //         'uri': '/aswSubscription',
                            //         'reqData': params
                            //     });

                            awid = existingawid;
                        }

                        /* respond worker id (used to identify associated workers) */
                        __send(socket, 201, undefined, {'wid': cwid, 'awid': awid});

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
                        let id = undefined;
                        if (url['query'] != undefined && url['query']['id'] != undefined) id = url['query']['id'];

                        if (__registerListener(wid, socket.id, id)){
                            __send(socket,201);
                        }else{
                            __send(socket,403,'already registered to worker');
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

function __registerListener(wid, socketID, id){
    logger.http("Socket for " + id + " now listening to worker " + wid, {'at': 'session_mngr'});

    socketIds2Ids[socketID] = id;

    if (workerIds2socketIds[wid] == undefined){
        workerIds2socketIds[wid] = [];
    }

    if( workerIds2socketIds[wid].indexOf(socketID) > -1 ) {
        return false;
    }else{
        workerIds2socketIds[wid].push(socketID);
        return true;
    }
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
        return;
    }
    // build and return urls for screenshare and modelshare
    else if (url.pathname.includes('/collabReq')) {
        
        if (url['query'] == undefined || url['query']['cid'] == undefined){
            _utils.respond(resp, 400, 'missing client ID for collab');
            return;
        }
        if (url['query'] == undefined || url['query']['user'] == undefined){
            _utils.respond(resp, 400, 'missing host for collab');
            return;
        }
        if (url['query'] == undefined || url['query']['address'] == undefined){
            _utils.respond(resp, 400, 'missing address for collab');
            return;
        }
        let cid = url['query']['cid'];
        let host = url['query']['user'];
        let address = url['query']['address'];

        let cswid = clientIDs2csids[cid][0];
        let aswid = clientIDs2asids[cid];

        let screenShareURL = address + "?host=" + host + "&cswid=" + cswid;
        let modelShareURL = screenShareURL + "&aswid=" + aswid;

        let params = {'screenShare': screenShareURL, "modelShare": modelShareURL};
        _utils.respond(
            resp,
            201,
            '',
            params);

        return;
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
        return;
    }

    if (url['query'] == undefined){
        _utils.respond(resp, 400, 'invalid query: ' + url);
        return;
    }

    let wids = undefined;

    // first, try to get the wid(s) from the client id
    // this is developed so that clients can talk to multiple cs workers if needed
    if (url['query']['cid'] != undefined && url['query']['swid'] == undefined ){
        wids = clientIDs2csids[url['query']['cid']];
    }

    // if the mapping wasn't possible, check if the message contains the wid
    // this is normal in the case for a HTTP message from a CSWorker
    if (wids == undefined && url['query']['wid'] != undefined){
        wids = [parseInt(url['query']['wid'])];
    }

    /* check for worker id and it's validity */
    if (wids == undefined) {
        _utils.respond(resp, 400, 'missing worker id');
        return;
    }

    for (let wid of wids) {
        if (workers[wid] == undefined)
            _utils.respond(resp, 400, 'wid ' + wid + ' not found in workers: ' + workers);
    }

    /* save resp object and forward request to worker(s) (if request is PUT or
          POST, recover request data first) */
    // again, in the future, requests might need to be directed to multiple workers
    if (req.method == 'PUT' || req.method == 'POST') {
        let reqData = '';
        req.addListener("data", function (chunk) {
            reqData += chunk;
        });
        req.addListener("end",
            function () {
                for (let wid of wids) {
                    workers[wid].send(
                        {
                            'method': req.method,
                            'uri': url.pathname,
                            'reqData': (reqData == '' ?
                                undefined :
                                eval('(' + reqData + ')')),
                            'uriData': url['query'],
                            'respIndex': responses.push(resp) - 1,
                            'cid': url['query']['cid'],
                        });
                }
            });
    } else {
        for (let wid of wids) {
            workers[wid].send(
                {
                    'method': req.method,
                    'uri': url.pathname,
                    'uriData': url['query'],
                    'respIndex': responses.push(resp) - 1,
                    'cid': url['query']['cid'],
                });
        }
    }
}


function send_to_all(wid, msg){
    let _msg = {
        'changelog':msg['changelog'],
        'sequence#':msg['sequence#'],
        'hitchhiker':msg['hitchhiker'],
        'cid':msg['cid']
    };

    // simplify the msg for logging
    let log_data = {'cid':msg['cid'], 'hitchhiker':_utils.collapse_hitchhiker(msg['hitchhiker'])};
    let s = "socketio sending chglg <br/>" + JSON.stringify(log_data) + "<br/>";
    for (let ch of _utils.collapse_changelog(msg["changelog"])){
        s += jsons(ch) + "<br/>";
    }
    logger.http(s,{'at': workerIds2workerType[wid] + wid});

    workerIds2socketIds[wid].forEach(
        function(sid)
        {
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
}