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
	var params = {};
	window.location.search.substring(1).split('&').forEach(
		function(arg)
		{	
			var _arg = arg.split('=');
			params[_arg[0]] = _arg[1];
		});

    let socket = io(
        window.location.hostname + ':8124', {
            // 'port':8124,
            'reconnect': false,
            'timeout': 200000
        });

    socket.on('connect',
        function () {

            if (window.location.search == '' ||
                ('aswid' in params && 'cswid' in params))
                HttpUtils.httpReq(
                    'POST',
                    '/csworker',
                    undefined,
                    function (statusCode, resp) {
                        __wid = resp;
                        socket.emit(
                            'message',
                            {'method': 'POST', 'url': '/changeListener?wid=' + __wid});
                    });

            else if ('cswid' in params)
                socket.emit(
                    'message',
                    {'method': 'POST', 'url': '/changeListener?wid=' + params['cswid']});

            else
                WindowManagement.openDialog(__FATAL_ERROR, 'invalid URL parameters ' +
                    utils.jsons(params));
        });

	socket.on('message', 
		function(msg)	
		{
			console.debug(' >> '+utils.jsons(msg));
			if( msg['statusCode'] != undefined )
			{
				if( msg['statusCode'] == 201 )	
				{
					_loadToolbar(__MAINMENU_PATH);
					
					if( window.location.search == '' )
						HttpUtils.httpReq(
							'PUT',
							'/aswSubscription?wid='+__wid,
							undefined,
							function(statusCode,resp)
							{
								console.debug(statusCode);
								console.debug(resp);
								__aswid = utils.jsonp(resp)['data'];

								_getUserPreferences(
									function(prefs)
									{
										console.debug("Get User Preferences in Init.js (96)");
										console.debug(prefs);
										__prefs = prefs;
										prefs['autoloaded-toolbars']['value'].
											forEach(_loadToolbar);
										if( prefs['autoloaded-model']['value'] != '' )
											_loadModel(prefs['autoloaded-model']['value']);

										Collaboration.enableCollaborationLinks();
										__launchAutosave();
									});
						   });
	
					else if( 'aswid' in params && 'cswid' in params )
					{
						__user = params['host'];
						HttpUtils.httpReq(
								'PUT',
								'/aswSubscription?wid='+__wid,
								{'aswid':params['aswid'], 
								 'cswid':params['cswid']},
								 function(statusCode,resp)
								 {
									 resp = utils.jsonp(resp);
									 __handleState(resp['data'],resp['sequence#']);
									 Collaboration.enableCollaborationLinks();
 									 __launchAutosave();
								 });
					}
					
					else
					{															
						__wid  = params['cswid'];
						__user = params['host'];
						HttpUtils.httpReq(
								'GET',
								'/current.state?wid='+params['cswid'],
								undefined,
								function(statusCode,resp)
								{
									resp = utils.jsonp(resp);
									__handleState(resp['data'],resp['sequence#']);
									Collaboration.enableCollaborationLinks();
									__launchAutosave();
								});
					}
				}
				else 
					WindowManagement.openDialog(__FATAL_ERROR, 'failed to connect to back-end');
			}

			else
				__handleChangelog(
						msg['data']['changelog'],
						msg['data']['sequence#'],
						msg['data']['hitchhiker']);
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