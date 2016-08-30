/*******************************************************************************
AToMPM - A Tool for Multi-Paradigm Modelling

Copyright (c) 2011 Raphael Mannadiar (raphael.mannadiar@mail.mcgill.ca)
Modified by Conner Hansen (chansen@crimson.ua.edu)

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

// DEPRECATED FUNCTIONS
///////////////////////////////////////////////////////////////////////////////
function _copy(){
	AtomPMClient.alertDeprecatedFunctionCall("_copy");
	EditUtils.copy();
}

function _paste(){
	AtomPMClient.alertDeprecatedFunctionCall("_paste");
	EditUtils.paste();
}

function _redo(){
	AtomPMClient.alertDeprecatedFunctionCall("_redo");
	EditUtils.redo();
}

function _undo(){
	AtomPMClient.alertDeprecatedFunctionCall("_undo");
	EditUtils.undo();
}
///////////////////////////////////////////////////////////////////////////////
// DEPRECATED FUNCTIONS
///////////////////////////////////////////////////////////////////////////////

/* copies the full AS and CS of selected icons into a cross-tab/window storage
  	area 
 
 	NOTE: the use of window.localStorage enables copy-pasting across atompm
 			instances... this could also have been accomplished via cookies albeit
			less efficiently since cookies are logged around during every backend 
			request/response */

