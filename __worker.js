/* This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
*  Copyright 2011 by the AToMPM team and licensed under the LGPL
*  See COPYING.lesser and README.md in the root of this project for full details
*/

/* NOTES: 
	because of the *asynchronous* nature of numerous operations in our system, 
	brought about by client requests coming to csworkers who asynchronously 
	forward them to asworkers that asynchronously return changelogs to subscribed
  	csworkers who later asynchronously return their own changelogs to subscribed 
	clients, CONCURRENCY CONTROL is needed to ensure weird interleavings of 
	operations and/or responses don't bring the system (either *worker or the
	client) into incoherent or undesirable states... 

	our approach is inspired by TCP and Readers-Writer locks :
		1. 'read' requests increment the number of readers (read requests are
			either GETs or have uris that start with "/GET/")
		2. 'write' requests increment the number of writers
		3. locking read requests also read-lock this *worker (the only such query
			is 'POST /GET/batchRead')
		4. locking write requests also write-lock this *worker (there is currently
			no such query... see *)
		5. before processing incoming requests, onmessage() calls __canProceed()..
			this method succeeds when the current configuration of readers, writers
			and locks allows the incoming query to run immediately... otherwise, 
			(e.g., if there is more than one reader or writer and a write lock is
			needed, or if the request queue is not-empty), this method fails, which
			triggers the queueing of the incoming request for handling asap... this
		  	essentially buys us a big 'synchronize' block around operations that 
			change the state of _mmmk (and its journal), operations which are 
			meant to be atomic...
		6. individual requests that make up batchEdits bypass __canProceed(): 
			these may need to write to a *worker that the initial 'POST /batchEdit'
		  	locked... specifying a valid 'backstagePass' in the uri allows them to
		  	skip over __canProceed()
		7. other than possible delays in query handling, queriers (be they clients
	  		or csworkers) are oblivious to the whole locking scheme... they are not
			expected to ask for locks (these are granted automatically) or to 
			explicitly release them (locks and increments to reader/writer counts 
			produced by a request are appropriately 'adjusted' upon receiving a 
			response to the said request)
		*. although one might think that 'POST /batchEdit' requests would write-
			lock this *worker, they don't... instead, they read-lock this *worker
			and increment the number of writers... this has 2 side-effects 
				a) no one can write to this *worker during a batchEdit
				b) people can still read from this *worker... thus, the 
					'intermediate' state of the system is visible to all
			this is important since effects of batchEdits may include the re-
			evaluation of VisualObject mapping functions... if the asworker were to
		  	reject such reads, the user would need to 'refresh' after each 
			batchEdit to sync up his icons... this all stems from the fact that we
		  	preferred not to 'catch/queue' changelogs emitted by the asworker 
			during batchEdits
	TBI: 
		perhaps the most important point to improve on here is that locking
		queries could be made to lock individual objects (e.g., one or more AS
		node) rather than the entire *worker... this is not necessarily difficult
	  	to implement: before accessing any object for reading or writing in
	  	_mmmk, check if its locked and/or lock it 


	the use of our verbose URIs in HTTP requests is mostly useful for debugging 
	and to enhance the RESTful feel of our HTTP exchanges: in most cases, IDs are
  	sufficient to uniquely identify and refer to nodes, and their associated URIs
  	can easily be computed... this fact, as well as performance concerns (e.g.,
  	minimizing bandwith needs and string matching) is behind our decision not to
	'URIZE' changelogs sent from asworker to csworker, i.e., changelogs refer to 
	nodes by ID rather than by URI... although this is acceptable in the backend,
	referring to nodes by ID in client-bound changelogs is not... thus, before
	sending changelogs to the client, any IDs they may contain are replaced by 
	URIs (via __urizeChangelog())

 
	TBI:
		eventually, it may be possible to entirely strip out the sequence 
		numbering mechanism... this is contingent (at least) on the WebSocket 
		protocol and its implementations guaranteeing that messages are always 
		delivered in order
	  
	
	supporting ATOMIC UNDO/REDO OF BATCHEDITS requires that we keep track of 
	which operations happened as part of the same batchEdit... this can get hairy
	in several cases, e.g., when:
		1. batched requests are individually piped through the csworker to the 
			asworker who thus has no way of knowing it should remember they're 
			batched
		2. certain requests are handled by the csworker while others are forwarded
			to the asworker which prevents any of the workers of really knowing 
			which are the first and last requests in the batchEdit
	to address this, we place easily identifiable user-checkpoints in both the
	asworker and csworker journals at the start and end of any batchEdit via POST
	/batchCheckpoint (in practice, these are handled by asworkers who report
	setting these checkpoints via changelogs such that all subscribed csworkers
	can set them as well)... given that possibly dispersed and/or delocalized
	operations now all reside between identically named user-checkpoints on both
	asworker and csworker, we can undo/redo them atomically on both workers by 
	undoing/redoing everything between the start and end checkpoints... this 
	special undo/redo behavior is implemented in csworker.__undoredo (see its
	comments for details) 
	
	
	it is assumed that csworker, asworker, mmmk and libmt are only ever imported
  	from this file and as such inherit all of its imported libraries */



