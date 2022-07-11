/* This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
*  Copyright 2011 by the AToMPM team and licensed under the LGPL
*  See COPYING.lesser and README.md in the root of this project for full details
*/

//TODO: shred initClient()
/* initialize client 

  PART 1: setup connection to backend
  0. extract GET parameters, if any, from URL
  1. setup socket and its event handlers (to handle changelogs etc.), then 
  	  connect socket
  2. on socket connection, 
	  a) if no GET params or if modelshare params, 
		  i.  spawn new csworker
		  ii. on spawn, subscribe to new csworker changes
	  a) otherwise (screenshare), subscribe to specified csworker changes
  3. on reception of socket messages,
	  a) if message has a status code (i.e., response to csworker subscription)
		  i.   load mainmenu button model
			 * CASE 1: no GET params *
		 ii.  spawn and subscribe to new asworker
		 iii. get user preferences and autoload toolbars and model, if any
		 iv.  enable collaboration links
		 v.	launch autosave daemon
			 * CASE 2: modelshare *
		 ii.  clone state of given csworker and subscribe to given asworker
		 iii. update client state based on our csworker's updated state
		 iv.  enable collaboration links
		 v.	launch autosave daemon
			 * CASE 3: screenshare *
		 ii.  retrieve state of given csworker
		 iii. update client state based on our csworker's updated state
		 iv.  enable collaboration links
		 v.	launch autosave daemon
	 a) otherwise, handle changelog


  PART 2: setup frontend
  1. setup various GUI details and behaviour statecharts
  2. setup exit prompt */
function __initClient()
{
	/** PART 1 **/
	let params = {};
	window.location.search.substring(1).split('&').forEach(
		function(arg)
		{	
			let _arg = arg.split('=');
			params[_arg[0]] = _arg[1];
		});

    let socket = io(
        {
            // 'port':8124,
            'reconnect': false,
            'timeout': 200000
        });

    socket.on('connect',
        function () {

			// request a client ID from the session manager
			if (__clientID == undefined) {
				HttpUtils.httpReq(
					'POST',
					HttpUtils.url('/newCID', __NO_WID + __NO_USERNAME),
					undefined,
					function (statusCode, resp) {
						if (!utils.isHttpSuccessCode(statusCode))
							WindowManagement.openDialog(__FATAL_ERROR, 'could not get client ID: error ' + statusCode);
						else{
							// set the clientID
							__clientID = resp;

							// set up the session
							// when the client ID is known
							askForSession(socket, params);
						}
					});
			}
			else {
				askForSession(socket, params);
			}

		});

	socket.on('message',
		function (msg) {
			console.debug(' >> ' + utils.jsons(msg));

			// handle a changelog
			if (msg['statusCode'] == undefined) {
				__handleChangelog(
					msg['data']['changelog'],
					msg['data']['sequence#'],
					msg['data']['hitchhiker'],
					msg['data']['cid']
				);
				return;
			}

			// otherwise, this is the response to creating a session
			if (msg['statusCode'] != 201) {
				WindowManagement.openDialog(__FATAL_ERROR, 'failed to connect to back-end');
				return;
			}

			_loadToolbar(__MAINMENU_PATH);

			//store the csworker id
			__wid = msg['data']['wid'];
			__aswid = msg['data']['awid'];

			if (window.location.search == '') {
				_getUserPreferences(
					function (prefs) {
						__prefs = prefs;
						prefs['autoloaded-toolbars']['value'].forEach(_loadToolbar);
						if (prefs['autoloaded-model']['value'] != '')
							_loadModel(prefs['autoloaded-model']['value']);

						// Collaboration.enableCollaborationLinks();
						__launchAutosave();
					});
			}

			// set up modelshare
			else if ('aswid' in params && 'cswid' in params) {
				__user = params['host'];
				HttpUtils.httpReq(
					'PUT',
					'/aswSubscription?wid=' + __wid,
					{
						'aswid': params['aswid'],
						'cswid': params['cswid']
					},
					function (statusCode, resp) {
						resp = utils.jsonp(resp);
						__handleState(resp['data'], resp['sequence#']);

						_getUserPreferences(
							function (prefs) {
								__prefs = prefs;
								// Collaboration.enableCollaborationLinks();
								__launchAutosave();
							});
					});
			}

			else {
				__user = params['host'];
				HttpUtils.httpReq(
					'GET',
					'/current.state?wid=' + __wid,
					undefined,
					function (statusCode, resp) {
						resp = utils.jsonp(resp);
						__handleState(resp['data'], resp['sequence#']);

						_getUserPreferences(
							function (prefs) {
								__prefs = prefs;
								// Collaboration.enableCollaborationLinks();
								__launchAutosave();
							});
					});
			}
		});

	socket.on('disconnect', 
		function()
		{  
			WindowManagement.openDialog(__FATAL_ERROR, 'lost connection to back-end');
		});


		

	/** PART 2 **/
	$('#a_logout').title = 'logout '+__user;
	__canvas = Raphael(GUIUtils.$$('div_canvas'),__CANVAS_SIZE,__CANVAS_SIZE);
	__canvas.canvas.setAttribute('vector-effect','non-scaling-stroke');
	__canvas.canvas.setAttribute('xmlns:xlink','http://www.w3.org/1999/xlink');
	BehaviorManager.setActiveBehaviourStatechart(__SC_DIALOG,true);
	BehaviorManager.setActiveBehaviourStatechart(__SC_CANVAS,true);
	WindowManagement.setWindowTitle();
		
	window.onbeforeunload = 
		/* prompt on non-logout exit */
		function(ev) 
		{
			if( __user == undefined )
				return;

			else if( __prefs['confirm-exit']['value'] && ! __isSaved() )
				return __EXITWARNING;
		};
	

}

function askForSession(socket, params) {
	if (params != undefined && params['cswid'] != undefined) {
		let param_str = "?cid=" + __clientID;
		param_str += (params['host'] == undefined) ? "" : "&host=" + params['host']
		param_str += (params['aswid'] == undefined) ? "" : "&aswid=" + params['aswid']
		param_str += (params['cswid'] == undefined) ? "" : "&cswid=" + params['cswid']
		socket.emit('message', {'method': 'POST', 'url': '/joinSession' + param_str});
	} else {
		socket.emit(
			'message',
			{'method': 'POST', 'url': '/createSession?cid=' + __clientID});
	}
}