EditUtils = function(){
	
	/**
	 * This copies the currently selected element(s) to the local
	 * clipboard object
	 */
	this.copy = function() {
		if( __selection == undefined || __selection['items'].length == 0 )
			return;
		else if( ! GeometryUtils.areTransformationsAllowed() )
		{
			console.warn('copy-pasting is only enabled if all of the ends of selected'
				  			 +' edges are also selected, and if the geometry controls are'
							 +' inactive');
			return;
		}
		
		var icons  = 
				__selection['items'].filter( function(it) {return it in __icons;} ),
			 todo   = icons.length,
			 cpdata = {};
		icons.forEach(
			function(uri)
			{
				if( cpdata == undefined )
					return;

				HttpUtils.httpReq(
					'GET',
					HttpUtils.url(uri,__NO_USERNAME),
					'&full=1',
					function(statusCode,resp)
					{
						if( ! utils.isHttpSuccessCode(statusCode) )
						{
							WindowManagement.openDialog(_ERROR,'failed to retrieve copy data :: '+resp);
							cpdata = undefined;
							return;
						}
						else
						{ 
							var data 	 = utils.jsonp(resp)['data'],
								 cs 		=  utils.jsonp(data['cs']),
								 as 		=  utils.jsonp(data['as']),
								 csattrs = {},
								 asattrs = {};		

							 for( var attr in cs )
								 csattrs[attr] = cs[attr]['value'];
							 for( var attr in as )
								 asattrs[attr] = as[attr]['value'];
							 delete csattrs['$type'];
							 delete csattrs['$asuri'];
							 delete asattrs['$type'];
	 						 cpdata[uri] = {'cs':csattrs,'as':asattrs};
						}
		
						if( --todo == 0 )
							window.localStorage.setItem('clipboard',utils.jsons(cpdata));
					});
			});
	};
	
	/* paste clipboard contents by building [and sending] batchEdit query filled 
	with node creation/connection requests

	0. produce metamodel loading requests for missing clipboard entry metamodels,
			if any
	1. sort contents such that non-Links get handled first... this is merely an
			optimization that optimizes step 2.
	2. while clipboard items remain, 
			.) shift first item
			a) if item is a non-connection type, produce a creation request for it
		  		and remember its index in 'it2creq'
			a) otherwise, 
				i.  if both connection ends have entries in 'it2creq', produce a
					 creation request for item and remember its index in 'it2creq'
				i. otherwise, push item at the end of the list of remaining items 
		clipboard data for the given item is used to populate the request's 
		'attrs', ['src', 'dest'] and 'hitchhiker.clone' parameters
	3. send off the batchEdit request
	4. on completion, select newly created nodes and edges

	NOTE 1:: to connect to-be created nodes and to select them, we need their ids
				... unfortunately, the csworker can not return the csid of a newly 
					requested node (this csid will only come to be when the csworker 
					handles the asworker's  MKNODE)... for this reason, paste batchEdits
					are directed to our asworker (who responds to creation requests with
					the asids of newly created nodes)

	NOTE 2:: the 'it2creq' data structure is used to remember which request is
				associated to which to-be node... this is needed for connection 
				requests with parameterized source and destination ids

	NOTE 3:: a limitation of the current implementation (which could fairly 
				easily be overcome) is that Link '$segments' are expected to always
				contain exactly 2 entries 

	NOTE 4:: selection of pasted elements requires that all icons be created...
				the batchEdit response only indicates that all asworker entities 
				have been created: their associated icons might not all exist yet...
			  	to this end, a timed-loop checks for all the icons to be created 
				before triggering selection... this works but it isn't perfect for 
				3 reasons
					1. there might be a visible lag before selecting
					2. a malicious user could cause the timed-loop to run forever
						by deleting pasted entities before the loop detects their
						creation 
						3. the loop almost always runs in O(||__icons||) */
	/**
	 * Pastes the current contents of the clipboard.
	 */
	this.paste = function() {
		var clipboard = utils.jsonp(window.localStorage.getItem('clipboard'));
		if( clipboard == null )
		{
			console.warn('clipboard is empty');
			return;
		}
		
		var toload	 = {},
			 requests = [],
			 it2creq	 = {},
			 tmpasuri = 
				 function(csuri,reqi)
				 {
					 var matches = csuri.match(
			 /^(.*)\..*Icons(\.pattern){0,1}(\/.*)Link\/[a-zA-Z0-9]*\.instance$/) ||
					 		  			csuri.match(
				 /^(.*)\..*Icons(\.pattern){0,1}(\/.*)Icon\/[a-zA-Z0-9]*\.instance$/);
					 return matches[1]+
						 	  (matches[2] || '')+
							  matches[3]+'/$'+reqi+'$.instance';
				 },
			 cburis = utils.keys(clipboard);
		
		cburis.forEach(
				function(uri)
				{
					var imm  = __getMetamodel(uri)+'.metamodel',
						 asmm = __iconMetamodelToMetamodel(imm);
					if( (!(asmm in __loadedToolbars) || !(imm in __loadedToolbars)) &&
					 	 !(imm in toload) )
					{
						requests.push(
							{'method':'PUT',
							 'uri':HttpUtils.url('/current.metamodels', __NO_USERNAME+__NO_WID),
							 'reqData':
							 	{'mm':HttpUtils.url(asmm,__NO_WID),
								 'hitchhiker':{'path':HttpUtils.url(imm,__NO_WID)}}});	
						toload[imm] = 1;
					}
				});
		
		cburis.sort( function(a,b) {return (__isConnectionType(a) ? 1 : -1);} );
		while( cburis.length > 0 )
		{
			var uri		= cburis.shift(),
				 matches = uri.match(
			 /^(.*)\..*Icons(\.pattern){0,1}(\/.*)Link\/[a-zA-Z0-9]*\.instance$/) ||
					 		  uri.match(
				 /^(.*)\..*Icons(\.pattern){0,1}(\/.*)Icon\/[a-zA-Z0-9]*\.instance$/),
				 type		= matches[1]+(matches[2] || '')+matches[3]+'.type';
			
			if( ! __isConnectionType(uri) )
			{
				it2creq[uri] = requests.length;
				requests.push(
					{'method':'POST', 
					 'uri':HttpUtils.url(type,__NO_USERNAME+__NO_WID),
					 'reqData':
					 	{'attrs':clipboard[uri]['as'],
						 'hitchhiker':{'clone':clipboard[uri]['cs']}}});
			}
			else
			{
				var segments = clipboard[uri]['cs']['$segments'],
					 src	 	 = undefined,
					 dest		 = undefined,
					 asSrc,
					 asDest;
			
				for( var edgeId in segments )
				{
					var ends = __edgeId2ends(edgeId);
					if( ends[0] == uri )
						dest = ends[1];
					else
						src = ends[0];
				}
				src    = (src  || uri);
				dest   = (dest || uri);
		
				if( it2creq[src] == undefined || it2creq[dest] == undefined )
					cburis.push(uri);
				else
				{
					delete clipboard[uri]['cs']['$segments'];
					it2creq[uri] = requests.length;
					asSrc  = tmpasuri(src,it2creq[src]);
					asDest = tmpasuri(dest,it2creq[dest]);
					requests.push(
						{'method':'POST', 
						 'uri':HttpUtils.url(type,__NO_USERNAME+__NO_WID),
						 'reqData':
						 	{'attrs':clipboard[uri]['as'],
							 'src':	asSrc,
							 'dest':	asDest,
							 'hitchhiker':
							 	{'clone':clipboard[uri]['cs'],
								 'asSrc':asSrc,
								 'asDest':asDest,
								 'segments':
								 	[segments[src+'--'+uri],
									 segments[uri+'--'+dest]]}}});
				}
			}
		}
		
		HttpUtils.httpReq(
			'POST',
			HttpUtils.url('/batchEdit',__NO_USERNAME+__NO_WID)+'?wid='+__aswid,
			requests,
			function(statusCode,resp)
			{
				if( ! utils.isHttpSuccessCode(statusCode) )
				{
					WindowManagement.openDialog(_ERROR, 'paste failed on :: '+resp);
					return;
				}
		
				var results = utils.jsonp(resp)['data']['results'],
					 asids	= results.filter(function(r) {return 'data' in r;}).
					 							map(function(r) {return ''+r['data'];}),
					 csuris	= [],
		 			 selectResults =
					 	function()
						{
								for( var uri in __icons )
		  					{
		  						var id = __icons[uri]['icon'].getAttr('__asuri').
											match(/.*\/(.*)\.instance/)[1];
		
		  						if( (idx=asids.indexOf(id)) > -1 )
		  						{
		  							if( __isConnectionType(uri) )
		  								csuris = csuris.concat(
												__icons[uri]['edgesIn'],__icons[uri]['edgesOut']);
		  							csuris.push(uri);
		  							asids.splice(idx,1);
		  						}
		  						
		  						if( asids.length == 0 )
									return BehaviorManager.handleUserEvent(__EVENT_CODED_SELECTION,csuris);
		  					}
							window.setTimeout(selectResults,100);
						};
				selectResults();
			});
	};
	
	/**
	 * Redo the last undone action
	 */
	this.redo = function(){		  
		BehaviorManager.handleUserEvent(__EVENT_CODED_CANVAS_EDIT);
		HttpUtils.httpReq(
				'POST',
				HttpUtils.url('/redo',__NO_USERNAME));	
	};
	
	/**
	 * Undo the last performed action
	 */
	this.undo = function() {				  
		BehaviorManager.handleUserEvent(__EVENT_CODED_CANVAS_EDIT);
		HttpUtils.httpReq(
				'POST',
				HttpUtils.url('/undo',__NO_USERNAME));	
	};
	
	return this;
}();