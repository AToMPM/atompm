/*******************************************************************************
AToMPM - A Tool for Multi-Paradigm Modelling

Copyright (c) 2011 Raphael Mannadiar (raphael.mannadiar@mail.mcgill.ca)

This file is part of AToMPM.

AToMPM is free software: you can redistribute it and/or modify it under the
terms of the GNU Lesser General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later 
version.

AToMPM is distributed in the hope that it will be useful, but WITHOUT ANY 
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE.  See the GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License along
with AToMPM.  If not, see <http://www.gnu.org/licenses/>.
*******************************************************************************/

/*********************************** IMPORTS **********************************/
var _util	= require("util"),
	 _fs 		= require('fs'),
	 _http 	= require('http'),
	 _path 	= require('path'),
	 _url 	= require('url'),
	 _utils 	= require('./utils'),
	 _sio 	= require('socket.io'),
	 _cp	 	= require('child_process'),
	 _fspp	= require('./___fs++'),	 	 
	 _duri	= require('./___dataurize');


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



/************************************ UTILS ***********************************/
/** Syntactic sugar to build and send HTTP responses **/
function __respond(response, statusCode, reason, data, headers)
{
	response.writeHead(
			statusCode,
			reason,
			(headers || {'Content-Type': 'text/plain'}));

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
}


/** Syntactic sugar to build and send a socket.io message **/
function __send(socket, statusCode, reason, data, headers)
{
//headers['Access-Control-Allow-Origin'] = 'http://raven10.kicks-ass.net:8080';
	socket.json.emit('message',
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
				_path.exists(userdir,
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



			/** manage cloud data **/
			/*	[permanently] delete specified file/folder */	
			else if( req.method == 'DELETE' && url.pathname.match(/\.file$/) )
			{
				var matches  = url.pathname.match(/^\/(.*?)\/(.*)\.file$/),
					 username = matches[1],
 					 fname 	 = matches[2],
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
						 function()
						 {
							 if( fname.match(/^_Trash_\//) )
								 _fspp.rmdirs(userdir+fname,ondelete);
							 else
								 _fspp.mv(userdir+fname,userdir+'_Trash_/',ondelete);
						 };
				_fs.exists(userdir+'_Trash_/',
					function(exists)
					{
						if( ! exists )
							_fs.mkdir(userdir+'_Trash_/',deletef);
						else
							deletef();
					});
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

				var reqData = '',
					 tmpzip	= 'upload'+Date.now()+'.zip',
					 destdir	= './users/'+url.pathname.match(/(.*)\.file$/)[1]+'/';
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
													_fs.unlink(destdir+tmpzip);
												});
										});
							});
					});
			}

			/* serve specified file/folder within a zip file */ 
			else if( req.method == 'GET' && url.pathname.match(/\.file$/) )
			{
				var matches  = url.pathname.match(/^\/(.*?)\/(.*)\.file$/),
					 username = matches[1],
 					 fname 	 = './'+matches[2],
					 userdir	 = './users/'+username+'/',
					 tmpzip	 = 'download'+Date.now()+'.zip';

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
										_fs.readFile(userdir+tmpzip,'binary',
											function(err, data)
											{
												__respond(resp,200,'',data,
													{'Content-Type':'application/zip',
													 'Content-Disposition':
													 	'attachment; filename="'+tmpzip+'"'});
												_fs.unlink(userdir+tmpzip);
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
				var worker = _cp.fork(_path.join(__dirname, '__worker.js')),
					 wid 	  = workers.push(worker)-1;
				workerIds2socketIds[wid] = [];
				worker.on('message',
					function(msg) 
					{
						/* push changes (if any) to registered sockets... even empty 
							changelogs are pushed to facilitate sequence number-based
							ordering */
						if( msg['changelog'] != undefined )
						{
							var _msg = {'changelog':msg['changelog'],
									 	  'sequence#':msg['sequence#'],
										  'hitchhiker':msg['hitchhiker']};

							workerIds2socketIds[wid].forEach(
								function(sid)
								{
									__send(
										wsserver.sockets.sockets[sid],
										undefined,
										undefined,
										_msg);
								});
						}

						/* respond to a request */
						if( msg['respIndex'] != undefined )
							__respond(
								responses[msg['respIndex']], 
								msg['statusCode'],
								msg['reason'],
								JSON.stringify(
									{'headers':
										(msg['headers'] || 
										 {'Content-Type': 'text/plain'}),
									 'data':msg['data'],
									 'sequence#':msg['sequence#']}),
								{'Content-Type': 'application/json'});
					});
				worker.send(
						{'workerType':url.pathname,
						 'workerId':wid});		

				/* respond worker id (used to identify associated worker) */
				__respond(
					resp, 
					201, 
					'', 
					''+wid);
				return;
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
httpserver.listen(8124);



var wsserver = _sio.listen(httpserver);
wsserver.configure(
	function()
	{
		wsserver.set('log level',2);
	});
wsserver.sockets.on('connection', 
	function(socket)
	{
		/* unregister this socket from the specified worker ... when a worker
		  	has no more registered sockets, terminate it */
		function unregister(wid)
		{
			var i = workerIds2socketIds[wid].indexOf(socket.id)
			if( i == -1 )
				__send(socket,403,'already unregistered from worker');
			else
			{
				workerIds2socketIds[wid].splice(i,1);
				if( workerIds2socketIds[wid].length == 0 )
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
				var url = _url.parse(msg.url,true);

				/* check for worker id and it's validity */
				if( url['query'] == undefined || 
					 url['query']['wid'] == undefined )
					return __send(socket,400,'missing worker id');

				var wid = url['query']['wid'];
				if( workers[wid] == undefined )
					__send(socket,400,'unknown worker id :: '+wid);

				/* register socket for requested worker */
				else if( msg.method == 'POST' && 
							url.pathname.match(/changeListener$/) )
				{
					if( workerIds2socketIds[wid].indexOf(socket.id) > -1 )
						__send(socket,403,'already registered to worker');
					else
					{
						workerIds2socketIds[wid].push(socket.id);
						__send(socket,201);
					}
				}
					
				/* unregister socket for requested worker */				
				else if( msg.method == 'DELETE' && 
							url.pathname.match(/changeListener$/) )
					unregister(wid);

				/* unsupported request */
				else
					__send(socket,501);
		 	});


		/* ondisconnect : on disconnection of socket */		
		socket.on('disconnect', 
			function()
			{
				for( var wid in workerIds2socketIds )
					for( var i in workerIds2socketIds[wid] )
						if( workerIds2socketIds[wid][i] == socket.id )
						{
							unregister(wid);
							return;
						}
			});
		});