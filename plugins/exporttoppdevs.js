{
	
	'interfaces': [{'method':'POST', 'url=':'/exportmtoppdevs'}],
	'csworker':
		function(resp, method, uri, reqData, wcontext) {
			var actions = [__wHttpReq('GET', '/current.model?wid=' + wcontext.__aswid)];
			_do.chain(actions) (
				function(asdata) {
					var writeActions = [_fspp.mkdirs('./exported_to_pypdevs/')];
					_do.chain(writeActions) (
						function() {
							var file_contents = '',
								as = _utils.jsonp(asdata['data']),
								type_map = {},
								type_map_keys = {},
								incoming = {},
								outgoing = {};
							
							file_contents += 'import sys\n'
							file_contents += 'sys.path.append("../../pypdevs/src/")\n\n'
							file_contents += 'from DEVS import *\n'
							file_contents += 'from infinity import INFINITY\n'
							file_contents += 'from util import *\n\n'
							
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
							
							function safe_add(l, el) {
								if (l.indexOf(el) == -1) {
									l.push(el);
								}
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
							
							calc_in_out_rel('/Formalisms/ParallelDEVS/ParallelDEVS/states');
							calc_in_out_rel('/Formalisms/ParallelDEVS/ParallelDEVS/ports');
							calc_in_out_rel('/Formalisms/ParallelDEVS/ParallelDEVS/channel');
							calc_in_out_rel('/Formalisms/ParallelDEVS/ParallelDEVS/statedef');
							calc_in_out_rel('/Formalisms/ParallelDEVS/ParallelDEVS/submodels');
							calc_in_out_rel('/Formalisms/ParallelDEVS/ParallelDEVS/ExternalTransition');
							calc_in_out_rel('/Formalisms/ParallelDEVS/ParallelDEVS/InternalTransition');
							calc_in_out_rel('/Formalisms/ParallelDEVS/ParallelDEVS/ConfluentTransition');
							
							for (var key in type_map['/Formalisms/ParallelDEVS/ParallelDEVS/StateDefinition']) {
								var node = type_map['/Formalisms/ParallelDEVS/ParallelDEVS/StateDefinition'][key],
									list_of_params = ['name=""'].concat(node['parameters']['value'].map(function(el) {return el['name'] + '=None'})),
									list_of_param_names = ['name'].concat(node['parameters']['value'].map(function(el) {return el['name']})),
									list_of_attrs = [['name', '']].concat(node['attributes']['value'].map(function(el) {return [el['name'], el['default']]}));
								file_contents += 'class ' + node['name']['value'] + ':\n';
								file_contents += '\tdef __init__(self, ' + list_of_params.join(', ') + '):\n';
                                file_contents += list_of_attrs.map(function(el) {return '\t\tself.' + el[0] + ' = ' + (list_of_param_names.indexOf(el[0]) != -1 ? el[0] : el[1])}).join('\n') + "\n";
                                file_contents += node['__init__']['value'].split('\n').map(function(line) {return '\t\t' + line}).join('\n');
								file_contents += '\n\n';
							}
							
							for (var key in type_map['/Formalisms/ParallelDEVS/ParallelDEVS/Event']) {
								var node = type_map['/Formalisms/ParallelDEVS/ParallelDEVS/Event'][key],
									list_of_params = (node['parameters']['value'].map(function(el) {return el['name'] + '=None'})),
									list_of_param_names = (node['parameters']['value'].map(function(el) {return el['name']})),
									list_of_attrs = (node['attributes']['value'].map(function(el) {return [el['name'], el['default']]}));
								file_contents += 'class ' + node['name']['value'] + ':\n';
								file_contents += '\tdef __init__(self, ' + list_of_params.join(', ') + '):\n';
								file_contents += list_of_attrs.map(function(el) {return '\t\tself.' + el[0] + ' = ' + (list_of_param_names.indexOf(el[0]) != -1 ? el[0] : el[1])}).join('\n') + "\n";
                                file_contents += node['__init__']['value'].split('\n').map(function(line) {return '\t\t' + line}).join('\n');
								file_contents += '\n\n';
								file_contents += '\tdef __str__(self):\n';
								file_contents += '\t\treturn "' + node['name']['value'] + '(" + ' + list_of_attrs.map(function(el) {return 'str(self.' + el[0] + ')'}).join(' + ", " + ') + ' + ")"';
								file_contents += '\n\n';
							}
							
							for (var idx in type_map['/Formalisms/ParallelDEVS/ParallelDEVS/AtomicDEVS']) {
								var node = type_map['/Formalisms/ParallelDEVS/ParallelDEVS/AtomicDEVS'][idx],
									list_of_params = (node['parameters']['value'].map(function(el) {return el['name'] + '=None'})),
									list_of_param_names = (node['parameters']['value'].map(function(el) {return el['name']})),
									list_of_attrs = (node['attributes']['value'].map(function(el) {return [el['name'], el['default']]}));
								file_contents += 'class ' + node['name']['value'] + '(AtomicDEVS):\n';
								file_contents += '\tdef __init__(' + (['self', 'name="' + node['name']['value'] + '"'].concat(list_of_params).join(', ')) + '):\n';
								file_contents += '\t\tAtomicDEVS.__init__(self, name)\n';
								file_contents += list_of_attrs.map(function(el) {return '\t\tself.' + el[0] + ' = ' + (list_of_param_names.indexOf(el[0]) != -1 ? el[0] + ' if ' + el[0] + ' is not None else ' + el[1] : el[1])}).join('\n');
								file_contents += '\n';
								key = type_map_keys['/Formalisms/ParallelDEVS/ParallelDEVS/AtomicDEVS'][idx];
								statedef = as.nodes[outgoing[outgoing[key].filter(function(el) {return as.nodes[el]['$type'] == '/Formalisms/ParallelDEVS/ParallelDEVS/statedef'})[0]][0]];
								states = outgoing[key].filter(function(el) {return as.nodes[el]['$type'] == '/Formalisms/ParallelDEVS/ParallelDEVS/states'}).map(function(statesid) {return outgoing[statesid][0]}).map(function(sid) {return as.nodes[sid]});
								defstate = states.filter(function(el) {return el['initial']['value']})[0]
								list_of_assigns = ['name="' + defstate['name']['value'] + '"'].concat(statedef['initial_binding']['value'].map(function(el) {return el['name'] + '=' + el['val']}))
								file_contents += '\t\tself.state = ' + statedef['name']['value'] + '(' + list_of_assigns.join(', ') + ')\n';
                                file_contents += node['__init__']['value'].split('\n').map(function(line) {return '\t\t' + line}).join('\n') + "\n";
								ports = outgoing[key].filter(function(el) {return as.nodes[el]['$type'] == '/Formalisms/ParallelDEVS/ParallelDEVS/ports'}).map(function(portsid) {return outgoing[portsid][0]}).map(function(pid) {return as.nodes[pid]});
								file_contents += '\t\tself.my_ports = {' + ports.map(function(el) {return '"' + el['name']['value'] + '": ' + (el['$type'] == '/Formalisms/ParallelDEVS/ParallelDEVS/OutputPort' ? 'self.addOutPort("' : 'self.addInPort("') + el['name']['value'] + '")'}).join(', ') + '}\n\n'
								file_contents += '\tdef timeAdvance(self):\n'
								file_contents += states.map(function(s) {return '\t\tif self.state.name == "' + s['name']['value'] + '":\n' + s['time_advance']['value'].split('\n').map(function(line) {return '\t\t\t' + line}).join('\n')}).join('\n')
								file_contents += '\n\n';
								file_contents += '\tdef outputFnc(self):\n'
                                file_contents += '\t\tdef subfunc(self):\n'
                                file_contents += states.map(function(s) {return '\t\t\tif self.state.name == "' + s['name']['value'] + '":\n' + (s['output']['value'] == '' ? ['\t\t\t\treturn {}'] : s['output']['value'].split('\n').map(function(line) {return '\t\t\t\t' + line}).join('\n'))}).join('\n') + "\n";
                                file_contents += '\t\treturn {self.my_ports[k]: v for k, v in subfunc(self).iteritems()}\n';
								file_contents += '\n\n';
								file_contents += '\tdef intTransition(self):\n'
								var content = false;
								for (var sidx in states) {
									s = states[sidx];
									if (outgoing[s['$key']]) {
										internals = outgoing[s['$key']].filter(function(el) {return as.nodes[el]['$type'] == '/Formalisms/ParallelDEVS/ParallelDEVS/InternalTransition'}).map(function(tid) {return as.nodes[tid]});
										for (var iidx in internals) {
											content = true;
											internal = internals[iidx];
											var target = as.nodes[outgoing[internal['$key']][0]],
												cond_name = 'cond_int_' + s['name']['value'] + '_to_' + target['name']['value'],
												action_name = 'action_int_' + s['name']['value'] + '_to_' + target['name']['value'];
											file_contents += '\t\t\def ' + cond_name + '():\n';
											file_contents += internal['condition']['value'] == '' ? '\t\t\treturn True' : internal['condition']['value'].split('\n').map(function(line) {return '\t\t\t' + line}).join('\n');
											file_contents += '\n\t\t\def ' + action_name + '():\n';
											file_contents += internal['action']['value'] == '' ? '\t\t\treturn {}' : internal['action']['value'].split('\n').map(function(line) {return '\t\t\t' + line}).join('\n');
											file_contents += '\n\t\tif self.state.name == "' + s['name']['value'] + '" and ' + cond_name + '():\n';
											file_contents += '\t\t\treturn ' + statedef['name']['value'] + '(name="' + target['name']['value'] + '", **' + action_name + '())\n\n';
										}
									}
								}
								if (!content) {
									file_contents += '\t\treturn AtomicDEVS.intTransition(self)\n';
								} else {
									file_contents += '\t\telse:\n';
									file_contents += '\t\t\treturn AtomicDEVS.intTransition(self)\n';
								}
								file_contents += '\n';
								file_contents += '\tdef extTransition(self, my_inputs):\n'
								file_contents += '\t\tinputs = {k.getPortName(): v for k, v in my_inputs.iteritems()}\n'
								content = false;
								for (var sidx in states) {
									s = states[sidx];
									if (outgoing[s['$key']]) {
										externals = outgoing[s['$key']].filter(function(el) {return as.nodes[el]['$type'] == '/Formalisms/ParallelDEVS/ParallelDEVS/ExternalTransition'}).map(function(tid) {return as.nodes[tid]});
										for (var iidx in externals) {
											content  = true;
											external = externals[iidx];
											var target = as.nodes[outgoing[external['$key']][0]],
												cond_name = 'cond_ext_' + s['name']['value'] + '_to_' + target['name']['value'],
												action_name = 'action_ext_' + s['name']['value'] + '_to_' + target['name']['value'];
											file_contents += '\t\t\def ' + cond_name + '():\n';
											file_contents += external['condition']['value'] == '' ? '\t\t\treturn True' : external['condition']['value'].split('\n').map(function(line) {return '\t\t\t' + line}).join('\n');
											file_contents += '\n\t\t\def ' + action_name + '():\n';
											file_contents += external['action']['value'] == '' ? '\t\t\treturn {}' : external['action']['value'].split('\n').map(function(line) {return '\t\t\t' + line}).join('\n');
											file_contents += '\n\t\tif self.state.name == "' + s['name']['value'] + '" and ' + cond_name + '():\n';
											file_contents += '\t\t\treturn ' + statedef['name']['value'] + '(name="' + target['name']['value'] + '", **' + action_name + '())\n\n';
										}
									}
								}
								if (!content) {
									file_contents += '\t\treturn AtomicDEVS.extTransition(self, my_inputs)\n';
								} else {
									file_contents += '\t\telse:\n';
									file_contents += '\t\t\treturn AtomicDEVS.extTransition(self, my_inputs)\n';
								}
								file_contents += '\n'
								file_contents += '\tdef confTransition(self, my_inputs):\n'
								file_contents += '\t\tinputs = {k.getPortName(): v for k, v in my_inputs.iteritems()}\n'
								content = false;
								for (var sidx in states) {
									s = states[sidx];
									confluents = outgoing[s['$key']].filter(function(el) {return as.nodes[el]['$type'] == '/Formalisms/ParallelDEVS/ParallelDEVS/ConfluentTransition'}).map(function(tid) {return as.nodes[tid]});
									for (var iidx in confluents) {
										content  = true;
										confluent = confluents[iidx];
										var target = as.nodes[outgoing[confluent['$key']][0]],
											cond_name = 'cond_conf_' + s['name']['value'] + '_to_' + target['name']['value'],
											action_name = 'action_conf_' + s['name']['value'] + '_to_' + target['name']['value'];
										file_contents += '\t\t\def ' + cond_name + '():\n';
										file_contents += confluent['condition']['value'] == '' ? '\t\t\treturn True' : confluent['condition']['value'].split('\n').map(function(line) {return '\t\t\t' + line}).join('\n');
										file_contents += '\n\t\t\def ' + action_name + '():\n';
										file_contents += confluent['action']['value'] == '' ? '\t\t\treturn {}' : confluent['action']['value'].split('\n').map(function(line) {return '\t\t\t' + line}).join('\n');
										file_contents += '\n\t\tif self.state.name == "' + s['name']['value'] + '" and ' + cond_name + '():\n';
										file_contents += '\t\t\treturn ' + statedef['name']['value'] + '(name="' + target['name']['value'] + '", **' + action_name + '())\n\n';
									}
								}
								if (!content) {
									file_contents += '\t\treturn AtomicDEVS.confTransition(self, my_inputs)\n';
								} else {
									file_contents += '\t\telse:\n';
									file_contents += '\t\t\treturn AtomicDEVS.confTransition(self, my_inputs)\n';
								}
								file_contents += '\n'
							}
							
							for (var idx in type_map['/Formalisms/ParallelDEVS/ParallelDEVS/CoupledDEVS']) {
								var node = type_map['/Formalisms/ParallelDEVS/ParallelDEVS/CoupledDEVS'][idx],
									list_of_params = (node['parameters']['value'].map(function(el) {return el['name'] + '=None'})),
									list_of_param_names = (node['parameters']['value'].map(function(el) {return el['name']})),
									list_of_attrs = (node['attributes']['value'].map(function(el) {return [el['name'], el['default']]}));
								file_contents += 'class ' + node['name']['value'] + '(CoupledDEVS):\n';
								file_contents += '\tdef __init__(' + (['self', 'name="' + node['name']['value'] + '"'].concat(list_of_params).join(', ')) + '):\n';
								file_contents += '\t\tCoupledDEVS.__init__(self, name)\n';
								file_contents += list_of_attrs.map(function(el) {return '\t\tself.' + el[0] + ' = ' + (list_of_param_names.indexOf(el[0]) != -1 ? el[0] : el[1])}).join('\n') + "\n";
                                file_contents += node['__init__']['value'].split('\n').map(function(line) {return '\t\t' + line}).join('\n') + "\n";
								key = type_map_keys['/Formalisms/ParallelDEVS/ParallelDEVS/CoupledDEVS'][idx];
								ports = outgoing[key].filter(function(el) {return as.nodes[el]['$type'] == '/Formalisms/ParallelDEVS/ParallelDEVS/ports'}).map(function(portsid) {return outgoing[portsid][0]}).map(function(pid) {return as.nodes[pid]});
								file_contents += '\t\tself.my_ports = {' + ports.map(function(el) {return '"' + el['name']['value'] + '": ' + (el['$type'] == '/Formalisms/ParallelDEVS/ParallelDEVS/OutputPort' ? 'self.addOutPort("' : 'self.addInPort("') + el['name']['value'] + '")'}).join(', ') + '}\n'
								file_contents += '\t\tself.submodels = {}\n';
								submodels = outgoing[key].filter(function(el) {return as.nodes[el]['$type'] == '/Formalisms/ParallelDEVS/ParallelDEVS/submodels'}).map(function(submodelsid) {return outgoing[submodelsid][0]}).map(function(mid) {return as.nodes[mid]});
								file_contents += submodels.map(function(m) {return '\t\tself.submodels["' + m['name']['value'] + '"] = self.addSubModel(' + m['devs_type']['value'] + '(' + ['name="' + m['name']['value'] + '"'].concat(m['parameter_binding']['value'].map(function(pb) {return pb['name'] + '=' + pb['val']})).join(', ') + '))'}).join('\n');
								file_contents += '\n\n';
								myportkeys = ports.map(function(port) {return port['$key']});
								port_to_m = {};
								m_to_ports = {};
								m_to_ports[key] = ports;
								ports.forEach(function(p) {port_to_m[p['$key']] = node});
								for (var skey in submodels) {
									var m = submodels[skey];
									m_to_ports[m['$key']] = [];
									ports = outgoing[m['$key']].filter(function(el) {return as.nodes[el]['$type'] == '/Formalisms/ParallelDEVS/ParallelDEVS/ports'}).map(function(portsid) {return outgoing[portsid][0]}).map(function(pid) {return as.nodes[pid]});
									ports.forEach(function(p) {port_to_m[p['$key']] = m; m_to_ports[m['$key']].push(p);});
								}
								for (var mkey in m_to_ports) {
									for (var pidx in m_to_ports[mkey]) {
										var p = m_to_ports[mkey][pidx],
											pkey = p['$key'];
										if (pkey in outgoing) {
											var conns = outgoing[pkey].filter(function(el) {return as.nodes[el]['$type'] == '/Formalisms/ParallelDEVS/ParallelDEVS/channel'}).map(function(channelid) {return as.nodes[channelid]})
											for (var cidx in conns) {
												var conn = conns[cidx],
													target = as.nodes[outgoing[conn['$key']][0]],
													transfname = 'transfer_' + as.nodes[mkey]['name']['value'] + '_' + as.nodes[pkey]['name']['value'] + '_to_' + target['name']['value'],
													fromportstr = (mkey == key ? 'self' : 'self.submodels["' + as.nodes[mkey]['name']['value'] + '"]') + '.my_ports["' + as.nodes[pkey]['name']['value'] + '"]',
													toportstr = (port_to_m[target['$key']]['$key'] == key ? 'self' : 'self.submodels["' + port_to_m[target['$key']]['name']['value'] + '"]') + '.my_ports["' + target['name']['value'] + '"]';
												if (conn['transfer_function']['value'] != '') {
													file_contents += '\t\tdef ' + transfname + '(event):\n';
													file_contents += conn['transfer_function']['value'].split('\n').map(function(line) {return '\t\t\t' + line}).join('\n');
													file_contents += '\n\n';
													file_contents += '\t\tself.connectPorts(' + fromportstr + ', ' + toportstr + ', ' + transfname + ')\n\n';
												} else {
													file_contents += '\t\tself.connectPorts(' + fromportstr + ', ' + toportstr + ')\n';
												}
											}
										}
									}
								}
								file_contents += '\n';
							}
							
							_fs.writeFileSync('./exported_to_pypdevs/model.py', file_contents);
							
							file_contents = 'import sys\n';
							file_contents += 'sys.path.append("../../pypdevs/src/")\n\n';
							file_contents += 'from DEVS import *\n';
							file_contents += 'from model import *\n';
							file_contents += 'from python_runtime.statecharts_core import Event\n';
							file_contents += 'from sccd import Controller\n\n';

							file_contents += 'def termination_condition(time, model, transitioned):\n';
							file_contents += '\ttime = time[0]\n';
							file_contents += type_map['/Formalisms/ParallelDEVS/ParallelDEVS/Simulation'][0]['end_condition']['value'].split('\n').map(function(line) {return '\t' + line}).join('\n') + '\n';
							
							_fs.writeFileSync('./exported_to_pypdevs/experiment.py', file_contents);
							
							__postMessage({'statusCode': 200,
										   'respIndex': resp});
						},
						function(writeErr) {__postInternalErrorMsg(resp, writeErr);}
					);
				},
				function(err) {__postInternalErrorMsg(resp, err);}
			)
		},
	'asworker':
		function(resp, method, uri, reqData, wcontext)
		{
			__postMessage(
				{'statusCode': 200,
					 'respIndex': resp});	
		}
}
