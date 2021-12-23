/* This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
*  Copyright 2011 by the AToMPM team and licensed under the LGPL
*  See COPYING.lesser and README.md in the root of this project for full details
*/

/*********************************** IMPORTS **********************************/
const _cp = require('child_process'),
	_fs = require('fs'),
	_http = require('http'),
	_path = require('path'),
	_sio = require('socket.io'),
	_url = require('url'),
	_duri = require('./___dataurize'),
	_fspp = require('./___fs++'),
	logger = require('./logger'),
	_utils = require('./utils');

logger.set_level(logger.LOG_LEVELS.HTTP);

/*********************************** GLOBALS **********************************/
/* an array of WebWorkers
	... each has its own mmmk instance */
var workers = new Array();			

/* an array of response objects
  ...	for workers to write on when they complete requests */
var responses = new Array();		

/* a map of worker ids to socket.io socket session ids
	... each socket is registered to exactly one worker 
 	... several sockets may be registered to the same worker */
var workerIds2socketIds = {};			

/* a map of worker ids to the type of worker
 * used for logging
 */
let workerIds2workerType = {};

/************************************ UTILS ***********************************/

/** Remove invalid characters from a string. **/
function __clean_string(s)
{
	if (s == undefined) {
        return s;
    }

	s = JSON.stringify(s);
	s = s.replace(/'/g, '');
	s = s.replace(/"/g, '');
	s = s.replace(/‘/g, '');
	s = s.replace(/’/g, '');
	s = s.replace(/\\/g, '\\');
	s = s.replace(/\//g, '\/');
	s = s.replace(/\\n/g, ' ');
	return s;
}

/** Syntactic sugar to build and send HTTP responses **/
function __respond(response, statusCode, reason, data, headers)
{
	response.writeHead(
			statusCode,
			__clean_string(reason),
			(headers || {'Content-Type': 'text/plain',
			'Access-Control-Allow-Origin': '*'}));

	var encoding = 
		(headers && 
		 	(headers['Content-Type'].match(/image/) ||
			 headers['Content-Type'].match(/pdf/) 	 ||
			 headers['Content-Type'].match(/zip/) 	 ) ? 
			 	'binary' :
				'utf8'),
		 content = reason || data;

	if( _utils.isObject(content) )
		response.end(_utils.jsons(content,null,'\t'), encoding);
	else
		response.end(content, encoding);

	logger.http("socketio _ 'respond' <br/>" + statusCode,{'from':"server",'to':"client"});
}


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

	// detect the worker id for logging
	let worker_id = -1;
	for( let wid in workerIds2socketIds ) {
		for (let socket_id of workerIds2socketIds[wid]) {
			if (socket_id === socket.id) {
				worker_id = wid;
			}
		}
	}
	logger.http("socketio _ 'message' <br/>" + log_statusCode + log_headers + JSON.stringify(log_data) ,{'from':"server",'to':workerIds2workerType[worker_id] + worker_id});

	socket.emit('message',
			{'statusCode':statusCode,
			 'reason':reason,
			 'headers':(headers || {'Content-Type': 'text/plain'}),
			 'data':data});
}


/************************************ LOGIC ***********************************/
var httpserver = _http.createServer( 
		function(req, resp) 
		{
			var url = _url.parse(req.url,true);
			url.pathname = decodeURI(url.pathname);

			logger.http("http <br/>" + req.method + "<br/>" + url.path ,{'from':"client",'to':"server",'type':"-)"});

			/* serve client */
			if( req.method == 'GET' && url.pathname == '/atompm' )
				_fs.readFile('./client/atompm.html', 'utf8',
					function(err, data)
					{
						if(err) 
							__respond(resp,500,String(err));
						else
							__respond(resp,200,'',data,{'Content-Type': 'text/html'});
					});
                    
			else if( req.method == 'GET' && url.pathname == '/favicon.png' )
				_fs.readFile('./favicon.png', 'binary',
					function(err, data)
					{
						if(err) 
							__respond(resp,500,String(err));
						else
							__respond(resp,200,'',data,{'Content-Type': 'image/png'});
					});



			/* provide an interface to the unfortunately unavoidable dataurize 
				module which returns data URIs for resources at arbitrary URLs */
			else if( req.method == 'GET' && url.pathname == '/datauri' )
			{
				var target = _url.parse(decodeURI(url['query']['target']));
				_duri.dataurize(
					target,
					function(err,datauri)
					{
						if(err) 
							__respond(resp,500,_utils.jsons(err));
						else
							__respond(resp,200,'',datauri);
					});
			}



			/* serve metamodels, buttons models and their icons */
			else if( req.method == 'GET' && 
				 (url.pathname.match(/\.metamodel$/) ||
				  url.pathname.match(/\.buttons.model$/) ||
				  url.pathname.match(/\.icon\.png$/i)) )
			{
				var isIcon = url.pathname.match(/\.icon\.png$/i);
				_fs.readFile('./users/'+url.pathname, (isIcon ? 'binary' : 'utf8'), 
					function(err, data)
					{
						if(err) 
							__respond(resp,500,String(err));
						else
						{
							var contentType = 
									(isIcon ? 
										{'Content-Type': 'image/png'} : 
										{'Content-Type': 'application/json'});
							__respond(resp,200,'',data,contentType);
						}
					});
	  		}



			/* serve ordinary files (e.g., js includes, images, css) 

				NOTE:: distinguish between atompm images (e.g., grid background,
						 filebrowser icons) and CS/Images */
			else if( req.method == 'GET' && 
					   (url.pathname.match(/\.html$/)  || 
						 url.pathname.match(/\.css$/)   || 
	  					 url.pathname.match(/\.js$/)	  ||
	  					 url.pathname.match(/\.pdf$/)   ||
					 	 url.pathname.match(/\.png$/i)  ||
						 url.pathname.match(/\.jpg$/i)  ||
						 url.pathname.match(/\.jpeg$/i) ||
						 url.pathname.match(/\.gif$/i)  ||
						 url.pathname.match(/\.svg$/i)) )
			{
				var isImage = url.pathname.match(/\.png$/i) ||
								  url.pathname.match(/\.jpg$/i) ||
								  url.pathname.match(/\.jpeg$/i) ||
		 						  url.pathname.match(/\.gif$/i) ||
		 						  url.pathname.match(/\.svg$/i),
					isText 	= ! isImage && ! url.pathname.match(/\.pdf$/);

				if( isImage && ! url.pathname.match(/^\/client\/media\//) )
					url.pathname = '/users/'+url.pathname;

				_fs.readFile('.'+url.pathname, (isText ? 'utf8' : 'binary'),
					function(err, data)
					{
						if(err) 
							__respond(resp,500,String(err));
						else
						{
							var contentType = 
								(url.pathname.match(/\.html$/) ? 
									 {'Content-Type': 'text/html'} :
								 url.pathname.match(/\.css$/) ? 
									 {'Content-Type': 'text/css'} :
								 url.pathname.match(/\.js$/) ? 
									 {'Content-Type': 'application/javascript'} :
								 url.pathname.match(/\.pdf$/) ? 
									 {'Content-Type': 'application/pdf'} :
								 url.pathname.match(/\.png$/i) ? 
									 {'Content-Type': 'image/png'} :
								 url.pathname.match(/\.jpg$/i) || 
								 	url.pathname.match(/\.jpeg$/i) ? 
									 {'Content-Type': 'image/jpeg'} :
								 url.pathname.match(/\.gif$/i) ? 
									 {'Content-Type': 'image/gif'} :
								 url.pathname.match(/\.svg$/i) ? 
									 {'Content-Type': 'image/svg+xml'} :
								 undefined);
							__respond(resp,200,'',data,contentType);
						}
					});
	  		}



			/* serve encrypted user password */
			else if( req.method == 'GET' && url.pathname == '/passwd' )
				_fs.readFile('./users/'+url['query']['username']+'/passwd', 'utf8',
					function(err, data)
					{
						if(err) 
							__respond(resp,500,String(err));
						else
							__respond(resp,200,'',data,{'Content-Type': 'text/html'});
					});


			/* create new user 
			 	1. make sure user doesn't already exist
			 	2. make a new copy of ./users/(default) 
			 	3. create password file */
			else if( req.method == 'POST' && url.pathname == '/user' )
			{
				var userdir = './users/'+url['query']['username'];
				_fs.exists(userdir,
					function(exists)
					{
						if( exists )
						{
							__respond(resp,500,'username already exists');
							return;
						}

						_fspp.cp('./users/(default)/',userdir,
							function(err, stdout, stderr)
							{
								if( err )
								{
									__respond(resp,500,String(err));
									return;
								}
									
								_fs.writeFile(
									userdir+'/passwd',
									url['query']['password'],
									function(err)
									{
										if( err )
											__respond(resp,500,String(err));
										else
											__respond(resp,200);
									});			
							});
					});
			}



			/* serve [a subset of] user preferences */
			else if( req.method == 'GET' && url.pathname.match(/prefs$/) )
				_fs.readFile('./users/'+url.pathname, 'utf8',
					function(err, data)
					{
						if(err) 
							__respond(resp,500,String(err));
						else if( url['query']['subset'] == undefined )
							__respond(resp,200,'',data);
						else
							try 			
							{	
								__respond(
									resp,
									200,
									'',
									_utils.splitDict(
										_utils.jsonp(data),
										_utils.jsonp(url['query']['subset'])));
							}
							catch(err)	{__respond(resp,500,String(err));}
					});


			/* update user preferences

				1 retrieve all post data
				2 read prefs file from disk
				3 apply changes 
			 	4 write updated prefs to disk */
			else if( req.method == 'PUT' && url.pathname.match(/prefs$/) )
			{
				var reqData = '';
				req.addListener("data", function(chunk) {reqData += chunk;});
				req.addListener("end", 
					function() 
					{
						_fs.readFile('./users/'+url.pathname, 'utf8',
							function(err, prefs)
							{
								if(err) 
									__respond(resp,500,String(err));
								else
								{
									try 			
									{	
										prefs   = _utils.jsonp(prefs);
										reqData = _utils.jsonp(reqData);
									}
									catch(err)	
									{
										__respond(resp,500,String(err));
										return;
									}

									for( var pref in reqData )
										prefs[pref]['value'] = reqData[pref];

									_fs.writeFile(
										'./users/'+url.pathname, 
										_utils.jsons(prefs,null,'\t'),
										function(err, data)
										{
											if(err) 
												__respond(resp,500,String(err));
											else
												__respond(resp,200);
										});
								}	
							});
					});
			}



			/*	delete specified file/folder */	
			else if( req.method == 'DELETE' && url.pathname.match(/\.(file|folder)$/) )
			{
                if (url.pathname.match('_Trash_')) {
                    __respond(resp,500,"cannot remove trash!");
                } else {
                    var matches  = url.pathname.match(/^\/(.*?)\/(.*\/)?(.*)\.(file|folder)$/),
                         username = matches[1],
                         folder = matches[2] || '',
                         fname 	 = matches[3],
                         userdir	 = './users/'+username+'/',
                         ondelete = 
                             function(err, stdout, stderr)
                             {
                                 if( err )
                                     __respond(resp,500,String(err));
                                 else
                                     __respond(resp,200);
                             },
                         deletef  = 
                             function(response)
                             {
                                 var newname = userdir+'_Trash_/'+folder+fname;
                                 if (_fs.existsSync(newname)) {
                                     if (url.pathname.match(/\.folder$/)) {
                                         _fspp.deleteFolderRecursive(newname);
                                     } else {
                                         _fs.unlink(newname);
                                     }
                                 }
                                 _fspp.mv(userdir+folder+fname,userdir+'_Trash_/'+folder,ondelete);
                             };
                    _fs.exists(userdir+'_Trash_/'+folder,
                        function(exists)
                        {
                            if( ! exists )
                                _fspp.mkdirs(userdir+'_Trash_/'+folder,deletef);
                            else {
                                deletef();
                            }
                        });
                }
			}



			/*	create folder */	
			else if( req.method == 'POST' && url.pathname.match(/\.folder$/) )
			{
				var matches  = url.pathname.match(/^\/(.*?)\/(.*)\.folder$/),
					 username = matches[1],
                     folder = matches[2],
					 userdir	 = './users/'+username+'/',
					 oncreate = 
						 function(err, stdout, stderr)
						 {
							 if( err )
								 __respond(resp,500,String(err));
							 else
								 __respond(resp,200);
						 };
				_fs.exists(userdir+folder,
					function(exists)
					{
						if( ! exists )
							_fspp.mkdirs(userdir+folder,oncreate);
                        else {
                            oncreate("folder " + folder + " already exists");
                        }
					});
			}



			/*	rename file/folder (or move) */	
			else if( req.method == 'PUT' && url.pathname.match(/\.(folder|file)$/) )
			{                
                req.setEncoding('utf8');
				var data = '';
				req.addListener("data", function(chunk) {data += chunk;});
				req.addListener("end", 
                    function() {
                        data = _utils.jsonp(data);
                        if (data.match(/^\//)) {
                            // move
                            var matches  = url.pathname.match(/^\/(.*?)\/(.*\/)?(.*)\.(file|folder)$/),
                                username = matches[1],
                                folder = matches[2] || '',
                                fname 	 = matches[3],
                                userdir	 = './users/'+username,
                                onmove = 
                                     function(err, stdout, stderr)
                                     {
                                         if( err )
                                             __respond(resp,500,String(err));
                                         else
                                             __respond(resp,200);
                                     };
                                if (_fs.existsSync(userdir+data+fname)) {
                                    if (url.pathname.match(/\.folder$/)) {
                                         _fspp.deleteFolderRecursive(userdir+data+fname);
                                     } else {
                                         _fs.unlink(newname);
                                     }
                                }
                            _fspp.mv(userdir+"/"+folder+fname,userdir+data,onmove);
                        } else {
                            // rename
                            var matches  = url.pathname.match(/^\/(.*?)\/(.*\/)?(.*)\.(file|folder)$/),
                                username = matches[1],
                                folder = matches[2] || '',
                                fname 	 = matches[3],
                                userdir	 = './users/'+username+'/',
                                onrename = 
                                     function(err, stdout, stderr)
                                     {
                                         if( err )
                                             __respond(resp,500,String(err));
                                         else
                                             __respond(resp,200);
                                     };
                            _fs.rename(userdir+folder+fname,userdir+folder+data,onrename);
                        }
                    }
                );
				
			}
            
            else if (req.method == 'POST' && url.pathname.match(/\.formalism$/)) {
                // create new formalism
                var matches = url.pathname.match(/^(.*)\/(.*)\.formalism$/),
                    username = matches[1],
                    formalism = matches[2],
                    userdir	 = './users/'+username+"/",
                    oncreatefolder = 
                         function(err, stdout, stderr)
                         {
                             if( err )
                                 __respond(resp,500,String(err));
                             else {
                                 _fs.createReadStream(userdir+"Formalisms/__Templates__/MetamodelTemplate.model").pipe(_fs.createWriteStream(userdir+"Formalisms/"+formalism+"/"+formalism+".model"));
                                 _fs.createReadStream(userdir+"Formalisms/__Templates__/ConcreteSyntaxTemplate.model").pipe(_fs.createWriteStream(userdir+"Formalisms/"+formalism+"/"+formalism+".defaultIcons.model"));
                                 _fs.createReadStream(userdir+"Formalisms/__Templates__/MetamodelTemplate.metamodel").pipe(_fs.createWriteStream(userdir+"Formalisms/"+formalism+"/"+formalism+".metamodel"));
                                 _fs.createReadStream(userdir+"Formalisms/__Templates__/ConcreteSyntaxTemplate.defaultIcons.metamodel").pipe(_fs.createWriteStream(userdir+"Formalisms/"+formalism+"/"+formalism+".defaultIcons.metamodel"));
                                 _fs.createReadStream(userdir+"Formalisms/__Templates__/T_TransformationTemplate.model").pipe(_fs.createWriteStream(userdir+"Formalisms/"+formalism+"/OperationalSemantics/T_OperationalSemantics.model"));
                                 _fs.createReadStream(userdir+"Formalisms/__Templates__/T_TransformationTemplate.model").pipe(_fs.createWriteStream(userdir+"Formalisms/"+formalism+"/TranslationalSemantics/T_TranslationalSemantics.model"));
                                 __respond(resp,200);
                             }
                         };
                _fs.mkdir(userdir+"Formalisms/"+formalism,function(err, stdout, stderr) {            
                     if( err )
                         __respond(resp,500,String(err));
                     else {
                         _fs.mkdirSync(userdir+"Formalisms/"+formalism+"/OperationalSemantics");
                         _fs.mkdir(userdir+"Formalisms/"+formalism+"/TranslationalSemantics", oncreatefolder);
                     }
                });
            }
            
            else if (req.method == 'POST' && url.pathname.match(/\.transformation$/)) {
                // create new transformation
                var matches = url.pathname.match(/^\/(.*?)\/(.*)\.transformation$/),
                    username = matches[1],
                    userdir	 = './users/'+username+"/";
                    
                _fs.createReadStream(userdir+"Formalisms/__Templates__/T_TransformationTemplate.model").pipe(_fs.createWriteStream('./users/'+url.pathname.slice(0, -(".transformation".length))));
                __respond(resp,200);
            }
            
            else if (req.method == 'POST' && url.pathname.match(/\.rule$/)) {
                // create new rule
                var matches = url.pathname.match(/^\/(.*?)\/(.*)\.rule$/),
                    username = matches[1],
                    userdir	 = './users/'+username+"/";
                    
                _fs.createReadStream(userdir+"Formalisms/__Templates__/R_RuleTemplate.model").pipe(_fs.createWriteStream('./users/'+url.pathname.slice(0, -(".rule".length))));
                __respond(resp,200);
            }
				
			/* extract user-uploaded archive to specified folder 
				1. read in all data
				2. make sure destination exists and is a directory
				3. write data to temp file (upload###.zip)
				4. extract temp file and remove it
			 
				NOTE:: it's not clear why (despite hours of googling) but the 
						 "req.setEncoding('utf8')" statement makes the difference
						 between retrieving correct and corrupted (when non-text
						 files in zip) data */
			else if( req.method == 'PUT' && url.pathname.match(/\.file$/) )
			{
				req.setEncoding('utf8');

				let reqData = '',
					 tmpzip	= 'upload'+Date.now()+'.zip',
					 destdir	= './users/'+url.pathname.match(/(.*)\.file$/)[1]+'/';

				if( url.pathname.contains("..") || url.pathname.contains(";") ) {
					__respond(resp, 404,
						'invalid pathname, no semicolons or .. allowed :: ' + url.pathname);
					return;
				}

				req.addListener("data", function(chunk) {reqData += chunk;});
				req.addListener("end", 
					function() 
					{
						_fs.stat(destdir,
							function(err,stats)
							{
								if( err )
									__respond(resp,404,String(err));
								else if( ! stats.isDirectory() )
									__respond(resp,404,
										'destination is not a directory :: '+destdir);
								else
									_fs.writeFile(
										destdir+tmpzip,eval('('+reqData+')'),
										'binary',
										function(err)
										{
											_cp.exec('cd '+destdir+'; unzip -o '+tmpzip,
												function(err, stdout, stderr)
												{
													if( err )
														__respond(resp,500,String(err));
													else
														__respond(resp,200);
													_fs.unlink(destdir+tmpzip, function(err){
														console.log("Unlinked " + destdir + tmpzip);
														}
													);
												});
										});
							});
					});
			}

			/* serve specified file/folder within a zip file */ 
			else if( req.method == 'GET' && url.pathname.match(/\.file$/) )
			{
				let matches  = url.pathname.match(/^\/(.*?)\/(.*)\.file$/),
					 username = matches[1],
 					 fname 	 = './'+matches[2],
					 userdir	 = './users/'+username+'/',
					 tmpzip	 = 'download'+Date.now()+'.zip';

				if( username.contains("..") || username.contains(";") ) {
					__respond(resp, 404,
						'invalid username, no colons or .. allowed :: ' + username);
					return;
				}

				_fs.exists(userdir+fname,
					function(exists)
					{
						if( ! exists )
							__respond(resp,404,
								'requested file/folder does not exist :: '+fname);
						else 
							_cp.exec('cd '+userdir+'; zip -r '+tmpzip+' "'+fname+'"',
								function(err, stdout, stderr)
								{
									if( err )
										__respond(resp,500,String(err));
									else
										_fs.readFile(userdir+tmpzip,
											function(err, data)
											{
												__respond(resp,200,'',data,
													{'Content-Type':'application/zip',
													 'Content-Disposition':
													 	'attachment; filename="'+tmpzip+'"'});
												_fs.unlink(userdir+tmpzip, function(err){
													console.log("Unlinked " + userdir+tmpzip);
												});
											});
								});
					});
			}

			/*	serve list of all files */
			else if( req.method == 'GET' && 
						url.pathname.match(/^\/.+\/filelist$/) )
			{
				var matches = url.pathname.match(/^\/(.+)\/filelist$/);
				_fspp.findfiles('./users/'+matches[1], 
						function(err, stdout, stderr)
						{
							if( err )
								__respond(resp,404,String(err));
							else
								__respond(resp,200,'',stdout);
						});
			}



			/* spawn new worker */
			else if( (url.pathname == '/csworker' || url.pathname == '/asworker') 
						&& req.method == 'POST' )
			{
				/* setup and store new worker */
				let worker = _cp.fork(_path.join(__dirname, '__worker.js'));

				let wid = workers.push(worker)-1;

				workerIds2socketIds[wid] = [];
				workerIds2workerType[wid] = url.pathname;

				worker.on('message',
					function(msg) 
					{
						/* push changes (if any) to registered sockets... even empty 
							changelogs are pushed to facilitate sequence number-based
							ordering */
						if( msg['changelog'] !== undefined )
						{
							let _msg = {'changelog':msg['changelog'],
									 	  'sequence#':msg['sequence#'],
										  'hitchhiker':msg['hitchhiker']};

							// simplify the msg for logging
							let log_data = {'changelog':_utils.collapse_changelog(msg["changelog"]), 'hitchhiker':msg['hitchhiker']};

							workerIds2socketIds[wid].forEach(
								function(sid)
								{
									logger.http("socketio _ 'sending message'+ <br/>" + JSON.stringify(log_data) ,{'at': workerIds2workerType[wid] + wid});
									__send(
										wsserver.sockets.sockets.get(sid),
										undefined,
										undefined,
										_msg);
								});
						}

						/* respond to a request */
						if( msg['respIndex'] !== undefined )
							__respond(
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

				let msg = {'workerType':url.pathname, 'workerId':wid};
				logger.http("process _ 'message'+ <br/>" + JSON.stringify(msg),{'from':"server",'to': url.pathname + wid, 'type':"-)"});
				worker.send(msg);

				/* respond worker id (used to identify associated worker) */
				__respond(
					resp, 
					201, 
					'', 
					''+wid);
			}


			/* check for worker id and it's validity */
			else if( url['query'] == undefined || 
						url['query']['wid'] == undefined )
				__respond(resp, 400, 'missing worker id');
			else if( workers[url['query']['wid']] == undefined )
				__respond(resp, 400, 'invalid worker id :: '+url['query']['wid']);

			
			/* save resp object and forward request to worker (if request is PUT or
			  	POST, recover request data first)
			
				TBI:: only registered sockets should be allowed to speak to worker
						... one way of doing this is forcing request urls to contain 
						cid=socket.id## */
			else if( req.method == 'PUT' || req.method == 'POST' )
			{
				var reqData = '';
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
			else
				workers[url['query']['wid']].send(
						{'method':req.method,
						 'uri':url.pathname,
						 'uriData':url['query'],
						 'respIndex':responses.push(resp)-1});
		});

let port = 8124;
httpserver.listen(port);
logger.info("AToMPM listening on port: " + port);
logger.info("```mermaid");
logger.info("sequenceDiagram");

let wsserver = new _sio.Server(httpserver);

wsserver.sockets.on('connection',
	function(socket)
	{
		/* unregister this socket from the specified worker ... when a worker
		  	has no more registered sockets, terminate it */
		function unregister(wid)
		{
			logger.http("socketio _ 'connection'" ,{'at':"server"});
			let i = workerIds2socketIds[wid].indexOf(socket.id);
			if( i === -1 ){
				logger.http("socketio _ 'connection' <br/> 403 already unregistered from worker" ,{'at':"server"});
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

				logger.http("socketio _ 'connection' <br/> 200" ,{'from':"server",'to': "worker" + wid, 'type':"-->>"});
				__send(socket,200);
			}
		}

		
		/* onmessage : on reception of data from worker */
	 	socket.on('message', 
			function(msg/*{method:_,url:_}*/)		
			{		
				let url = _url.parse(msg.url,true);


				/* check for worker id and it's validity */
				if( url['query'] === undefined ||
					 url['query']['wid'] === undefined ){
					logger.http("socketio _ 'message' <br/> 400 'missing worker id'" ,{'at':"server"});
					return __send(socket,400,'missing worker id');
				}

				let wid = url['query']['wid'];

				let from_worker = workerIds2workerType[wid] + wid;
				logger.http("socketio _ 'message' <br/>" + msg.method + " " + JSON.stringify(url['query']) + "<br/>" + url.pathname,{'from':from_worker,'to':"server"});

				if( workers[wid] === undefined ) {
					logger.http("socketio _ 'message' <br/> 400 unknown worker id" ,{'at':"server"});
					__send(socket,400,'unknown worker id :: '+wid);
				}
				/* register socket for requested worker */
				else if( msg.method === 'POST' &&
							url.pathname.match(/changeListener$/) )
				{
					if( workerIds2socketIds[wid].indexOf(socket.id) > -1 ) {
						logger.http("socketio _ 'message' <br/> 403 already registered to worker" + wid,{'at':"server"});
						__send(socket,403,'already registered to worker');
					}else
					{
						//logger.http("socketio _ 'message' <br/> 201 " + url.pathname,{'at':"server"});
						workerIds2socketIds[wid].push(socket.id);
						__send(socket,201);
					}
				}
					
				/* unregister socket for requested worker */				
				else if( msg.method === 'DELETE' &&
							url.pathname.match(/changeListener$/) )
					unregister(wid);

				/* unsupported request */
				else {
					logger.http("socketio _ 'message' <br/> 501 'unsupported request'",{'at':"server"});
					__send(socket,501);
				}
		 	});


		/* ondisconnect : on disconnection of socket */		
		socket.on('disconnect', 
			function()
			{
				logger.http("socketio _ 'disconnect'",{'at':"server"});
				for( let wid in workerIds2socketIds )
					for( let i in workerIds2socketIds[wid] )
						if( workerIds2socketIds[wid][i] === socket.id )
						{
							unregister(wid);
							return;
						}
			});
		});