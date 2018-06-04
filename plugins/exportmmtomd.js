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
	'interfaces': [{'method':'POST', 'url=':'/exportmmtomd'}],
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
							var edges = {};
							var superclasses = {};
							var superclasses_ids = {};
							
							// R: Replace $* by Node ($* is the wildcard class of AToMPM: metaDepth's Node)
							// R: This is still not 100% safe since Node is no longer in the reservedWordsPattern, 
							// so a class could be called Node in atompm and give a compilation error in metadepth
							for (var key in as.nodes) {
								var node = as.nodes[key];
								if (node.name != null && node.name.value == '$*') {
									node.name.value = 'Node';
								}
							}
							
							/* 
							R: Start variable name fixing 
							*/
							var reservedWordsPattern = /(Sequence|Model|Edge|Link)/;
							var escapes = [[/\//g, "\\\/"], [/\\/g, "\\\\"]];
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
								// console.log(as);
								var node = as.nodes[key];
								if (node.name != null) {
									node.name.value = fixName(node.name.value);
									// console.log(node.name);
									// console.log(node.attributes);
									if (node.attributes != null) {
										for (var prop in node.attributes['value']) {
											// All names of attributes and (default) values
											node.attributes['value'][prop].name = fixName(node.attributes['value'][prop].name);
											if (node.attributes['value'][prop].type == 'string' | node.attributes['value'][prop].type == 'code')
												node.attributes['value'][prop]['default'] = escapeString(node.attributes['value'][prop]['default']);
										}
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
							
							for (var i = 0; i < as.edges.length; i += 2) {
								if (as.edges[i].dest != as.edges[i + 1].src) console.error('The source and destination of the edge are different!');
								if (extract_md_type(as.nodes[as.edges[i].dest]['$type']) == 'Inheritance') {
									if (!(as.edges[i].src in superclasses)) {
										superclasses[as.edges[i].src] = [];
										superclasses_ids[as.edges[i].src] = [];
									}
									superclasses[as.edges[i].src].push(as.nodes[as.edges[i + 1].dest]['name']['value']);
									superclasses_ids[as.edges[i].src].push(as.edges[i + 1].dest);
								} else {
									edges[as.edges[i].dest] = ([as.edges[i].src, as.edges[i + 1].dest]);
								}
							}
							// Add superclass Link to all Edges (this is class is not present in AToMPM thus not contained in as.nodes)
							for (var key in as.nodes) {
								// console.log(key);
								var node = as.nodes[key];
								if (key in edges) {
									superclasses[key] = ['Link'];
								}
							}
							
							file_contents += 'Model ' + reqData['name'] + ' {\n';
							
							var sorted_nodes = [];
							var sorted_edges = [];
							var nodes_no_superclasses = [];
							var c_to_superclass = {};
							// copy superclasses dictionary
							for (var key in superclasses_ids) {
								c_to_superclass[key] = superclasses_ids[key].slice(0);
							}
							// create reverse of superclasses: mapping of class to its subclasses
							var c_to_subclasses = {};
							for (var key in superclasses_ids) {
								// console.error(superclasses_ids[key]);
								for (var i in superclasses_ids[key]) {
									var sc = superclasses_ids[key][i];
									if (!(sc in c_to_subclasses)) {
										c_to_subclasses[sc] = [];
									}
									c_to_subclasses[sc].push(key);
								}
							}
							// get all nodes without any superclasses
							for (var key in as.nodes) {
								if (!(key in superclasses_ids)) {
									nodes_no_superclasses.push(key);
								}
							}
							// topological sort
							while (nodes_no_superclasses.length > 0) {
								var n = nodes_no_superclasses.pop();
								if (n in edges) {
									sorted_edges.push(n);
								} else {
									sorted_nodes.push(n);
								}
								for (var i in c_to_subclasses[n]) {
									sc = c_to_subclasses[n][i];
									// console.error(c_to_superclass[sc]);
									c_to_superclass[sc].splice(c_to_superclass[sc].indexOf(n), 1);
									// console.error(c_to_superclass[sc]);
									if (c_to_superclass[sc].length == 0) {
										nodes_no_superclasses.push(sc);
									}
								}
							}
							
							sorted_nodes = sorted_nodes.concat(sorted_edges);
							// console.log('as.nodes:');
							// console.log(as.nodes);
							// console.log('as.edges:');
							// console.log(as.edges);
							// console.log('edges:');
							// console.log(edges);
							
							// If there is at least an edge in the model, add the Link superclass since all edges will extend it
							// console.log(edges);
							if (edges !== {}) { // BUG: This check is currently not working.
								file_contents += 
								'Node Link {\n' +
								'src : Node;\n' +
								'dst : Node;\n' +
								'}\n';
							}
							while (sorted_nodes.length > 0) {
								key = sorted_nodes.shift();
								var node = as.nodes[key];
							
								if (!(node["$type"].search('GlobalConstraint') >= 0 || node["$type"].search('GlobalAction') >= 0 || node["$type"].search('Inheritance') >= 0|| node.name.value == "Node")) {
									// if (key in edges) {
										/*
										var incoming, outgoing;
										for (var e in edges) {
											if (edges[e][0] == key) {
												outgoing = edges[e][1];
											} else if (edges[e][1] == key) {
												incoming = edges[e][0];
											}
										}
										*/
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
									// No abstract classes in pattern metamodel (RAMification)
									file_contents += 	'Node ' 
														+ node.name.value
														+ (key in superclasses ? ': ' + superclasses[key].join(', ') : ' ')
														+ '{\n';
									// if (incoming.length) {
									// file_contents += 	                    
														// incoming.map(function(i) {return 'in' + as.nodes[i].name.value + 
														// ': ' + as.nodes[edges[i][0]]['name']['value'] + '[*];'}).join('\n')
														// + '\n';
									// }
									// if (outgoing.length) {
									// file_contents += 	                    
														// outgoing.map(function(i) {return 'out' + as.nodes[i].name.value + 
														// ': ' + as.nodes[edges[i][1]]['name']['value'] + '[*];'}).join('\n')
														// + '\n';
									// }
									var typemapping = {
									'bool': 'boolean',
									'string': 'String',
									'list<string>': 'String[*]',
									'list<bool>': 'boolean[*]',
									'list<int>': 'int[*]',
									'list<float>': 'double[*]',
									'list<double>': 'double[*]',
									'list<real>': 'double[*]',
									'code': 'String'
									};
									
									// DEPRECATED: No longer needed after adding the Link Node
									// if (key in edges) {
										// file_contents += 'in : ' + as.nodes[edges[key][0]]['name']['value'] +';\n';
										// file_contents += 'out : ' + as.nodes[edges[key][1]]['name']['value'] +';\n';
									// }
									
									for (var prop in node.attributes['value']) {
										t = node.attributes['value'][prop].type;
										file_contents += node.attributes['value'][prop].name + ':' + (t in typemapping ? typemapping[t] : t) + (node.attributes['value'][prop]['default'] != '' ?  ' = ' + (t.search('list') >= 0 ? '[' : '') + node.attributes['value'][prop]['default'] + (t.search('list') >= 0 ? ']' : '') : '') + ';\n';
									}
									file_contents += '}\n';	
								}
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