/**************************** LIBRARIES and GLOBALS ****************************/
var  _util 	= require('util'),
	 _path 	= require('path'),
	 _http 	= require('http'),
	 _do  	= require('./___do'),
	 _fs 	 	= _do.convert(require('fs'), ['readFile', 'writeFile', 'readdir']),
	 _fspp	= _do.convert(require('./___fs++'), ['mkdirs']),	 
	 _siocl	= require('socket.io-client'),
	 _utils	= require('./utils'),
	 _styleinfo = require('./styleinfo'),
	 _svg		= require('./libsvg').SVG,
	 _wlib,
	 _mmmk,
	 _mt,
	 _plugins,
	 __wid,
	 __wtype;
var keepaliveAgent = new _http.Agent({keepAlive: true, maxSockets: 10, maxFreeSockets: 5}); // proposed by yentl to improve performance


/*********************************** UTILS ************************************/
/***************************** BASIC CONTINUABLES *****************************/
/* return a failure continuable */
function __errorContinuable(err)	
{
	return function(callback,errback) {errback(err);}
}

/* return a success continuable */
function __successContinuable(arg)	
{
	return function(callback,errback) {callback(arg);}
}



/******************************* HTTP REQUESTS ********************************/
/* make an HTTP request to 127.0.0.1:port */
function __httpReq(method,url,data,port)
{
	if( port == undefined )
		port = 8124;

	return function(callback,errback)
			 {
				 var options = {'port': port, 'path': url, 'method': method, 'agent': keepaliveAgent}; // agent proposed by yentl to improve performance
				 if( data != undefined )
				 {
					 data = _utils.jsons(data);
					 options['headers'] = {'Content-Length':unescape(encodeURIComponent(data)).length};
				 }

				 var request = 
					 _http.request(options, 
						 function(resp)
						 {
							 var resp_data = '';
							 resp.on('data', 	function(chunk) {resp_data += chunk;});
 							 resp.on('end',
								 function()
								 {
									 if( _utils.isHttpSuccessCode(resp.statusCode) )
										 callback(resp_data);
									 else
										 errback(resp.statusCode+':'+resp_data);
								 });
						 });
				 request.on('error',
						 function(err)
						 {
						 	 errback('HTTP request ('+method+' '+url+':'+port+') '+
								 		'failed on ::\n'+err);
						 });
				 request.end(data);
			 };
}


/* make an http request to a *worker... this is basically just a wrapper than
	takes into account the fact that *workers respond data in respData.data and
	sometimes include sequence numbers in respData.sequence# */
