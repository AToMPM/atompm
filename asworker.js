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
	__uri_to_id,
	__mmmkReq,
	compare_changelogs,
	compare_objects,
} = require("./__worker");

const _do = require("./___do");
const _utils = require('./utils');
const _mmmk = require("./mmmk");
const _libcompile = require("./libcompile");
const _libeventhandler = require("./libeventhandler")
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
		async function (resp, method, uri, reqData) {
			let self = this;
			let actions =
				[__successContinuable(),
					function () {
						uri = uri.substring('/__mt'.length);
						return __httpReq(
							method,
							uri + '?wid=' + self.__mtwid,
							reqData,
							8125);
					}];

			let mms1 = _mmmk.readMetamodels();
			let mms = await __mmmkReq(["readMetamodels"])

			compare_objects(mms1, mms)
			if (mms['$err'])
				return __errorContinuable(mms['$err']);

			let m1 = await __mmmkReq(["read"])
			let m = _mmmk.read();
			compare_objects(m1, m)

			if (m['$err'])
				return __errorContinuable(m['$err']);

			if( this.__mtwid == undefined )
			{
				if( reqData == undefined || 
					 reqData['transfs'] == undefined ||
					 reqData['transfs'].length == 0 )
					return __postInternalErrorMsg(resp,'missing transformations');
				else if( reqData['username'] == undefined ||
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
  						function () {
							return __httpReq(
								'PUT',
								'/current.model?wid=' + self.__mtwid,
								{
									'mms': mms,
									'm': m,
									'sequence#': __sequenceNumber(0)
								},
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
			let actions = [__successContinuable()];

			if( reqData['hitchhiker'] == undefined ||
				 'path' in reqData['hitchhiker'] )
				actions.push(
					function()
					{
						let ext;
						if (reqData['mm'].match(/\.pattern\.metamodel$/))
							ext = '.pattern.metamodel';
						else
							ext = '.metamodel';

						let path;
						if (reqData['hitchhiker'] && 'path' in reqData['hitchhiker'])
							path = reqData['hitchhiker']['path'];
						else
							path = reqData['mm'].match(/(.*)\.metamodel/)[1] + '.defaultIcons' + ext;
						let name = path.match(/.+?(\/.*)\.metamodel/)[1];

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
					async function (asmmData) {
						let mm = reqData['mm'].match(/.+?(\/.*)\.metamodel/)[1];
						let res1 = _mmmk.loadMetamodel(mm, asmmData);
						let res2 = await __mmmkReq(["loadMetamodel", mm, asmmData]);

						compare_changelogs(res1, res2)

						__postMessage(
							{
								'statusCode': 200,
								'changelog': res2['changelog'],
								'sequence#': __sequenceNumber(),
								'hitchhiker': reqData['hitchhiker'],
								'respIndex': resp
							});
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
		async function (resp, uri) {
			let mm = uri.match(/(.*)\.metamodel/)[1];
			let res1 = _mmmk.unloadMetamodel(mm);
			let res2 = await __mmmkReq(["unloadMetamodel", mm]);
			compare_changelogs(res1, res2)
			__postMessage(
				{
					'statusCode': 200,
					'changelog': res1['changelog'],
					'sequence#': __sequenceNumber(),
					'respIndex': resp
				});
		},


	/* load a model */
	'PUT /current.model' :
		async function (resp, uri, reqData/*m,name,insert,hitchhiker*/) {
			let res = _mmmk.loadModel(reqData['name'], reqData['m'], reqData['insert']);
			let res2 = await __mmmkReq(["loadModel", reqData['name'], reqData['m'], reqData['insert']]);
			compare_changelogs(res, res2)
			if (res['$err'])
				__postInternalErrorMsg(resp, res['$err']);
			else
				__postMessage(
					{
						'statusCode': 200,
						'changelog': res['changelog'],
						'sequence#': __sequenceNumber(),
						'hitchhiker': reqData['hitchhiker'],
						'respIndex': resp
					});
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
		async function (resp, uri, reqData/*[src,dest],hitchhiker,attrs*/) {
			let matches = uri.match(/(.*)\.type/);
			let fulltype = matches[1];
			let res;
			if (reqData == undefined || reqData['src'] == undefined) {
				res = _mmmk.create(fulltype, reqData['attrs']);
				let res2 = await __mmmkReq(["create", fulltype, reqData['attrs']])
				compare_changelogs(res, res2)
			} else {
				res = _mmmk.connect(
				 	__uri_to_id(reqData['src']),
				 	__uri_to_id(reqData['dest']),
				 	fulltype,
				 	reqData['attrs']);
				let res2 = await __mmmkReq(["connect",
					__uri_to_id(reqData['src']),
					__uri_to_id(reqData['dest']),
					fulltype,
					reqData['attrs']]);
				compare_changelogs(res, res2)
			}

			if ('$err' in res)
				__postInternalErrorMsg(resp, res['$err']);
			else
				__postMessage(
					{
						'statusCode': 200,
						'changelog': res['changelog'],
						'data': res['id'],
						'sequence#': __sequenceNumber(),
						'hitchhiker': reqData['hitchhiker'],
						'respIndex': resp
					});
		},


	/* return an instance */
	'GET *.instance' :
		async function (resp, uri) {
			let id = __uri_to_id(uri);
			let res1 = _mmmk.read(id)
			let res = await __mmmkReq(["read", id])
			compare_objects(res1, res)
			if (res['$err'])
				__postInternalErrorMsg(resp, res['$err']);
			else
				__postMessage(
					{
						'statusCode': 200,
						'data': res,
						'sequence#': __sequenceNumber(0),
						'respIndex': resp
					});
		},


	/* updates an instance 

		NOTE:: if this update produces no changelog *and* to-do-cschanges are 
				 bundled, we return a dummy changelog that ensures the said to-do-
				 cschanges get handled by csworker.__applyASWChanges().CHATTR */
	'PUT *.instance' :
		async function (resp, uri, reqData/*changes[,hitchhiker]*/) {
			let id = __uri_to_id(uri);
			let res1 = _mmmk.update(id, reqData['changes']);
			let res = await __mmmkReq(["update", id, reqData['changes']]);
			compare_changelogs(res1, res)
			if (res['$err'])
				__postInternalErrorMsg(resp, res['$err']);
			else {
				let changelog = res['changelog'];
				if (res['changelog'].length == 0 && reqData['hitchhiker']) {
					changelog = [{'op': 'CHATTR', 'id': id}];
				}
				__postMessage(
					{
						'statusCode': 200,
						'changelog': changelog,
						'sequence#': __sequenceNumber(),
						'hitchhiker': reqData['hitchhiker'],
						'respIndex': resp
					});
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
		async function (resp, uri) {
			let id = __uri_to_id(uri);

			let res1 = _mmmk.read(id)
			let res = await __mmmkReq(["read", id])
			compare_objects(res1, res)

			if (res['$err']) {
				__postMessage({'statusCode': 200, 'respIndex': resp});
				return;
			}
			res1 = _mmmk.delete(id);
			res = await __mmmkReq(["delete", id])
			compare_changelogs(res1, res)

			if (res['$err']) {
				__postInternalErrorMsg(resp, res['$err']);
				return;
			}

			__postMessage(
				{
					'statusCode': 200,
					'changelog': res['changelog'],
					'sequence#': __sequenceNumber(),
					'respIndex': resp
				});
		},


	/* generate a metamodel from the current model and write it to disk 
	 
		1. generate metamodel
		1. setup sync/async action chaining
			a) write specified mm to disk 
		2. launch chain... return success or error code */ 
	'PUT *.metamodel' :
		async function(resp,uri,reqData/*[csm]*/)
		{
			let res;
			let m1 = _utils.jsonp(_mmmk.read());
			let m = await __mmmkReq(["read"]);

			let model = _utils.jsonp(m);

			compare_objects(m1, model)

			if (uri.match(/(.*)\..*Icons\.metamodel/)) {
				let mm = await __mmmkReq(["readMetamodels"])
				let metamodels = _utils.jsonp(mm);
				res = _libcompile.compileToIconDefinitionMetamodel(model, metamodels, reqData['csm'], reqData['asmm'])
			} else {
				res = _libcompile.compileToMetamodel(model);
			}

			if (res['$err']) {
				__postInternalErrorMsg(resp, res['$err']);
				return;
			}

			let uri2 = uri.substring('/GET'.length);
			let actions = [_fs.writeFile('./users' + uri2, res)];
			_do.chain(actions)(
				function () {
					__postMessage(
						{
							'statusCode': 200,
							'respIndex': resp
						});
				},
				function (err) {
					__postInternalErrorMsg(resp, err);
				}
			);

		},


	/* validate a model */
	'GET /validatem' :
		function(resp)
		{
			let err = _libeventhandler.validateModel(_mmmk);
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
		async function (resp, uri, reqData/*[undoUntil],hitchhiker*/) {
			let res1 = _mmmk.undo(reqData['undoUntil']);
			let res = await __mmmkReq(["undo", reqData['undoUntil']]);

			compare_changelogs(res1, res);
			__postMessage(
				{
					'statusCode': 200,
					'changelog': res['changelog'],
					'sequence#': __sequenceNumber(),
					'hitchhiker': reqData['hitchhiker'],
					'respIndex': resp
				});
		},
	

	/* redo the effects of a csworker's last undone action
			OR
		redo until the specified user-checkpoint  */
	'POST /redo' :
		async function (resp, uri, reqData/*[redoUntil],hitchhiker*/) {
			let res1 = _mmmk.redo(reqData['redoUntil']);
			let res = await __mmmkReq(["redo", reqData['redoUntil']]);

			compare_changelogs(res1, res);

			__postMessage(
				{
					'statusCode': 200,
					'changelog': res['changelog'],
					'sequence#': __sequenceNumber(),
					'hitchhiker': reqData['hitchhiker'],
					'respIndex': resp
				});
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
		function (resp, uri, reqData/*{...,fullvid:mapper,...}*/) {
			let id = __uri_to_id(uri);
			let attrVals = {};

			for (let fullvid in reqData) {
				let res = _libeventhandler.runDesignerAccessorCode(
					_mmmk,
					reqData[fullvid],
					'mapper evaluation (' + uri + ')',
					id);
				if (res == undefined)
					continue;

				if (!_utils.isObject(res)) {
					attrVals =
						{
							'$err':
								'mapper returned non-dictionary type :: ' + (typeof res)
						};
					break;
				} else if ('$err' in res) {
					attrVals = res;
					break;
				} else
					for (let attr in res)
						attrVals[fullvid + attr] = res[attr];
			}

			__postMessage(
				{
					'statusCode': 200,
					'data': attrVals,
					'respIndex': resp
				});
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
			__mmmkReq(["setUserCheckpoint", reqData['name']]);
			__postMessage(
					{'statusCode':200,
					 'changelog':[{'op':'MKBTCCHKPT','name':reqData['name']}],
					 'sequence#':__sequenceNumber(),
					 'respIndex':resp});
		}	
};
