const {
    __errorContinuable,
    __httpReq,
	__wHttpReq,
    __postInternalErrorMsg, __postMessage,
    __sequenceNumber,
    __successContinuable,
	__uri_to_id
} = require("../__worker");

const _do = require("../___do");
const _utils = require('../utils');
const _mmmk = require("../mmmk");
const _fs = _do.convert(require('fs'), ['readFile', 'writeFile', 'readdir']);
const _fspp	= _do.convert(require('../___fs++'), ['mkdirs']);

module.exports = {
	'interfaces'	: [{'method':'POST', 'url=':'/generatecode'}],

	'csworker'		: 
		function(resp,method,uri,reqData,wcontext)
		{
			var actions = [__wHttpReq('GET','/current.model?wid='+wcontext.__aswid)];
			_do.chain(actions)(
				function(asdata) {
					var writeActions = [_fspp.mkdirs('./generated_code/'+reqData['root'])];
					_do.chain(writeActions)(
						function()
						{
							var res;
							if( (res = _mmmk.read())['$err'] ) {
								__postInternalErrorMsg(resp,res['$err']);
							} else {
								var cs = _utils.jsonp(res);
								var as = _utils.jsonp(asdata['data']);
								var	subFolders = {};
								var from = {};
								var to = {};
								var	filesInFolder = {};
								var	possibleRoots = [];
								for (var key in as.nodes) {
									if (as.nodes[key]['$type'].indexOf('Folder') != -1) {
										possibleRoots.push(key);
									}
								}
								for (var key in as.edges) {
									if (as.nodes[as.edges[key]['src']]['$type'].indexOf('Folder') != -1) {
										from[as.edges[key]['dest']] = as.edges[key]['src'];
									} else if ((as.nodes[as.edges[key]['dest']]['$type'].indexOf('Folder') != -1)
									|| (as.nodes[as.edges[key]['dest']]['$type'].indexOf('File') != -1)) {
										to[as.edges[key]['src']] = as.edges[key]['dest'];
									}
								}
								for (var key in from) {
									if (as.nodes[to[key]]['$type'].indexOf('Folder') != -1) {
										if (subFolders[from[key]]) {
											subFolders[from[key]].push(to[key]);
										} else {
											subFolders[from[key]] = [to[key]];
										}
										if (possibleRoots.indexOf(to[key]) > -1) {
											possibleRoots.splice(possibleRoots.indexOf(to[key]), 1);
										}
									} else if (as.nodes[to[key]]['$type'].indexOf('File') != -1) {
										if (filesInFolder[from[key]]) {
											filesInFolder[from[key]].push(to[key]);
										} else {
											filesInFolder[from[key]] = [to[key]];
										}
									}
								}
								if (possibleRoots.size > 1) {
									 __postInternalErrorMsg(resp,"There can only be 1 root, found " + possibleRoots.size);
								} else {
									let generateFolder = function(key, prefix) {
										var dir = prefix + as.nodes[key]['name']['value'] + '/';
										writeActions = _fspp.mkdirs(dir);
										_do.chain(writeActions)(
											function() {
												for (var file in filesInFolder[key]) {
													_fs.writeFileSync(dir + as.nodes[filesInFolder[key][file]]['name']['value'], as.nodes[filesInFolder[key][file]]['contents']['value']);
												}
											},
											function(writeErr) { __postInternalErrorMsg(resp,writeErr);	}
										);
										for (var subFolder in subFolders[key]) {
											generateFolder(subFolders[key][subFolder], dir);
										}
									};
									generateFolder(possibleRoots[0], './generated_code/' + reqData['root'] + '/');
									__postMessage({'statusCode':200,
												   'respIndex':resp});
								}
							}
						},
						function(writeErr) { __postInternalErrorMsg(resp,writeErr);	}
					);
				},
				function(err) 	{__postInternalErrorMsg(resp,err);}			
			);
				
		},


	'asworker'		: 
		function(resp,method,uri,reqData,wcontext)
		{
			__postMessage(
				{'statusCode':200,
					 'respIndex':resp});	
		}
};
