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

/* delete specified file/folder */

DataUtils = function(){
	/* 	
		NOTE:: information about the pathString is bundled with the request... if the
	  			 request succeeds, it is returned along with the changelog and used to 
				 draw the requested connection [and center-piece]
		NOTE:: DataUtils.connect() may be called from the behaviour statechart with a single
	  			 parameter (i.e., event.target)... in such cases, we construct an 
				 appropriate 2-parameter call to DataUtils.connect() and recurse 
	 */
	/**
	 * Requests a connection of specified instances with center-piece (if and when any)
	 * at center of ConnectionUtils.getConnectionPath(). In practice, before this request
	 * is sent, the user is prompted to either choose a connection type (this choice is
	 * made for him when exactly one type is available) or to be told that no legal
	 * connection exists
	 */
	this.connect = function(uri1,uri2){
		if( uri2 == undefined )
			return DataUtils.connect(ConnectionUtils.getConnectionSource(), __vobj2uri(uri1));
	
		var segments 	= __path2segments(ConnectionUtils.getConnectionPath()),
			 pathCenter	= segments.splice(1,1)[0],
	 		 callback 	= 
				 function(connectionType)
				 {
			 		 HttpUtils.httpReq(
			 				 'POST',
			 				 HttpUtils.url(connectionType,__NO_USERNAME),
			 				 {'src':uri1,
							  'dest':uri2,
			 				  'pos':[pathCenter.x,pathCenter.y],
							  'segments':segments});
				 };
	
		ConnectionUtils.hideConnectionPath();
		WindowManagement.openDialog(
				_LEGAL_CONNECTIONS,
				{'uri1':uri1,'uri2':uri2,'ctype':__VISUAL_LINK},
				callback);
	};
	
	/**
	 * Request creation of an instance of __typeToCreate at the specified
	 * x and y coordinates
	 */
	this.create = function(x,y){
		if( __typeToCreate != undefined )
			HttpUtils.httpReq(
					'POST',
					HttpUtils.url(__typeToCreate+'.type',__NO_USERNAME),
					{'pos':[x,y]});
		else
			WindowManagement.openDialog(_ERROR,'you must select a type to create');
	};
	
	/**
	 * Deletes the current selection entities
	 */
	this.del = function(){
		var requests = [];
		__selection['items'].forEach(
			function(it)
			{
				if( it in __icons )
					requests.push(
						{'method':'DELETE', 
						 'uri':HttpUtils.url(it,__NO_USERNAME+__NO_WID)});
			});

		HttpUtils.httpReq(
			'POST',
			HttpUtils.url('/batchEdit',__NO_USERNAME),
			requests);
	};
	
	/**
	 * Deletes the file from the cloud storage by URI
	 * 
	 * @param fileuri - the file to upload
	 * @param callback - the callback function after the operation
	 * has completed
	 */
	this.deleteFromCloud = function(fileuri,callback){
		HttpUtils.httpReq(
			'DELETE',
			fileuri,
			undefined,
			callback);
	};
	
	/*
		1. retrieve and validate uri associated to 'into'
		2. validate and/or setup 'items' (see NOTE)
		3. prompt for connection type
		*. return connection type or undefined via 'callback'
	
		NOTE:: when 'items' is undefined, __selection.items is used as the default 
	*/
	/**
	 * Prompt user to select a containment link type (or chooses it for him if there
	 * is only one) and pass the choice to the callback function. 
	 * 
	 * @param into - where to put the connection
	 * @param items - items to insert
	 * @param callback - function to call when finished with the request
	 */
	this.getInsertConnectionType = function(into,items,callback){
		var intouri = into.getAttribute('__csuri'); 
		if( intouri == undefined  || 
			 !(intouri in __icons) || 
			 __isConnectionType(intouri) )
			return callback();
		if( (items == undefined || items.length == 0) &&
			 (__selection == undefined	|| __selection['items'].length == 0) )
			return callback();
		items = (items || __selection['items']);
	
		WindowManagement.openDialog(
				_LEGAL_CONNECTIONS,
				{'uri1':intouri,
				 'uri2':items[0],
				 'ctype':__CONTAINMENT_LINK,
				 'forceCallback':true},
				function(ctype)
				{
					if( utils.isObject(ctype) && '$err' in ctype )
						callback();
					else
						callback(ctype);
				});
	};
	
	/*
	1. foreach non-connection type icon in 'items' that is not already inside 
		'into' or any other icon in 'items'
		a. synthesize a path from 'into''s top-left to the icon's center
		b. save that path's center and 2 halves
		c. remove the path
		d. remember connection request
	2. send all requests from step 1d as a single batchEdit or return them

	NOTE:: similarly to what is done in DataUtils.connect(), each connection request is 
			 bundled with 'pos' and 'segments'... here however, since the user drew
			 no path, these are both synthesic... this serves 2 purposes: first, it
			 shields the csworker from receiving different queries for containment
			 and visual connections, but most importantly, it ensures that 
			 containment links have an existing visual representation if one is 
			 needed

 	NOTE:: the 'context' parameter contains a list of pending changes computed by 
			 GeometryUtils.transformSelection() but not yet persisted onto the canvas... this 
			 seemingly odd passing around of pending information is necessary to 
			 enable atomicity of icon transformations and insertions 
	 */
	/**
	 * Inserts 'items' into 'into' (connects them via a containment link of type
	 * 'connectionType'). This sends a bundle of batched connection requets to csworker.
	 */
	this.insert = function(into,items,connectionType,context,dryRun) {	
		var intobbox = __getBBox(into,context),
			 requests = [];
	
		items.forEach(
			function(it)
			{
				if( ! (it in __icons) 					 ||
					__isConnectionType(it)				 ||
					__isDirectlyContainedIn(it,into)  ||
					items.some( 
						function(_it)
						{
							return __isDirectlyContainedIn(it,_it);
						}) )
					return;
	
				var itbbox	 	 = __getBBox(it,context),
					 itcenter 	 = [itbbox.x+itbbox.width/2, itbbox.y+itbbox.height/2],
					  path	 	 = __canvas.path(
						  					'M'+intobbox.x+','+intobbox.y+'L'+itcenter),
					  segments 	 = __path2segments(path),
					  pathCenter = segments.splice(1,1)[0];
				path.remove();
				
				requests.push(
						{'method':'POST',
						 'uri':HttpUtils.url(connectionType,__NO_USERNAME+__NO_WID),
						 'reqData':
							 {'src':into,
							  'dest':it,
							  'pos':[pathCenter.x,pathCenter.y],
							  'segments':segments}});
			});
		
		if( dryRun )
			return requests;
		else if( requests.length > 0 )
			HttpUtils.httpReq(
					'POST',
					HttpUtils.url('/batchEdit',__NO_USERNAME),
					requests);
	};
	
	/**
	 * Loads the Button Model
	 * 
	 * @param bm - the button model to load
	 */
	this.loadbm = function(bm){
		HttpUtils.httpReq(
				'GET',
				HttpUtils.url(bm,true),
				undefined,
				function(statusCode,resp)
				{
					GUIUtils.setupAndShowToolbar(
						bm,
						eval('('+resp+')'),
						__BUTTON_TOOLBAR);					
				});	
	};
	
	/* 
		1. does the deed
		2. if a 'missing metamodel' error is returned
			a. request that the missing metamodel be loaded
				i.  if an error is returned, show it
				ii. otherwise, return to step 1. */
	/**
	 * Request that the specified model be loaded
	 */
	this.loadm = function(fname,insert) {
		HttpUtils.httpReq(
				'PUT',
				HttpUtils.url('/current.model', __NO_USERNAME),
				{'m':HttpUtils.url(fname,__NO_WID),
				 'insert':insert},
				function(statusCode,resp)
				{
					if( ! utils.isHttpSuccessCode(statusCode) )
					{
						if( (matches = resp.match(/metamodel not loaded :: (.*)/)) )
						{
							var missing = matches[1]+'.metamodel';
							console.warn('auto-loading missing metamodel :: '+missing);
							DataUtils.loadmm(
									missing,
									function(_statusCode,_resp)
									{
										if( ! utils.isHttpSuccessCode(_statusCode) )
											WindowManagement.openDialog(_ERROR,_resp);
										else
											DataUtils.loadm(fname,insert);
									});
						}
						else
							WindowManagement.openDialog(_ERROR,resp);
					}
					else
						WindowManagement.setWindowTitle();
				});				
	};
	
	/*
	CASE 1: asmm is already loaded but with a different csmm
		> request params only contain csmm
		> triggers back-end CS-switch
	
	CASE 2: asmm is not loaded or is loaded with the specified csmm
		> request params contain asmm and csmm
		> triggers back-end metamodel (re-)load */
	/**
	 * Loads (or reloads) the specified metamodel
	 */
	this.loadmm = function(imm,callback){
		var asmm = __iconMetamodelToMetamodel(imm),
		sameASMM = function(mm) {
					 return __isIconMetamodel(mm) && 
						 	  __iconMetamodelToMetamodel(mm) == asmm;
				 },
			 params;
		if( !(imm in __loadedToolbars) && 
			 	utils.keys(__loadedToolbars).some(sameASMM) )
			params = {'csmm':HttpUtils.url(imm,__NO_WID)};
		else
			params = {'csmm':HttpUtils.url(imm,__NO_WID), 'asmm':HttpUtils.url(asmm,__NO_WID)};
		
		HttpUtils.httpReq(
			'PUT',
			HttpUtils.url('/current.metamodels', __NO_USERNAME),
			params,
			callback);
	};
	
	/**
	 * Saves the current model to the specified file
	 */
	this.savem = function(fname){
		HttpUtils.httpReq(
				'PUT',
				HttpUtils.url(fname,__FORCE_GET));	
	};
	
	/**
	 * Unloads the selected button model
	 */
	this.unloadbm = function(bm){
		GUIUtils.removeToolbar(bm);
	};
	
	/**
	 * Unloads the selected metamodel
	 */
	this.unloadmm = function(mm){
		HttpUtils.httpReq(
			'DELETE',
			HttpUtils.url(mm,__NO_USERNAME));
	};
	
	/**
	 * Updates the current model with the listed
	 * changes
	 */
	this.update = function(uri,changes){
		if( utils.keys(changes).length > 0 )
			HttpUtils.httpReq(
					'PUT',
					HttpUtils.url(uri,__NO_USERNAME),
					{'changes':changes});
	};
	
	/**
	 * Updates using a worker thread?
	 */
	this.updatecs = function(uri,changes){
		HttpUtils.httpReq(
				'PUT',
				HttpUtils.url(uri+'.cs',__NO_USERNAME),
				{'changes':changes});
	};
	
	/**
	 * Uploads the data to a file specified by the tofolder entry
	 * 
	 * @param tofolder - the folder to upload the data to
	 * @param data - the data to upload
	 * @param callback - the callback function after the operation
	 * has completed
	 */
	this.uploadToCloud = function(tofolder,data,callback){
		HttpUtils.httpReq(
				'PUT',
				HttpUtils.url(tofolder+'.file',__NO_WID),
				data,
				callback);	
	};
	
	return this;
}();