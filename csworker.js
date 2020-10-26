/* This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
*  Copyright 2011 by the AToMPM team and licensed under the LGPL
*  See COPYING.lesser and README.md in the root of this project for full details
*/

/* NOTES: 
	it is assumed that csworker _mmmk cud operations NEVER FAIL... 
		1. IMPLICATIONS
			a) we don't check for failure
			b) if failure were to occur, we wouldn't rollback the associated 
				asworker perations
			c) *Icons.metamodels should NOT support actions, constraints or
				multiplicities to ensure neither of these block cud operations...
			  	they do however support parsing functions (designer code that 
				translates CS updates into AS operations) which are somewhat akin to
				pre-edit actions: if the parsing function or the AS operations fail,
			  	the CS update fails	
		2. REASONING
			a) if we allowed csworker to rollback asworker operations, it would be
				a natural extension for csworkers to be allowed to fail and "respond
			  	negatively" to pushed changelogs and request asworker rollbacks... 
				this might	cause severe user experience problems in collaboration 
				scenarios (e.g., A's changes could be repeatedly undone by failures
			  	produced by B's csworker)
			b) it doesn't make sense for logic that could overturn AS cud 
				operations to live anywhere else than in the AS spec 
 	

	csworker cud operations are CHANGELOG-DRIVEN... in other words, when a client
  	makes PUT/POST/DELETE requests to a csworker, these are translated into
  	appropriate requests for an asworker...
		1. on success, the asworker 
			a) returns a 20x status code to the csworker who made the request, in
		  		turn, it forwards it to the client who made the request
			b) returns a changelog that describes the AS impacts of the request...
				this changelog is pushed to all of its csworker subscribers 
				(including the one who made the request) and which point their
				internal CS models are adjusted to reflect AS changes... finally,
				the result of these CS model modifications are themselves bundled
			  	into changelogs that are forwarded to all subscribed clients 
				(subscription managment is performed in httpwsd.js)
		2. on failure, the asworker
			a) returns a 40x|50x status code to the csworker...
	so basically, when a client asks a csworker to change something, all that
	csworker does is forward the request to its asworker... if and when the 
	csworker does comply, it will be in response to an asworker changelog 
	received sometime after it has responded a 20x status code to the client


	'HITCHHIKERS' allow subscriber information exchange... for instance, if A
  	loads SC.purpleIcons.metamodel, we'd like for all csworkers subscribed to A's
  	associated asworker to be told (1) that their asworker has loaded 
	SC.metamodel *and* (2) that they should load SC.purpleIcons.metamodel... with
  	hitchhikers, 'subscriber-relevant' but 'worker-irrelevant' data is sent to
  	workers so that they may push it back to all of their subscribers upon
  	returning  


	technically, asworkers and csworkers could be run on DISTINCT MACHINES...
	however, for the moment, this is neither supported nor recommended:
		1. csworkers as they are now are not robust to asworker failures caused by
	  		timeouts and/or other network problems
		2. requests to asworkers would need to be prepended with the actual url of
	  		wherever the asworker is being served from 
 
		
	there are at least 3 alternatives for EVALUATING A MAPPING FUNCTION
	  	1. retrieve the full AS model and run the mapping function within this
			csworker within some scope where the said model is accessible via the
		  	designer API (ala. _mmmk.__runDesignerCode())
				+ RESTful requests to asworker
				- possibly very inefficient to transmit AS model
		2. run the mapping function within this csworker within some scope where
	  		calls to getAttr() are translated to REST that retrieve desired 
			information from the asworker
				+ RESTful requests to asworker
				- possibly numerous queries
		3. send mapping function to asworker and run it there
				- non-RESTful request
				+ most efficient in terms of data traffic
	we chose the 3rd approach for its efficiency... furthermore, when 
	regenerating icons (who may contain numerous VisualObjects with numerous
	coded attributes), to avoid having to send many queries to the asworker 
	(i.e., one for each mappingf), we bundle together all of the icon's mappingfs
  	and send them to the asworker for evaluation in a single query


	CREATING AN ICON AT A SPECIFIC POSITION brings up a few issues in the context
	where icon position plays a role in AS attribute values... consider this
	scenario:
		1. user creates a BuildingIcon at (500,600)
		2. request is received by csworker and forwarded to asworker
		3. asworker creates a Building and sets abstract attribute 'address' to
	  		metamodel-specified default (0,0) 
		4. later, __applyASWChanges() receives MKNODE
			a) it creates a BuildingIcon
			b) sets its 'position' to (500,600)
			c) calls __regenIcon() who determines that 'position' should be (0,0)
		  		after mapping AS attribute 'address'
			d) emits changelog instructing client to create a BuildingIcon at (0,0)
	the core issue here is that step 4b) is a hack... instead of 'position' being
	set via 'PUT *.cs' which would have parsed 'position', appropriately updated 
	'address', and only later -- via AS changelog -- mapped 'address' and updated
  	'position', step 4b) bypasses this whole pipeline... this causes CS and AS to
  	be out-of-sync, which in turn causes the behaviour described for step 4c)... 
	to address this issue, during step 2 we perform a task similar to that of 
	'PUT *.cs'... step 2 from the above scenario thus becomes:
		0. request is received by csworker
		A. retrieve the BuildingIcon's parser
		B. create a dummy context where a *Icon's parser can be run... within this
	  		context, 'orientation' and 'scale' are set to their defaults, but 
			'position' is set to (500,600)
		C. run the BuildingIcon's parser within this dummy context, this could
			yield {'address':(5,6)}
		D. forwarded creation request to asworker *and* bundle the result from 
			step C.
	step 3 is also slightly changed: the asworker creates a new Building *and*
	updates any specified attributes, in our example, 'address' would be set to
   (5,6)... step 4 is left unchanged but step 4c) no longer causes any problems
	because __regenIcon's mapping of 'address' will return (500,600)
  

	supporting undo/redo requires REMEMBERING HITCHHIKERS... __applyASWChanges()
	sometimes expects asworker changelogs to be bundled with hitchhikers... this
	is the case when changelogs are the result of 'normal' requests getting
	forwarded to the asworker by the csworker... however, for undos/redos, no 
	hitchhikers are bundled and as such, when __applyASWChanges() is called as a
  	result of undos and redos on the asworker, required information that would 
	normally be in hitchhikers is missing... to address this, we 'remember' 
	hitchhikers as we encounter them like so:
		1. MKNODE hitchhikers are remembered by asid
	 	2. LOADMM hitchhikers are remembered by asmm
		3. RESETM hitchhikers are remembered by name *
			* for this case, we also create and remember a hitchhiker to enable
		  	  undoing loading a model over an unsaved non-empty model 
	long story short, when handling asworker changelogs, missing hitchhikers, if
  	any, are retrieved from the __hitchhikerJournal 
	

	supporting FULL UNDO/REDO in our distributed environment presents a few 
	challenges
		1. operations with no AS implications should be undone/redone by csworkers
		2. operations with AS implications should be undone/redone by asworkers
			*but* resulting changelogs should be handled specially to ensure that
			csworkers undo/redo in response to asworer undo/redos
	challenge 1 requires means to determine what kind of operation the client
  	wishes to undo/redo... we addressed this by logging handled sequence#s (via
	__checkpointUserOperation()... when an undo/redo request is received, the 
	current sequence# to undo/redo dictates whether we're in case 1 or 2.
	challenge 2 requires means to determine whether or not an asworker changelog
  	pertains to an undo/redo operation *and*, which csworker operations to undo/
	redo in response to an asworker undo/redo... we addressed this in 3 parts
		1. when DOing something in response to asworker changelogs, the csworker
			sets a user-checkpoint (named after the asworker sequence#) in its 
			journal
		2. when forwarding undo/redo requests to asworkers, the asworker sequence#
	  		to undo/redo is bundled in a hitchhiker
		3. when an asworker changelog has a bundled undo/redo hitchhiker, the 
			csworker handles it by undoing/redoing all of the changes the bundled
		  	asworker sequence# had originally induced
	step 3 is paramount... if the csworker responded to undo/redos like it would
	any other request (e.g., respond to RMNODE by RMNODE), it would become out of
	sync with the asworker... see example below:
		1. client creates A/0, AIcon/0
		2. client moves AIcon/0
		3. client undoes move	(csworker only, OK)
		4. client undoes create (would trigger RMNODE A/0, AIcon/0)
		5. client redoes create	(would trigger MKNODE A/0, AIcon/1)
		6. client redoes move	(will fail because AIcon/0 doesn't exist)
	in short, proper undo/redo requires that operations resultings from undo/redo
	be distinguishable from normal ones 
	
	
	TBI:: undoing/redoing SYSOUT-only changelogs has no perceptible effect from 
			client... one inconvenient side-effect of this is that rules require 2
			undos/redos to undo/redo: 1 to undo/redo the rule, 1 to undo/redo the
			SYSOUT message announcing the launching of the rule... a sensible and 
		  	nice solution would be not to remember such changelogs in
			__handledSeqNums */

const {
	__batchCheckpoint,
    __errorContinuable,
	GET__current_state,
	get__ids2uris,
	set__ids2uris,
	get__nextSequenceNumber,
	set__nextSequenceNumber,
	get__wtype,
     __httpReq,
	__id_to_uri,
	__wHttpReq,
    __postInternalErrorMsg, __postMessage,
	__postBadReqErrorMsg, __postForbiddenErrorMsg,
    __sequenceNumber,
    __successContinuable,
	__uri_to_id
} = require("./__worker");

