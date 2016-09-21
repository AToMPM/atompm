/* SCCDXML exporter plugin*/
{
	'interfaces'	: [{'method':'POST', 'url=':'/exporttosccdxml_debug'}],
	'csworker'		: 
        function(resp,method,uri,reqData,wcontext)
		{
			var self		= this,
				 actions = [__wHttpReq('GET','/current.model?wid='+wcontext.__aswid)];

			_do.chain(actions)(
					function(asdata){
						var writeActions = [_fspp.mkdirs('./exported_to_sccdxml/classes/')];
						_do.chain(writeActions) (
							function() {
								var file_contents = '',
									as = _utils.jsonp(asdata['data']),
									type_map = {},
									type_map_keys = {},
									incoming = {},
									outgoing = {};
									
								for (var key in as.nodes) {
									var node = as.nodes[key];
									if (!(node['$type'] in type_map)) {
										type_map[node['$type']] = [];
										type_map_keys[node['$type']] = [];
									}
									type_map[node['$type']].push(node);
									type_map_keys[node['$type']].push(key);
									node['$key'] = key;
								}
                                
                                function xml_safe(str) {
                                    return str.replace(/&/g, "&amp;").replace(/>/g, "&gt;").replace(/</g, "&lt;");
                                }
								
								function safe_add(l, el) {
									if (l.indexOf(el) == -1) {
										l.push(el);
									}
								}
								
								function find_initial(state){
									var substates = outgoing[state['$key']].filter(function(el) {return as.nodes[el]['$type'] == '/Formalisms/SCCD/SCCD/contain' || as.nodes[el]['$type'] == '/Formalisms/SCCD/SCCD/ocContain'}).map(function(tid) {return as.nodes[tid]});
									for (var sidx in substates){
										var substate = as.nodes[outgoing[substates[sidx]['$key']]];
										if(substate['isStart']['value']){
											return substate['name']['value'];
										}
									}
								}
								
								function get_full_path(state){
									var parent_link = incoming[state['$key']].filter(function(el) {return as.nodes[el]['$type'] == '/Formalisms/SCCD/SCCD/contain' || as.nodes[el]['$type'] == '/Formalisms/SCCD/SCCD/ocContain' || as.nodes[el]['$type'] == '/Formalisms/SCCD/SCCD/containOC' || as.nodes[el]['$type'] == '/Formalisms/SCCD/SCCD/includes'}).map(function(tid) {return as.nodes[tid]})[0];
									if (parent_link != undefined){
										var parent = as.nodes[incoming[parent_link['$key']][0]];
										return get_full_path(parent).concat([state['name']['value']]);
									}
									else{
										return [state['name']['value']];
									}	
								}
								
								function find_path(source, destination){
									if(source['$key'] == destination['$key']){
										return ".";
									}
									// Resolve absolute path of source
									source_path = get_full_path(source);
									
									// Resolve absolute path of destination
									destination_path = get_full_path(destination);
									
									// Now make the destination path relative to the source path
									var common;
									for (var i in source_path){
										if(source_path[i] != destination_path[i]){
											common = i;
											break;
										}
									}
									source_path = source_path.slice(i, source_path.length);
									destination_path = destination_path.slice(i, destination_path.length);
									
									var result = ".";
									for (var i in source_path){
										result += "/..";
									}
									for (var i in destination_path){
										result += "/" + destination_path[i];
									}
									return result;
								}
								
								function write_raise(lst){
									contents = "";
									for(var ridx in lst){
										var r = lst[ridx];
										contents += '<raise event="' + r['event'] + '"';
										if(r['scope'].length == 0){
											contents += ' scope="broad">\n';
										}
										else if(r['scope'].lastIndexOf("output(", 0) === 0){
											contents += ' scope="output" port="' + r['scope'].slice(7, -1)+ '">\n';
										}
										else{
											contents += ' scope="' + r['scope'] + '">\n';
										}
										arguments = r['arguments'];
										for (var aidx in arguments){
											var arg = arguments[aidx];
											if(arg != ""){
												contents += '<parameter expr="' + xml_safe(arg) + '"/>\n';
											}
										}
										contents += '</raise>\n';
									}
									return contents;
								}
								
								function resolve_transitions(state){
									contents = "";
									if(outgoing[state['$key']] == undefined){
										return "";
									}
									var transitions = outgoing[state['$key']].filter(function(el) {return as.nodes[el]['$type'] == '/Formalisms/SCCD/SCCD/transition'}).map(function(tid) {return as.nodes[tid]});
									for (var tidx in transitions){
										var transition = transitions[tidx];
										contents += "<transition ";
										if(transition['after']['value'].length > 0){
											contents += 'after="' + xml_safe(transition['after']['value']) + '" ';
										}
										if(transition['event']['value'].length > 0){
											contents += 'event="' + transition['event']['value'] + '" ';
										}
										if(transition['guard']['value'].length > 0){
											contents += 'cond="' + xml_safe(transition['guard']['value']) + '" ';
										}
										if(transition['port']['value'].length > 0){
											contents += 'port="' + transition['port']['value'] + '" ';
										}
										var target = as.nodes[outgoing[transition['$key']][0]];
										contents += 'target="' + find_path(state, target) + '" ';
										contents += '>\n';
										var parameters = transition['parameters']['value'];
										for(var pidx in parameters){
											var param = parameters[pidx];
											contents += '<parameter name="' + param + '"/>\n';
										}
										if(transition['action']['value'].length > 0){
											contents += "<script><![CDATA[";
											contents += transition['action']['value'].split("/*newline*/").join("\n");
											contents += "]]></script>\n";
										}
										var raise = transition['raise']['value'];
										contents += write_raise(raise);
										contents += '</transition>\n';
									}
									return contents;
								}
								
								function find_priority(state){
									state = as.nodes[state['$key']];
									if(state['option']['value'] == "OTF"){
										return "source_parent";
									}
									else if(state['option']['value'] == "ITF"){
										return "source_child";
									}
									else {
										console.log("Unknown conflict resolution selected: " + state['option']['value']);
										return "undefined";
									}
								}
								
								function add_actions(state){
									contents = "<onentry>\n";
									state = as.nodes[state['$key']];
									if(state['entryAction'] == undefined){
										return "";
									}
									contents += "<script><![CDATA[";
									if(state['$type'] == "/Formalisms/SCCD/SCCD/BasicState"){
										contents += "if True:\n";
										contents += " data = json.dumps({'text':'CLIENT_BDAPI :: {\"func\":\"_highlightState\",\"args\":{\"asid\":\"" + state['$key'] + "\",\"followCrossFormalismLinks\":\"*\"}}'})\n";
										contents += " headers = {'Content-Type': 'text/plain'}\n";
										contents += " conn = httplib.HTTPConnection('127.0.0.1:8124')\n";
										contents += " conn.request('PUT', '/GET/console?wid=" + wcontext.__aswid + "', data, headers)\n";
										contents += " conn.getresponse()\n";
										contents += " conn.close()\n";
										contents += "else:\n";
										contents += " pass\n";
									}
									else{
										// To prevent crashes of the compiler
										contents += "pass\n";
									}
									if(state['entryAction']['value'].length > 0){
										contents += state['entryAction']['value'].split("/*newline*/").join("\n");
									}
									contents += "]]></script>\n";
									var raise = state['raiseEntry']['value'];
									contents += write_raise(raise);
									contents += "</onentry>\n";
									contents += "<onexit>\n";
									contents += "<script><![CDATA[";
									if(state['$type'] == "/Formalisms/SCCD/SCCD/BasicState"){
										contents += "if True:\n";
										contents += " data = json.dumps({'text':'CLIENT_BDAPI :: {\"func\":\"_unhighlightState\",\"args\":{\"asid\":\"" + state['$key'] + "\"}}'})\n";
										contents += " headers = {'Content-Type': 'text/plain'}\n";
										contents += " conn = httplib.HTTPConnection('127.0.0.1:8124')\n";
										contents += " conn.request('PUT', '/GET/console?wid=" + wcontext.__aswid + "', data, headers)\n";
										contents += " conn.getresponse()\n";
										contents += " conn.close()\n";
										contents += "else:\n";
										contents += " pass\n";
									}
									else{
										// To prevent crashes of the compiler
										contents += "pass\n";
									}
									if(state['exitAction']['value'].length > 0){
										contents += state['exitAction']['value'].split("/*newline*/").join("\n");
									}
									contents += "]]></script>\n";
									var raise = state['raiseExit']['value'];
									contents += write_raise(raise);
									contents += "</onexit>\n";
									return contents;
								}
								
								function recursive(state, is_root){
									var contents = "";
									
									if(outgoing[state['$key']] == undefined){
										var containOC = [],
											contain = [],
											ocContain = [];
									}
									else{
										var containOC = outgoing[state['$key']].filter(function(el) {return as.nodes[el]['$type'] == '/Formalisms/SCCD/SCCD/containOC'}).map(function(tid) {return as.nodes[tid]});
										var contain = outgoing[state['$key']].filter(function(el) {return as.nodes[el]['$type'] == '/Formalisms/SCCD/SCCD/contain'}).map(function(tid) {return as.nodes[tid]});
										var ocContain = outgoing[state['$key']].filter(function(el) {return as.nodes[el]['$type'] == '/Formalisms/SCCD/SCCD/ocContain'}).map(function(tid) {return as.nodes[tid]});
										var history = outgoing[state['$key']].filter(function(el) {return as.nodes[el]['$type'] == '/Formalisms/SCCD/SCCD/includes'}).map(function(tid) {return as.nodes[tid]});
									}
									var s = as.nodes[state['$key']];
									if (is_root){
										contents += '<scxml initial="' + find_initial(s) + '" priority="' + find_priority(s) + '">\n';
										var children = containOC.concat(contain).concat(ocContain).concat(history);
										console.log("Children of root: " + children);
										for (var cidx in children){
											var child = as.nodes[outgoing[children[cidx]['$key']]];
											contents += recursive(child, false);
										}
										contents += resolve_transitions(s);
										contents += '</scxml>\n';
									}
									else if (containOC.length > 0){
										contents += '<parallel id="' + s['name']['value'] + '">\n';
										var children = containOC.concat(contain).concat(ocContain).concat(history);
										for (var cidx in children){
											var child = as.nodes[outgoing[children[cidx]['$key']]];
											contents += recursive(child, false);
										}
										contents += resolve_transitions(s);
										contents += add_actions(s);
										contents += '</parallel>\n';
									}
									else if(contain.length + ocContain.length > 0){
										contents += '<state id="' + s['name']['value'] + '" initial="' + find_initial(s) + '">\n';
										var children = containOC.concat(contain).concat(ocContain).concat(history);
										for (var cidx in children){
											var child = as.nodes[outgoing[children[cidx]['$key']]];
											contents += recursive(child, false);
										}
										contents += resolve_transitions(s);
										contents += add_actions(s);
										contents += '</state>\n';
									}
									else {
										var history = incoming[state['$key']].filter(function(el) {return as.nodes[el]['$type'] == '/Formalisms/SCCD/SCCD/includes'}).map(function(tid) {return as.nodes[tid]});
										if (history.length > 0){
											contents += '<history id="' + s['name']['value'] + '" type="' + s['type']['value'].trim() + '"/>\n';
										}
										else{
											contents += '<state id="' + s['name']['value'] + '">\n';
											contents += resolve_transitions(s);
											contents += add_actions(s);
											contents += '</state>\n';
										}
									}
									return contents;
								}
								
								function calc_in_out_rel(rel_type) {
									for (var idx in type_map_keys[rel_type]) {
										key = type_map_keys[rel_type][idx];
										incoming[key] = [];
										outgoing[key] = [];
										for (var e_key in as.edges) {
											var e = as.edges[e_key];
											if (e['dest'] == key) {
												safe_add(incoming[key], e['src'])
												if (!(e['src'] in outgoing)) {
													outgoing[e['src']] = [];
												}
												safe_add(outgoing[e['src']], key);
											}
											if (e['src'] == key) {
												safe_add(outgoing[key], e['dest'])
												if (!(e['dest'] in incoming)) {
													incoming[e['dest']] = [];
												}
												safe_add(incoming[e['dest']], key);
											}
										}
									}
								}
								
								calc_in_out_rel('/Formalisms/SCCD/SCCD/transition');
								calc_in_out_rel('/Formalisms/SCCD/SCCD/Inheritance');
								calc_in_out_rel('/Formalisms/SCCD/SCCD/Association');
								calc_in_out_rel('/Formalisms/SCCD/SCCD/contain');
								calc_in_out_rel('/Formalisms/SCCD/SCCD/containOC');
								calc_in_out_rel('/Formalisms/SCCD/SCCD/ocContain');
								calc_in_out_rel('/Formalisms/SCCD/SCCD/behaviour');
								calc_in_out_rel('/Formalisms/SCCD/SCCD/includes');
								
								for (var key in type_map['/Formalisms/SCCD/SCCD/Class']){
									var node = type_map['/Formalisms/SCCD/SCCD/Class'][key],
										external = node['external']['value'],
										type = node['name']['value'];
									if(!external){
										file_contents += '<class name="' + node['name']['value'] + '" default="true">\n';
										file_contents += '\t<relationships>\n';
										inheritances = outgoing[node['$key']].filter(function(el) {return as.nodes[el]['$type'] == '/Formalisms/SCCD/SCCD/Inheritance'}).map(function(tid) {return as.nodes[tid]});
										for (var iidx in inheritances){
											target = as.nodes[outgoing[inheritances[iidx]['$key']][0]];
											file_contents += '\t\t<inheritance class="' + target['name']['value'] + '"/>\n';
										}
										associations = outgoing[node['$key']].filter(function(el) {return as.nodes[el]['$type'] == '/Formalisms/SCCD/SCCD/Association'}).map(function(tid) {return as.nodes[tid]});
										for (var iidx in associations){
											target = as.nodes[outgoing[associations[iidx]['$key']][0]];
											file_contents += '\t\t<association name="' + associations[iidx]['name']['value'] + '" class="' + target['name']['value'] + '"/>\n';
										}
										file_contents += '';
										file_contents += '\t</relationships>\n';
										
										for (var fidx in node['methods']['value']){
											var func = node['methods']['value'][fidx];
											file_contents += '\t<method name="' + func['name'] + '">\n';
											for (var aidx in func['args']){
												var arg = func['args'][aidx];
												if(arg['name'] == ""){
													continue;
												}
												file_contents += '\t\t<parameter name="' + arg['name'] + '"/>\n';
											}
											file_contents += '\t<body><![CDATA[';
											file_contents += func['body'].split("/*newline*/").join("\n");
											file_contents += "\n";
                                            if(func['name'] == node['name']['value']){
												file_contents += "if True:\n";
												file_contents += "\tdata = json.dumps({'text':'CLIENT_BDAPI :: {\"func\":\"_unhighlight\",\"args\":{}}'})\n";
												file_contents += "\theaders = {'Content-Type': 'text/plain'}\n";
												file_contents += "\tconn = httplib.HTTPConnection('127.0.0.1:8124')\n";
												file_contents += "\tconn.request('PUT', '/GET/console?wid=" + wcontext.__aswid + "', data, headers)\n";
												file_contents += "\tconn.getresponse()\n";
												file_contents += "\tconn.close()\n";
												file_contents += "else:\n";
												file_contents += "\tpass\n";
											}
											file_contents += '\t]]></body>\n';
											file_contents += '\t</method>\n';
										}
										
										var behaviour = outgoing[node['$key']].filter(function(el) {return as.nodes[el]['$type'] == '/Formalisms/SCCD/SCCD/behaviour'}).map(function(tid) {return as.nodes[tid]});
										var statechart = as.nodes[outgoing[behaviour[0]['$key']][0]];
										file_contents += recursive(statechart, true);
										file_contents += '</class>\n';
									}
								}
								_fs.writeFileSync('./exported_to_sccdxml/classes/model.xml', file_contents);
								
								__postMessage({'statusCode': 200,
										   'respIndex': resp});
						},
						function(writeErr) {__postInternalErrorMsg(resp, writeErr);}
					);
				},
				function(err) {__postInternalErrorMsg(resp, err);}
			)
		},

	'asworker'		: 
		function(resp,method,uri,reqData,wcontext)
		{
			this.localcontext.counter++;
			__postMessage(
					{'statusCode':200, 
					 'respIndex':resp});
		}
}
