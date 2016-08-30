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

GeometryUtils = function(){
	
	var geometryControlsOverlay = undefined;
	var transformationPreviewOverlay = undefined;
	
	/**
	 * Determines whether or not geometric transformations are allowed. This only
	 * applies if:
	 * 1. Geometry controls are hidden
	 * 2. If an edge is selected, its start and end icons are also selected
	 */
	this.areTransformationsAllowed = function(){
		var seen = {};
		return (geometryControlsOverlay == undefined ||
					geometryControlsOverlay.css("display") == 'none') &&
				 __selection['items'].every(
					function(it)
					{
						if( it in __edges )
						{
							var start = __edges[it]['start'],
								 end	 = __edges[it]['end'];
							if( ! (start in seen) && 
								 ! utils.contains(__selection['items'],start) )
								return false;
							if( ! (end in seen) && 
								 ! utils.contains(__selection['items'],end) )
								return false;
							seen[start] = seen[end] = 1;
						}
						return true;
					});
	};
	
	/**
	 * Hides the geometry controls overlay
	 */
	this.hideGeometryControlsOverlay = function() {
		if( geometryControlsOverlay != undefined )
			geometryControlsOverlay.css("display", "none");
		__setCanvasScrolling(true);	
	};
	
	/**
	 * Hides the transformation preview overlay
	 */
	this.hideTransformationPreviewOverlay = function() {
		if( transformationPreviewOverlay != undefined )
		{
			transformationPreviewOverlay.remove();
			transformationPreviewOverlay = undefined;
		}
	};
	
	/*
		NOTE:: _x and _y are used to remember the last 'confirmed' position which we
				 to compute the relative parameters of calls to translate(..)
		NOTE:: the call to toBack() causes whatever is beneath the transformation 
				 preview overlay to become above it, thus becoming detectable by 
				 document.elementFromPoint()... this is used to distinguish between 
				 dropping selections on the canvas and on icons, with the latter 
				 possibly causing insertion */
	/**
	 * Initializes a Raphael rectangle matching the selection bounding box.
	 */
	this.initSelectionTransformationPreviewOverlay = function(x,y)
	{
		if( transformationPreviewOverlay != undefined )
			return;
	
		var bbox = __selection['bbox'];
		transformationPreviewOverlay = __bbox2rect(bbox,'transformation_preview');
		transformationPreviewOverlay.node.setAttribute('_x0',x);
		transformationPreviewOverlay.node.setAttribute('_y0',y);
		transformationPreviewOverlay.node.setAttribute('_x',x);
		transformationPreviewOverlay.node.setAttribute('_y',y);
		transformationPreviewOverlay.node.onmouseup = 
			function(event)
			{
				transformationPreviewOverlay.toBack();
				var beneathTPO = document.elementFromPoint(event.x,event.y),
					 _event;
	
				if( transformationPreviewOverlay.node != beneathTPO &&
					 beneathTPO != __selection['rect'].node )
				{
					_event = document.createEvent('MouseEvents');
					_event.initMouseEvent(
							event.type, event.canBubble, event.cancelable, event.view,
							event.detail, event.screenX, event.screenY, event.clientX,
						  	event.clientY, event.ctrlKey, event.altKey, event.shiftKey,
							event.metaKey, event.button, event.relatedTarget );
					beneathTPO.parentNode.dispatchEvent(_event);
				}
				else if( event.button == 0 )
					BehaviorManager.handleUserEvent(__EVENT_LEFT_RELEASE_CANVAS,event);
			};
	};
	
	/**
	 * Applies the effects of the specified transformation to the preview overlay
	 */
	this.previewSelectionTransformation = function(op,dir) {
		var bbox  = __selection['bbox'],
			 scale = (dir > 0 ? 1.05 : 0.95),
			 angle = (dir > 0 ? 3 : -3);
		if( op == 'resize' )
			transformationPreviewOverlay.scale(scale,scale,bbox.x,bbox.y);
		else if( op == 'resizeH' )
			transformationPreviewOverlay.scale(1,scale,bbox.x,bbox.y);
		else if( op == 'resizeW' )
			transformationPreviewOverlay.scale(scale,1,bbox.x,bbox.y);
		else if( op == 'rotate' )
			transformationPreviewOverlay.rotate(angle,bbox.x,bbox.y);
	};
	
	/**
	 * Moves the transformation preview overlay to the specified coordinates
	 */
	this.previewSelectionTranslation = function(x,y) {
		var _x = parseInt(transformationPreviewOverlay.node.getAttribute('_x')),
			 _y = parseInt(transformationPreviewOverlay.node.getAttribute('_y'));
		transformationPreviewOverlay.translate(x-_x,y-_y);
		transformationPreviewOverlay.node.setAttribute('_x',x);
		transformationPreviewOverlay.node.setAttribute('_y',y);
	};
	
	/* 
			0. exit on empty icon list
			1. foreach non-link icon, 
				a. loop back to step 1 if it has no container
				b. determine if it's bbox is fully inside, fully outside or intersects
					with its container's
					i.   when fully inside, loop to step 1
					ii.  when fully outside AND was actually contained (as opposed to
						  to-be-inserted) AND dragouts are enabled, produce deletion 
						  request for containment link
					iii. otherwise, store needed changes to container position and size
				  		  to fit icon... we do this (as opposed to producing a request)
						  to lump together all changes to a given container (each which 
						  may originiate from different icons)
			2. exit on empty request and container changes lists
			3. convert container changes to CS update requests and append to existing
				deletion requests, if any			
			4. recurse with 'icons' set to any modified containers and 'context' set
				to their pending changes (computed in step 1biii) and append returned
				requests... the purpose of this step is for container resizing to have
				a cascading effect (i.e., a resized container triggers its parent's
				resizing if need be)
			5. send batchEdit or return requests 
	 
		NOTE:: the 'context' parameter contains a list of pending changes computed by
				 GeometryUtils.transformSelection() but not yet persisted onto the canvas, as well
				 as a map of pending insertions, if any... this seemingly odd passing 
				 around of pending information is necessary to enable atomicity of icon
				 transformations, insertions and container resizings */
	/**
	 * Resizes the containers of icons (specified as uri array) that have moved within
	 * them as required and uninsert dragged-out icons.
	 */
	this.resizeContainers = function(icons,context,dryRun,disabledDragouts) {
		if( icons.length == 0 )
			return (dryRun ? [] : undefined);
	
		var requests 			  = [],
			 containers2changes = {},
			 resizeContainer	  =
				 function(c,clink,it)
				 {
					 var cbbox  = __getBBox(
							 c,utils.mergeDicts([context,containers2changes]) ),
					 	  itbbox = __getBBox(it,context);
	 				 if( __isBBoxInside(itbbox, cbbox) )
	 					 return;
	 				 else if( __isBBoxDisjoint(itbbox, cbbox) && 
							 	 clink && 
								 ! disabledDragouts )
	 					 requests.push(
							 {'method':'DELETE',
							  'uri':HttpUtils.url(clink,__NO_USERNAME+__NO_WID)});
	 				 else
	 				 {
	 					 containers2changes[c] = 
	 						 containers2changes[c] || 
	 						 utils.mergeDicts(
								 [{'position':
									  [parseFloat(__getIcon(c).getAttr('__x')),
									   parseFloat(__getIcon(c).getAttr('__y'))],
		 							'scale': 
										[parseFloat(__getIcon(c).getAttr('__sx')),
										 parseFloat(__getIcon(c).getAttr('__sy'))]},
								  context[c]]);
	
	 					 var padding  = 20,
	 						  overflow = 
								  {'right':	 (itbbox.x + itbbox.width) - 
													(cbbox.x + cbbox.width) + padding,
								   'left': 	 cbbox.x - itbbox.x + padding,
	  								'top':	 cbbox.y - itbbox.y + padding,
	  								'bottom': (itbbox.y + itbbox.height) - 
													(cbbox.y + cbbox.height) + padding};
	
						 if( overflow.left > 0 )
	 					 {
	 						 containers2changes[c]['position'][0] -= overflow.left;
	 						 containers2changes[c]['scale'][0] *= 
	 							 (cbbox.width+overflow.left)/cbbox.width;
	 						 cbbox.width *= containers2changes[c]['scale'][0];
	 					 }
	 					 if( overflow.right > 0 )
	 						 containers2changes[c]['scale'][0] *= 
	 							 (cbbox.width+overflow.right)/cbbox.width;
						 
	 					 if( overflow.top > 0 )
	 					 {
	 						 containers2changes[c]['position'][1] -= overflow.top;
	 						 containers2changes[c]['scale'][1] *= 
	 							 (cbbox.height+overflow.top)/cbbox.height;
	 						 cbbox.height *= containers2changes[c]['scale'][1];
	 					 }
	 					 if( overflow.bottom > 0 )
	 						 containers2changes[c]['scale'][1] *= 
	 							 (cbbox.height+overflow.bottom)/cbbox.height;
	 				 }
				 };
	
		icons.forEach(
			function(it)
			{
				if( !(it in __icons) || __isConnectionType(it) )
					return;
			
				__icons[it]['edgesIn'].forEach(
					function(edgeId)
					{
						var linkIn = __edgeId2ends(edgeId)[0];
						if( __isContainmentConnectionType(linkIn) )
							resizeContainer(
								__edgeId2ends(__icons[linkIn]['edgesIn'][0])[0],
								linkIn,
								it);
					});
	
				if( context.toBeInserted && it in context.toBeInserted )
					resizeContainer(context.toBeInserted[it],undefined,it);			
			});
	
	
		if( utils.keys(containers2changes).length == 0 && requests.length == 0 )
			return (dryRun ? [] : undefined);
	
		for( var uri in containers2changes )
			requests.push(
					{'method':'PUT', 
					 'uri':HttpUtils.url(uri+'.cs',__NO_USERNAME+__NO_WID),
					 'reqData':{'changes':containers2changes[uri]}});
	
		requests = 
			requests.concat(
				utils.flatten(
					GeometryUtils.resizeContainers(
						 utils.keys(containers2changes),
						 containers2changes,
						 true)));
	
		if( dryRun )
			return requests;	
		else
			HttpUtils.httpReq(
					'POST',
					HttpUtils.url('/batchEdit',__NO_USERNAME),
					requests);	
	};
	
	/**
	 * Shows the geometry controls overlay (positioning is based on the bounding box
	 * of the current selection) and initializes the transformation preview overlay
	 */
	this.showGeometryControlsOverlay = function() {
		var bbox = __selection['bbox'];
	
		if( geometryControlsOverlay == undefined )
		{
			geometryControlsOverlay = $('#div_geom_ctrls');
			['resize','resizeH','resizeW','rotate'].forEach(
				function(x)
				{
					var img = $('<img>');
					img.attr('class', 'geometry_ctrl');
					img.attr('src', 'client/media/'+x+'.png');
					img.get(0).onmousewheel = 
						function(event)	
						{
							var dir = event.wheelDelta;
							GeometryUtils.previewSelectionTransformation(x,dir);
							return false;
						};
					geometryControlsOverlay.append(img);
				});
			var img = $('<img>');
			img.attr('class', 'geometry_ctrl');
			img.attr('src', 'client/media/ok.png');
			img.click(function(event) {GeometryUtils.transformSelection(__GEOM_TRANSF);});
			geometryControlsOverlay.append(img);
		}
			
		geometryControlsOverlay.css("top", 
			bbox.y + bbox.height + 2 - document.body.scrollTop + "px"),
		geometryControlsOverlay.css("left", 
			bbox.x + bbox.width/2 - __GEOM_CTRLS_WIDTH/2.0 -  document.body.scrollLeft + "px");
		geometryControlsOverlay.css("display", "inline");
	
		GeometryUtils.initSelectionTransformationPreviewOverlay();
		__setCanvasScrolling(false);
	};
	
	/**
	 * Snaps the top-left corner of the selection bounding box to the nearest
	 * grid point
	 */
	this.snapSelectionToGrid = function() {
		var bbox = __selection['bbox'],
			 dx	= bbox.x % __GRID_CELL_SIZE,
			 dy	= bbox.y % __GRID_CELL_SIZE;
		
		if( dx == 0 && dy == 0 )
			return;

		GeometryUtils.initSelectionTransformationPreviewOverlay(bbox.x,bbox.y);
		GeometryUtils.previewSelectionTranslation(
			bbox.x + (dx < __GRID_CELL_SIZE/2 ? -dx : __GRID_CELL_SIZE-dx),
			bbox.y + (dy < __GRID_CELL_SIZE/2 ? -dy : __GRID_CELL_SIZE-dy));
		GeometryUtils.transformSelection(__GEOM_TRANSF);
	};
	
	/* applies the transformation currently applied to the preview overlay to the 
	 	selected icon(s)/edge(s) and removes the geometry controls and transformation
	  	preview overlays... if 'insertInfo' is specified, also inserts selection into
		it (see NOTE about why this is done from here)... this function doesn't 
		actually transform the icons, it merely requests the update of the icon(s)'s
	  	'transformation' and/or the link(s)'s $segments attributes on the csworker
		(i.e., a changelog triggers the actual transformation)
			
			1. extract transformation and build up changes in 'uri2changes'
			2. add $segments changes to 'uris2changes'
			3. retrieve and compute all necessary requests 
				a. retrieve insertion requests (+ provide DataUtils.insert() with data needed
					to compute bboxes of to-be-transformed icons, i.e., 'uris2changes')
				b. convert 'uri2changes' to icon transformation requests
				c. retrieve container resizing requests (+ provide GeometryUtils.resizeContainers()
					with 'uris2changes', a list of pending insertions from step	3a, and
					possibly a dragout prohibition)
			4. send batchEdit with requests from step 3... note that requests from 
				step 3a. are inserted last s.t. the event-flow is 1-something moved
				followed by 2-something inserted... this ordering is needed to ensure 
				mappers and parsers are evaluated in a sensible order
	
		the following describes the algorithm for getting edge ends to follow their
	  	icons when these are transformed:
			1. for each outgoing edge,
				z)	do nothing if the edge's Link is in __selection
				a) fetch the edge's source xy
				b) apply transformation T on it to produce xy'
				c) 'move' the edge source and possibly its first control point (when 
					they are colocated) to xy'... in reality, save the desired motion in
					connectedEdgesChanges
			2. for each outgoing edge, apply similar logic but to edge's end and last
				control point
	
		NOTE:: to avoid race conditions between updates to different edges within a
				 single Link's $segments, relevant changes are accumulated in 
				 connectedEdgesChanges s.t. those pertaining to the same Link end up
				 bundled in a single update request
	
		NOTE:: to avoid race conditions between updates to $segments resulting from
				 edge ends following connected icon and updates resulting from edges 
				 themselves being transformed (i.e., when they are within __selection),
				 the former are ignored when we know the latter will be carried out 
	 
		NOTE:: because SVG transformations are always relative to the global (0,0),
				 non-translate transformations still technically translate things... 
				 Raphael allows specifiying different origins for transformations...
					default SVG scale x2 :
						Rect(10,10,200,100)  >  Rect(20,20,400,200)
					Raphael scale with scale origin set to (10,10)
						Rect(10,10,200,100)  >  Rect(10,10,200,100)
				 in the above example, Raphael's transformation matrix will report the
	 			 translation from (20,20) back to (10,10) even though from my 
	 			 perspective, the figure hasn't moved and has only been scaled... to 
	 			 account for this, when decomposing the said matrix, we ignore tx,ty
				 when r|sx|sy aren't 0|1|1 and vice-versa... this doesn't cause any 
				 problems because the client interface doesn't support scaling/rotating
				 *and* translating without an intermediate call to this function... 
	
		NOTE:: essentially, the above-explained ignored rotation/scaling translation
	  			 components apply to the top-left corner of the selection bbox (i.e., 
				 it's Raphael ensuring that the said corner does not move as a result 
				 of rotations/scalings 'centered' on it)... however, similar rotation/
				 scaling translation components apply to contents of the selection... 
				 this is because the said contents are changing wrt. the top-left 
				 corner of the selection, not wrt. their own (x,y)... ignoring these 
				 'internal' translation components would cause altering a selection to
				 act like altering each selected item individually... long story short,
				 we can not and do not ignore them... below is the algorithm we use to
				 compute the internal translation components:
				 
				 1. foreach selected icon
					[do nothing if no rotation or and no scaling]			 
					a) compute offset between icon's x,y and selection's top-left corner
					b) apply extracted (from transformation matrix) rotation and scale 
						to a point whose coordinates are the x and y offsets from step a)
					c) determine translation from point from step a) to transformed 
						point from step b)
					d) the icon's transformation is now the extracted rotation and 
						scaling *and* the translation from step c) 
	 
		NOTE:: since the selection transformation should be an atomic operation, 
				 changes are accumulated in 'uris2changes' and are only actually sent
				 to the csworker at the very end of this function... also, since 
	 			 insertions and container resizings and the selection transformations
				 that triggered them should be atomic too, requests pertaining to the 2
				 former tasks are computed and bundled with those that effect the 
				 latter... the results of this form the emitted batchEdit */
	this.transformSelection = function(callingContext,insertInfo) {
		var T = transformationPreviewOverlay.node.getAttribute('transform');
		if( T == null || T == 'matrix(1,0,0,1,0,0)' )
		{
			GeometryUtils.hideGeometryControlsOverlay();
			GeometryUtils.hideTransformationPreviewOverlay();
			return;
		}
	
		/** 1 **/
		var _T   					  = __decomposeTransformationMatrix(T),
			 connectedEdgesChanges = {},
			 uris2changes			  = {};
		__selection['items'].forEach(
			function(it)
			{
				if( it in __icons )
				{
					var icon		= __icons[it]['icon'],
						 changes = {};
					if( _T.r == 0 && 
						 Math.abs(1-_T.sx) <= 0.001 &&
						 Math.abs(1-_T.sy) <= 0.001 )
					{
						/* translation only */ 		
						if( _T.tx != 0 || _T.ty != 0 )
							changes['position'] = 
								[_T.tx + parseFloat(icon.getAttr('__x')), 
		  						 _T.ty + parseFloat(icon.getAttr('__y'))];
					}
					else
					{
						/* rotation/scale only */ 						
						var offset	 = [icon.getAttr('__x') - __selection['bbox'].x,
						 				 	 icon.getAttr('__y') - __selection['bbox'].y],
							 rsOffset = GeometryUtils.transformPoint(
												offset[0],
												offset[1],
												'rotate('+_T.r+') scale('+_T.sx+','+_T.sy+')'),
						  	 offsetTx = rsOffset[0] - offset[0],
							 offsetTy = rsOffset[1] - offset[1];
	
						if( _T.r != 0 )
							changes['orientation'] = 
								(parseFloat(icon.getAttr('__r')) + _T.r) % 360;
	
						if( Math.abs(1-_T.sx) > 0.001 || Math.abs(1-_T.sy) > 0.001  )
							changes['scale'] = 
									[_T.sx * parseFloat(icon.getAttr('__sx')), 
		  							 _T.sy * parseFloat(icon.getAttr('__sy'))];
	
						if( offsetTx != 0 || offsetTy != 0 )
							changes['position'] = 
								[offsetTx + parseFloat(icon.getAttr('__x')), 
		  						 offsetTy + parseFloat(icon.getAttr('__y'))];
					}
	 				uris2changes[it] = changes;
	
	
					if( ! __isConnectionType(it) )
					{
						/* have edge ends out follow */
						__icons[it]['edgesOut'].forEach(
							function(edgeId)
							{
								var linkuri = __edgeId2linkuri(edgeId);
								if( __isSelected(linkuri) )
									return;
					
								var segments = __edges[edgeId]['segments'],
									 points	 = segments.match(/([\d\.]*,[\d\.]*)/g),
									 xy 		 = utils.head(points).split(','),
									 newXY 	 = GeometryUtils.transformPoint(xy[0],xy[1],T);
										 
								connectedEdgesChanges[linkuri] = 
									(connectedEdgesChanges[linkuri] || {});
								points.splice(0,1,newXY.join(','));
								connectedEdgesChanges[linkuri][edgeId] = 
									'M'+points.join('L');
							});
	
						/* have edge ends in follow */
						__icons[it]['edgesIn'].forEach(
							function(edgeId)
							{
								var linkuri = __edgeId2linkuri(edgeId);
								if( __isSelected(linkuri) )
									return;
				
								var segments = __edges[edgeId]['segments'],
									 points	 = segments.match(/([\d\.]*,[\d\.]*)/g),
									 xy 		 = utils.tail(points).split(','),
									 newXY 	 = GeometryUtils.transformPoint(xy[0],xy[1],T);
								connectedEdgesChanges[linkuri] = 
									(connectedEdgesChanges[linkuri] || {});
								points.splice(points.length-1,1,newXY.join(','));
								connectedEdgesChanges[linkuri][edgeId] = 
									'M'+points.join('L');
							});
					}
					else
					{
						/* transform entire edges */					
						var __segments = __linkuri2segments(it),
							 changes		 = {};
						for( var edgeId in __segments )
						{
							var segments  = __segments[edgeId],
								 points	  = segments.match(/([\d\.]*,[\d\.]*)/g),
								 newPoints = points.map(
			 										 function(p)
							 						 {
														 p = p.split(',');
														 return GeometryUtils.transformPoint(p[0],p[1],T);
													 });
							changes[edgeId] = 'M'+newPoints.join('L');
						}
						uris2changes[it]['$segments'] = changes;
					}
				}
			});
	
		/** 2 **/
		if( utils.keys(connectedEdgesChanges).length > 0 )
			for( var linkuri in connectedEdgesChanges )
			{	
				if( !(linkuri in uris2changes) )
					uris2changes[linkuri] = {};
				if( !('$segments' in uris2changes[linkuri]) )
					uris2changes[linkuri]['$segments'] = __linkuri2segments(linkuri);
	
				uris2changes[linkuri]['$segments'] = 
					utils.mergeDicts([
						uris2changes[linkuri]['$segments'],
						connectedEdgesChanges[linkuri]]);
			}
	
		/** 3-4 **/
		if( utils.keys(uris2changes).length > 0 )
		{
			var csRequests 	 = [],
				 insertRequests = [];
			if( insertInfo )
			{
				insertRequests = DataUtils.insert(
											insertInfo['dropTarget'].getAttribute('__csuri'),
											__selection['items'],
											insertInfo['connectionType'],
											uris2changes,
											true);
	
				var toBeInserted = {};
				insertRequests.forEach(
					function(r)
					{
						toBeInserted[r['reqData']['dest']] = r['reqData']['src'];
					});
			}
	
			for( var uri in uris2changes )
				if( utils.keys(uris2changes[uri]).length > 0 )
					csRequests.push(
						{'method':'PUT', 
						 'uri':HttpUtils.url(uri+'.cs',__NO_USERNAME+__NO_WID),
						 'reqData':{'changes':uris2changes[uri]}});
			
			HttpUtils.httpReq(
				'POST',
				HttpUtils.url('/batchEdit',__NO_USERNAME),
				csRequests.concat(
					GeometryUtils.resizeContainers(
						__selection['items'],
						utils.mergeDicts(
							[uris2changes, {'toBeInserted':toBeInserted}]),
						true,
						(callingContext == __GEOM_TRANSF)),
					insertRequests));
		}
	};
	
	/**
	 * Apply the specified transformation to the given point and return
	 * the resulting point
	 */
	this.transformPoint = function(x,y,T) {
		var pt = __canvas.group();
		pt.push( __canvas.point(x,y) );
		pt.node.setAttribute('transform',T);
	
		var bbox	 = pt.getBBox();
		pt.remove();
		return [bbox.x+bbox.width/2,bbox.y+bbox.height/2];
	};
	
	return this;
}();