const _do = require("./___do");
const _utils = require('./utils');
const _mmmk = require("./mmmk");
const _fs = _do.convert(require('fs'), ['readFile', 'writeFile', 'readdir']);
const _path = require('path');
const _fspp	= _do.convert(require('./___fs++'), ['mkdirs']);
const _svg = require('./libsvg').SVG;
const _mt = require('./libmt');

const _siocl = require('socket.io-client');

 module.exports = {
	'__REGEN_ICON_RETRY_DELAY_MS':200,
	'__asmm2csmm':{},
	'__asid2csid':{},
	'__aswid':undefined,
	'__handledSeqNums':{'i':undefined,'#s':[]},

	
	/*************************** ASWORKER INTERACTION **************************/
	/* apply asworker changes 

		0. check the changelog's sequence number to know if we should handle it 
			now or later
		1. iterate through the AS changelog setting up sync/async actions that 
			appropriately modify the CS while accumulating CS changelogs (for 
			pushing to subscribed clients)
		2. launch sync/async action chain... on error, post error... on success,
			a) flatten the CS changelogs into a single changelog
			b) post message to server with flattened CS changelog, the server will
				then push it to subscribed clients 
			c) apply next pending asworker changelog, if any and if applicable
	
		__nextASWSequenceNumber 
				used to determine if a changelog is received out of order, and if a
			  	pending changelog is now ready to be handled
		__pendingChangelogs 
				stores out or order changelogs until we're ready to handle them 
		 __hitchhikerJournal
		 		stores encountered hithchikers for future use (see NOTES above) */
	'__nextASWSequenceNumber':'/asworker#1',
	'__pendingChangelogs':[],
	'__hitchhikerJournal':{},
	'__applyASWChanges' :
		function(changelog,aswSequenceNumber,hitchhiker)
		{
			console.error('w#'+__wid+' ++ ('+aswSequenceNumber+') '+
							_utils.jsons(changelog));


			if( _utils.sn2int(aswSequenceNumber) > 
				 	_utils.sn2int(this.__nextASWSequenceNumber) )
			{
				this.__pendingChangelogs.push(
							{'changelog':changelog,
							 'sequence#':aswSequenceNumber,
	 						 'hitchhiker':hitchhiker});
				var self = this;
				this.__pendingChangelogs.sort(
					function(a,b)
					{
						return self.__sn2int(a['sequence#']) - 
									self.__sn2int(b['sequence#']);
					});
				return;
			}
			else if( _utils.sn2int(aswSequenceNumber) < 
							_utils.sn2int(this.__nextASWSequenceNumber) )
				throw 'invalid changelog sequence#';


			var cschangelogs 		= [],
				 cshitchhiker,
				 actions 	  		= [__successContinuable()],
				 self			  		= this;

			/* special handling of undo/redo changelogs (see NOTES above) */
			if( hitchhiker && 'undo' in hitchhiker )
				cschangelogs.push(_mmmk.undo(hitchhiker['undo'])['changelog']);
			else if( hitchhiker && 'redo' in hitchhiker )
				cschangelogs.push(_mmmk.redo(hitchhiker['redo'])['changelog']);

			/* special handling of batchCheckpoint changelogs (see NOTES above) */
			else if( changelog.length == 1 && changelog[0]['op'] == 'MKBTCCHKPT' )
				this.__checkpointUserOperation(changelog[0]['name']);

			/* handle any other changelog */
			else
			{
				var manageHitchhiker = 
						function(hhid,hh)
						{
							/* remember/restore a hitchhiker given specified id */
							if( hh )
								self.__hitchhikerJournal[hhid] = hh;
							else if( hitchhiker )	
								self.__hitchhikerJournal[hhid] = hitchhiker;
							else
								hitchhiker = self.__hitchhikerJournal[hhid];
						};

				this.__checkpointUserOperation(aswSequenceNumber);
				changelog.forEach(
					function(step)
					{
						/* no legal connections exist between *Icon types, so we 
							simply simulate the CS change such a [dis]connection would
						  	incur */
						if( step['op'] == 'MKEDGE' || step['op'] == 'RMEDGE' )
							actions.push(
								function()
								{
									var asid1 = step['id1'],
	  									 asid2 = step['id2'],
										 csid1 = self.__asid_to_csid(asid1),
										 csid2 = self.__asid_to_csid(asid2);

									cschangelogs.push(
										[{'op':step['op'],'id1':csid1,'id2':csid2}]);
									return __successContinuable();
								});

                        /* create appropriate CS instance and associate it with new AS
                            instance (remember the association in __asid2csid to
                            optimize future operations) */
                        else if (step['op'] == 'MKNODE') {
                            actions.push(
                                function () {
                                    manageHitchhiker(step['id']);

                                    let asid = step['id'],
                                        node = _utils.jsonp(step['node']),
                                        isLink = ('segments' in hitchhiker),
                                        fullastype = node['$type'],
                                        fullcstype = self.__astype_to_cstype(
                                            fullastype,
                                            isLink),
                                        asuri = fullastype + '/' + asid + '.instance',
                                        attrs = {'$asuri': asuri};

                                    if ('pos' in hitchhiker)
                                        attrs['position'] = hitchhiker['pos'];
                                    else if ('neighborhood' in hitchhiker) {
                                        let nc = self.__nodesCenter(
                                            hitchhiker['neighborhood']);
                                        attrs['position'] =
                                            [(nc[0] || 200), (nc[1] || 200)];
                                    }
                                    else if ('clone' in hitchhiker)
                                        attrs = _utils.mergeDicts(
                                            [attrs, hitchhiker['clone']]);
                                    else
                                        attrs['position'] = [200, 200];

                                    let res = _mmmk.create(fullcstype, attrs),
                                        csid = res['id'];

                                    self.__asid2csid[asid] = csid;
                                    cschangelogs.push(res['changelog']);

                                    if (isLink) {
                                        let s = {},
                                            src =
                                                hitchhiker['src'] ||
                                                self.__asuri_to_csuri(hitchhiker['asSrc']),
                                            dest =
                                                hitchhiker['dest'] ||
                                                self.__asuri_to_csuri(hitchhiker['asDest']),
                                            segments =
                                                hitchhiker['segments'] ||
                                                self.__defaultSegments(src, dest);
                                        s[src + '--' + __id_to_uri(csid)] = segments[0];
                                        s[__id_to_uri(csid) + '--' + dest] = segments[1];

                                        cschangelogs.push(
                                            _mmmk.update(
                                                csid,
                                                {'$segments': s})['changelog'],
                                            self.__positionLinkDecorators(csid));
                                    }

                                    return self.__regenIcon(csid);
                                },
                                function (riChangelog) {
                                    cschangelogs.push(riChangelog);
                                    return __successContinuable();
                                });
                        }
						/* remove appropriate CS instance... update __asid2csid for it
						  	to remain consistent */				
						else if( step['op'] == 'RMNODE' )
							actions.push(
								function()
								{
									var asid = step['id'],
										 csid	= self.__asid_to_csid(asid);

									cschangelogs.push(_mmmk['delete'](csid)['changelog']);
									delete self.__asid2csid[asid];
									return __successContinuable();
								});
	
						/* regenerate the icon to re-evaluate any coded attributes

							NOTE:: CS changes may be bundled (i.e., if an AS update was
									 simulated by a CS update)... if so, perform them
									 before regenerating the icon */
						else if( step['op'] == 'CHATTR' )
							actions.push(
								function()
								{
									var asid	= step['id'],
										 csid	= self.__asid_to_csid(asid);

									if( hitchhiker && 'cschanges' in hitchhiker )
									{
										var cschanges = hitchhiker['cschanges'];

										cschangelogs.push(
											_mmmk.update(csid,cschanges)['changelog'],
											('$segments' in cschanges ?
									 			self.__positionLinkDecorators(csid) :
												[]));
									}
									return self.__regenIcon(csid);
								},
								function(riChangelog)
								{
									cschangelogs.push(riChangelog);
									return __successContinuable();
								});
	
						/* load appropriate CS metamodel (stored in hitchhiker)... 
							remember AS-to-CS metamodel mapping in __asmm2csmm to 
							optimize future operations */			
						else if( step['op'] == 'LOADMM' )
							actions.push(
								function()
								{
									manageHitchhiker(step['name']);
	
									var asmm = step['name'],
		  								 csmm = hitchhiker['name'],
										 data = hitchhiker['csmm'];

									cschangelogs.push(
										_mmmk.loadMetamodel(csmm,data)['changelog'],
										{'op':'LOADASMM',
										 'name':asmm,
										 'mm':step['mm']});
					 				self.__asmm2csmm[asmm] = csmm;
									return __successContinuable();
								});

						/* unload appropriate CS metamodel... update __asmm2csmm for
						  	it to remain consistent */			
						else if( step['op'] == 'DUMPMM' )
							actions.push(
								function()
								{
									var asmm 	 = step['name'],
		  								 csmm 	 = self.__asmm2csmm[asmm];

									cschangelogs.push(_mmmk.unloadMetamodel(csmm)['changelog']);
					 				delete self.__asmm2csmm[asmm];							
									return __successContinuable();
								});
	
						/* load appropriate CS model (stored in hitchhiker) and 
							overwrite past hitchhiker associated to initial load of
						  	current model, if any... when step['insert'] is specified,
							adjust $asuris to compensate for offsetting of inserted asm
							and $segments to compensate for upcoming offsetting of to-
							be-inserted csm */
                        else if (step['op'] == 'RESETM')
                            actions.push(
                                function () {
                                    manageHitchhiker(
                                        step['old_name'],
                                        {'csm': _mmmk.read()});
                                    manageHitchhiker(step['new_name']);

                                    var csm = hitchhiker['csm'];
                                    var _csm = eval('(' + csm + ')');
                                    if (step['insert']) {
                                        var asoffset = parseInt(step['insert']),
                                            csoffset = _mmmk.next_id,
                                            incUri =
                                                function (oldUri, offset) {
                                                    var matches = oldUri.match(/(.+\/)(.+)(\.instance)/);
                                                    return matches[1] +
                                                        (parseInt(matches[2]) + offset) +
                                                        matches[3];
                                                };

                                        for (var id in _csm.nodes) {
                                            _csm.nodes[id]['$asuri']['value'] =
                                                incUri(_csm.nodes[id]['$asuri']['value'],
                                                    asoffset);

                                            if (!('$segments' in _csm.nodes[id]))
                                                continue;

                                            var segments =
                                                    _csm.nodes[id]['$segments']['value'],
                                                _segments = {};
                                            for (var edgeId in segments) {
                                                var uris = edgeId.match(
                                                    /^(.*\.instance)--(.*\.instance)$/);
                                                _segments[incUri(uris[1], csoffset) + '--' +
                                                incUri(uris[2], csoffset)] =
                                                    segments[edgeId];
                                            }
                                            _csm.nodes[id]['$segments']['value'] = _segments;
                                        }
                                        csm = _utils.jsons(_csm, null, '\t');
                                    }

                                    //see if any cs metamodels are missing
                                    //this fixes issue #28
                                    //this loading should be done elsewhere in the model loading chain
                                    for (var i in _csm.metamodels) {
                                        var mm = _csm.metamodels[i];

                                        if (!(_mmmk.model.metamodels.includes(mm))) {
                                            console.error("Last-minute loading for CS metamodel: " + mm);

                                            var csmm = _fs.readFile('./users/' + mm, 'utf8');
                                            _mmmk.loadMetamodel(mm, csmm);
                                        }
                                    }

                                    var res = _mmmk.loadModel(
                                        step['new_name'],
                                        csm,
                                        step['insert']);

                                    if (res["$err"] == undefined) {
                                        cschangelogs.push(res['changelog']);
                                        return __successContinuable();
                                    } else {
                                        return __errorContinuable();
                                    }

                                });
	
						/* forward this SYSOUT command */
						else if( step['op'] == 'SYSOUT' ) 
							actions.push(
								function()
								{
									cschangelogs.push([step]);
									return __successContinuable();
								});
					});

				actions.push(
					function()
					{
						cschangelogs.push( self.__solveLayoutContraints(changelog) );
						return __successContinuable();
					});
			}

			_do.chain(actions)(
				function()
				{
					var cschangelog = _utils.flatten(cschangelogs);

					console.error('w#'+__wid+' -- ('+aswSequenceNumber+') '+
						_utils.jsons(cschangelog));

					__postMessage(
							{'statusCode':200,
							 'changelog':cschangelog,
	 						 'sequence#':aswSequenceNumber,
							 'hitchhiker':cshitchhiker});
					
					self.__nextASWSequenceNumber = 
						_utils.incrementSequenceNumber(self.__nextASWSequenceNumber);
					self.__applyPendingASWChanges();
				},
				function(err) 
				{
					throw 'unexpected error while applying changelogs :: '+err;
				}
			);
		},


	/* apply pending asworker changelogs, if any and if applicable */
	'__applyPendingASWChanges' :
		function()
		{
			if( this.__pendingChangelogs.length > 0 &&
				 this.__nextASWSequenceNumber == 
				 	this.__pendingChangelogs[0]['sequence#'] )
				{
					var pc = this.__pendingChangelogs.shift();
					this.__applyASWChanges(
							pc['changelog'],
							pc['sequence#'],
							pc['hitchhiker']);
				}
		},


	/* initialize a socket that will listen for and handle changelogs returned by
	  	this csworker's associated asworker 

		1. onconnect() is triggered when 2 way communication is established, at
	  		which point we attempt to subscribe for specified asworker
		2. onmessage() is triggered once in response to our subscription attempt:
				a) we set this.__aswid to specified aswid
				b) if a cswid was provided (i.e., a shared model session is being
					set up)
						i.   retrieve the specified csworker's internal state 
						ii.  setup this csworker's state and _mmmk based on the 
							  results from step ii. 
						iii. return the new state to the client (via callback())
						iv.  remove any obsolete changelogs received since step i.
							  and set __nextASWSequenceNumber to the same value as 
							  that of the csworker whose state we're cloning
						v.  apply pending changelogs, if any
	  		all future triggers of onmessage() are due to the asworker pushing 
			changelogs, these are handled by __applyASWChanges
	 
		NOTE : actually, there is a 3rd case where onmessage() is triggered...
				 between the moment where the socket is created and the moment
				 where we receive the response to our subscription attempt, we
				 will receive *all* messages broadcasted by the websocket server
				 in httpwsd.js... these are detected and discarded */
	'__aswSubscribe' :
		function(aswid,cswid)
		{
			var self = this;
			return function(callback,errback)
			{
				var socket = _siocl.connect('127.0.0.1',{port:8124});	
				socket.on('connect', 
					function()	
					{
						socket.emit('message',
							{'method':'POST','url':'/changeListener?wid='+aswid});
					});
				socket.on('disconnect', 
					function()	{self.__aswid = undefined;});
				socket.on('message', 	
					function(msg)	
					{
						/* on POST /changeListener response */
						if( msg.statusCode != undefined )
						{
							if( ! _utils.isHttpSuccessCode(msg.statusCode) )
								return errback(msg.statusCode+':'+msg.reason);
								
							self.__aswid = aswid;	
							if( cswid != undefined )
							{
								var actions = 
										[__wHttpReq('GET','/internal.state?wid='+cswid)];
											
								_do.chain(actions)(
									function(respData) 		
									{
										var state = respData['data'];
										_mmmk.clone(state['_mmmk']);
										self.__clone(state['_wlib']);										
										var __ids2uris = state['__ids2uris'];
										set__ids2uris(__ids2uris);
										var __nextSequenceNumber =
												state['__nextSequenceNumber'];
										set__nextSequenceNumber(__nextSequenceNumber);
				
										self.__pendingChangelogs = 
											self.__pendingChangelogs.filter(
												function(pc)
												{
													return self.__sn2int(pc['sequence#']) > 
																self.__sn2int(
																	self.__nextASWSequenceNumber)
												});
										callback();
										self.__applyPendingASWChanges();
									},
									function(err) 	{errback(err);}
								);
							}
							else
								callback();
						}
	
						/* on changelog reception (ignore changelogs while not 
							subscribed to an asworker... see NOTE) */
						else if( self.__aswid != undefined )
							self.__applyASWChanges(
									msg.data.changelog,
									msg.data['sequence#'],
									msg.data.hitchhiker);
					});
			};
		},



	/***************************** ICON GENERATION *****************************/
	/* determine the correct positions and orientations of the given link's 
		decorators, adjust them and return changelogs 
	 
		0. concatenate segments into a single path
		1. for each link decorator (i.e., Link $contents)
			*. do nothing if link decoration information is missing... this ensures
				backward compatibility with pre-link decorator models
			a. extract link decoration information, i.e., xratio and yoffset
			b. determine point on path at xratio and its orientation
			c. adjust yoffset given orientation (yoffset was specified for 0deg)
			d. adjust endAt given orientation (endAt is specified for 0deg)... note
				that endAt is only relevant for arrowtails
			e. relativize point from step b. w.r.t. to Link center and adjust 
				position by adjusted yoffset
			f. set new position and orientation in mmmk and remember changelogs
		2. return flattened changelogs 
	 
		NOTE:: the initial values of vobject geometric attribute values must
				 always be remembered... they are needed on the client to properly
				 support the drawing and transformation of vobjects... this is 
				 captured by buildVobjGeomAttrVal(), which we use in step 1f */
	'__positionLinkDecorators' :
		function(id)
		{
			var link	 		= _utils.jsonp(_mmmk.read(id)),
				 vobjs 		= link['$contents']['value'].nodes,
				 segments	= _utils.values(link['$segments']['value']),
				 path			= segments[0]+
					 				segments[1].substring(segments[1].indexOf('L')),
				 changelogs = [];

			for( var vid in vobjs )
			{
				if( !('$linkDecoratorInfo' in vobjs[vid]) )
					continue;

				var ldi 		= vobjs[vid]['$linkDecoratorInfo']['value'],
					 pp  		= _svg.fns.getPointOnPathAtRatio(path,ldi.xratio);
                     
                if (pp == undefined)
                    continue;
                
				var yoffset	= new _svg.types.Point(0,ldi.yoffset).rotate(pp.O),
					endAt	= (ldi.xratio >= 1 ? 
						 				new _svg.types.Point(100,0).rotate(pp.O) :
										new _svg.types.Point(0,0)),
					changes = {};
				pp.x += yoffset.x - link['position']['value'][0];
				pp.y += yoffset.y - link['position']['value'][1];

				changes['$contents/value/nodes/'+vid+'/position'] 	  = 
					[_utils.buildVobjGeomAttrVal(
							vobjs[vid]['position']['value'][0], pp.x+','+endAt.x+'%'),
					 _utils.buildVobjGeomAttrVal(
 						  	vobjs[vid]['position']['value'][1], pp.y+','+endAt.y+'%')];
				changes['$contents/value/nodes/'+vid+'/orientation'] = 
					_utils.buildVobjGeomAttrVal(
							vobjs[vid]['orientation']['value'],	pp.O);
				changelogs.push( _mmmk.update(id,changes)['changelog'] );
			}

			return _utils.flatten(changelogs);
		},


	/* regenerate specified icon... if newCsmm is specified, the regeneration 
		process essentially transforms the icon for it to conform to whatever is
	  	specified by newCsmm... otherwise, it merely involves re-evaluating
	  	VisualObject mappers

		1. if newCSmm is defined
			a) create a new instance I of node 'id''s icontype given newCsmm
			b) copy node 'id''s '$asuri', 'position', etc. attributes to I
			c) delete node 'id'
			d) update__asid2csid and 'id' variable to be I's id
			e) save the changelogs of steps a-c)
		2. in either case, [re-]eval VisualObject mappers
			a) retrieve Icon and VisualObject mappers...
				i.   fetch specified node from mmmk
				ii.  retrieve its '$contents' attribute 
				iii. retrieve the 'mapper' attribute for the node itself
				iii. retrieve the 'mapper' attribute of VisualObjects within 
					  '$contents'
			b) return empty changelog if all mappers are empty
			c) setup sync/async action chaining
				i.  ask asworker to evaluate a bunch of mappers
				ii. save results for later access
			d) launch chain... 
					on success, populate attributes with results from step 2ci and 
					'return' changelog OR 'return' SYSOUT error if evaluating mappers
					raised exceptions
					on failure (this only occurs if we were unable to obtain an 
					asworker read-lock), relaunch chain after short delay
		TBI: step 2d) could potentially lead to an infinite loop if failure is due
	  		  to unforeseen error or to very long delays if lock holder takes a 
			  long time to finish... we could address this by *not* relaunching the
			  chain if some number of tries have failed, and instead setting coded 
			  attribute values to '<out-of-date>' */
	'__regenIcon' :
		function(id,newCsmm)
		{
			var changelogs = [],
 				 self 	   = this;
			return function(callback,errback)
			{
				if( newCsmm != undefined )
				{
					var node  = _utils.jsonp(_mmmk.read(id)),
						 asuri = _mmmk.read(id,'$asuri'),
						 asid	 = __uri_to_id(asuri),
						 attrs = _utils.mergeDicts([
									 {'$asuri':asuri,
									  'position':node['position']['value'],
									  'orientation':node['orientation']['value'],
									  'scale':node['scale']['value']},
									 ((s=_mmmk.read(id,'$segments'))['$err'] ?
										 {} : {'$segments':s}) ]),
						 cres  = _mmmk.create(
								 		newCsmm+'/'+node['$type'].match(/.*\/(.*)/)[1],
										attrs),
						 csid	 = cres['id'],
						 dres	 = _mmmk['delete'](id);
					 self.__asid2csid[asid] = id = csid;
					 changelogs.push(
							 cres['changelog'],
							 dres['changelog']);
				}

				var csuri  	 		= __id_to_uri(id),
					 asuri			= self.__csuri_to_asuri(csuri),
					 icon				= _utils.jsonp(_mmmk.read(id)),
					 vobjects		= icon['$contents']['value'],
					 mappers 		= {};

				if( icon['mapper']['value'] != '' )
					mappers[''] = icon['mapper']['value'];

				for( var vid in vobjects['nodes'] )
					if( 'mapper' in vobjects['nodes'][vid] &&
						 vobjects['nodes'][vid]['mapper']['value'] != '' )
						mappers['$contents/value/nodes/'+vid+'/'] = 
							vobjects['nodes'][vid]['mapper']['value'];

				if( _utils.keys(mappers).length > 0 )
				{				
					var actions = 
							[__wHttpReq(
									'POST',
									'/GET/'+asuri+'.mappings?wid='+self.__aswid,
									mappers)],
						 successf = 
 							 function(attrVals)
 							 {
								 if( '$err' in attrVals )
									 callback( 
										[{'op':'SYSOUT',
										  'text':'ERROR :: '+attrVals['$err']}]);
								 else
								 {
									 var changes = {};
	 								 for( var fullattr in attrVals )
	 									 changes[fullattr] = attrVals[fullattr];
                                     var result = _mmmk.update(id,changes);
                                     if ( '$err' in result )
                                         callback( 
                                            [{'op':'SYSOUT',
                                              'text':'ERROR :: '+result['$err']}]);
                                     else {
                                         changelogs.push(
                                                 result['changelog'] );
                                         callback( _utils.flatten(changelogs) );
                                     }
								 }
 							 },
						 failuref = 
	 						 function(err) 
	 						 {
	 							 console.error('"POST *.mappings" failed on :: '+err+
										 		'\n(will try again soon)');
	 							 setTimeout(
		 								 _do.chain(actions),
		 								 self.__REGEN_ICON_RETRY_DELAY_MS,
		 								 successf,
		 								 failuref);
	 						 };
					_do.chain(actions)(successf,failuref);
				}
				else
					callback( _utils.flatten(changelogs) );
			};
		},


	'__solveLayoutContraints':
		function(changelog)
		{
			// TBC actually implement this function 
			//	use ids in changelog to determine what changed 
			//	add 2 lines below to mmmk.__create() if necessary
			//		if( type in this.metamodels[metamodel]['connectorTypes'] )
			//			new_node['$linktype'] = this.metamodels[metamodel]['connectorTypes'][type];	

			return [];
			// return [{'op':'SYSOUT',
			//   		  'text':'WARNING :: '+
			// 			  		'a proper layout constraint solver has yet to be '+
			// 			  		'implemented... inter-VisualObject relationships are '+
			// 					'ignored and containers do not resize to fit their '+
			// 					'contents'}];
		},


	/* transform all icons from tgtCsmm into appropriate icons of newCsmm
	
		1. read model and newCsmm from _mmmk
		2. for each icon of tgtCsmm, if newCsmm defines a replacement icon, save
			the icon's id in 'tgtIds'... otherwise, return error 
		3. init sync/async action chaining... 
			a) for each id in 'tgtIds', add 2 entries to chain
				i.  call __regenIcon on specified icon
				ii. save resulting changelog and continue 
		4. launch chain... 
			on success, 
				a) adjust $segments attributes from all Links to account for edge
					end change of id (and uri)
				b) 'return' flattened changelogs
			on failure, 'return' error */
	'__transformIcons' :
		function(tgtCsmm,newCsmm)
		{
			var self = this;
			return function(callback,errback)
			{
				var m 			 = _utils.jsonp(_mmmk.read()),
					 newCsmmData = _utils.jsonp(_mmmk.readMetamodels(newCsmm)),
					 tgtIds		 = [],
					 newIds		 = {},
					 changelogs  = [],
					 actions	    = [__successContinuable()];

				for( var id in m.nodes )
					if( (matches = m.nodes[id]['$type'].match('^'+tgtCsmm+'/(.*)')) )
					{
						var type = matches[1];
						if( newCsmmData.types[type] == undefined )
						{
							errback('Icons mm should define type :: '+type);
							return;
						}
						tgtIds.push(id);
					}

				tgtIds.forEach(
					function(id) 
					{
						actions.push(
							function()	{return self.__regenIcon(id,newCsmm);},
							function(changelog)	
							{
								var newId = changelog[0]['id'];
								newIds[id] = newId;		
								changelogs.push(
									changelog.concat(
										'$err' in _mmmk.read(newId,'$segments') ?
											[] : self.__positionLinkDecorators(newId)) );
								return __successContinuable();
							});
					});
				
				_do.chain(actions)(
					function()	  
					{
						var m = _utils.jsonp(_mmmk.read());
						for( var id in m.nodes )
							if( (matches = m.nodes[id]['$type'].match(/Link$/)) )
							{
								var s			= _mmmk.read(id,'$segments'),
									 changed	= false;
								for( var edgeId in s )
								{
									var ends = 
											edgeId.match(/(.*\.instance)--(.*\.instance)/),
										 id1	= __uri_to_id(ends[1]),
										 id2	= __uri_to_id(ends[2]);
 
									if( id1 in newIds )
									{
										ends[1] = __id_to_uri( newIds[id1] );
			 							changed = true;
	 								}
									if( id2 in newIds )
									{
										ends[2] = __id_to_uri( newIds[id2] );
										changed = true;
									}
									if( changed )
									{
										s[ends[1]+'--'+ends[2]] = s[edgeId];
										delete s[edgeId];
									}
								}
								if( changed )
									changelogs.push( 
										_mmmk.update(id,{'$segments':s})['changelog'] );
							}

						callback(_utils.flatten(changelogs));
					},
					function(err) 
					{
						errback('__transformIcons() should never fail... '+
								  'failed on :: '+err); 
					}
				);
			};
		},



	/************************** REST REQUEST HANDLING **************************/
	/* INTENT :
			ask our asworker's mtworker to do something (e.g., change 
			transformation execution mode) 
		IN PRACTICE: 
			adjust uri and forward to asworker

	1. setup sync/async action chaining
		a) ask asworker to forward request to its mtworker
	2. launch chain... return success code or error */
	'mtwRequest' :
		function(resp,method,uri,reqData)
		{
			var actions = [__wHttpReq(
									method,
									uri+'?wid='+this.__aswid,
									reqData)];

			_do.chain(actions)(
					function() 
					{
						__postMessage({'statusCode':200, 'respIndex':resp});
					},
					function(err) 	{__postInternalErrorMsg(resp,err);}
			);
		},


	/*	return sufficient information to clone the current csworker to the tinyest
	   detail... this is a pimped out version of GET current.state for internal
		use only
		1. bundle info about _mmmk and _wlib
		2. return to querier */			
	'GET /internal.state' :
		function(resp)
		{
			__postMessage(
					{'statusCode':200,
					 'data':{'_mmmk':_mmmk.clone(),
	 						   '_wlib':this.__clone(),
								'__ids2uris':_utils.clone(get__ids2uris()),
								'__nextSequenceNumber':get__nextSequenceNumber()},
					 'sequence#':__sequenceNumber(0),
					 'respIndex':resp});
		},
		

	/* subscribe to an existing or to-be-created asworker

		1. validate parameters 
		2. if 'aswid' and 'cswid' are given,
			a) setup sync/async action chaining
				i) attempt to subsribe to specified asworker using specified 
					csworker's current model as this csworker's initial model
			b) launch chain... on success, 'return' current state (via 
				GET__current_state())... on error, return error
		2. otherwise,
			a) setup sync/async action chaining
				i)  spawn new asworker
				ii) subscribe to it
			b) launch chain... return success code or error */
	'PUT /aswSubscription' :
		function(resp,uri,reqData/*wid*/)
		{
		  	if( this.__aswid > -1 )
				return __postForbiddenErrorMsg(
						resp,
						'already subscribed to an asworker');

			if( reqData != undefined )
			{
				if( reqData['aswid'] == undefined ||
					 reqData['cswid'] == undefined )
					return __postInternalErrorMsg(resp, 'missing AS and/or CS wid');

				var self	   = this,
					 actions = 
	 					 [this.__aswSubscribe(reqData['aswid'],reqData['cswid'])];
		
				_do.chain(actions)(
						function() 
						{
							GET__current_state(resp);
						},
						function(err) 	{__postInternalErrorMsg(resp,err);}
				);
			}

			else
			{
				var self	   = this,
					 actions = 
						 [__httpReq('POST','/asworker'),
						  function(aswid)	  {return self.__aswSubscribe(aswid);}];
		
				_do.chain(actions)(
						function() 
						{
							__postMessage(
								{'statusCode':200, 
								 'data':self.__aswid,
								 'respIndex':resp});
						},
						function(err) 	{__postInternalErrorMsg(resp,err);}
				);
			}
		},

	
	/* INTENT : 
			load a CS and an AS metamodel from disk
	 			*OR* 
			switch between different CS metamodels
		IN PRACTICE: 
			adjust uri and reqData and forward to asworker
	 			*OR* 
			fulfill intent				

		1.	parse + validate parameters
		2. if no asmm is specified (CS switch),
			a) setup sync/async action chaining
				i.   read specified csmm from disk
				ii.  load read data into _mmmk
				iii. try to regen all icons from overwritten csmm
			b) launch chain... 
				i.  on failure, undo step 2.a)ii. if it ran, and return error
				ii. on success, 
					j.   return success code
				   jj.  unload previous csmm
					jjj. post bundled and flattened changelogs
		2. if an asmm is specified (MM load)
			a) setup sync/async action chaining
				i.  read specified csmm from disk
				ii. ask asworker to load AS metamodel + pass CS metamodel name and
			  		 data as 'hitchhiker'
			b) launch chain... return success code or error */
	'PUT /current.metamodels' :
		function(resp,uri,reqData/*[asmm,]csmm*/)
		{
			if( reqData == undefined )
				return __postBadReqErrorMsg(resp, 'missing request data');
			else if( reqData['csmm'] == undefined )
				return __postBadReqErrorMsg(resp, 'missing CS mm');
			else if( ! (matches = reqData['csmm'].
							match(/.+?((\/.*)\..*Icons(\.pattern){0,1})\.metamodel/)) )
				return __postBadReqErrorMsg(
								resp,
								'bad uri for Icons mm :: '+reqData['csmm']);

			var asmm = matches[2]+(matches[3] || ''),
				 csmm = matches[1];

			if( reqData['asmm'] == undefined )
			{
				if( this.__asmm2csmm[asmm] == undefined )
					return __postBadReqErrorMsg(resp, 'missing AS mm');

				var lres		= undefined,
					 sn		= undefined,
					 self		= this,
					 actions = 
						 [_fs.readFile('./users'+reqData['csmm'],'utf8'),
					 	  function(csmmData)
						  {
							  sn 	 = __sequenceNumber();
			  				  self.__checkpointUserOperation(sn); 
							  lres = _mmmk.loadMetamodel(csmm,csmmData);
							  return __successContinuable();
						  },
						  function()	
						  {
							  return self.__transformIcons(
									  					self.__asmm2csmm[asmm],
									  					csmm);
						  }];

				_do.chain(actions)(
						function(changelog) 
						{
							__postMessage({'statusCode':202, 'respIndex':resp});

							var ures = _mmmk.unloadMetamodel(self.__asmm2csmm[asmm]),
								 changelogs = 
								 	[lres['changelog'],changelog,ures['changelog']];
							self.__asmm2csmm[asmm] = csmm;

							__postMessage(
								{'statusCode':200,
  								 'changelog':_utils.flatten(changelogs),
								 'sequence#':sn});
						},
						function(err) 	
						{
							if( sn != undefined )
								__postInternalErrorMsg(resp,
									'CS switch should never fail for non-I/O reason'+
									'... backend may now be in unstable state... '+
									'failed on :: '+err);
							else
								__postInternalErrorMsg(resp,err);
						}
				);
			}
			else
			{	
				var self	 	= this,
					 actions = 
	 					 [_fs.readFile('./users'+reqData['csmm'],'utf8'),
					 	  function(csmmData)
						  {
	 						  return __wHttpReq(
										  'PUT',
										  uri+'?wid='+self.__aswid,
										  {'mm':reqData['asmm'],
  										   'hitchhiker':{'csmm':csmmData,'name':csmm}});
						  }];

				_do.chain(actions)(
						function() 
						{
							__postMessage({'statusCode':202, 'respIndex':resp});
						},
						function(err) 	{__postInternalErrorMsg(resp,err);}
				);
			}
		},


	/*  INTENT : 
			unload a metamodel (deletes all entities from that metamodel)
		IN PRACTICE: 
			adjust uri and forward to asworker
 
		1. parse + validate parameters
		2. setup sync/async action chaining
			a) ask asworker to unload corresponding AS mm
		3. launch chain... on success, unload specified metamodel */
	'DELETE *.metamodel' :
		function(resp,uri)
		{
			var matches = uri.match(/(.*)\..*Icons(\.pattern){0,1}\.metamodel/);			
			if( ! matches )
				return __postBadReqErrorMsg(resp,'bad uri for Icons mm :: '+uri);

			var asuri   = matches[1]+(matches[2] || '')+'.metamodel',
				 actions = 
					 [__wHttpReq('DELETE',asuri+'?wid='+this.__aswid)];

			_do.chain(actions)(
					function() 
					{
						__postMessage({'statusCode':202, 'respIndex':resp});
					},
					function(err) 	{__postInternalErrorMsg(resp,err);}
			);
		},


	/*  INTENT : 
	  		load a model from disk
				OR
			clear current model (and metamodels)
		IN PRACTICE: 
			adjust reqData and forward to asworker

		1. parse + validate parameters
		2. read specified model from disk
				OR
			fabricate empty model
		3. setup sync/async action chaining
			a) ask asworker to load associated AS model + pass CS model as 
				'hitchhiker'
		4. launch chain... return success code or error */
	'PUT /current.model' :
		function(resp,uri,reqData/*m[,insert]*/)
		{
			if( reqData == undefined )
				return __postBadReqErrorMsg(resp, 'missing model');

			var self	 	= this,
				 mData	= undefined,
				 actions = [];
			if( reqData['m'] == undefined )
				 actions = 
					 [__successContinuable(),
					  function()
 					  {
						  mData = {"csm": {"nodes": {},
											    "edges": [],
												 "metamodels": []},
									  "asm": {"nodes": {},
 												 "edges": [],
												 "metamodels": []}};
						  reqData['m'] = 'new';
						  return __successContinuable(mData);
					  }];
			else {
                try {
                    _fs.accessSync('./users/'+reqData['m']);
                } catch (e) {
                    return __postBadReqErrorMsg(resp, 'cannot read ' + reqData['m']);
                }
                actions = [   _fs.readFile('./users/'+reqData['m'],'utf8'),
                              function(_mData)
                              {
                                  mData = eval('('+_mData+')');
                                  return __successContinuable(mData);
                              }];
                actions.push(
                    function(m)
                    {
                         var asmData = _utils.jsons(m['asm']),
                              csmData = _utils.jsons(m['csm']);
                         return __wHttpReq(
                                      'PUT',
                                      uri+'?wid='+self.__aswid,
                                      {'m':asmData,
                                       'name':reqData['m']+(new Date().getTime()),
                                        'insert':reqData['insert'],
                                       'hitchhiker':{'csm':csmData}});						
                    });
                _do.chain(actions)(
                    function() 
                    {
                        __postMessage({'statusCode':202,'respIndex':resp});					
                    },
                    function(err) 	
                    {
                        var MISSING_MM_ERROR = 'metamodel not loaded :: ';
                        if( (matches = err.match('^500:'+MISSING_MM_ERROR+
                                                                    '(.*?)(\\.pattern){0,1}$')) )
                        {
                            var asmm = matches[1],
                                 pmm	= (matches[2] != undefined),
                                 csmm;
                            mData['csm'].metamodels.some(
                                function(mm)
                                {
                                    if( (pmm && mm.match(
                                            '^'+asmm+'\\.[a-zA-Z0-9]*Icons\\.pattern$')) ||
                                         (!pmm && mm.match(
                                            '^'+asmm+'\\.[a-zA-Z0-9]*Icons$')) )
                                        csmm = mm;
                                    return csmm;
                                });
                            __postInternalErrorMsg(resp,MISSING_MM_ERROR+csmm);
                        }
                        else
                            __postInternalErrorMsg(resp,err);
                    }
                );
            }
		},


    /* INTENT :
             create a new instance of specified type (if reqData has
             'src' and 'dest' fields, type is a connector)
        IN PRACTICE:
            adjust uri (and reqData) and forward to asworker

        1. parse + validate parameters
        2. setup sync/async action chaining
            a) construct reqData for asworker.POST *.type
                i.   handle connector ends if applicable
                ii.  handle 'pos'... pass as hitchhiker and evaluate the to-be
                      *Icon's parser within a dummy context where 'position' is set
                      to 'pos'... see NOTES above for more details on this
           b) ask asworker to create an instance of appropriate AS type
        3. launch chain... return success code or error */
    'POST *.type':
        function (resp, uri, reqData/*pos|clone,[segments,src,dest]*/) {
            let matches =
                uri.match(/((.*)\..*Icons)(\.pattern){0,1}\/((.*)Icon)\.type/) ||
                uri.match(/((.*)\..*Icons)(\.pattern){0,1}\/((.*)Link)\.type/);
            if (!matches)
                return __postBadReqErrorMsg(
                    resp,
                    'bad uri for Icon/Link type :: ' + uri);

            let asuri = matches[2] + (matches[3] || '') + '/' + matches[5] + '.type',
                csmm = matches[1] + (matches[3] || ''),
                cstype = matches[4],
                types = _utils.jsonp(_mmmk.readMetamodels(csmm))['types'];

            if (!(cstype in types)) {
                return __postBadReqErrorMsg(
                    resp, 'no concrete syntax definition found for ' + cstype);
            }

            let parser =
                    types[cstype].filter(
                        function (attr) {
                            return attr['name'] == 'parser';
                        })[0]['default'],
                self = this,
                actions =
                    [__successContinuable(),
                        function () {
                            if (reqData == undefined)
                                return __errorContinuable('missing creation parameters');

                            let hitchhiker = {},
                                reqParams = {},
                                segments = reqData['segments'],
                                src = reqData['src'],
                                dest = reqData['dest'],
                                pos = reqData['pos'];

                            if (src != undefined &&
                                dest != undefined) {

                                let src_asuri = self.__csuri_to_asuri(src);
                                if (src_asuri['$err'])
                                    return __errorContinuable(src_asuri['$err']);

                                let dest_asuri = self.__csuri_to_asuri(dest);
                                if (dest_asuri['$err'])
                                    return __errorContinuable(dest_asuri['$err']);

                                if (segments == undefined) {
                                    segments = self.__defaultSegments(src, dest);
                                }

                                if (pos == undefined) {
                                    pos = self.__nodesCenter([src_asuri, dest_asuri]);
                                }

                                hitchhiker = {
                                    'segments': segments,
                                    'src': src,
                                    'dest': dest
                                };
                                reqParams = {
                                    'src': src_asuri,
                                    'dest': dest_asuri
                                };


                            }

                            if (pos == undefined)
                                return __errorContinuable('missing position');

                            hitchhiker['pos'] = pos;
                            reqParams['attrs'] =
                                self.__runParser(
                                    parser,
                                    {
                                        'position': pos,
                                        'orientation': 0,
                                        'scale': [1, 1]
                                    },
                                    {});

                            return __successContinuable(
                                _utils.mergeDicts(
                                    [{'hitchhiker': hitchhiker}, reqParams]));
                        },
                        function (asreqData) {
                            return __wHttpReq(
                                'POST',
                                asuri + '?wid=' + self.__aswid,
                                asreqData);
                        }];

            _do.chain(actions)(
                function (res) {
                    __postMessage({'statusCode': 202, 'respIndex': resp, 'reason': res});
                },
                function (err) {
                    __postInternalErrorMsg(resp, err);
                }
            );

        },


	/* return an AS instance, and optionally also the associated CS instance

	1. setup sync/async action chaining
		a) get AS instance uri for specified CS instance
		b) ask asworker for AS instance
	2. launch chain
		... on success, 'return' instance possibly bundling CS instance
		... on error, 'return' error */
	'GET *.instance' :
		function(resp,uri,reqData/*[full]*/)
		{
			var self	= this,
 				 actions = 
					[__successContinuable(),
					 function()
					 {
						 if( (asuri = self.__csuri_to_asuri(uri))['$err'] )
							 return __errorContinuable(asuri['$err']);
						 return __successContinuable(asuri);
					 },
					 function(asuri)	
					 {
						 return __wHttpReq('GET',asuri+'?wid='+self.__aswid);
					 }];

			_do.chain(actions)(
					function(respData) 
					{
						if( reqData && 'full' in reqData )
							var data = {'cs':_mmmk.read(__uri_to_id(uri)),
											'as':respData['data']};
						else
							var data = respData['data'];

						__postMessage(
							{'statusCode':200, 
	  						 'data':data,
							 'sequence#':respData['sequence#'],					 
							 'respIndex':resp});
					},
					function(err) 	{__postInternalErrorMsg(resp,err);}
			);
		},


	/* INTENT :
			update an AS instance's attributes
		IN PRACTICE: 
			adjust uri and forward to asworker

		1. setup sync/async action chaining
			a) determine associated AS instance uri
			b) ask asworker to update it
		2. launch chain... return success code or error */ 
	'PUT *.instance' :
		function(resp,uri,reqData)
		{
			var self	= this,
				 actions = 
					[__successContinuable(),
					 function()
					 {
						 if( (asuri = self.__csuri_to_asuri(uri))['$err'] )
							 return __errorContinuable(asuri['$err']);
						 return __successContinuable(asuri);
					 },
					 function(asuri)	
					 {
						 return __wHttpReq(
									 'PUT',
									 asuri+'?wid='+self.__aswid,
									 reqData);
					 }];

			_do.chain(actions)(
					function(asnode) 
					{
						__postMessage(
							{'statusCode':202, 					
							 'respIndex':resp});
					},
					function(err) 	{__postInternalErrorMsg(resp,err);}
			);
		},


	'POST *.instance.click' :
		function(resp,uri,reqData)
		{
			/* TBA 
				REST requests vs. code run on ASw
				+ checkout bak/ for _mmmk.handleVisualObjectClick */
		},


	/* INTENT :
			delete an instance 
		IN PRACTICE: 
			adjust uri and forward to asworker

		1. setup sync/async action chaining
			a) determine associated AS instance uri
			b) ask asworker to delete it
		2. launch chain... return success code 

		NOTE:: this function does not return csworker errors to the client (i.e.,
				 errors triggered by __csuri_to_asuri() failures)... the reason for
				 this is that mmmk sometimes cascades deletes (e.g., deleting a 
				 node alsos deletes any connected links) which often causes errors
				 during 'mass' deletions, e.g., 
				 	a) client requests
				  			delete A
							delete A->B
				  			delete B
					b) csworker handles delete A 		(deletes A and A->B)
					c) csworker handles delete A->B 	(error, A->B already deleted)
					... */
	'DELETE *.instance' :
		function(resp,uri)
		{
			var self  = this,
				 asuri = this.__csuri_to_asuri(uri),
				 actions = 
					[__wHttpReq('DELETE',asuri+'?wid='+self.__aswid)];

			if( asuri['$err'] )
				__postMessage({'statusCode':200, 'respIndex':resp});
			else
				_do.chain(actions)(
					function() 
					{
						__postMessage({'statusCode':202, 'respIndex':resp});
					},
					function(err) 	
					{
						__postInternalErrorMsg(resp,err);
					}
				);
		},


	/* INTENT :
			update a CS instance's attributes (position,...)
		IN PRACTICE :
			perform intent *or* possibly adjust uri and reqData and forward to
		  	asworker

		1. retrieve the icon's parser
	  	2. execute parser to determine AS impacts
		3. if parsing produced an error, return it
		3. if there are AS impacts, simulate an edit-via-dialog update by 
			'forwarding' the request (with modified reqData) to 'PUT *.instance'
			*and* bundle requested CS update (for later handling)
		3. if there are no AS impacts, perform requested CS update and post 
			changelog */
	'PUT *.cs' :
		function(resp,uri,reqData)
		{			
			var id 	= __uri_to_id(uri),
				 icon = _utils.jsonp( _mmmk.read(id) ),
				 updd = this.__runParser( 
						 				icon['parser']['value'], 
										reqData['changes'], 
										icon );

			if( updd && updd['$err'] )
				return __postInternalErrorMsg(resp,updd['$err']);

			if( updd )
				this['PUT *.instance'](
						resp,
						uri,
						{'changes':updd,
						 'hitchhiker':{'cschanges':reqData['changes']}} );
			else
			{
				var sn = __sequenceNumber();
				this.__checkpointUserOperation(sn);			
				__postMessage(
						{'statusCode':200,
  						 'changelog':
						 	_mmmk.update(id,reqData['changes'])['changelog'].
								concat('$segments' in reqData['changes'] ?
										 	this.__positionLinkDecorators(id) :
											[]),
						 'sequence#':sn,
						 'respIndex':resp});
			}
		},


	/* INTENT :
			update a VisualObject's attributes
		IN PRACTICE: 
			perform intent *or* possibly adjust uri and reqData and forward to
		  	asworker

		1. parse + validate parameters
		2. retrieve VisualObject and its parsing function
		3. execute parsing function to determine AS impacts
		4. if parsing produced an error, return it
		4. if there are AS impacts, simulate an edit-via-dialog update by 
			'forwarding' the request (with modified reqData) to 'PUT *.instance'
			*and* bundle requested CS update (for later handling)
		4. if there are no AS impacts, perform the requested VisualObject update
	  		and post changelog */
	'PUT *.vobject' :
		function(resp,uri,reqData)
		{
			var matches = uri.match(/.*\/(.*)\.instance\/(.*)\.vobject/);
			if( ! matches )
				return __postBadReqErrorMsg(
							resp,
							'bad uri for VisualObject :: '+uri);

			var id		 = matches[1],
				 vid		 = matches[2],
				 vobjAttr = '$contents/value/nodes/'+vid;
			
			if( (res = _mmmk.read(id,'$contents'))['$err'] )
				return __postBadReqErrorMsg(resp,res['$err']);

			var __vo__ 	 = res['nodes'][vid],
				 parsingf = __vo__['parser']['value'],
	 			 updd 	 = this.__runParser( 
						 					parsingf, 
											reqData['changes'], 
											__vo__ );

			if( updd && updd['$err'] )
				return __postInternalErrorMsg(resp,updd['$err']);

			var _reqData = {};
			for( var attr in reqData['changes'] )
				_reqData[vobjAttr+'/'+attr] = reqData['changes'][attr];
			
			if( updd )
				this['PUT *.instance'](
						resp,
						uri,
						{'changes':updd,
						 'hitchhiker':{'cschanges':_reqData}} );
			else
			{
				var sn = __sequenceNumber();
				this.__checkpointUserOperation(sn);		
				__postMessage(
						{'statusCode':200,
  						 'changelog':_mmmk.update(id,_reqData)['changelog'],
						 'sequence#':sn,
						 'respIndex':resp});
			}
		},


	/* INTENT :
			A) generate a metamodel from the current AS model and write it to disk
					OR
			B) generate a CS metamodel (i.e., an icon definition metamodel) from 
				the current AS and CS models and write it to disk
					OR
			C) generate pattern metamodels from AS and CS metamodels

		IN PRACTICE: 
			A) adjust uri and forward to asworker
				OR
			B) adjust uri and forward to asworker + bundle CS model
				OR
			C) do the deed

		C) if the uri is a pattern metamodel uri,
		1. setup sync/async action chaining
			a) read AS metamodel + store contents
			b) read contents of parent dir
		2. launch chain... on error, return error... on success, 
			a) setup another sync/async action chaining
				i.   read all CS metamodels + store contents
				ii.  call _mt.ramify() with AS and CS metamodel data
				iii. write results to disk
			b) launch chain... return success or error code 
	 
		B) if the uri is an icon definition metamodel uri,
		1. setup sync/async action chaining
			a) ask asworker to generate metamodel and write it to disk... asworker
		  		request reqData includes the current CS model
		2. launch chain... return success code or error 

		A) otherwise,
		1. setup sync/async action chaining
			a) ask asworker to generate metamodel and write it to disk
		2. launch chain... return success code or error */
	'PUT *.metamodel' :
		function(resp,uri)
		{
			if( (matches = uri.match(/\.pattern\.metamodel/)) )
			{
				let matches = uri.match(/\/GET(((.*\/).*).pattern.metamodel)/);
				let RAMasmmPath = './users' + matches[1];
				let asmmPath = './users' + matches[2] + '.metamodel';
				let parentDir = './users' + matches[3];
				let asmm = undefined;
				let csmms = {};
				let actions =
					[_fs.readFile(asmmPath, 'utf8'),
						function (data) {
							asmm = data;
							return _fs.readdir(parentDir);
						}];

				// only rewrite CS models matching the metamodel name
				// obtains last token in path
				let metamodel_name = matches[2].split("/").slice(-1)[0];

				_do.chain(actions)(
						function(files)
						{
							files =
								  files.filter(
	 								  function(f)
									 	 {
									 	 	let m = metamodel_name + "\..*Icons\.metamodel";
									 	 	return f.match(m);
									 	 });

							if (files.length === 0) {
								throw 'could not match concrete syntax model to metamodel. model names must match';
							}

						  	var ramActions = [__successContinuable()];
							files.forEach(
								function(f)
								{
									ramActions.push(
										function()
										{
											return _fs.readFile(parentDir+f,'utf8');
										},
										function(data)
										{
											csmms[f] = data;
											return __successContinuable();
  										});
	 							});
							ramActions.push(
									function()
									{
										var res = _mt.ramify(_utils.jsonp(asmm),csmms);
										asmm	= res['asmm'];
										csmms = res['csmms'];
										return _fs.writeFile(
														RAMasmmPath,
														_utils.jsons(asmm,null,'\t'));
									});
							files.forEach(
								function(f)
								{
									ramActions.push(
										function()
										{
											var RAMf = parentDir +
														  f.match(/(.*)\.metamodel/)[1] +
														  '.pattern.metamodel';
                                            return _fs.writeFile(
														RAMf,
														_utils.jsons(csmms[f],null,'\t'));
										});
	 							});

							_do.chain(ramActions)(
								function()
								{
									__postMessage({'statusCode':200,'respIndex':resp});
								},
								function(err) 	{__postInternalErrorMsg(resp,err);}
							);
						},
						function(err) 	{__postInternalErrorMsg(resp,err);}
				);
			}
			else
			{
				var  matches   	 = uri.match(/\/GET(((.*\/).*)\..*Icons.metamodel)/),
					 asmmPath  	 = (matches ? ('./users'+matches[2]+'.metamodel') : undefined),
                     asmm       = undefined;
                     aswid      = this.__aswid;
                     actions    = [];
                 if (asmmPath) {
                     actions = [
                            _fs.readFile(asmmPath,'utf8'),
                            function(data) {
                               asmm = _utils.jsonp(data);
                               return __successContinuable();
                            },
                            function(result) {
                                return __wHttpReq('PUT',
                                           uri+'?wid='+aswid,
                                           ({'csm':_mmmk.read(), 'asmm': asmm}))
                            }]
                 } else {
                     actions = [__wHttpReq('PUT',
                                           uri+'?wid='+aswid,
                                           undefined)];
                 }
                 _do.chain(actions)(
                    function() { __postMessage({'statusCode':200,'respIndex':resp}); },
                    function(err) {__postInternalErrorMsg(resp,err);}
                 );
			}
		},


	/* write a bundle containing this CS model and its associated AS model to 
		disk

		1. setup sync/async action chaining
			a) ask asworker for current model (AS)			
		2. launch chain... on error, return error... on success, compare sequence#
			of returned AS model with next expected sequence# from asworker
				a) if AS model is too old, restart
			  	b) if AS model is too recent, wait 200 ms and restart
				c) otherwise, 
					i.   extract path info
					ii.  return error on invalid path
					iii. ask _mmmk for current model (CS)
					iv.  setup another sync/async action chaining
							 a) write bundled AS and CS models to disk
					v.   launch chain... return success or error code */
	'PUT *.model' :
		function(resp,uri)
		{
			var self		= this,
				 actions = [__wHttpReq('GET','/current.model?wid='+this.__aswid)];

			_do.chain(actions)(
					function(asdata)
					{
						var sn = asdata['sequence#'];
						if( self.__nextASWSequenceNumber - 1 > sn )
							self['PUT *.model'](resp,uri);
						else if( self.__nextASWSequenceNumber - 1 < sn )
							setTimeout(self['PUT *.model'], 200, resp, uri);
						else
						{
							if( (res = _mmmk.read())['$err'] )
								__postInternalErrorMsg(resp,res['$err']);
							else
							{
								var path  = './users'+uri.substring('/GET'.length),
									 dir	 = _path.dirname(path);

								if( dir.match(/"/) )
									throw 'illegal filename... these characters are not'+
									  		' allowed in filenames :: "';

								var mData = {
										'csm':_utils.jsonp(res),
										'asm':_utils.jsonp(asdata['data'])},
									 writeActions = 
										[_fspp.mkdirs(dir),
									 	 function()
										 {
											 return _fs.writeFile(
															path,
															_utils.jsons(mData,null,'\t'));
										 }];
								_do.chain(writeActions)(
									function()
									{
										__postMessage(
											{'statusCode':200,
	  										 'respIndex':resp});
									},
									function(writeErr)	
									{
										__postInternalErrorMsg(resp,writeErr);
									}
								);
							}
						}
					},
					function(err) 	{__postInternalErrorMsg(resp,err);}
			);
		},
	

	/* INTENT :
			validate the associated AS model 
		IN PRACTICE: 
			adjust uri and forward to asworker

	1. setup sync/async action chaining
		a) ask asworker to validate its model
	2. launch chain... return success code or error */
	'GET /validatem' :
		function(resp,uri)
		{
			var actions = [__wHttpReq('GET',uri+'?wid='+this.__aswid)];

			_do.chain(actions)(
					function() 
					{
						__postMessage({'statusCode':200, 'respIndex':resp});
					},
					function(err) 	{__postInternalErrorMsg(resp,err);}
			);
		},


	/* INTENT :
			undo/redo the effects of a client's last not yet undone/redone action
		IN PRACTICE: 
			adjust uri and forward asworker undo/redos to asworker, and handle 
			csworker undo/redos locally

	1. if next __handledSeqNums is a non-csworker sequence#,
		a) if it's a batchEdit marker:
			i.   adjust __handledSeqNums['i'] to account for multiple undos/redos
			ii.  populate reqData['redo/undoUntil'] with batchEdit marker s.t. 
				  asworker knows to undo/redo everything til specified marker
			iii. populate hitchhiker['redo/undo'] with batchEdit marker s.t. when 
				  asworker undo/redo changelog comes around, csworkers know until 
				  where they should undo/redo
			iv. forward request to asworker and return success code or error
		a) if it's an asworker marker:
			i.   populate hitchhiker['redo/undo'] with asworker marker s.t. when
				  asworker undo/redo changelog comes around, csworkers know until 
				  where they should undo/redo
			ii.  forward request to asworker and return success code or error */
	'POST /undo' :
		function(resp,uri,reqData/*[undoUntil]*/)
		{
			if( this.__handledSeqNums['i'] == undefined )
				this.__handledSeqNums['i'] = this.__handledSeqNums['#s'].length-1;
			if( this.__handledSeqNums['#s'][this.__handledSeqNums['i']] )
				this.__undoredo(
							resp,
							uri,
							(reqData != undefined && 'undoUntil' in reqData ?
							 	reqData['undoUntil'] :
								this.__handledSeqNums['#s'][this.__handledSeqNums['i']--]),
							'undo');
			else
				__postMessage({'statusCode':200, 'respIndex':resp});

		},
	'POST /redo' :
		function(resp,uri)
		{
			if( this.__handledSeqNums['i'] == undefined )
				this.__handledSeqNums['i'] = this.__handledSeqNums['#s'].length-1;
			if( this.__handledSeqNums['#s'][this.__handledSeqNums['i']+1] )
				this.__undoredo(
						resp,
						uri,
						this.__handledSeqNums['#s'][++this.__handledSeqNums['i']],
						'redo');
			else
				__postMessage({'statusCode':200, 'respIndex':resp});
			
		},
	'__undoredo' :
		function(resp,uri,sn,func)
		{
			if( ! sn.match(get__wtype()) )
			{
				var hitchhiker = {},
					 reqData		= {'hitchhiker':hitchhiker},
					 actions 	= [__wHttpReq(
											 'POST',
			 								 uri+'?wid='+this.__aswid,
											 reqData) ];

				if( (matches = sn.match(/^bchkpt@([0-9]+)/)) )
				{
					if( func == 'undo' )
					{
						for( ;
						  ! this.__handledSeqNums['#s'][this.__handledSeqNums['i']].
						  		match('^bchkpt@'+matches[1]);
					     this.__handledSeqNums['i']-- )	
							;
						this.__handledSeqNums['i']--;
						reqData[func+'Until'] = hitchhiker[func] = 
							__batchCheckpoint(matches[1],true);
					}
					else
					{
						this.__handledSeqNums['i']++;
						for( ;
						  ! this.__handledSeqNums['#s'][this.__handledSeqNums['i']].
						  		match('^bchkpt@'+matches[1]);
					     this.__handledSeqNums['i']++ ) 
							;
						reqData[func+'Until'] = hitchhiker[func] =
						  	__batchCheckpoint(matches[1]);
					}
				}
				else
					hitchhiker[func] = sn;					

				_do.chain( actions )(
					function() 
					{
						__postMessage({'statusCode':202, 'respIndex':resp});
					},
					function(err) 	{__postInternalErrorMsg(resp,err);}
				);
			}
			else
				__postMessage(
					{'statusCode':200,
					 'changelog':_mmmk[func](sn)['changelog'],
					 'sequence#':__sequenceNumber(),
					 'respIndex':resp});
		},


	/* INTENT :
			place an easily identifiable user-checkpoint in the journal
		IN PRACTICE: 
			adjust uri and forward to asworker

	1. setup sync/async action chaining
		a) forward request to asworker
	2. launch chain... return success code or error */
	'POST /batchCheckpoint' :
		function(resp,uri,reqData)
		{
			var actions = [
				__wHttpReq('POST',uri+'?wid='+this.__aswid,reqData)];

			_do.chain(actions)(
					function() 
					{
						__postMessage({'statusCode':202, 'respIndex':resp});
					},
					function(err) 	{__postInternalErrorMsg(resp,err);}
			);
		},



	/********************************** UTILS **********************************/
	/* wrapper around reads to '__asid2csid'...  needed because loading a model 
		(as opposed to creating it from scratch) doesn't populate this data 
		structure... this wrapper enables its lazy and transparent population as
	  	read queries are made */
	'__asid_to_csid' :
		function(asid)
		{
			if( this.__asid2csid[asid] != undefined )
				return this.__asid2csid[asid];

			var csm = _utils.jsonp(_mmmk.read());
			for( var csid in csm.nodes )
				if( __uri_to_id(_mmmk.read(csid,'$asuri')) == asid )
					return (this.__asid2csid[asid] = csid);
		},


	/* return a fullcstype from a fullastype */
	'__astype_to_cstype' :
		function(fullastype,isLink)
		{
			var matches = fullastype.match(/(.*)\/(.*)/),
				 asmm 	= matches[1],
				 astype	= matches[2];
			return this.__asmm2csmm[asmm]+'/'+astype+(isLink ? 'Link' : 'Icon');
		},


	/* return the CS instance uri associated to the AS instance described by the
		given uri */
	'__asuri_to_csuri' :
		function(uri)
		{
			if( (asid = __uri_to_id(uri))['$err'] )
				return asid;
			return __id_to_uri(this.__asid_to_csid(asid));
		},


	/* add a checkpointing marker in mmmk and log the said marker as a 
		non-undo/redo operation (remove any undone operations from log first) */
	'__checkpointUserOperation' :
		function(sn)
		{
			_mmmk.setUserCheckpoint(sn);
			if( this.__handledSeqNums['i'] != undefined )
			{
				this.__handledSeqNums['#s'].splice( this.__handledSeqNums['i']+1 );
				this.__handledSeqNums['i'] = undefined;
			}
			this.__handledSeqNums['#s'].push(sn);			
		},


	/* produce a bundle of internal state variables sufficient to fully clone 
		this instance
			OR
		use a provided bundle to overwrite this instance's internal state */
	'__clone' :
		function(clone)
		{
			if( clone )
			{
				this.__asmm2csmm 					= clone.__asmm2csmm;
				this.__asid2csid 					= clone.__asid2csid;
				this.__aswid						= clone.__aswid;
				this.__handledSeqNums 			= clone.__handledSeqNums;
				this.__nextASWSequenceNumber  = clone.__nextASWSequenceNumber;
				this.__pendingChangelogs 		= clone.__pendingChangelogs;
				this.__hitchhikerJournal		= clone.__hitchhikerJournal;
			}
			else
				return _utils.clone(
							{'__asmm2csmm':					this.__asmm2csmm,
							 '__asid2csid':					this.__asid2csid,
							 '__aswid':							this.__aswid,
							 '__handledSeqNums':				this.__handledSeqNums,
						 	 '__nextASWSequenceNumber':	this.__nextASWSequenceNumber,
						 	 '__pendingChangelogs':			this.__pendingChangelogs,
				 			 '__hitchhikerJournal':			this.__hitchhikerJournal});
		},


	/* return the AS instance uri associated to the CS instance described by the
		given uri */
	'__csuri_to_asuri' :
		function(uri)
		{
			if( (csid = __uri_to_id(uri))['$err'] )
				return csid;
			else if( (asuri = _mmmk.read(csid,'$asuri'))['$err'] )
				return asuri;
			return asuri;
		},


	/* compute 'default' segments between the given icons (specified via uri) */
	'__defaultSegments' :
		function(src,dest)
		{
			var pos1 	= _mmmk.read(__uri_to_id(src),'position'),
				 pos2 	= _mmmk.read(__uri_to_id(dest),'position'),
				 middle	= [pos2[0]-(pos2[0]-pos1[0])/2.0,
								pos2[1]-(pos2[1]-pos1[1])/2.0];
			return ['M'+pos1+'L'+middle, 'M'+middle+'L'+pos2];
		},


	/* compute the x,y center of the icons given by the specified AS uris */
	'__nodesCenter' :
		function(asuris)
		{
			var sumx = 0,
				 sumy = 0,
				 self = this;
			asuris.forEach(
					function(asuri)
					{
						var asid = __uri_to_id(asuri),
							 csid = self.__asid_to_csid(asid),
							 pos 	= _mmmk.read(csid,'position');
						sumx += parseFloat(pos[0]);
						sumy += parseFloat(pos[1]);
					});
			return [sumx/asuris.length, sumy/asuris.length];
		},


	/* run given code within given contexts

		1. setup a very stripped down version of _mmmk.__runDesignerCode() with
		  	getAttr() and safe_eval() (see _mmmk.__runDesignerCode() for more 
			elaborate comments) 
		2. safely evaluate code and return result
				
		NOTE: getAttr() first checks the 'local' context and then the 'global'
				context to find requested attributes... this enables such behaviours
				as accessing 'new'  attribute values as opposed to those stored in 
				_mmmk */
	'__runParser' :
		function(parser,local,global)
		{
			function getAttr(_attr)
			{
				if( _attr in local )
					return local[_attr];
				else if( !(_attr in global) || _attr.charAt(0) == '$')
					throw 'invalid getAttr() attribute :: '+_attr;
				return _utils.clone(global[_attr]['value']);
			}
			function safe_eval(code)
			{
				try			{return eval(code);}
				catch(err)	{return {'$err':err};}
			}	

			return safe_eval(parser);
		},


	/* returns the numeric part of sequence# of the form 'src#number' */
	'__sn2int' :
		function(sn)
		{
			return parseInt(sn.match(/.*#(\d*)/)[1]);
		}
};