function __wHttpReq(method,url,data,port)
{
	return function(callback,errback)
			 {
				 __httpReq(method,url,data,port)(
	 					 function(respData)
	 					 {
							 respData = eval('('+respData+')');
							 respData = 
								 (respData == undefined || 
								  respData['sequence#'] != undefined ? 
									  respData : 
									  respData.data);
							 callback(respData);
						 },	
	 					 function(respData)	 {errback(respData);}
				 );
			 };
}



/******************************* URI PROCESSING *******************************/
/* optimize __id_to_uri() by remembering computed mappings */
var __ids2uris = {};


/* try to construct a uri from an instance id */
function __id_to_uri(id)
{
	if( id == undefined )
		return undefined;
	else if( id in __ids2uris )
		return __ids2uris[id];
	else if( (res =_mmmk.read(id))['$err'] )
		return res;

	var uri = _utils.jsonp(res)['$type']+'/'+id+'.instance';
	__ids2uris[id] = uri;
	return uri;
}


/* try to extract an instance id from a uri */
function __uri_to_id(uri)
{
	var matches = uri.match(/.*\/(.*).instance/);
	if( matches != null )
		return matches[1];
	return {'$err':'bad instance uri :: '+uri};
}


/* replace ids in the given changelog by corresponding uris... see above NOTES
  	on IDs vs. URIs for more on this 
 
 	NOTE:: when RESETM steps are encountered, we additionaly flush all currently
  			 remembered id-to-uri mappings */
function __urizeChangelog(chlog)
{
	chlog.forEach(
		function(step)
		{	
			if( step['op'] == 'RESETM' )
			{
				__ids2uris = {};
				var newModel = _utils.jsonp(step['new_model']);
				for( var id in newModel.nodes )
				{
					newModel.nodes[__id_to_uri(id)] = newModel.nodes[id];
					delete newModel.nodes[id];
				}	
				step['new_model'] = _utils.jsons(newModel);
			}
			else
				['id','id1','id2'].forEach(
					function(x)
					{
						if( x in step )
							step[x] = __id_to_uri(step[x]);
					});
		});
}



/****************************** POST MESSAGE... *******************************/
/* wrapper for : 400 Bad Request Syntax */
function __postBadReqErrorMsg(respIndex,reason) 
{
	__postErrorMessage(respIndex,400,reason);
}

/* wrapper for all error messages */
function __postErrorMessage(respIndex,statusCode,reason)
{
	__postMessage(
			{'statusCode':statusCode,
			 'reason':reason,
			 'respIndex':respIndex});
}

/* wrapper for : 403 Forbidden */
function __postForbiddenErrorMsg(respIndex,reason) 
{
	__postErrorMessage(respIndex,403,reason);
}

/* wrapper for : 500 Internal Server Error */
function __postInternalErrorMsg(respIndex,reason)
{
	__postErrorMessage(respIndex,500,reason);
}

/* wrapper for all messages */
function __postMessage(msg) 
{
	console.error("w#"+__wid+" << ("+msg.respIndex+") "+msg.statusCode+" "+
			(msg.reason || 
			 (typeof msg.data == 'object' ? 
				  _utils.jsons(msg.data) : 
				  msg.data)));

	if( 'respIndex' in msg )
		__onRequestResponse(msg.respIndex);

	if( __wtype == '/csworker' && 'changelog' in msg )
		__urizeChangelog(msg['changelog']);

	process.send(msg);
}

/* wrapper for : 501 Not Implemented */
function __postUnsupportedErrorMsg(respIndex)
{
	__postErrorMessage(respIndex,501);
}



/********************************** LOCKING ***********************************/
var __wLocked    		  = false,
	 __rLocks 	  		  = 0,
	 __numWriters 		  = 0,
	 __numReaders 		  = 0,
	 __reqs2lockInfo 	  = {},
	 __reqQueue			  = [],
	 __NO_LOCK			  = 0,
	 __LOCK				  = 1,
	 __WLOCK				  = __LOCK | 2,
	 __RLOCK				  = __LOCK | 4;

