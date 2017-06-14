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

/* NOTES:
		atom3 supported pre/post actions and constraints for the 'SAVE' EVENT...
		this never really made any sense (e.g., the user could be prevented from
		saving and, technically, the effects of post-actions were never saved)...
		atom3 supported 'save' events as a hack to enable forcing mm validation...
		in atompm, such validation is carried out by _mmmk.validateModel (which
		clients can 'call') and thus, we do no support 'save' events... */
{
	/********************************* GLOBALS *********************************/
	'metamodels':{},
	'model':{'nodes':{},'edges':[],'metamodels':[]},
	'name':'',
	'next_id':0,



	/********************************* ENV SETUP *******************************/
	/* produce a bundle of internal state variables sufficient to fully clone 
		this instance
			OR
		use a provided bundle to overwrite this instance's internal state */
	'clone' :
		function(clone)
		{
			if( clone )
			{
				this.metamodels 		= clone.metamodels;
				this.model 				= clone.model;
				this.name 				= clone.name;
				this.next_id 			= clone.next_id;
				this.journal 			= clone.journal;
				this.journalIndex 	= clone.journalIndex;
				this.undoredoJournal = clone.undoredoJournal;
			}
			else
				return _utils.clone(
							{'metamodels':			this.metamodels,
							 'model':				this.model,
							 'name':					this.name,
							 'next_id':				this.next_id,
						 	 'journal':				this.journal,
						 	 'journalIndex':		this.journalIndex,
				 			 'undoredoJournal':	this.undoredoJournal});
		},


	/* load a model into this.model 
	 
		0. create step-checkpoint
		1. make sure all required metamodels are loaded
		2. if 'insert' is specified,
			a) append 'model' to this.model (via __resetm__)
		2. otherwise, load 'model' into this.model and 'name' into this.name 
			(via __resetm__) */
	'loadModel' : 
		function(name,model,insert)
		{
			this.__setStepCheckpoint();

			var new_model = eval('('+ model +')');
			for( var i in new_model.metamodels )
				if( this.metamodels[new_model.metamodels[i]] == undefined )
					return {'$err':'metamodel not loaded :: '+new_model.metamodels[i]};

			this.__resetm__(name,model,insert);	
			return {'changelog':this.__changelog()};
		},


	/* load a metamodel 
		
		0. create a step-checkpoint
		1. load metamodel into this.model.metamodels and this.metamodels (via 
			__loadmm__) */
	'loadMetamodel' : 
		function(name,mm)
		{
			this.__setStepCheckpoint();

			this.__loadmm__(name,mm);
			return {'changelog':this.__changelog()};
		},


	/* unload a metamodel and delete all entities from that metamodel
	 
		0. create a step-checkpoint
		1. deletes nodes from specified metamodel
		2. delete edges where deleted nodes appear
		3. remove metamodel from this.model.metamodels and this.metamodels 
			(via __dumpmm__) */
	'unloadMetamodel' :
		function(name)
		{
			this.__setStepCheckpoint();

			for( var i=0; i<this.model.edges.length; i++ )
			{
				var edge = this.model.edges[i];
				if( this.__getMetamodel(this.model.nodes[edge['src']]['$type']) == name ||
					 this.__getMetamodel(this.model.nodes[edge['dest']]['$type']) == name )
					this.__rmedge__(i--);
			}

			for( var id in this.model.nodes )
				if( this.__getMetamodel(this.model.nodes[id]['$type']) == name )
					this.__rmnode__(id);

			this.__dumpmm__(name);
			return {'changelog':this.__changelog()};
		},



	/******************************** MODEL CRUD *******************************/
	/* wraps crud operations with generic boilerplate

		0. setup next_type hack : the next_type variable is used to carry the type
			of the to-be-created node for the special case of pre-create handlers 
			because their target nodes aren't yet in this.model.nodes
		1. create a checkpoint (any failure along the way causes checkpoint 
			restore)
		2. run all applicable pre-events constraints and actions
		3. perform the specified crud operation
		4. run all applicable post-events actions and constraints
		5. clear unused checkpoint */
	'__crudOp' :
		function(metamodel,events,eventTargets,op,args)
		{
			if( this.metamodels[metamodel] == undefined )
				return {'$err':'metamodel not loaded :: '+metamodel};

			if( _utils.contains(events,'create') )
				this.next_type = args.fulltype || args.connectorType;

			this.__checkpoint();

			var pre_events  = events.slice(0).map(function(ev) {return 'pre-'+ev;}),
	 			 post_events = events.slice(0).map(function(ev) {return 'post-'+ev;});				 
			if( (err = this.__runEventHandlers(this.metamodels[metamodel]['constraints'], pre_events, eventTargets, 'constraint')) ||
				 (err = this.__runEventHandlers(this.metamodels[metamodel]['actions'], pre_events, eventTargets, 'action')) ||
				 (err = this[op](args)) ||
				 (err = this.__runEventHandlers(this.metamodels[metamodel]['actions'], post_events, eventTargets, 'action')) ||
				 (err = this.__runEventHandlers(this.metamodels[metamodel]['constraints'], post_events, eventTargets, 'constraint')) )
			{
				this.__restoreCheckpoint();
				return err;
			}
			this.__clearCheckpoint();
		},


	/* connect specified nodes with instance of connectorType	 	

		__connectNN: (connect 2 nodes)
			1. run pre-connect on end nodes
			2. run __create to create instance and connect it to end nodes  
			3. run post-connect on end nodes
		__connectCN: (connect 1 node and 1 connector)
			1. add an appropriate edge to this.model.edges   
		connect:
			0. create a step-checkpoint
			1. verify validity of requested connection (i.e., connection is legal
		  		and max cardinalities haven't been reached)
			2. if one of the nodes is a connector
				a) run pre-connect on end nodes
				b) create appropriate new edge between them (via __connectCN)
				c) run post-connect on end nodes
			2. if both nodes are non-connectors
				a) run pre-create on connectorType
				b) create connectorType instance and connect it to end nodes (via
			  		__connectNN)  
				c) run post-create on connectorType
			3. return err or (new or existing) connector's id */
	'__connectNN' : 
		function(args/*id1,id2,connectorType,attrs*/)
		{
			return this.__crudOp(
					this.__getMetamodel(args.connectorType),
					['connect'],
					[args.id1,args.id2],
					'__create',
					{'fulltype':args.connectorType,
					 'id1':args.id1,
					 'id2':args.id2,
					 'attrs':args.attrs});
		},
	'__connectCN' :
		function(args/*id1,id2,connectorId*/)
		{
			this.__mkedge__(args.id1,args.id2);
		},
	'connect' : 
		function(id1,id2,connectorType,attrs)
		{	
			this.__setStepCheckpoint();

			var metamodel = this.__getMetamodel(connectorType),
				 t1 		  = this.__getType(this.model.nodes[id1]['$type']),
				 t2		  = this.__getType(this.model.nodes[id2]['$type']),
				 tc 		  = this.__getType(connectorType),
				 into		  = (t1 == tc ? t2 : tc),
				 from		  = (t2 == tc ? t1 : tc),
				 card_into = undefined,
				 card_from = undefined,
				 num_id1to = 0,
				 num_toid2 = 0,
				 self		  = this;

			[t1,'$*','__p$*'].some(
					function(t)
					{
						for( var i in self.metamodels[metamodel]['cardinalities'][t] )
						{
							var cardinality = self.metamodels[metamodel]['cardinalities'][t][i];
							if( cardinality['type'] == into && cardinality['dir'] == 'out' )
							{
								card_into = cardinality;
								return true;
							}
						}
					});

			[t2,'$*','__p$*'].some(
					function(t)
					{
						for( var i in self.metamodels[metamodel]['cardinalities'][t] )
						{
							var cardinality = self.metamodels[metamodel]['cardinalities'][t][i];
							if( cardinality['type'] == from && cardinality['dir'] == 'in' )
							{
								card_from = cardinality;
								return true;
							}
						}
					});

			if( card_into == undefined || card_from == undefined )
				return {'$err':'can not connect types '+t1+' and '+t2};
			else if( card_into['max'] == 0 )
				return {'$err':'maximum outbound multiplicity reached for '+t1+' ('+id1+') and type '+into};
			else if( card_from['max'] == 0 )
				return {'$err':'maximum inbound multiplicity reached for '+t2+' ('+id2+') and type '+from};

			for( var i in this.model.edges )
			{
				var edge = this.model.edges[i];
				if( edge['src'] == id1 && 
					 this.__getType(this.model.nodes[edge['dest']]['$type']) == into &&
					 ++num_id1to >= card_into['max'] )
					return {'$err':'maximum outbound multiplicity reached for '+t1+' ('+id1+') and type '+into};

				if( edge['dest'] == id2 && 
					 this.__getType(this.model.nodes[edge['src']]['$type']) == from &&
					 ++num_toid2 >= card_from['max'] )
					return {'$err':'maximum inbound multiplicity reached for '+t2+' ('+id2+') and type '+from};
			}
			
			if( t1 == tc || t2 == tc )
			{
				var connectorId = (t1 == tc ? id1 : id2),
 					 err = this.__crudOp(
						metamodel,
						['connect'],
						[id1,id2],
						'__connectCN',
						{'id1':id1,
  						 'id2':id2,
						 'connectorId':connectorId});
				return err || 
					 {'id':connectorId,
					  'changelog':this.__changelog()};
			}
			else
			{
				var err = this.__crudOp(
						metamodel,
						['create'],
						[this.next_id],
						'__connectNN',
						{'id1':id1,
						 'id2':id2,
 						 'connectorType':connectorType,
						 'attrs':attrs});
				return err || 
					 {'id':this.next_id++,
					  'changelog':this.__changelog()};

			}
		},
	

	/* create an instance of fulltype 
	
		__create:
			1. create [default] instance using metamodel [and possibly specified 
				attrs] + init $type
			2. add to current model nodes 
			[3. if fulltype is a connectorType, create edges between node id1 
				and new instance and between new instance and node id2
	 	create: 
			0. create a step-checkpoint
	 		1. wrap __create in crudOp 
			2. return err or new instance id */
	'__create' : 
		function(args/*fulltype,attrs,[,id1,id2]*/)
		{
			var metamodel = this.__getMetamodel(args.fulltype),
		  		 type 	  = this.__getType(args.fulltype),	
				 typeAttrs = this.metamodels[metamodel]['types'][type],
	 			 new_node = {};

			if( typeAttrs == undefined )
				return {'$err':'can not create instance of unknown type :: '+args.fulltype};

			typeAttrs.forEach(
					function(attr)
					{
						var val = (args.attrs && attr['name'] in args.attrs ? 
					  					args.attrs[attr['name']] :
										attr['default']);
						new_node[attr['name']] = 
							{'type':attr['type'], 
							 'value':(typeof attr['default'] == 'object' ? 
								 			_utils.clone(val) : 
											val)};
					});
			new_node['$type'] = args.fulltype;

			this.__mknode__(this.next_id,new_node);

			if( args.id1 != undefined )
			{
				this.__mkedge__(args.id1,String(this.next_id));
				this.__mkedge__(String(this.next_id),args.id2);
			}
		},
	'create' : 
		function(fulltype,attrs)
		{
			this.__setStepCheckpoint();

			var err = this.__crudOp(
									this.__getMetamodel(fulltype),
									['create'],
									[this.next_id],
									'__create',
									{'fulltype':fulltype,
									 'attrs':attrs});
			return err || 
					 {'id':this.next_id++,
					  'changelog':this.__changelog()};
		},


	/* delete the specified node (and appropriate edges and/or connectors)
	 
		__delete:
			1. determine specified node's neighbors
			2. if specified node is a connector (neighbors are non-connectors), 
				a) run pre-disconnect constraints and actions and on its neighbors
				b) delete it and all appropriate edges (via __deleteConnector)
				c) run post-disconnect constraints and actions and on its neighbors
			2. if specified node is not a connector (neighbors are connectors),
				a) recursively run __delete on each of its neighbors 
				b) delete it
		__deleteConnector:
			1. delete all appropriate edges then delete node
	 	delete: 
			0. create a step-checkpoint
	 		1. wrap __delete in crudOp 
			2. return err or nothing */	
	'__delete' : 
		function(args/*id*/)
		{
			var id			 = args.id,
				 metamodel 	 = this.__getMetamodel(this.model.nodes[id]['$type']),
				 type			 = this.__getType(this.model.nodes[id]['$type']),
				 isConnector = (this.metamodels[metamodel]['connectorTypes'][type] != undefined),
				 neighbors	 = [];

			this.model.edges.forEach(
				  function(edge)
					{
						if( edge['src'] == id && ! _utils.contains(neighbors,edge['dest']) )
							neighbors.push(edge['dest']);
						else if( edge['dest'] == id && ! _utils.contains(neighbors,edge['src']) )
							neighbors.push(edge['src']);
					});

			if( isConnector )
			{
				if( (res = this.__crudOp(
								metamodel,
								['disconnect'],
								neighbors,
								'__deleteConnector',
								{'id':id})) )
					return res;
			}
			else
			{
				for( var i in neighbors ) 
					if( (res = this.__crudOp(
									metamodel,
									['delete'],
									[neighbors[i]],
									'__delete',
									{'id':neighbors[i]})) )
						return res;

				this.__rmnode__(id);
			}
		},
	'__deleteConnector' : 
		function(args/*id*/)
		{
			for( var i=0; i<this.model.edges.length; i++ )
			{
				var edge = this.model.edges[i];
				if( edge['src'] == args.id || edge['dest'] == args.id )
					this.__rmedge__(i--);
			}	
			this.__rmnode__(args.id);
		},
	'delete' : 
		function(id)
		{
			this.__setStepCheckpoint();

			if( this.model.nodes[id] == undefined )
				return {'$err':'invalid id :: '+id};

			var err = this.__crudOp(
					this.__getMetamodel(this.model.nodes[id]['$type']),
					['delete'],
					[id],
					'__delete',
					{'id':id});

			return err || 
					 {'changelog':this.__changelog()};
		},


	/* returns the stringified full model, a stringified node, or a copy of an
	  	attribute's value */
	'read' :
		function(id,attr)
		{
			if( id == undefined )
				return _utils.jsons(this.model);
			else if( this.model.nodes[id] == undefined )
				return {'$err':'instance not found :: '+id};
			else if( attr == undefined )
				return _utils.jsons(this.model.nodes[id]);		
			else if( attr.match(/.+\/.+/) )
			{
				var curr = this.model.nodes[id];
				for( var i in (path = attr.split('/')) )
					if( typeof curr == 'object' && path[i] in curr )
						curr = curr[path[i]];
					else
						return {'$err':'instance '+id+' has no attribute :: '+attr};
			}
			else if( !(attr in this.model.nodes[id]) )
				return {'$err':'instance '+id+' has no attribute :: '+attr};

			var attrVal = (curr ? curr['value'] : this.model.nodes[id][attr]['value']);
			if( typeof attrVal == 'object' )
				return _utils.clone(attrVal);
			else
				return attrVal;
		},


	/* returns a copy of one or all metamodels in this.metamodels */
	'readMetamodels' :
		function(metamodel)
		{
			if( metamodel == undefined )
				return _utils.jsons(this.metamodels);
			else if( this.metamodels[metamodel] == undefined )
				return {'$err':'metamodel not found :: '+metamodel};
			else
				return _utils.jsons(this.metamodels[metamodel]);
		},


	/* returns this.name */
	'readName' :
		function()
		{
			return this.name;
		},


	/* runs accesor-code that conforms to the DesignerCode API and returns its 
		results */
	'runDesignerAccessorCode' :
		function(code,desc,id)
		{
			var res = this.__runDesignerCode(code,desc,'accessor',id);
			if( res && res['$err'] )
				return res;
			return res;			
		},


	/* runs action-code that conforms to the DesignerCode API (of interest is 
		that this 'operation' is checkpointed and can thus be undone/redone; and
	  	that any exceptions thrown by the code cause a full rollback to before it
	  	was run and are then returned to the querier) */
	'runDesignerActionCode' :
		function(code,desc,type,id)
		{
			this.__setStepCheckpoint();
	
			this.__checkpoint();
			if( (err = this.__runDesignerCode(code,desc,type,id)) )
			{
				this.__restoreCheckpoint();
				return err;
			}

			this.__clearCheckpoint();
			return {'changelog':this.__changelog()};			
		},


	/* updates node with specified id 
	
		__update:
			1. update instance as per data
			2. return err on unknown attributes
			3. TBA: type verification on new values
	 	update: 
			0. create a step-checkpoint
	 		1. wrap __update in crudOp 
			2. return err or nothing */	
	'__update' : 
		function(args/*id,data*/)
		{
			for( var attr in args.data )
				if( args.data[attr] == null )
					return {'$err':'tried to set attribute '+attr+' to "null"'};					
				else if( (res = this.read(args.id,attr))['$err'] )
					return res;
				else
					this.__chattr__(args.id,attr,args.data[attr]);
		},
	'update' : 
		function(id,data/*{..., attr_i:val_i, ...}*/)
		{
			this.__setStepCheckpoint();

			if( this.model.nodes[id] == undefined )
				return {'$err':'invalid id :: '+id};

			var err = this.__crudOp(
									this.__getMetamodel(this.model.nodes[id]['$type']),
									['edit'],
									[id],
									'__update',
									{'id':id,
			  						'data':data});

			return err || 
					 {'changelog':this.__changelog()};			
		},




	/*************************** EVENT HANDLER EXEC ****************************/
	/* run the given constraint|action|accessor... when id is specified, we 
		consider it to be the id of the node that "owns" the current 
		constraint|action|accessor... 
		
		this function is divided in 3 parts
		1. constraints/actions/accessors API definition
		2. safe_eval definition
		3. actual code that runs the handler and handles its output */
	'__runDesignerCode' :
		function(code,desc,type,id)
		{
			/* the functions below implement the API available for constraints,
			 	actions and 'accessors'... they can only be called from "designer" 
				code (i.e., from actions/constraints/accessors written by language
			  	and/or model transformation designers)... the main consequence of 
				this is our design decision that setAttr() is not treated like a
				normal crud operation: it does not go through the crudOp pipeline 
				of pre/post edit constraints/actions... on one hand, this decision
			  	avoids any weird recursion cases (e.g., setAttr() in pre-edit action
			  	triggers pre-edit action and on and on and on)... on the other hand,
			  	designers should be aware that:
					1. setAttr() may set attributes to values that the user could not
				  		input (e.g., due to constraints)
					2. consequences (specified as edit actions) of a user setting an
				  		attribute A to value 'a' might not take effect if setAttr() 
						sets attribute A to value 'a' : for instance, if an edit 
						action says that attribute B should be 'a'+2, setAttr() won't
					  	trigger that action
					3. even though setAttr() bypasses crudOp constraints/actions, its
						effects are still immediate: a getAttr() on the next line (of
						designer code) reports the updated value
				
				moral of story: 
					designers must be very careful with setAttr() to avoid putting 
					the model into otherwise unreachable states


				API:		
					hasAttr(_attr[,_id])
						return true if the specified node has an attribute of the 
						given name

					getAttr(_attr[,_id])
						return the requested attr of the specified node... to ensure
					  	getAttr can't be used to edit the model, JSON parse+stringify
					  	is used to return a *copy* of the attribute when its value has
						an object type (i.e., hash or array)

					getAllNodes([_fulltypes])
						if _fulltypes is undefined, return the ids all of nodes... 
						otherwise, return ids of all nodes with specified fulltypes

					getNeighbors(_dir[,_type,_id])
						return all inbound (_dir = '<'), outbound (_dir = '>') or both
					  	(_dir = '*') neighbor ids for specified type (if any)

					print(str)
						print something to the console that launched the server

					setAttr(_attr,_val[,_id])
						((this function is only available in actions))... update the
					  	requested attr of the specified node using __chattr__ (s.t. 
						the change is logged)...  
						TBA:: type-checking on _val 

				basic checks are made on input parameters to aid in debugging faulty
				actions and constraints... for functions with id parameters, if no 
				id is given, we use the id passed to __runDesignerCode... which is 
				either the id of the node that "owns" the current constraint|action|
				accessor, or undefined if the parameter was omitted */
			var self = this;
			function getAttr(_attr,_id)
			{
				if( _id == undefined )
					_id = id;

				if( self.model.nodes[_id] == undefined )
					throw 'invalid getAttr() id :: '+_id;
				else if( !(_attr in self.model.nodes[_id]) )
					throw 'invalid getAttr() attribute :: '+_attr;

				if( _attr.charAt(0) == '$' )
					return self.model.nodes[_id][_attr];				
				else if( typeof self.model.nodes[_id][_attr]['value'] == 'object' )
					return _utils.clone(self.model.nodes[_id][_attr]['value']);
				else
					return self.model.nodes[_id][_attr]['value'];
			}
			function getAttrNames(_id)
			{
				if( _id == undefined )
					_id = id;
				if( self.model.nodes[_id] == undefined )
					throw 'invalid getAttrNames() id :: '+_id;
				return Object.getOwnPropertyNames(self.model.nodes[_id]);
			}
			function hasAttr(_attr,_id)
			{
				if( _id == undefined )
					_id = id;

				if( self.model.nodes[_id] == undefined )
					throw 'invalid getAttr() id :: '+_id;
				return _attr in self.model.nodes[_id];
			}
			function getAllNodes(_fulltypes)
			{
				if( _fulltypes != undefined && !(_fulltypes instanceof Array) )
					throw 'invalid getAllNodes() types array :: '+_fulltypes;

				var ids = [];
				for( var _id in self.model.nodes )
				{
					if( _fulltypes == undefined ||
						 _utils.contains(_fulltypes,self.model.nodes[_id]['$type']) )
						ids.push(_id);
				}
				return ids;
			}
			function getNeighbors(_dir,_type,_id)
			{
				if( _id == undefined )
					_id = id;
				
				if( _type == undefined )
					_type = '*';

				if( self.model.nodes[_id] == undefined )
					throw 'invalid getNeighbors() id :: '+_id;

				var ids = [];
				for( var i in self.model.edges )
				{
					var edge = self.model.edges[i];
					if( edge['src'] == _id && 
						 (_dir == '>' || _dir == '*' || _dir == "out") &&
						 (_type == '*' || self.model.nodes[edge['dest']]['$type'] == _type) &&
						 ! _utils.contains(ids,edge['dest']) )
						ids.push(edge['dest']);
					else if( edge['dest'] == _id && 
								(_dir == '<' || _dir == '*' || _dir == "in") &&
	  							(_type == '*' || self.model.nodes[edge['src']]['$type'] == _type) &&
								! _utils.contains(ids,edge['src']) )
						ids.push(edge['src']);
				}
				return ids;
			}
			function print(str)
			{
				_util.log(str);
			}
			function setAttr(_attr,_val,_id)
			{
				if( type != 'action' )
					throw 'setAttr() can only be used within actions';

				if( _id == undefined )
					_id = id;

				if( self.model.nodes[_id] == undefined )
					throw 'invalid setAttr() id :: '+_id;
				else if( !(_attr in self.model.nodes[_id]) || _attr.charAt(0) == '$' )
					throw 'invalid setAttr() attribute :: '+_attr;

				self.__chattr__(_id,_attr,_val);
			}


			/* evaluate provided code without the said code having access to 
				globals (i.e., model, journal) or to 'self' (which we use above to 
				allow non-global functions to access globals), and catching any 
				exceptions it may throw... escaped newlines if any are unescaped */
			function safe_eval(code)
			{
				var self = undefined;
				try
				{
					return eval(code);
				}
				catch(err)
				{
					if( err == 'IgnoredConstraint' )
						return true;
					return {'$err':err};
				}
			}	


			var res = safe_eval(code);

			if( res != undefined && res['$err'] != undefined )
				return {'$err':type+' ('+desc+') crashed on :: '+res['$err']};

			/* completed accessor */
			else if( type == 'accessor' )	
				return res;

			/* failed constraint */
			else if( res == false )
				return {'$err':type+' ('+desc+') failed'};
		},


	/* run actions or constraints for specified events and specified nodes 

		1. get types of specified nodes (note that we do a little hack for the 
			special case of pre-create handlers because this.model.nodes does not
			yet contain a node with the to-be-created node's id... thus its type 
			is read from this.next_type)
		2. identify and run applicable handlers based on events and targetTypes */
	'__runEventHandlers' : 
		function(allHandlers,events,ids,handlerType)
		{	
			var types2ids = {};
			for( var i in ids )
			{
				var id = ids[i];
				if( id == this.next_id )
					var type = this.__getType(this.next_type);
				else if( this.model.nodes[id] == undefined )
					continue;
				else
					var type = this.__getType(this.model.nodes[id]['$type']);

				if( types2ids[type] == undefined )
					types2ids[type] = [];
				types2ids[type].push(id);
			}

			for( var i in allHandlers )
			{
				var handler = allHandlers[i];
				if( _utils.contains(events,handler['event']) )
				{
					if( handler['targetType'] == '*' )
					{
						for( var j in ids )
							if( (res = this.__runDesignerCode(
														handler['code'],
														handler['event']+' '+handler['name'],
														handlerType,
														ids[j])) )
								return res;

						if( ids.length == 0 )
							if( (res = this.__runDesignerCode(
														handler['code'],
														handler['event']+' '+handler['name'],
														handlerType)) )
								return res;
					}
					else
						for( var j in types2ids[handler['targetType']] )
						{
							var id = types2ids[handler['targetType']][j];
							if( (res = this.__runDesignerCode(
														handler['code'],
														handler['event']+' '+handler['name'],
														handlerType,
														id)) )
								return res;
						}
				}
			}
		},



	/**************************** MODEL VALIDATION *****************************/
	/* verifies that the current model satisfies (1) the min cardinalities set 
		by its metamodel(s) and (2) all global eventless constraints... returns
		the first encountered discrepancy or nothing

		1. count incoming and outgoing connections of each type for each node
		2. compare the above to the min cardinalities 
		3. run all global eventless constraints */
	'validateModel' :
		function(model)
		{
			var inCounts 	= {},
				 outCounts	= {},
				 model 		= (model == undefined ? this.model : model),
                 outContainments = {},
                 containmentTargets = {};

			if( model.nodes == undefined ||
				 model.edges == undefined ||
				 model.metamodels == undefined ||
				 model.metamodels.length == 0 )
				return {'$err':'provided model is either empty or not an atompm model'}

			for( var i in model.edges )
			{
				var edge 	 = model.edges[i],
					 srcType  = this.__getType(model.nodes[edge['src']]['$type']),
					 destType = this.__getType(model.nodes[edge['dest']]['$type']),
                     srcMetamodel = this.__getMetamodel(model.nodes[edge['src']]['$type']),
                     destMetamodel = this.__getMetamodel(model.nodes[edge['dest']]['$type']);
				
				if( inCounts[edge['dest']] == undefined )
					inCounts[edge['dest']] = {};
				if( inCounts[edge['dest']][srcType] == undefined )
					inCounts[edge['dest']][srcType] = 0;
				inCounts[edge['dest']][srcType]++;

				if( outCounts[edge['src']] == undefined )
					outCounts[edge['src']] = {};
				if( outCounts[edge['src']][destType] == undefined )
					outCounts[edge['src']][destType] = 0;
				outCounts[edge['src']][destType]++;
                
                if ( outContainments[edge['src']] == undefined ) {
                    outContainments[edge['src']] = [];
                }
                if (destType in this.metamodels[destMetamodel]['connectorTypes'] && this.metamodels[destMetamodel]['connectorTypes'][destType] == 'containment') {
                    outContainments[edge['src']].push(edge['dest']);
                }
                
                if ( containmentTargets[edge['src']] == undefined ) {
                    containmentTargets[edge['src']] = [];
                }
                if (srcType in this.metamodels[srcMetamodel]['connectorTypes'] && this.metamodels[srcMetamodel]['connectorTypes'][srcType] == 'containment') {
                    containmentTargets[edge['src']].push(edge['dest']);
                }
			}

            var checked_for_loops = []
			for( var id in model.nodes )
			{
				var metamodel = this.__getMetamodel(model.nodes[id]['$type']),
					 type		  = this.__getType(model.nodes[id]['$type']);

				for( var i in this.metamodels[metamodel]['cardinalities'][type] )
				{
					var cardinality = this.metamodels[metamodel]['cardinalities'][type][i],
						 tc			 = cardinality['type'];
					if( cardinality['dir'] == 'out' && 
						 cardinality['min'] > (outCounts[id] == undefined || outCounts[id][tc] == undefined ? 0 : outCounts[id][tc]) )
						return {'$err':'insufficient outgoing connections of type '+tc+' for '+model.nodes[id]['$type']+'/'+id}; 
					else if( cardinality['dir'] == 'in' && 
								cardinality['min'] > (inCounts[id] == undefined || inCounts[id][tc] == undefined ? 0 : inCounts[id][tc]) )
						return {'$err':'insufficient incoming connections of type '+tc+' for '+model.nodes[id]['$type']+'/'+id};
				}
                
                if (checked_for_loops.indexOf(id) < 0 && !(type in this.metamodels[metamodel]['connectorTypes'])) {
                    var visited = [],
                        tv = [id];
                    function dfs(to_visit) {
                        var curr = to_visit.pop();
                        if( curr == undefined )
                            return undefined; // no more to check
                        else if( visited.indexOf(curr) > -1 )
                            return {'$err':'containment loop found for ' + model.nodes[id]['$type']+'/'+id}; // error: loop found!
                        else {
                            visited.push(curr);
                            // find all (containment) associations linked to the object, and add their targets to the to_visit list.
                            for ( var oc_idx in outContainments[curr] ) {
                                to_visit = to_visit.concat(containmentTargets[outContainments[curr][oc_idx]]);
                            }
                            return dfs( to_visit );
                        }
                    }
                    var res = dfs(tv);
                    if (res != undefined) {
                        return res;
                    }
                    checked_for_loops= checked_for_loops.concat(visited);
                }
			}
			
			for( var metamodel in this.metamodels )
				if( (err=this.__runEventHandlers(this.metamodels[metamodel]['constraints'], [''], [], 'constraint')) )
					return err;
		},



	/**************************** MODEL COMPILATION ****************************/
	/* compile the current model and the given CS model into an icon definition 
		metamodel

		0. the entire function body is wrapped in a try/catch... this is our lazy
	  		approach to verifying that the current model is indeed a valid model of
		  	an icon definition metamodel
		1. if the current model is missing the CS formalism, return error 
		2. extract information about types from current model
			a) find all ConcreteSyntax/Icons and ConcreteSyntax/Links
			b) map all CS/Icons to their IconIcon in the CS model (argument)
			c) map all CS/Icons to the nodes they're [transitively] connected to
				(except their IconContents links)
			d)	save all edges between contained nodes from step c)
			e) enhance every contained node (from step c)) with information about
				its associated IconIcon (e.g., position, orientation)... this is 
				needed so that the final '$contents' attributes of each generated
				*Icon hold sufficient information to render icons as the user 
				specified them... note that position attributes are adjusted to make
				them relative to the containing IconIcon's top-left corner
			e*) enhance nodes contained within Links with link decorator 
				 positioning information (e.g., xratio, yoffset)
			f) when pre-defined arrowheads/tails have been selected by the user,
				pretend the user has actually drawn them s.t. they get handled by
				link decorator positioning code during modelling... in practice:
					i.   identify pre-defined arrowheads/tails
					ii.  locate corresponding drawings within relevant Link's 
						  LinkIcon $contents
					iii. copy them into relevant Link's compiled $contents
					iv.  enhance them with link decorator information (c.f., step e*)
		3. construct mm.types based on information from step 2... the resulting 
			mm.types wil look very much like ConcreteSyntax.types, with a few added
			'special' attributes (e.g., $asuri, $contents, etc.) 
        4. check whether all non-abstract types have an icon, and no abstract types have an icon    
		5. return mm stringified (ensures no references to objects in this.model
			are returned) */
	'compileToIconDefinitionMetamodel' : 
		function(csm, asmm)
		{
			var CS = '/Formalisms/__LanguageSyntax__/ConcreteSyntax/ConcreteSyntax';
			try
			{
				/* 1 */
				if( ! _utils.contains(this.model.metamodels,CS) )
					throw 'icon definition models must have the '+CS+' formalism loaded';
				else 
					var model =	_utils.jsonp(this.read());
					nodes = {};
					for (var id in model.nodes) {
						console
						if (model.nodes[id]['$type'].slice(0, CS.length) == CS) {
							nodes[id] = model.nodes[id];
						}
					}
					model.nodes = nodes;

				/* 2 */
				var mm = 
	 					 {'types':{}, 
						  'constraints':[],  
						  'actions':[], 
		 				  'cardinalities':{},
		 				  'legalConnections':{}, 
		 				  'connectorTypes':{},
						  'types2parentTypes':{}},
					 iids  			= [],
					 iids2contents = {},
					 ids2csids		= {},
					 self 			= this,
					 outNeighbors	= 
						 /* returns the given node's outbound neighbors */
						 function(source)
						 {
							 return model.edges.filter(function(edge) {return edge['src'] == source && model.nodes[edge['dest']] != undefined;}).
								 							map(function(edge) {return edge['dest'];});
		 				 },
					 getConnectedNodes	= 
						 /* compute the [transitive] contents of 'container'... this
							 function is a bit of an oversimplification: it makes the
							 reasonable but not necessarily correct assumption that 
							 anything that is [transitively] connected to a CS/Icon or
							 CS/Link is inside it */
						 function(container,contents)
		 				 {
		 					 var _contents = {};
		 					 outNeighbors(container).forEach(
								 function(n)
								 {
									 if( !(n in contents) )
										 _contents[n] = 1;
			 					 });

							 if( _utils.keys(_contents).length == 0 )
								 return contents;

							 contents = _utils.mergeDicts([contents,_contents]);
							 return _utils.mergeDicts(
											_utils.keys(_contents).map( 
												function(_c) {return getConnectedNodes(_c,contents);} ));
		 				 };

				/* 2a */
				for( var id in model.nodes )
					if( model.nodes[id]['$type'] == CS+'/Icon' ||
						 model.nodes[id]['$type'] == CS+'/Link' )
					{
						iids.push(id);
						iids2contents[id] = {'nodes':{},'edges':[]};
					}

				/* 2b */
				csm = _utils.jsonp(csm);
				for( var csid in csm.nodes )
				{
					var id = csm.nodes[csid]['$asuri']['value'].match(/.*\/(.*)\.instance$/)[1];
					ids2csids[id] = csid;
				}

				iids.forEach(
					function(iid)
					{		
						/* 2c */
						_utils.keys(getConnectedNodes(iid,{})).filter(
							function(id)
							{
								return model.nodes[id]['$type'] != CS+'/IconContents';
							}).forEach(	
									function(id)
									{
										iids2contents[iid].nodes[id] = model.nodes[id];
									});

						/* 2d */
						model.edges.forEach(	
							function(edge)
							{
								if( iids2contents[iid].nodes[edge['src']] != undefined  &&
									 iids2contents[iid].nodes[edge['dest']] != undefined )
									iids2contents[iid].edges.push(edge);
							});

						/* 2e */
					 	var iidCSIcon = csm.nodes[ ids2csids[iid] ];
						for( var vid in iids2contents[iid].nodes )
						{
							var vidCSIcon  	  = csm.nodes[ ids2csids[vid] ],
								 vidContentsNode = iids2contents[iid].nodes[vid];
							['position','orientation','scale','link-style'].forEach( 
									function(_) {vidContentsNode[_] = vidCSIcon[_];});
							var vidContentsNodePosition = vidContentsNode['position']['value'],
								 iidCSIconPosition		 = iidCSIcon['position']['value'],
								 vidContentsNodeRelX		 = vidContentsNodePosition[0] - iidCSIconPosition[0],
								 vidContentsNodeRelY		 = vidContentsNodePosition[1] - iidCSIconPosition[1];
							vidContentsNode['position']['value'] = [vidContentsNodeRelX,vidContentsNodeRelY];

							/* 2e* */
							if( model.nodes[iid]['$type'] == CS+'/Link' )
							{
								var sx			  = iidCSIcon['scale']['value'][0],
									 sy			  = iidCSIcon['scale']['value'][1],
									 linkPathBBox = 
										{'x':sx*35,
										 'y':sy*77,
										 'width': sx*198,
										 'height': sy*(model.nodes[iid]['link-style']['stroke-width'] || 1)};

								vidContentsNode['position']['value'] = [0,0];
								vidContentsNode['$linkDecoratorInfo'] = 
									{'type':'map<string,double>',
									 'value':
										{'xratio' :(vidContentsNodeRelX-linkPathBBox.x) / (linkPathBBox.width-linkPathBBox.x),
										 'yoffset':vidContentsNodeRelY - (linkPathBBox.y+linkPathBBox.height/2)}};
							}
						}
						
						/* 2f */
						if( model.nodes[iid]['$type'] == CS+'/Link' )
						{
							var contents = csm.nodes[ids2csids[iid]]['$contents']['value'].nodes,
								 sy		 = iidCSIcon['scale']['value'][1];
							['arrowHead','arrowTail'].forEach(
								function(at)
								{
									if( !(at in model.nodes[iid]) )
										throw 'migrate to new Link specification means to compile';

									var a = model.nodes[iid][at]['value'];
									if( a != 'custom' )
										for( var vid in contents )
											if( 'mapper' in contents[vid] &&
												 ( _styleinfo[a + ':' + at] ) && (matches = contents[vid]['mapper']['value'].match("^'"+a+":"+at+":(.*)';")) )
											{
												iids2contents[iid].nodes[vid] = contents[vid];
												iids2contents[iid].nodes[vid]['mapper']['value'] = '';
												iids2contents[iid].nodes[vid]['position']['value'] = [0,0];
												iids2contents[iid].nodes[vid]['$linkDecoratorInfo'] =
													{'type':'map<string,double>',
			  										 'value':
													 	{'xratio' :(at == 'arrowHead' ? -1 : 1),
														 'yoffset':-_styleinfo[a + ':' + at]/2*sy}};
												break;
											}
								});
						}


						/* 3 */
						var node   			= model.nodes[iid];
					  		type   	        = node['typename']['value'];
							isConnectorType = 'link-style' in node;
						mm.types[type] = [];

						self.metamodels[CS].
								types[(isConnectorType ? 'Link' : 'Icon')].forEach(
									function(attr)
									{
										if( _utils.contains(['link-style','typename','mapper','parser','position'],attr['name']) )
											mm.types[type].push(
												{'name':		attr['name'],
			  									 'type':		node[attr['name']]['type'],
												 'default':	node[attr['name']]['value']});
										else
											mm.types[type].push(attr);	
									});
						mm.types[type].push(								
								{'name':		'$contents',
								 'type':		'map<string,*>',
								 'default':	iids2contents[iid]},
								{'name':		'$asuri',
								 'type':		'string',
								 'default':	'-1'});
						if( isConnectorType )
							mm.types[type].push(
								{'name':		'$segments',
								 'type':		'map<string,list<string>>',
								 'default':	{}});


						mm.cardinalities[type] = [];
						mm.types2parentTypes[type] = [];
					});
                
                /* 4 */
                var types = [],
                    abstractTypes = [];
                    
                for (var idx in asmm["constraints"]) {
                    var curr_constraint = asmm["constraints"][idx];
                    if (curr_constraint["name"] == "noAbstractInstances") {
                        abstractTypes.push(curr_constraint["targetType"]);
                    }
                }
                
                for (var curr_type in asmm["types"]) {
                    if ((curr_type + 'Link' in mm["types"]) || (curr_type + 'Icon' in mm["types"])) {
                        if (abstractTypes.indexOf(curr_type) >= 0) {
                            return {'$err':'abstract type '+curr_type+' cannot have a visual representation'};
                        }
                    } else {
                        if (abstractTypes.indexOf(curr_type) < 0) {
                            return {'$err':'concrete type '+curr_type+' needs to have a visual representation'};
                        }
                    }
                }
                
                for (var curr_type in mm["types"]) {                    
                    if (!(curr_type.slice(0, -4) in asmm["types"])) {
                        return {'$err':'type '+curr_type.slice(0, -4)+' not found in the abstract syntax metamodel, visual representation ' + curr_type + ' invalid'};
                    }
                }
                    
				/* 5 */
				return _utils.jsons(mm,null,"\t");
			}
			catch(err)
			{
				return {'$err':'invalid metamodel model, crashed on :: '+err};
			}
		},

	/* compile the current model into a metamodel

		0. the entire function body is wrapped in a try/catch... this is our lazy
	  		approach to verifying that the current model is indeed a valid model of
		  	a metamodel
		1. if the current model is not an ER or a SCD model, return error 
		2. if the current model is a SCD model, transform it into an ER model 
			before beginning compilation (via _mt.transform)
		3. copy information about types, constraints, actions, cardinalities,  
			connectorTypes and types2parentTypes from current model to mm
		4. add any missing cardinalities (relationships between entities define 
			legal connections but the user might have omitted to specify their
			cardinalities), then construct legalConnections and store it in mm
		5. return mm stringified (ensures no references to objects in this.model
			are returned) */
	'compileToMetamodel' : 
		function()
		{
			var ER  = '/Formalisms/__LanguageSyntax__/EntityRelationship/EntityRelationship',
				 SCD = '/Formalisms/__LanguageSyntax__/SimpleClassDiagram/SimpleClassDiagram',
				 isolateMMModel = 
					 /* remove all non-ER/SCD entities from the provided model... 
						 doing so considerably eases compilation */
					 function(m)
					 {
						 m = _utils.jsonp(m);						 	  
		 				 for( var id in m.nodes )
							 if( ! m.nodes[id]['$type'].match('^'+ER) &&
								  ! m.nodes[id]['$type'].match('^'+SCD) )
								 delete m.nodes[id];
						 var keepEdges = [];
						 m.edges.forEach(
							function(edge,i) 
							{	
								if( edge['src'] in m.nodes && edge['dest'] in m.nodes )
									keepEdges.push(edge);
							});
						 m.edges = keepEdges;
						 return m;
					 };
			try
			{
				/* 1-2 */
				if( _utils.contains(this.model.metamodels,ER) &&
					 _utils.contains(this.model.metamodels,SCD) )
					throw 'metamodel models should not have more than one loaded metametamodel';
				else if( _utils.contains(this.model.metamodels,ER) )
					var model = isolateMMModel(this.read());
				else if( _utils.contains(this.model.metamodels,SCD) )
					var model =	_mt.transform(
										_utils.jsons(isolateMMModel(this.read())),
										'SimpleClassDiagram-2-EntityRelationship');
				else
					throw 'metamodel models should have at least one loaded metametamodel';

				/* 3 */
				var mm = 
	 					 {'types':{}, 
						  'constraints':[],  
						  'actions':[], 
		 				  'cardinalities':{},
		 				  'legalConnections':{}, 
		 				  'connectorTypes':{},
						  'types2parentTypes':{}};	
				for( var id in model.nodes )
				{
					var node = model.nodes[id];
					if( node['$type'] == ER+'/Entity' ||
						 node['$type'] == ER+'/Relationship' )
					{
						var type = node['name']['value'];

						mm.types[type] = [];

						node['attributes']['value'].forEach(
								function(attr)	{mm.types[type].push(attr);});
		
						node['constraints']['value'].forEach(
								function(constraint)	
								{
									constraint['targetType'] = type;
								  	mm.constraints.push(constraint);
								});

						node['actions']['value'].forEach(
								function(action)	
								{
									action['targetType'] = type;
								  	mm.actions.push(action);
								});

						mm.cardinalities[type] = node['cardinalities']['value'];
		
						if( node['linktype'] != undefined )
							mm.connectorTypes[type] = node['linktype']['value']; 
					}

					else if( node['$type'] == ER+'/GlobalConstraint' )
						mm.constraints.push(
								{'name':node['name']['value'],
								 'event':node['event']['value'],
					  			 'targetType':'*',
					  			 'code':node['code']['value']});

					else if( node['$type'] == ER+'/GlobalAction' )	
						mm.actions.push(
								{'name':node['name']['value'],
								 'event':node['event']['value'],
					  			 'targetType':'*',
					  			 'code':node['code']['value']});

					else
						throw 'node "'+id+'" does not conform to the '+ER+' metamodel';		
				}
				mm.types2parentTypes = model.types2parentTypes || {};

				/* 4 */
				var types2legalNeighborTypes = {},
	 				 addMissingCardinalities  = 
						 function(t1,t2,dir)									
						 {
							 /* if there is no cardinality between t1 and t2 for dir, add a default cardinality...
									1:1 			for links
									0:Infinity 	for nodes */
	 						 if( ! mm.cardinalities[t1].some( function(c) {return c['type'] == t2 && c['dir'] == dir;} )  )
		 					 {
		 						 if( mm.connectorTypes[t1] )
		 							 mm.cardinalities[t1].push( 
			 								 {'dir':dir,
											  'type':t2,
			 								  'min':'0',
			 								  'max':'1'});
		 						 else
		 							 mm.cardinalities[t1].push( 
			 								 {'dir':dir,
											  'type':t2,
			 								  'min':'0',
			 								  'max':'Infinity'});
		 					 }
		 				 };
				model.edges.forEach(
						function(edge)
						{
							var srcType  = model.nodes[edge['src']]['name']['value'],
								 destType = model.nodes[edge['dest']]['name']['value'];
							addMissingCardinalities(srcType,destType,'out',mm.connectorTypes[srcType]);
							addMissingCardinalities(destType,srcType,'in',mm.connectorTypes[destType]);									
						});				
				for( var type in mm.types )
				{
					if( types2legalNeighborTypes[type] == undefined )
						types2legalNeighborTypes[type] = [];
	
					mm.cardinalities[type].forEach(
							function(cardinality)
							{
								if( cardinality['dir'] == 'out' )
									types2legalNeighborTypes[type].push(cardinality['type']);
							});
				}					
				for( var type in types2legalNeighborTypes )
				{
					if( mm.connectorTypes[type] != undefined ) 
						continue;

					types2legalNeighborTypes[type].forEach(
							function(ntype)
							{
								types2legalNeighborTypes[ntype].forEach(
									function(nntype)
									{
										if( mm.legalConnections[type] == undefined )
											mm.legalConnections[type] = {};
										if( mm.legalConnections[type][nntype] == undefined )
											mm.legalConnections[type][nntype] = []
										mm.legalConnections[type][nntype].push(ntype);
									});
								});
				}

				/* 5 */
				return _utils.jsons(mm,null,"\t");
			}
			catch(err)
			{
				return {'$err':'invalid metamodel model, crashed on :: '+err};
			}
		},



	/************************* JOURNALING + UNDO/REDO **************************/
	'journal':[],
	'journalIndex':0,

	/* NOTE: on this.undoredoJournal 
			this.undoredoJournal contains cud operations performed during the last
			undo()/redo() call provided no user-operations was performed since the 
			said call (in which case this.undoredoJournal is empty)... undo/redo 
			ops need to be logged for __changelog() to be able to return their 
			effects... however, they should not be logged in the main journal since
		  	all they conceptually do is move a cursor in it... in practice, 
			this.undoredoJournal is emptied on every call to undo(), redo() and 
			__setStepCheckpoint() */


	/*	create a checkpoint : add an entry in the log used as a delimiter to know
	  	where to stop when restoring (i.e., undoing failed pre-/post-actions or 
		crud ops) */
	'__checkpoint' :
		function()
		{
			this.__log({'op':'MKCHKPT'});
		},


	/* deletes the last checkpoint of the current model (other than tidying the
	  	journal, there's no reason for ever clearing unused checkpoints) */ 
	'__clearCheckpoint' :
		function()
		{
			for( var i=this.journal.length-1; i>=0; i-- )
				if( this.journal[i]['op'] == 'MKCHKPT' )
				{
					this.journal.splice(i,1);
					this.journalIndex--;
					break;
				}
		},


	/* case 1: 'this.undoredoJournal is defined (possibly empty)'
		returns the operations performed by the last undo()/redo() 

		case 2: 'this.undoredoJournal = undefined'
		returns a copy of the portion of the journal that describes the changes
	  	made by the last user-operation... note that user-operations always call 
		__setStepCheckpoint before running */
	'__changelog' :
		function()
		{
			if( this.undoredoJournal != undefined )
				return _utils.clone( this.undoredoJournal.splice(0) );

			var ji = this.journalIndex;
			while( ji > 0 )
				if( this.journal[--ji]['op'] == 'MKSTPCHKPT' )
					break;
			return _utils.clone( this.journal.slice(ji+1,this.journalIndex) );
		},


	/* case 1: 'log=undefined'
		logs an internal cud operation into the journal... if the current index in
		the journal is anything but the end of the journal, clear everything after
		the index (this effectively erases the command "future-history" when 
		editing an "undone" model)

		case 2: 'log="UNDOREDO"'
		logs an internal cud operation into this.undoredoJournal

		case 3: 'log="DONTLOG"'
		do nothing
		
			legal logging commands:
				MKNODE	id,node
				RMNODE	id,node
				MKEDGE	id,id
				RMEDGE	id,id
			 	CHATTR	id,attr,new_val,old_val
				LOADMM	name,mm
				DUMPMM	name,mm
				RESETM	name,model 
				MKCHKPT
				MKSTPCHKPT
				MKUSRCHKPT */
	'__log' :
		function(step,log)
		{
			if( log == undefined )
			{
				if( this.journalIndex != this.journal.length )
					this.journal.splice(this.journalIndex);
				this.journal.push(step);
				this.journalIndex++;
			}

			else if( log == 'UNDOREDO' )
				this.undoredoJournal.push(step);

			else if( log == 'DONTLOG' )
				;
		},


	/* redo a single step 
	 
  		1. identify the nature of the logged operation 
	 	2. reproduce its effects (these are logged in this.undoredoJournal) */
	'__redo' : 
		function(step)
		{
			var log = 'UNDOREDO';
			if( step['op'] == 'CHATTR' )			this.__chattr__(step['id'],step['attr'],step['new_val'],log);
			else if( step['op'] == 'DUMPMM' )	this.__dumpmm__(step['name'],log);
			else if( step['op'] == 'LOADMM' )	this.__loadmm__(step['name'],step['mm'],log);
			else if( step['op'] == 'MKEDGE' )	this.__mkedge__(step['id1'],step['id2'],step['i'],log);
			else if( step['op'] == 'MKNODE' )	this.__mknode__(step['id'],_utils.jsonp(step['node']),log);
			else if( step['op'] == 'RESETM' )	this.__resetm__(step['new_name'],step['new_model'],false,log);
			else if( step['op'] == 'RMEDGE' )	this.__rmedge__(step['i'],log);
			else if( step['op'] == 'RMNODE' )	this.__rmnode__(step['id'],log);
		},


	/* redo all of the changes until the next step-checkpoint or until after the 
		specified user-checkpoint, if any... when complete the journal index is 
		after the redone MKSTPCHKPT/MKUSRCHKPT entry... redoing when the journal 
		index is at the end of the journal will have no effect */
	'redo' :
		function(uchkpt)
		{
			this.undoredoJournal = [];			
			var stopMarkerReached = 
					(uchkpt == undefined ?
					 	function(step)	{return step['op'] == 'MKSTPCHKPT';} :
						function(step)	{return uchkptEncountered && step['op'] == 'MKUSRCHKPT';}),
				 self 				 = this,
				 uchkptEncountered = false,
				 uchkptReached		 = function(step)	{return step['op'] == 'MKUSRCHKPT' && step['name'] == uchkpt;},
 				 uchkptFound 	 	 =
					 function(i)
					 {
						 while( i < self.journal.length )
							 if( uchkptReached(self.journal[i++]) )
 								 return true;
						 return false;
					 };
		
			if( uchkpt == undefined || uchkptFound(this.journalIndex) )	
				while( this.journalIndex < this.journal.length )
				{
					if( uchkpt != undefined && 
						 ! uchkptEncountered && 
						 uchkptReached(this.journal[this.journalIndex]) )
						uchkptEncountered = true;
					if( this.journal[++this.journalIndex] == undefined ||
						 stopMarkerReached( this.journal[this.journalIndex] ) )
						break;
					else
						this.__redo(this.journal[this.journalIndex]);
				}

			return {'changelog':this.__changelog()};
		},


	/*	undo every logged operation until a MKCHKPT is reached (and remove them 
		and the said MKCHKPT from the journal)... note that this operation is only
		called internally and that the journalIndex will always be at the end of 
		the journal when it's called (and after its called) */
	'__restoreCheckpoint' :
		function()
		{
			while( this.journal.length > 0 )
			{
				var step = this.journal.pop();
				if(step['op'] == 'MKCHKPT' )
					break;
				else
					this.__undo(step,'DONTLOG');
			}
			this.journalIndex = this.journal.length;
		},


	/*	create a step-checkpoint : add an entry in the log used as a delimiter to 
		know where to stop when undoing/redoing (i.e., on client undo/redo) 
	 
		1. create new step-checkpoint or re-use a 'zombie' step-checkpoint (zombie
	  		step-checkpoints (SC) are SCs associated to failed or effectless user 
			operations... they are recognizable as SCs with no following log 
			entries... there's at most 1 zombie SC in the log at any given time) */
	'__setStepCheckpoint' :
		function()
		{
			this.undoredoJournal = undefined;			
			if( this.journal.length == 0 ||
				 this.journal[this.journal.length-1]['op'] != 'MKSTPCHKPT' )
				this.__log({'op':'MKSTPCHKPT'});
		},


	/*	create a user-checkpoint : add an entry in the log used as a delimiter to 
		enable undoing/redoing until a specified marker 	

		1. create new step-checkpoint or re-use a 'zombie' user-checkpoint (zombie
	  		user-checkpoints (UC) are UCs associated to failed or effectless user 
			operations... they are recognizable as same-name UCs with no following 
			log entries... there's at most 1 zombie UC per name in the log at any 
			given time) */
	'setUserCheckpoint' :
		function(name)
		{
			this.undoredoJournal = undefined;
			if( this.journal.length == 0 ||
				 this.journal[this.journal.length-1]['op'] != 'MKUSRCHKPT' ||
			  	 this.journal[this.journal.length-1]['name'] != name )
				this.__log({'op':'MKUSRCHKPT','name':name});
		},


	/* undo a single step 
	 
  		1. identify the nature of the logged operation 
	 	2. invert its effects (these may be ignored (log = 'DONTLOG') or logged in
	  		this.undoredoJournal (log = 'UNDOREDO') */
	'__undo' : 
		function(step,log)
		{
			if( step['op'] == 'CHATTR' )			this.__chattr__(step['id'],step['attr'],step['old_val'],log);
			else if( step['op'] == 'DUMPMM' )	this.__loadmm__(step['name'],step['mm'],log);
			else if( step['op'] == 'LOADMM' )	this.__dumpmm__(step['name'],log);
			else if( step['op'] == 'MKEDGE' )	this.__rmedge__(step['i'],log);
			else if( step['op'] == 'MKNODE' )	this.__rmnode__(step['id'],log);
			else if( step['op'] == 'RESETM' )	this.__resetm__(step['old_name'],step['old_model'],false,log);
			else if( step['op'] == 'RMEDGE' )	this.__mkedge__(step['id1'],step['id2'],step['i'],log);
			else if( step['op'] == 'RMNODE' )	this.__mknode__(step['id'],_utils.jsonp(step['node']),log);
		},


	/* undo all of the changes since the last step-checkpoint or since the 
		specified user-checkpoint, if any... when complete the journal index is on
	  	the undone MKSTPCHKPT/MKUSRCHKPT entry... undoing when the journal index is 0
		or when a non-existing user-checkpoint is given will have no effect */
	'undo':
		function(uchkpt)
		{
			this.undoredoJournal = [];
			var stopMarkerReached = 
					(uchkpt == undefined ?
					 	function(step)	{return step['op'] == 'MKSTPCHKPT';} :
						function(step)	{return step['op'] == 'MKUSRCHKPT' && step['name'] == uchkpt;}),
				 self 				 = this,
				 stopMarkerFound 	 =
					 function(i)
					 {
						 while( --i >= 0 )
							 if( stopMarkerReached(self.journal[i]) ) 
 								 return true;
						 return false;
					 };

			if( uchkpt == undefined || stopMarkerFound(this.journalIndex) )	
				while( this.journalIndex > 0 )
					if( stopMarkerReached( this.journal[--this.journalIndex] ) )
						break;
					else
						this.__undo(this.journal[this.journalIndex],'UNDOREDO');	

			return {'changelog':this.__changelog()};
		},



	/****************************** INTERNAL CUD *******************************/
	/* the following functions are super basic and low-level, they offer cud (no
	  	read) commands on this' internal data structures... their main purposes 
		are (1) to localize the said cud operations, and (2) to log everything
		they do... logging enables undoing and redoing (on constraint/action/... 
		failure or on client requests) and facilitates change pushing (i.e., push 
		a short change log rather the full model)... note that it is assumed that 
		only valid parameters are passed to these functions... last but not least,
		the optional 'log' parameter is used when undoing/redoing to log undoing/
		redoing cud ops elsewhere than in this.journal

		__chattr__	change an attribute's value
						> log id,attr,new_val,old_val
		__dumpmm__	remove mm from this.model.metamodels and this.metamodels	
						> log name,mm
		__loadmm__	add a mm to this.model.metamodels and this.metamodels
						> log name,mm
		__mkedge__	add an edge to this.model.edges... optional 'i' parameter 
						specifies index of new edge in this.model.edges
						> log id1,id2,i
		__mknode__	add a node to this.model.nodes
						> log id,node
		__resetm__	when the 'insert' parameter is false, replaces the current
	  					model with another + updates this.next_id to account for ids
					  	in loaded model + updates model.metamodels to account for 
						metamodels loaded before the model
						when the 'insert' parameter is true, inserts the given model
						alongside the current model + alters the given model's ids to
					  	avoid clashes with existing ids + updates this.next_id... the
					  	logged value of 'insert' ends up being the offset we applied
						to the provided model's ids
						> log new_name,new_model,old_name,old_model,insert	
		__rmedge__	remove an edge from this.model.edges
						> log id1,id2,i
		__rmnode__	remove a node from this.model.nodes
						> log id,node 
	 
		note: these functions never log any 'live' data into the log (i.e., any 
				references that could be altered elsewhere thereby altering the 
				journal's contents) */
	'__chattr__' :
		function(id,attr,new_val,log)
		{
			var getattr = undefined, 
				 setattr = undefined,
				 attrval = function(v) {return (v == undefined ? v : _utils.jsonp(v));},
				 self		= this;
			if( attr.match(/.+\/.+/) )
			{
				var curr = this.model.nodes[id];
				for( var i in (path = attr.split('/')) )
					curr = curr[path[i]];
				getattr = function()	 {return curr['value'];};
				setattr = function(v) {curr['value'] = v;};
			}
			else
			{
				getattr = function()  {return self.model.nodes[id][attr]['value'];};
				setattr = function(v) {self.model.nodes[id][attr]['value'] = v;};
			}

			var _old_val = _utils.jsons(getattr()),
				 _new_val = _utils.jsons(new_val);
			if( _old_val == _new_val )
				return;
			setattr( attrval(_new_val) );
			this.__log(
					{'op':'CHATTR',
					 'id':id,
					 'attr':attr,
					 'new_val': attrval(_new_val),
					 'old_val': attrval(_old_val)},
					 log);	
		},
	'__dumpmm__' :
		function(name,log)
		{
			for( var i in this.model.metamodels )
				if( this.model.metamodels[i] == name )
				{
					this.model.metamodels.splice(i,1);
					break;
				}
			var mm = this.metamodels[name];
			delete this.metamodels[name];
			this.__log(
					{'op':'DUMPMM',
					 'name':name,
					 'mm':_utils.jsons(mm)},
					 log);
		},
	'__loadmm__' :
		function(name,mm,log)
		{
			this.metamodels[name] = eval('('+ mm +')');
			if( ! _utils.contains(this.model.metamodels,name) )
				this.model.metamodels.push(name);
			this.__log(
					{'op':'LOADMM',
					 'name':name,
					 'mm':mm},
					 log);
		},
	'__mkedge__' :	
		function(id1,id2,i,log)			
		{
			if( i == undefined )
				i = this.model.edges.push({'src':id1, 'dest':id2})-1;
			else
				this.model.edges.splice(i,0,{'src':id1, 'dest':id2});

			this.__log(
					{'op':'MKEDGE',
					 'id1':id1,
					 'id2':id2,
					 'i':i},
					 log);
		},
	'__mknode__' :
		function(id,node,log)			
		{
			this.model.nodes[id] = node;
			this.__log(
					{'op':'MKNODE',
					 'id':id,
					 'node':_utils.jsons(node)},
					 log);
		},
	'__resetm__' :
		function(new_name,new_model,insert,log)
		{
			var old_model = this.read(),
				 old_name  = this.name;

			if( insert )
			{
				var _new_model = eval('('+ new_model +')');

				for( var id in _new_model.nodes )
					this.model.nodes[parseInt(id)+this.next_id] = _new_model.nodes[id];

				_new_model.edges.forEach(
					function(edge)
					{
						this.model.edges.push(
							{'src':  parseInt(edge.src)+this.next_id,
							 'dest': parseInt(edge.dest)+this.next_id});
					}, this);

				new_model = this.read();
				insert = this.next_id;
			}
			else
			{
				this.model = eval('('+ new_model +')');
				for( var mm in this.metamodels )
					if( ! _utils.contains(this.model.metamodels,mm) )
						this.model.metamodels.push(mm);
			}
			
			this.name = new_name;
			for( var id in this.model.nodes )
				if( id >= this.next_id )
					this.next_id = parseInt(id)+1;

			this.__log(
					{'op':'RESETM',
					 'new_name': new_name,
					 'new_model':new_model,
					 'old_name': old_name,
					 'old_model':old_model,
					 'insert':insert},
					 log);			
		},
	'__rmedge__' :	
		function(i,log)
		{
			var edge = this.model.edges.splice(i,1).pop();
			this.__log(
					{'op':'RMEDGE',
					 'i':i,
					 'id1':edge['src'],
					 'id2':edge['dest']},
					 log);
		},
	'__rmnode__' :
		function(id,log)			
		{
			node = this.model.nodes[id];
			delete this.model.nodes[id];
			this.__log(
					{'op':'RMNODE',
					 'id':id,
					 'node':_utils.jsons(node)},
					 log);
		},



	/***************************** INTERNAL UTILS ******************************/
	/* splits a full type of the form '/path/to/metamodel/type' and returns 
		'/path/to/metamodel' */
	'__getMetamodel' :
			function(fulltype)
			{
				return fulltype.match(/(.*)\/.*/)[1];
			},


	/* splits a full type of the form '/path/to/metamodel/type' and returns
	  	'type' */
	'__getType' :
			function(fulltype)
			{
				return fulltype.match(/.*\/(.*)/)[1];
			}
}
