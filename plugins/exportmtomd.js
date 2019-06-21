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
const _fs = _do.convert(require('fs'), ['readFile', 'writeFile', 'readdir']);
const _fspp	= _do.convert(require('../___fs++'), ['mkdirs']);

module.exports = {
	
	'interfaces': [{'method':'POST', 'url=':'/exportmtomd'}],
	'csworker':
		function(resp, method, uri, reqData, wcontext) {
			var actions = [__wHttpReq('GET', '/current.model?wid=' + wcontext.__aswid)];
			_do.chain(actions) (
				function(asdata) {
					var writeActions = [_fspp.mkdirs('./exported_to_md/')];
					_do.chain(writeActions) (
						function() {
							var file_contents = '';
							var as = _utils.jsonp(asdata['data']);
							var mms = as['metamodels'];

							/*
							R: If a pattern metamodel is found: add the original metamodel to the imports list (if not already present)
							e.g. rpg.pattern --> rpg
							*/
							var mmsToAdd = [];
							for (var i in mms) {
								var mm = mms[i];
								var pos = mm.search(".pattern");
								if (pos != -1) {
									var mmToAdd = mm.replace(".pattern", "");
									if (mms.indexOf(mmToAdd) == -1) {
										mms.push(mmToAdd);
									}
								}
							}
							
							/* 
							R: Start variable name fixing 
							*/
							var reservedWordsPattern = /(Sequence|Model|)/g;
							var stringEscapingPattern = /\\/g;
							// A word character is a character from a-z, A-Z, 0-9, including the _ (underscore) character.
							var nonWordCharPattern = /\W/g;
							var reservedWordsPattern = /(Sequence|Model|Edge|Node)/;
							var escapes = [[/\//g, "\\\/"], [/\\/g, "\\\\"], [/\"/g, "\\\""]];
							var nonWordCharPattern = /\W/g; // A word character is a character from a-z, A-Z, 0-9, including the _ (underscore) character.		
							function fixName(name) {
								name = name.replace(nonWordCharPattern, '_');
								var matchArr = name.match(reservedWordsPattern);
								if (matchArr != null) {
									name = name.replace(matchArr[0], matchArr[0] + '0');
								}
								return name;
							}
							function escapeString(str) {
								for (i in escapes) {
									str = str.replace(escapes[i][0], escapes[i][1]);
								}
								return str;
							}
							for (var key in as.nodes) {
								// All names of Nodes
								var node = as.nodes[key];
								// console.log(node.$type);
								// console.log(node);
								if (node['$type'] != null) { // Fix node name
									parts = node['$type'].split('/');
									node['$type'] = parts.join('/').replace(parts[parts.length - 1], fixName(parts[parts.length - 1]));
								}
								for (var prop in node) {
									if (prop != '$type') {
										// All names and values of properties
										if (node[prop]['type'] == 'string' | node[prop]['type'] == 'code')
											node[prop]['value'] = escapeString(node[prop]['value']);
									}
								}
							}
							/* 
							R: End variable name fixing
							*/
							
							extract_md_type = function(mm) {
								mm_parts = mm.split('/');
								return fixName(mm_parts[mm_parts.length - 1]); // R: Add fixName() here to apply it to types as well
							};
							// Import extra metamodels
							for (var i = mms.length - 1; i >= 0; i--) {
								file_contents += 'load "' + extract_md_type(mms[i]) + '"\n';
							}
							// FIX: Define an auxiliary metamodel which imports all other metamodels and is then instantiated by the main model
							var mm = extract_md_type(mms[0]);
							var modelName = reqData['name'];
							mm = 'Metamodel';
							file_contents += '\nModel ' + mm + ' imports ';
							for (var i = 0; i < mms.length - 1; i++) {
								file_contents += extract_md_type(mms[i]) + ', ';
							}
							file_contents += extract_md_type(mms[mms.length - 1]);
							file_contents += ' {} \n\n';
							var edges = {};
							for (var i = 0; i < as.edges.length; i += 2) {
								if (as.edges[i].dest != as.edges[i + 1].src) console.error('The source and destination of the edge are different!');
								edges[as.edges[i].dest] = ([as.edges[i].src, as.edges[i + 1].dest]);
							}
							// Model definition
							file_contents += mm + ' ' + modelName + ' {\n';
							// console.log('------------');
							// console.log(as.nodes);
							// console.log('------------');
							// console.log(as.edges);
							// console.log('------------');
							for (var key in as.nodes) {
									var node = as.nodes[key];
									// console.log('-----start-----');
									// console.log(node);
									var node_type = extract_md_type(node['$type']);
									file_contents += node_type + ' ' + node_type + '_' + key;
									file_contents += ' {\n';

									if (key in edges) {
										file_contents += 'src = ' + extract_md_type(as.nodes[edges[key][0]]['$type']) + '_' + edges[key][0] +';\n';
										file_contents += 'dst = ' + extract_md_type(as.nodes[edges[key][1]]['$type']) + '_' + edges[key][1] +';\n';
									}
									// var incoming = [];
									// var outgoing = [];
									// for (var e in edges) {
										// if (edges[e][0] == key) {
											// outgoing.push(e);
										// } 
										// if (edges[e][1] == key) {
											// incoming.push(e);
										// }
									// }

									// if (incoming.length) {
										// file_contents += 
											// incoming.map(function(key) {
												// var edge = edges[key];
												// var srcKey = edge[0];
												// var attr = 'in' + extract_md_type(as.nodes[key]['$type']);
												// var type = extract_md_type(as.nodes[srcKey]['$type']);
												// var name = type + '_' + srcKey;
												// return attr + ' = ' + name + ';';
											// }).join('\n') + '\n'
										// ;
									// }
									// if (outgoing.length) {
										// file_contents += 
											// outgoing.map(function(key) {
												// var edge = edges[key];
												// var destKey = edge[1];
												// var attr = 'out' + extract_md_type(as.nodes[key]['$type']);
												// var type = extract_md_type(as.nodes[destKey]['$type']);
												// var name = type + '_' + destKey;
												// return attr + ' = ' + name + ';';
											// }).join('\n') + '\n'
										// ;
									// }
									for (var prop in node) {
										if (prop != '$type') {
											var pre = '';
											var post = '';
											if (node[prop]['type'] == 'string' | node[prop]['type'] == 'code') {
												pre = '"';
												post = '"';
											} else if (node[prop]['type'].search('list') >= 0) {
												pre = '[';
												post = ']';
											}
											// fixName should be extracted from here and done at the start
											file_contents += fixName(prop) + ' = ' + pre + node[prop]['value'] + post + ';\n';
										}
									}
									file_contents += '}\n';
								// }
							}
							file_contents += '}\n';
							_fs.writeFileSync('./exported_to_md/' + reqData['name'] + '.mdepth', file_contents);
							__postMessage({	'statusCode': 200,
											'respIndex': resp});
						},
						function(writeErr) {__postInternalErrorMsg(resp, writeErr);}
					);					
				},
				function(err) {__postInternalErrorMsg(resp, err);}
			);
		},
	'asworker':
		function(resp, method, uri, reqData, wcontext)
		{
			__postMessage(
				{'statusCode': 200,
					 'respIndex': resp});	
		}
};