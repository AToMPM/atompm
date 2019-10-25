/* This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
*  Copyright 2011 by the AToMPM team and licensed under the LGPL
*  See COPYING.lesser and README.md in the root of this project for full details
*/
const {
    __errorContinuable,
    __httpReq,
    __postInternalErrorMsg, __postMessage,
    __sequenceNumber,
    __successContinuable,
	__uri_to_id
} = require("./__worker");

const _do = require("./___do");
const _utils = require('./utils');
const _mmmk = require("./mmmk");
const _fs = _do.convert(require('fs'), ['readFile', 'writeFile', 'readdir']);


module.exports = {
	/************************** REST REQUEST HANDLING **************************/
	/* INTENT :
			ask our mtworker to do something (e.g., change transformation execution
		  	mode) 
		IN PRACTICE: 
			adjust uri and forward to mtworker
 
	1. setup sync/async action chaining
		a) if this asworker doesn't already have an mtworker 
			i.   create mtworker
			ii.  subscribe it to this asworker
			iii. send it this asworker's current model
		b) ask asworker to forward initial request to its mtworker
	2. launch chain... return success code or error */
	'__mtwid':undefined,
	'mtwRequest' :
		function(resp,method,uri,reqData)
		{
			var self	   = this,
				 actions = 
				 	[__successContinuable(),
	 				 function()
	 				 {
						 uri = uri.substring('/__mt'.length);
	 					 return __httpReq(
								 		method,
										uri+'?wid='+self.__mtwid,
										reqData,
										8125);
	 				 }];

			if( this.__mtwid == undefined )
			{
				if( reqData == undefined || 
					 reqData['transfs'] == undefined ||
					 reqData['transfs'].length == 0 )
					return __postInternalErrorMsg(resp,'missing transformations');
				else if( reqData == undefined || 
  							reqData['username'] == undefined ||
	  						reqData['username'].length == 0 )
					return __postInternalErrorMsg(resp,'missing username');

				actions.splice(1,0,
						function()
						{
							return __httpReq(
								'PUT',
								'/GET/console?wid='+__wid,
								{'text':'please wait while model transformation module'+
										  ' initializes (this may take a few seconds)'});
						},
  						function()
  						{
							return __httpReq('POST','/mtworker',undefined,8125);
	  					},
  						function(mtwid)
  						{
							self.__mtwid = mtwid;
  							return __httpReq(
										'PUT',
  										'/aswSubscription?wid='+self.__mtwid,
  										{'aswid':__wid},
  										8125);
	  					},
						function()
						{
							return _fs.readFile('./users/'+reqData['username']+
															'/prefs','utf8');
						},
  						function(prefs)
  						{
							try 			{prefs = eval('('+prefs+')');}
							catch(err)	{
								return __errorContinuable(
									'an error occurred while reading your preferences '+
									'(you must restart your client before successful '+
									'model transformation module initialization becomes'+
									' possible :: '+err);} 

  							return __httpReq(
										'PUT',
  										'/envvars?wid='+self.__mtwid,
  										{'username':reqData['username'],
										 'defaultDCL':prefs['default-mt-dcl']['value']},
  										8125);
	  					},
  						function()
  						{
							if( (mms = _mmmk.readMetamodels())['$err'] )
								return __errorContinuable(mms['$err']);
	  						else if( (m = _mmmk.read())['$err'] )
								return __errorContinuable(m['$err']);
								
  							return __httpReq(
										'PUT',
  										'/current.model?wid='+self.__mtwid,
										{'mms':mms,
										 'm':m, 
										 'sequence#':__sequenceNumber(0)},
  										8125);
  						},
  						function()
  						{
  							return __httpReq(
										'PUT',
  										'/current.transform?wid='+self.__mtwid,
  										{'transfs':reqData['transfs']},
  										8125);
	  					},
						function()
						{
							return __httpReq(
								'PUT',
								'/GET/console?wid='+__wid,
								{'text':'model tranformation module is ready to go!'});
						}						
				);
			}


            _do.chain(actions)(
                function () {
                    __postMessage({'statusCode': 200, 'respIndex': resp});
                },
                function (err) {
                    if (err.includes("ECONNREFUSED")) {
                        let msg = "could not connect to model transformation worker!\n" +
                            "please ensure the worker is running!";
                        __postInternalErrorMsg(resp, msg);
                    } else {
                        __postInternalErrorMsg(resp, err);
                    }
                }
            );
		},

		
	/* load a metamodel

		1. setup sync/async action chaining
			a) if no hitchhiker containing CSMM information is provided, or if only
				a CSMM name is provided, setup hitchihiker construction/completion 
			b) read specified mm from disk 
		2. launch chain... on success, load requested metamodel into _mmmk and
			return success code and 'hitchhiker' (see notes at top of csworker.js
		  	for more about 'hitchhikers')... on error, return error */ 
	'PUT /current.metamodels' :
		function(resp,uri,reqData/*mm,hitchhiker*/)
		{
			var actions = [__successContinuable()]; 

			if( reqData['hitchhiker'] == undefined ||
				 'path' in reqData['hitchhiker'] )
				actions.push(
					function()
					{
						var ext  = (reqData['mm'].match(/\.pattern\.metamodel$/) ?
											'.pattern.metamodel' :
											'.metamodel'),
							 path = 
							(reqData['hitchhiker'] && 'path' in reqData['hitchhiker'] ?
								reqData['hitchhiker']['path'] :
								reqData['mm'].match(/(.*)\.metamodel/)[1]+
										'.defaultIcons'+ext),
							 name = path.match(/.+?(\/.*)\.metamodel/)[1];

						reqData['hitchhiker'] = {};											
						reqData['hitchhiker']['name'] = name;
  						return _fs.readFile('./users'+path,'utf8');
					},
 					function(csmmData)
 					{
						reqData['hitchhiker']['csmm'] = csmmData;
 						return __successContinuable();
	 				});

			actions.push(
					function()
					{
						return _fs.readFile('./users'+reqData['mm'],'utf8');
					});		

			_do.chain(actions)(
					function(asmmData) 
					{
  						var mm  = reqData['mm'].match(/.+?(\/.*)\.metamodel/)[1],
							 res = _mmmk.loadMetamodel(mm,asmmData);
						__postMessage(
							{'statusCode':200, 
	  						 'changelog':res['changelog'],
							 'sequence#':__sequenceNumber(),
							 'hitchhiker':reqData['hitchhiker'],
							 'respIndex':resp});
					},
					function (err) {

						if (err['code'].includes("ENOENT")) {
							err = "Error! File not found: " + err['path'];
						}
						__postInternalErrorMsg(resp, err);
					}
			);
		},


	/* unload a metamodel (deletes all entities from that metamodel) */
	'DELETE *.metamodel' :
		function(resp,uri)
		{
			var mm  = uri.match(/(.*)\.metamodel/)[1],
				 res = _mmmk.unloadMetamodel(mm);
			__postMessage(
					{'statusCode':200, 
					 'changelog':res['changelog'],
					 'sequence#':__sequenceNumber(),
					 'respIndex':resp});
		},


	/* load a model */
	'PUT /current.model' :
		function(resp,uri,reqData/*m,name,insert,hitchhiker*/)
		{
			if( (res = _mmmk.loadModel(
										reqData['name'],
										reqData['m'],
										reqData['insert']))['$err'] )
				__postInternalErrorMsg(resp,res['$err']);
			else
				__postMessage(
						{'statusCode':200, 
  						 'changelog':res['changelog'],	
					 	 'sequence#':__sequenceNumber(),
						 'hitchhiker':reqData['hitchhiker'],
						 'respIndex':resp});
		},


	/* create a new instance of type... if reqData has 'src' and 'dest' fields,
	  	type is a connector

		1. if *.type is a node, ask _mmmk to create it
		1. if *.type is a connector, ask _mmmk to create it and connect 
				its endpoints
		2. return success or error code

		NOTE:: since create() is given 'attrs' (i.e., these aren't given to
				 update() after creation), it is important that post-edit 
				 constraints also be made post-create constraints... otherwise, it
				 would be possible to create nodes via copy-paste that would 
				 otherwise be blocked by post-edit constraints */
	'POST *.type' :
		function(resp,uri,reqData/*[src,dest],hitchhiker,attrs*/)
		{
			var matches 	= uri.match(/(.*)\.type/),
				 fulltype 	= matches[1],
				 res  		= (reqData == undefined || reqData['src'] == undefined ?
									 _mmmk.create(fulltype,reqData['attrs']) :
									 _mmmk.connect(
										 __uri_to_id(reqData['src']),
										 __uri_to_id(reqData['dest']),
										 fulltype,
										 reqData['attrs']));

			if( '$err' in res )
				__postInternalErrorMsg(resp,res['$err']);
			else
				__postMessage(
					{'statusCode':200, 
					 'changelog':res['changelog'],
					 'data':res['id'],					 
					 'sequence#':__sequenceNumber(),
					 'hitchhiker':reqData['hitchhiker'],
					 'respIndex':resp});
		},


	/* return an instance */
	'GET *.instance' :
		function(resp,uri)
		{
			var id = __uri_to_id(uri);

			if( (res = _mmmk.read(id))['$err'] )
				__postInternalErrorMsg(resp,res['$err']);
			else
				__postMessage(
					{'statusCode':200, 
					 'data':res, 
					 'sequence#':__sequenceNumber(0),
					 'respIndex':resp});
		},


	/* updates an instance 

		NOTE:: if this update produces no changelog *and* to-do-cschanges are 
				 bundled, we return a dummy changelog that ensures the said to-do-
				 cschanges get handled by csworker.__applyASWChanges().CHATTR */
	'PUT *.instance' :
		function(resp,uri,reqData/*changes[,hitchhiker]*/)
		{
			var id = __uri_to_id(uri);

			if( (res = _mmmk.update(id,reqData['changes']))['$err'] )
				__postInternalErrorMsg(resp,res['$err']);
			else
			{
				var changelog = 
						(res['changelog'].length == 0 && reqData['hitchhiker'] ?
						 	[{'op':'CHATTR','id':id}] :
							res['changelog']);
				__postMessage(
					{'statusCode':200, 
					 'changelog':changelog,
					 'sequence#':__sequenceNumber(),
					 'hitchhiker':reqData['hitchhiker'],
					 'respIndex':resp});
			}
		},


	'POST *.instance.click' :
		function(id,vid)
		{
			//TODO
		},

	/* delete an instance 

		NOTE:: this function does not return asworker errors to the client (see 
				 NOTE for csworker.DELETE *.instance with the difference that in 
				 this context, the client is the mtworker) */
	'DELETE *.instance' :
		function(resp,uri)
		{
			var id = __uri_to_id(uri);
			if( (res = _mmmk.read(id))['$err'] )
				__postMessage({'statusCode':200, 'respIndex':resp});
			else if( (res = _mmmk['delete'](id))['$err'] )
				__postInternalErrorMsg(resp,res['$err']);
			else
				__postMessage(
					{'statusCode':200, 
					 'changelog':res['changelog'],
					 'sequence#':__sequenceNumber(),
					 'respIndex':resp});
		},


	/* generate a metamodel from the current model and write it to disk 
	 
		1. generate metamodel
		1. setup sync/async action chaining
			a) write specified mm to disk 
		2. launch chain... return success or error code */ 
	'PUT *.metamodel' :
		function(resp,uri,reqData/*[csm]*/)
		{
			if( uri.match(/(.*)\..*Icons\.metamodel/) && 
				 (res = _mmmk.
						compileToIconDefinitionMetamodel(reqData['csm'], reqData['asmm']))['$err'] )
				__postInternalErrorMsg(resp,res['$err']);
			else if( ! uri.match(/(.*)\..*Icons\.metamodel/) &&
						(res = _mmmk.compileToMetamodel())['$err'] )
				__postInternalErrorMsg(resp,res['$err']);
			else
			{
				var uri 		= uri.substring('/GET'.length),
					 actions = [_fs.writeFile('./users'+uri,res)];
				_do.chain(actions)(
						function() 
						{
							__postMessage(
								{'statusCode':200, 
								 'respIndex':resp});
						},
						function(err) 	{__postInternalErrorMsg(resp,err);}
				);
			}
		},


	/* validate a model */
	'GET /validatem' :
		function(resp)
		{
			var err = _mmmk.validateModel();
			if( err )
				__postInternalErrorMsg(resp,err['$err']);
			else
				__postMessage(
					{'statusCode':200,
					 'respIndex':resp});
		},


	/* undo the effects of a csworker's last not yet undone action
			OR
		undo until the specified user-checkpoint */
	'POST /undo' :
		function(resp,uri,reqData/*[undoUntil],hitchhiker*/)
		{
			__postMessage(
				{'statusCode':200,
				 'changelog':_mmmk.undo(reqData['undoUntil'])['changelog'],
				 'sequence#':__sequenceNumber(),
				 'hitchhiker':reqData['hitchhiker'],
				 'respIndex':resp});
		},
	

	/* redo the effects of a csworker's last undone action
			OR
		redo until the specified user-checkpoint  */
	'POST /redo' :
		function(resp,uri,reqData/*[redoUntil],hitchhiker*/)
		{
			__postMessage(
				{'statusCode':200,
				 'changelog':_mmmk.redo(reqData['redoUntil'])['changelog'],
				 'sequence#':__sequenceNumber(),
				 'hitchhiker':reqData['hitchhiker'],
				 'respIndex':resp});
		},


	/* evaluate a set of mapping functions (i.e., those functions that compute
		the values of coded VisualObject attributes based on the AS model)... of
	  	interest is that this function 'succeeds' even if one or more of the given
		mapping function produces an error: in such cases, the new value of the 
		associated attribute will be the produced error 

		NOTE: 
			this request is actually a GET : it doesn't change anything anywhere...
			however, due to the possibly large amount of reqData it requires, we're
			forced to make it a POST */
	'POST *.mappings' :
		function(resp,uri,reqData/*{...,fullvid:mapper,...}*/)
		{
			var id  		 = __uri_to_id(uri),
				 attrVals = {};

			for( var fullvid in reqData )
			{
				var res = _mmmk.runDesignerAccessorCode(
									 reqData[fullvid],
									 'mapper evaluation ('+uri+')',
 									 id);
				if( res == undefined )
					continue; 
				else if( !_utils.isObject(res) )
				{
					attrVals = 
						{'$err':
						 'mapper returned non-dictionary type :: '+(typeof res)};
					break;
				}
				else if( '$err' in res )
				{
					attrVals = res;
					break;
				}
				else
					for( var attr in res )
						attrVals[fullvid+attr] = res[attr];
			}

			__postMessage(
					{'statusCode':200,
					 'data':attrVals,
					 'respIndex':resp});
		},


	/*	little hack that allows pretty much anyone to send some text to the client
	  	for console output... this is currently used by mtworkers to post feedback
		about the state of a running transformation... eventually, it could also 
		be used to implement inter-collaborator chatting */
	'PUT /GET/console' :
		function(resp,uri,reqData/*text*/)
		{
			__postMessage(
					{'statusCode':200,
					 'changelog':[{'op':'SYSOUT','text':reqData['text']}],
					 'sequence#':__sequenceNumber(),
					 'respIndex':resp});
		},


	/* place an easily identifiable user-checkpoint in the journal */
	'POST /batchCheckpoint' :
		function(resp,uri,reqData)
		{
			_mmmk.setUserCheckpoint(reqData['name']);
			__postMessage(
					{'statusCode':200,
					 'changelog':[{'op':'MKBTCCHKPT','name':reqData['name']}],
					 'sequence#':__sequenceNumber(),
					 'respIndex':resp});
		}	
};