/* determine whether this worker can proceed with the specified request given 
	its current readers/writers/locks/queue... returns false if the worker can't
	proceed... otherwise, grants needed locks, increments number of readers/
	writers, and returns true

	NOTE:: the 'ignoreQueue' parameter disables queue-emptyness as a condition
			 for this function's success */
function __canProceed(method,uri,respIndex,ignoreQueue)
{
	function __isRead(method,uri)
	{
		/* returns true if request is a read */
		return (method == 'GET' || uri.match(/^\/GET\//));
	}

	function __needsLock(method,uri)
	{
		/* returns lock type needed by request */
		if( method == 'POST' && uri.match(/^batch/) )
			return __RLOCK;
		return __NO_LOCK;
	}


	var isReader  = __isRead(method,uri),
		 needsLock = __needsLock(method,uri);

	/* disallow concurrent writes and queue if queue (see NOTES above) */	
	if( (!isReader && __numWriters > 0) ||
		 (!ignoreQueue && __reqQueue.length > 0) )
		return false;

	/* check current locks */
	if( __wLocked 													|| 
		 (__rLocks > 0			&& !isReader)					||
		 (__numReaders > 0 	&& (needsLock &  __WLOCK)) ||
		 (__numWriters > 0 	&& (needsLock & __LOCK)) 	)
		return false;

	/* access granted... */
	if( needsLock & __RLOCK )			
		__rLocks++;
	else if( needsLock & __WLOCK )	
		__wLocked = true;

	if( isReader )		
		__numReaders++;
	else				
		__numWriters++;

	__reqs2lockInfo[respIndex] = {'isReader':isReader,'needsLock':needsLock};
	return true;
}


/* unlock this *worker (if request had locked it), decrement number of readers/
	writers, and launch queued requests, if any... ignore requests that have no
  	entry in __reqs2lockInfo (i.e., requests with backstage passes) */
function __onRequestResponse(respIndex)
{	
	if( (li = __reqs2lockInfo[respIndex]) == undefined )
		return;

	if( li['needsLock'] & __RLOCK )			
		__rLocks = Math.max(--__rLocks,0);
	else if( li['needsLock'] & __WLOCK )	
		__wLocked = false;

	if( li['isReader'])		
		__numReaders = Math.max(--__numReaders,0);
	else							
		__numWriters = Math.max(--__numWriters,0);

	__runQueuedRequests();
}


/* run proceedable queued requests in FIFO order until a non-proceedable request
 	is encountered... 
	
	NOTE:: this function doesn't wait for request responses, if all queued 
			 responses can run concurrently (e.g., all reads), it will launch them
			 all s.t. they can all be handled in parallel */
function __runQueuedRequests()
{
	if( __reqQueue.length > 0 )
	{
		var head 	  = __reqQueue[0],
			 uri		  = head['uri'],
			 method	  = head['method'],
			 reqData   = head['reqData'],
			 respIndex = head['respIndex'];

		if( __canProceed(method,uri,respIndex,true) )
		{
			__reqQueue.shift();
			__handleClientRequest(uri,method,reqData,respIndex);
			__runQueuedRequests();
		}
	}
}


/* push given request onto request queue for future handling */
function __queueRequest(uri,method,reqData,respIndex)
{
	__reqQueue.push(
			{'uri':uri,
			 'method':method,
			 'reqData':reqData,
			 'respIndex':respIndex});
}



/****************************** SEQUENCE NUMBERS ******************************/
var __nextSequenceNumber = 0;

function __sequenceNumber(inc)
{
	if( inc == undefined || inc == 1 )
		inc = 1;
	else if( inc != 0 )
		throw '__sequenceNumber increment must be 0, 1 or undefined';
	return __wtype+'#'+(__nextSequenceNumber+=inc);
}

function __batchCheckpoint(id,start)
{
	return 'bchkpt@'+id+(start ? '>>' : '<<');
}


process.on('message', 
	function(msg)
	{
		console.error(">> "+JSON.stringify(msg));

		/* parse msg */
		var uri 		  = msg['uri'],
			 method 	  = msg['method'],
			 uriData	  = msg['uriData'],
			 reqData   = msg['reqData'],
			 respIndex = msg['respIndex'];



		/* initial setup */
		if( _wlib == undefined )
		{
			/** enable/disable debugging messages **/			
			console.error = function() {};

			__wtype = msg['workerType'];
			__wid   = msg['workerId'];
			_wlib   = eval('('+_fs.readFileSync('.'+__wtype+'.js', 'utf8')+')');
			_mmmk   = eval('('+_fs.readFileSync('./mmmk.js', 'utf8')+')');
			_mt  	  = eval('('+_fs.readFileSync('./libmt.js', 'utf8')+')');

			_plugins = {};
			_fs.readdirSync('./plugins').forEach(
				function(p)
				{
					try 
					{
						if( ! p.match(/.*\.js$/) )
							throw 'invalid plugin filename, see user\'s manual';

						p = p.match(/(.*)\.js$/)[1];
						_plugins[p] = eval(
							'('+_fs.readFileSync('./plugins/'+p+'.js','utf8')+')');
						if( ! ('interfaces' in _plugins[p]) ||
							 ! ('csworker' in _plugins[p])  ||
							 ! ('asworker' in _plugins[p]) )
							throw 'invalid plugin specification, see user\'s manual';
					}
					catch(err)
					{
						_util.log('failed to load plugin ('+p+') on :: '+err);
					}
				});
			return;
		}


		/* concurrent access control */
		if( uriData != undefined && uriData['backstagePass'] != undefined )
		{
			if( uriData['backstagePass'] != __backstagePass )
				return __postErrorMessage(respIndex,401,'invalid backstage pass');
		}
		else if( ! __canProceed(method,uri,respIndex) )
			return __queueRequest(
							uri,
							method,
							(method == 'GET' ? uriData : reqData),
							respIndex);

		/* handle client requests 
			POST 		<>  create 
			GET		<>  retrieve
			PUT		<>  update
			DELETE	<>  delete */
		__handleClientRequest(
				uri,
				method,
				(method == 'GET' ? uriData : reqData),
				respIndex);	
	});


/* handle a request described by the given parameters */
function __handleClientRequest(uri,method,reqData,respIndex)
{
	/********************** SHARED AS-CS WORKER BEHAVIOR ***********************/
	if( method == 'GET' && uri.match(/^\/current.model$/) )
		GET__current_model(respIndex);

	else if( method == 'GET' && uri.match(/^\/current.state$/) )
		GET__current_state(respIndex);

	else if( method == 'POST' && uri.match(/^\/GET\/batchRead$/) )
		POST_GET_batchread(respIndex,reqData);

	else if( method == 'POST' && uri.match(/^\/batchEdit$/) )
		POST_batchedit(respIndex,reqData);


	/********************* DISTINCT AS-CS WORKER BEHAVIOR **********************/
	else if( (method == 'DELETE'	&& uri.match(/\.metamodel$/))	 				||
  				(method == 'POST' 	&& uri.match(/\.type$/)) 						||
  				(method == 'GET' 		&& uri.match(/\.instance$/)) 					||
  				(method == 'PUT' 		&& uri.match(/\.instance$/)) 					||
  				(method == 'DELETE' 	&& uri.match(/\.instance$/)) 					||
  				(method == 'PUT' 		&& uri.match(/\.instance.cs$/)) 				||
  				(method == 'PUT' 		&& uri.match(/\.vobject$/)) 					||
				(method == 'POST' 	&& uri.match(/^\/GET\/.*\.mappings$/))		||
				(method == 'PUT' 		&& uri.match(/^\/GET\/.*\.metamodel$/))	||
				(method == 'PUT' 		&& uri.match(/^\/GET\/.*\.model$/))			)
	{
		var func = method+' *'+uri.match(/.*(\..*)$/)[1];
		if( _wlib[func] == undefined )
			return __postUnsupportedErrorMsg(respIndex);
		_wlib[func](respIndex,uri,reqData);
	}

	else if( (method == 'GET' 	&& uri.match(/^\/internal.state$/)) 		||
				(method == 'PUT' 	&& uri.match(/^\/aswSubscription$/)) 		||
				(method == 'PUT' 	&& uri.match(/^\/current.metamodels$/))	||
				(method == 'PUT' 	&& uri.match(/^\/current.model$/))	 		||
				(method == 'GET' 	&& uri.match(/^\/validatem$/))		 		||
				(method == 'POST' && uri.match(/^\/undo$/))				 		||
				(method == 'POST' && uri.match(/^\/redo$/))				 		||
				(method == 'PUT'  && uri.match(/^\/GET\/console$/))		 	||
				(method == 'POST' && uri.match(/^\/batchCheckpoint$/))		)
	{
		var func = method+' '+uri;
		if( _wlib[func] == undefined )
			return __postUnsupportedErrorMsg(respIndex);
		_wlib[func](respIndex,uri,reqData);
	}

	else if( uri.match(/^\/__mt\/.*$/) )
		_wlib.mtwRequest(respIndex,method,uri,reqData);

	/* plugin request */
	else if( uri.match(/^\/plugins\/.*$/) )
	{
		var matches = uri.match(/^\/plugins\/(.*?)(\/.*)$/),
			 plugin	= matches[1],
			 requrl	= matches[2],
			 self    = this;

		if( ! (plugin in _plugins) ||
			 ! _plugins[plugin].interfaces.some(
 				 function(ifc)
 				 {
					 if( method == ifc.method &&
						  ('url=' in ifc && ifc['url='] == requrl) ||
 						  ('urlm' in ifc && requrl.match(ifc['urlm'])) )
 					 {
						 _plugins[plugin][__wtype.substring(1)](
 							 respIndex,
							 method,
 							 uri,
							 reqData,
 							 _wlib)
 						 return true;
	 				 }
	 			 }) )
			__postUnsupportedErrorMsg(respIndex);
	}

	/* unsupported request */
	else
		__postUnsupportedErrorMsg(respIndex);
}


/************************ SHARED AS-CS WORKER BEHAVIOR ************************/
/*	returns the current model to the querier
	1. ask _mmmk for a copy of the current model
	2. return said copy to the querier */
function GET__current_model(resp)
{
	if( (res = _mmmk.read())['$err'] )
		__postInternalErrorMsg(resp,res['$err']);
	else
		__postMessage(
			{'statusCode':200,
			 'data':res,
			 'sequence#':__sequenceNumber(0),					 
			 'respIndex':resp});
}

/*	returns the current 'state' of this *worker's _mmmk (i.e., its model,
  	loaded metamodels, current sequence#, and next expected sequence#, if any)
  	to the querier
	1. ask _mmmk for a copy of its model, loaded metamodels and name
	2. return said copies to the querier */
function GET__current_state(resp)
{
	if( (mms = _mmmk.readMetamodels())['$err'] )
		__postInternalErrorMsg(resp,mms['$err']);
	else if( (m = _mmmk.read())['$err'] )
		__postInternalErrorMsg(resp,m['$err']);
	else
		__postMessage(
			{'statusCode':200,
			 'data':{'mms':mms,
						'm':m,
						'name':_mmmk.readName(),
						'asn':_wlib['__nextASWSequenceNumber'],
						'asw':_wlib['__aswid']},
			 'sequence#':__sequenceNumber(0),
			 'respIndex':resp});
}

/*	returns an array containing the results of a number of bundled read
  	requests */
function POST_GET_batchread(resp,reqData)
{
	var actions = [__successContinuable()],
		 results = [];
		
	reqData.forEach(
			function(r)
			{
				actions.push(
					function()		
					{
						return __wHttpReq(r['method'],r['uri']+'?wid='+__wid);
					},
					function(res)
					{
						results.push(res);
						return __successContinuable();
					});
			});

	_do.chain(actions)(
			function()	 	
			{
				__postMessage(
					{'statusCode':200,
					 'data':{'results':results},
					 'sequence#':__sequenceNumber(0),
					 'respIndex':resp});
			},
			function(err)	{__postInternalErrorMsg(resp,err);}
	);
}

/*	returns an array containing the results of a number of bundled edit
  	requests (these results are mostly just statusCodes)... if any of the
 	requests fail, every preceding request is undone (this is facilitated by 
	setting a user-checkpoint before beginning)

	NOTE: requests may refer to the results of previously completed requests
			in their uri and reqData : all occurrences of '$i$' are replaced by 
			the result of request #i 

	NOTE: to enable undoing/redoing batchEdits atomically, easily identifiable 
			user-checkpoints are set before performing any of the batched requests
		  	and after they've all been completed... more on this in NOTES above
 
 	NOTE:	nested batchEdits are not supported */
function POST_batchedit(resp,reqData)
{
	for( var i in reqData )
		if( reqData[i]['method'] == 'POST' && 
			 reqData[i]['uri'].match(/^\/batchEdit$/) )
			return __postBadReqErrorMsg(
				'nested batchEdit requests are not supported');

	var results    = [],
		 currtime   = Date.now(),
		 startchkpt = __batchCheckpoint(currtime,true),
		 endchkpt   = __batchCheckpoint(currtime),
		 setbchkpt  = 
			 function(name)
 			 {
				 return function()
					 	  {
			 				  __backstagePass = Math.random();
			 				  return __wHttpReq(
		 								  'POST',
			 							  '/batchCheckpoint?wid='+__wid+
	  										  '&backstagePass='+__backstagePass,
				 						  {'name':name});
						  }
	 		 },
		 actions = [__successContinuable(), setbchkpt(startchkpt)];

	reqData.forEach(
		function(r)
		{
			actions.push(
				function()		
				{
					__backstagePass = Math.random();
					var replace = function(s,p1) {return results[p1]['data'];},
						 uri 		= r['uri'].replace(/\$(\d+)\$/g,replace);
					if( r['reqData'] != undefined )
						var reqData = 
								_utils.jsonp(
									_utils.jsons(r['reqData']).
										replace(/\$(\d+)\$/g,replace) );
					return __wHttpReq(
									r['method'],
									uri+'?wid='+__wid+
												'&backstagePass='+__backstagePass,
									reqData);
				},
				function(res)
				{
					results.push(res);
					return __successContinuable();
				});
		});
	actions.push(setbchkpt(endchkpt));

	_do.chain(actions)(
			function()	 	
			{
				__backstagePass = undefined;
				__postMessage(
					{'statusCode':200,
					 'data':{'results':results},
					 'sequence#':__sequenceNumber(0),
					 'respIndex':resp});
			},
			function(err) 
			{
				var undoActions = 
					[__successContinuable(),
					 function()		
					 {
						 if( results.length == 0 )
							 return __successContinuable();
 						 return __wHttpReq(
									'POST',
									'/undo?wid='+__wid+'&backstagePass='+__backstagePass,
									{'undoUntil':startchkpt,
									 'hitchhiker':{'undo':startchkpt}});
					 }];
				
				_do.chain(undoActions)(
					function()	
					{
						__backstagePass = undefined;
						__postInternalErrorMsg(resp,err)
					},
					function(undoErr)	
					{	
						__backstagePass = undefined;
						__postInternalErrorMsg(
							resp,
							'unexpected error occured on rollback :: '+undoErr);
					}
				);	
			}
	);
}
