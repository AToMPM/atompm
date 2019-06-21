
/* This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
*  Copyright 2011 by the AToMPM team and licensed under the LGPL
*  See COPYING.lesser and README.md in the root of this project for full details
*/

const _utils = require('./utils');

/* eslint-disable no-inner-declarations */
module.exports = {
	/* apply transformation T to specified model 

		TBI:: this method only supports transforming class diagrams to ER diagrams
	  			and does so programmatically (vs. locating an appropriate [chain of] 
				model transformations and running them) */
	'transform' : 
		function(_model,T)
		{
            if (!Array.prototype.find) {
              Array.prototype.find = function(predicate) {
                if (this == null) {
                  throw new TypeError('Array.prototype.find called on null or undefined');
                }
                if (typeof predicate !== 'function') {
                  throw new TypeError('predicate must be a function');
                }
                var list = Object(this);
                var length = list.length >>> 0;
                var thisArg = arguments[1];
                var value;

                for (var i = 0; i < length; i++) {
                  value = list[i];
                  if (predicate.call(thisArg, value, i, list)) {
                    return value;
                  }
                }
                return undefined;
              };
            }
			var model	  = _utils.jsonp(_model),
	 			 new_model = _utils.jsonp(_model),
				 SCD	  	  = '/Formalisms/__LanguageSyntax__/SimpleClassDiagram/SimpleClassDiagram',
				 ER		  = '/Formalisms/__LanguageSyntax__/EntityRelationship/EntityRelationship';

			if( T == 'SimpleClassDiagram-2-EntityRelationship' )
			{
				/* 1 map each type to all of its ancestors 
				 	2 flatten ancestor contents into their children + 'reroute' associations
				 	3 make new_model conform to ER 
				 	4 append type-to-parentType mapping (needed for MT subtype matching) */
                function copyAttributes(parent_id, child_id) {
                    new_model.nodes[child_id]['attributes']['value'] = 
									new_model.nodes[child_id]['attributes']['value'].concat(
                                        new_model.nodes[parent_id]['attributes']['value'].filter(
                                            function(attr) {
                                                return !new_model.nodes[child_id]['attributes']['value'].find(
                                                    function(el) {return el['name'] == attr['name'];}
                                                );
                                            }
                                        )
                                    );
                    new_model.nodes[child_id]['constraints']['value'] = 
									new_model.nodes[child_id]['constraints']['value'].concat(
                                        new_model.nodes[parent_id]['constraints']['value'].filter(
                                            function(constr) {
                                                return !new_model.nodes[child_id]['constraints']['value'].find(
                                                    function(el) {return el['name'] == constr['name'];}
                                                );
                                            }
                                        )
                                    );
                    new_model.nodes[child_id]['actions']['value'] = 
									new_model.nodes[child_id]['actions']['value'].concat(
                                        new_model.nodes[parent_id]['actions']['value'].filter(
                                            function(act) {
                                                return !new_model.nodes[child_id]['actions']['value'].find(
                                                    function(el) {return el['name'] == act['name'];}
                                                );
                                            }
                                        )
                                    );
                    new_model.nodes[child_id]['cardinalities']['value'] = 
									new_model.nodes[child_id]['cardinalities']['value'].concat(
                                        new_model.nodes[parent_id]['cardinalities']['value'].filter(
                                            function(card) {
                                                return !new_model.nodes[child_id]['cardinalities']['value'].find(
                                                    function(el) {return el['dir'] == card['dir'] && el['type'] == card['type'];}
                                                );
                                            }
                                        )
                                    );
                }

				function findAncestors(ids)
				{
					var inheritances = [];
					model.edges.forEach(
							function(edge)	
							{
								if( _utils.contains(ids,edge['src']) && 
									 model.nodes[edge['dest']]['$type'] == SCD+'/Inheritance' )
									inheritances.push(edge['dest']);
							});

					if( inheritances.length == 0 ) {
                        return ids;
                    }

					var parents = [];
					model.edges.forEach(
							function(edge)	
							{
								if( _utils.contains(inheritances,edge['src']) )
									parents.push(edge['dest']);
							});

					return ids.concat(findAncestors(parents));
				}


				var ids2ancestors = {};				
				for( var id in model.nodes )
				{
					/* 1 */
                    var ids = findAncestors([id]);
                    ids.reverse(); // oldest first
                    var idx = 1;
                    while (idx < ids.length) {
                        copyAttributes(ids[idx-1], ids[idx]);
                        idx++;
                    }
					ids2ancestors[id] = ids;
                    ids2ancestors[id].splice(-1);

					/* 2 */
					/* a) apply attributes, constraints, actions and cardinalities inheritance to id 
						b) update cardinalities of Associations who connect to parent + add edges between Associations 
							and children... this effectively does association inheritance */ 
					ids2ancestors[id].forEach(
							function(a)
							{
                                var ancestorType = model.nodes[a]['name']['value'],
                                    idType 		  = model.nodes[id]['name']['value'];
                                model.edges.forEach(
                                    function(edge)	
                                    {            
                                        if( edge['src'] == a || edge['dest'] == a )
                                        {
                                            var ancestorIsSrc = (edge['src'] == a),
                                                 assoc = (ancestorIsSrc ? edge['dest'] : edge['src']);
                                            if( model.nodes[assoc]['$type'] != SCD+'/Association' )
                                                return;
                                                
                                            for( var i in model.nodes[assoc]['cardinalities']['value'] )
                                            {
                                                var card = model.nodes[assoc]['cardinalities']['value'][i];
                                                if( card['type'] == ancestorType && card['dir'] == (ancestorIsSrc ? 'out' : 'in') )
                                                {
                                                    var new_card = _utils.clone(card);
                                                    new_card['type'] = idType;
                                                    new_model.nodes[assoc]['cardinalities']['value'].push(new_card);
                                                }
                                            }
                                            new_model.edges.push(
                                                    (ancestorIsSrc ? {'src':id,'dest':assoc} : {'src':assoc,'dest':id}) );
                                        }
                                    });
							});
				}

				/* 3 */ 
				/* due to extreme similarity between SCD and ER, we only need to 
					a) update $type attributes
							special case: make abstract classes uninstantiable
							special case: remove inheritances 
					b) update new_model.metamodels */
				for( var id in new_model.nodes )
				{
					if( new_model.nodes[id]['$type'] == SCD+'/Class' )
					{
						new_model.nodes[id]['$type'] = ER+'/Entity';

						if( new_model.nodes[id]['abstract']['value'] )
						{
							new_model.nodes[id]['constraints']['value'].push(
									{'name':'noAbstractInstances',
									 'event':'pre-create',
									 'code':'false'});
						}
					}
					else if( new_model.nodes[id]['$type'] == SCD+'/Association' )
						new_model.nodes[id]['$type'] = ER+'/Relationship';
					else if( new_model.nodes[id]['$type'] == SCD+'/GlobalConstraint' )
						new_model.nodes[id]['$type'] = ER+'/GlobalConstraint';
					else if( new_model.nodes[id]['$type'] == SCD+'/GlobalAction' )
						new_model.nodes[id]['$type'] = ER+'/GlobalAction';					
					else if( new_model.nodes[id]['$type'] == SCD+'/Inheritance' ) 
					{
						/* special case: inheritance
							a) remove all edges pertaining to it
							b) remove it */
						new_model.edges = new_model.edges.filter(
								function(edge)	{return edge['src'] != id && edge['dest'] != id;});
						delete new_model.nodes[id];
					}
				}
				new_model.metamodels = [ER];


				/* 4 */
				var types2parentTypes = {};
				for( var id in new_model.nodes )
				{
					var type = new_model.nodes[id]['name']['value'];
					if( types2parentTypes[type] == undefined ) 
					{
						types2parentTypes[type] = [];
						ids2ancestors[id].forEach(
								function(a)
								{
									types2parentTypes[type].push(new_model.nodes[a]['name']['value']);
								});
					}
				}
				new_model['types2parentTypes'] = types2parentTypes;

				/* return transformed model... note the little hack here... the reason for this is that pushing
				 	the 'same' attribute/constraint/action/cardiniality *objects* during the inheritance process
					causes problems when these are later edited (e.g., extended with targetType in compileToMM)
					since they all point to each other and changing one changes them all... */
				return _utils.clone(new_model);
			}

		else
			return {'$err':'unknown transformation :: '+T};
		},


	/* RAMify an AS metamodel and associated CS metamodel(s)

		1. RELAX
			a) alter all constraints such that they are always satisfied (includes
		  		constraints that prevent instantiation of abstract types) + remember
				abstract types (for step 2diii)
			b) alter all actions such that they have no effect				
			c) reduce all minimum multiplicities to 0
		2. AUGMENT & MODIFY
			a) setup pattern types, constraints, actions, cardinalities, etc.
			b) replace types, constraints, etc. by results of steps a)
			c) insert post-create action that sets newly created, non-copied nodes'
				__pLabels to non-taken values
			d) alter each CS metamodel (i.e., icon definitions)
				i.   use pattern type names
				ii.  remove parsing and mapping functions (because pattern attribute
			  		  values are code, as opposed to their 'original' types)
				iii. create basic icons for abstract types 
	 			iv.  add a Text VisualObject to show/edit the __pLabel attribute to
			  		  every icon */
	'ramify' : 
		function(asmm,csmms)
		{
			var abstractTypes = [];
			for( var i in asmm.constraints )
			{
				if( asmm.constraints[i]['name'] == 'noAbstractInstances' )
					abstractTypes.push(asmm.constraints[i]['targetType']);
				asmm.constraints[i]['code'] = 
					'/* comment next line to enable this constraint */\n'+
					'throw "IgnoredConstraint"\n'+asmm.constraints[i]['code'];
			}

			for( var i in asmm.actions )
				asmm.actions[i]['code'] = 
					'/* comment next line to enable this action */\n'+
					'throw "IgnoredConstraint"\n'+asmm.actions[i]['code'];
			
			for( var t in asmm.cardinalities )
				for( var i in asmm.cardinalities[t] )
					asmm.cardinalities[t][i]['min'] = 0;


			var patternTypes 	 	 = {},
				 patternActions 	 = [],
				 patternCards	 	 = {},
				 patternLegalConns = {},
				 patternConnTypes	 = {},
				 patternT2PT		 = {};
			for( var t in asmm.types )
			{
				patternTypes['__p'+t]  = 
					[{'name':'__pLabel',			  'type':'string',	'default':''},
					 {'name':'__pPivotIn',			  'type':'string',	'default':''}, /* hergin motif-integration */
					 {'name':'__pPivotOut',			  'type':'string',	'default':''}, /* hergin motif-integration */
					 {'name':'__pMatchSubtypes', 'type':'boolean',	'default':true}];
				for( var i in asmm.types[t] )
					patternTypes['__p'+t].push(
						{'name':asmm.types[t][i]['name'],
						 'type':'code',	
						 'default':
							'"[PYTHON]"\n"Example:\t result = True"\n"Example:\t result = getAttr()"\n\n'+
							'"[JAVASCRIPT]"\n"Example:\t true"\n"Example:\t getAttr()"'});
			}

			for( var i in asmm.actions )
			{
				var action = asmm.actions[i];
				patternActions.push(_utils.clone(action));
				patternActions[patternActions.length-1]['targetType'] = '__p'+action['targetType'];
			}

			for( var t in asmm.cardinalities )
			{
				patternCards['__p'+t] = [];
				for( var i in asmm.cardinalities[t] )
				{
					var card = asmm.cardinalities[t][i];
					patternCards['__p'+t].push(_utils.clone(card));
					patternCards['__p'+t][i]['type'] = '__p'+card['type'];
				}
			}

			for( var t1 in asmm.legalConnections )
			{
				patternLegalConns['__p'+t1] = {};
				for( var t2 in asmm.legalConnections[t1] )
				{
					patternLegalConns['__p'+t1]['__p'+t2] = [];
					for( var i in asmm.legalConnections[t1][t2] )
						patternLegalConns['__p'+t1]['__p'+t2].push(
								'__p'+asmm.legalConnections[t1][t2][i]);
				}
			}

			for( var t in asmm.connectorTypes )
				patternConnTypes['__p'+t]  = asmm.connectorTypes[t];

			for( var t in asmm.types2parentTypes )
			{
				patternT2PT['__p'+t]  = [];
				for( var i in asmm.types2parentTypes[t] )
					patternT2PT['__p'+t].push('__p'+asmm.types2parentTypes[t][i]);
			}

			asmm.types 	 			  = patternTypes;
			asmm.actions 			  = patternActions;
			asmm.cardinalities 	  = patternCards;
			asmm.legalConnections  = patternLegalConns;
			asmm.connectorTypes	  = patternConnTypes;
			asmm.types2parentTypes = patternT2PT;

			patternActions.push(
					{'name': 		'distinctPLabels',
					 'event': 		'post-create',
		 			 'code':			'if( getAttr("__pLabel") == "" )\n'+
					 					'{\n'+
										'	var pLabels = getAllNodes().\n'+
										'							filter( function(n) {return hasAttr("__pLabel",n);} ).\n'+
										'								map( function(n) {return getAttr("__pLabel",n);} ),\n'+
										'		 i			= "0";\n'+
										'\n'+
										'	while( _utils.contains(pLabels,i) )\n'+
										'		i = String(parseInt(i)+1);\n'+
										'	setAttr("__pLabel",i);\n'+
										'}',
					 'targetType':	'*'});



			function addPLabelTextVisualObject(nodes)
			{
				nodes['__pLabelText'] = {"position":	 {"type": "list<double>",			"value": [0,0]},
												 "orientation": {"type": "double",					"value": 0},
												 "scale": 		 {"type": "list<double>",			"value": [1,1]},
												 "textContent": {"type": "string",					"value": "#"},
												 "style": 		 {"type": "map<string,string>",	"value": {"stroke": "#6000ff",
																															 "fill": "#6000ff",
																						 									 "font-size": "15px",
																															 "opacity": "1"}},
												 "mapper": 		 {"type": "code",						"value": "({'textContent':getAttr('__pLabel')})"},
												 "parser": 		 {"type": "code",						"value": "({'__pLabel':getAttr('textContent')})"},
												 "$type": "/Formalisms/__LanguageSyntax__/ConcreteSyntax/ConcreteSyntax/Text"};
			}

			var NO_MAPPERS_PARSERS = '/* mapping and parsing code is disabled by default because pattern attribute values are code */';
			for( var csmm in csmms )
			{
				var patternTypes = {},
					 patternCards = {},
					 patternT2PT  = {};
				csmms[csmm] 	  = _utils.jsonp(csmms[csmm]);
				for( type in csmms[csmm].types )
				{
					var contents = undefined;
					patternTypes['__p'+type] = _utils.clone(csmms[csmm].types[type]);
					patternCards['__p'+type] = [];
					patternT2PT['__p'+type] = [];
				   patternTypes['__p'+type].forEach(
							function(attr)	
							{
								if( attr['name'] == '$contents' )
									contents = attr;
								else if( attr['name'] == 'parser' || attr['name'] == 'mapper' )
									attr['default'] =  NO_MAPPERS_PARSERS;
							});

					for( id in contents['default']['nodes'] )
						for( attr in contents['default']['nodes'][id] )
							if( attr == 'parser' || attr == 'mapper' )
								contents['default']['nodes'][id][attr]['value'] = NO_MAPPERS_PARSERS;
					addPLabelTextVisualObject(contents['default']['nodes']);
				}

				abstractTypes.forEach(
					function(type)
					{
						patternCards['__p'+type+'Icon'] = [];
						patternT2PT['__p'+type+'Icon'] = [];
						patternTypes['__p'+type+'Icon'] = [{"name": "typename",				"type": "string",				"default": '__p'+type+'Icon'},
																	  {"name": "position",				"type": "list<double>",		"default": [0,0]},
																	  {"name": "orientation",			"type": "double",				"default": 0},
																	  {"name": "scale",					"type": "list<double>",		"default": [1,1]},
																	  {"name": "mapper",					"type": "code",				"default": ''},
																	  {"name": "parser",					"type": "code",				"default": ''},
																	  {"name": "$contents",				"type": "map<string,*>",	"default": {
												  						  "nodes": {
												  							  "text": {
													  							  "textContent": 			{"type": "string",					"value": '__p'+type+'Icon'},
													  							  "style": 					{"type": "map<string,string>",	"value": {"stroke": "#000000",
											  																															 "stroke-dasharray": "",
																																	 									 "fill": "#000000",
																																	 									 "fill-opacity": "1",
																																	 									 "font-size": "13px"}},
																				  "mapper": 				{"type": "code",						"value": ""},
													  							  "parser": 				{"type": "code",						"value": ""},
													  							  "$type": "/Formalisms/__LanguageSyntax__/ConcreteSyntax/ConcreteSyntax/Text",
													  							  "position": 				{"type": "list<double>",			"value": [10,76]},
													  							  "orientation": 			{"type": "double",					"value": 0},
														  						  "scale": 					{"type": "list<double>",			"value": [1,1]}},
												  							  "rect": {
													  							  "width": 					{"type": "double",					"value": 75},
													  							  "height": 				{"type": "double",					"value": 75},
													  							  "cornerRadius": 		{"type": "double",					"value": 15},
													  							  "style": 					{"type": "map<string,string>",	"value": {"stroke": "#000000",
																																	 									 "fill": "#ffffff",
																																	 									 "fill-opacity": 0.75}},
																				  "mapper": 				{"type": "code",						"value": ""},
													  							  "parser": 				{"type": "code",						"value": ""},
													  							  "$type": "/Formalisms/__LanguageSyntax__/ConcreteSyntax/ConcreteSyntax/Rectangle",
													  							  "position": 				{"type": "list<double>",			"value": [0,0]},
													  							  "orientation": 			{"type": "double",					"value": 0},
														  						  "scale": 					{"type": "list<double>",			"value": [1,1]}},
																			  "textBelowRect": {
																				  "distance": 				{"type": "double",					"value": 10},
													  							  "alignment": 			{"type": "ENUM(\"right\",\"left\",\"center\")", "value": "center"},
													  							  "$type": "/Formalisms/__LanguageSyntax__/ConcreteSyntax/ConcreteSyntax/Below",
													  							  "position": 				{"type": "list<double>",			"value": [5,38]},
													  							  "orientation": 			{"type": "double",					"value": 0},
													  							  "scale": 					{"type": "list<double>",			"value": [1,1]},
													  							  "link-style": 			{"type": "map<string,string>",	"value": {"stroke": "#00ff00",
												  																														 "stroke-dasharray": "",
																																	 									 "stroke-opacity": 1,
																																	 									 "arrow-start": "none",
																																	 									 "arrow-end": "classic-wide-long"}}}},
													  					  "edges": [{"src": "text",				"dest": "textBelowRect"},
												  									   {"src": "textBelowRect",	"dest": "rect"}]}},
																	  {"name": "$asuri",	  				"type": "string",					"default": "-1"}];
						addPLabelTextVisualObject(patternTypes['__p'+type+'Icon'][6]['default']['nodes']);
					});

				csmms[csmm].types 	 			= patternTypes;
				csmms[csmm].cardinalities 	 	= patternCards;
				csmms[csmm].types2parentTypes	= patternT2PT;
			}

			return {'asmm':asmm,'csmms':csmms};
		}
};

