/* This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
*  Copyright 2011 by the AToMPM team and licensed under the LGPL
*  See COPYING.lesser and README.md in the root of this project for full details
*/

ConnectionUtils = function(){
	var connectionPathEditingOverlay = {};
	var currentControlPoint = undefined;
	var connectionSource = undefined;
	var connectionPath = undefined;
	
	this.getConnectionSource = function(){
		return connectionSource;
	};
	
	this.getConnectionPath = function(){
		return connectionPath;
	};
	
	/**
	 * "Confirm"s the entire current connection path.
	 * TODO: update this documentation
	 */
	this.addConnectionSegment = function(){
		connectionPath.node.setAttribute('_d',connectionPath.attr('path'));
	};
	
	/**
	 * Adds a new control point to the current path
	 * @param x the x-coordinate
	 * @param y the y-coordinate
	 * @param overlay 
	 */
	this.addControlPoint = function(x,y,overlay) {
		ConnectionUtils.addOrDeleteControlPoint('+',overlay,x,y);
	};
	
	/* Explanation of the Add/Delete algorithm:
		
		addition:
			. clicked overlay corresponds to Lx2,y2
	  		Mx0,y0 Lx1,y1 Lx2,y2 Lx3,y3
				becomes
	  		Mx0,y0 Lx1,y1 Lx2,y2 Lx2,y2 Lx3,y3
	
		deletion:
			. clicked overlay corresponds to Lx2,y2
	  		Mx0,y0 Lx1,y1 Lx2,y2 Lx3,y3
				becomes
	  		Mx0,y0 Lx1,y1 Lx3,y3
	
		after making the described modifications to the corresponding edge's segments
		property, 
		1 the edge is redrawn
		2 a request is sent to the csworker to update the edge's Link's $segments 
		  property 
		3 the connection path editing overlay is refreshed (this will cause newly 
		  added control points to appear, and deleted ones to disappear) 
	 
		NOTE:: the first and last control points can never be deleted */
	/**
	 * Adds or deletes the control point associated with the given overlay.
	 */
	this.addOrDeleteControlPoint = function(op,overlay,x,y){
		if( ! overlay.hasAttribute('__edgeId') )
			return;
		
		var edgeId = overlay.getAttribute('__edgeId'),
			 num = parseInt( overlay.getAttribute('__num') ),
			 offset = parseInt( overlay.getAttribute('__offset') ),
			 segments = __edges[edgeId]['segments'],
			 points = segments.match(/([\d\.]*,[\d\.]*)/g);
	
		if( op == '-' )
			/* delete a control point */
		{
			if( num+offset == 0 || num+offset == points.length-1 )
				return;
			points.splice(num+offset,1);
		}
		else
			/* add a control point */
			points.splice(num+offset,0,x+','+y);
	
		var newpath = 'M'+points.join('L'),
			 edgeIds = utils.keys(connectionPathEditingOverlay),
			 linkuri = __edgeId2linkuri(edgeId),
			 changes = {};
		
		changes[edgeId] = newpath;
		__redrawEdge(edgeId,newpath);
		DataUtils.updatecs(
			linkuri, 
			{'$segments':utils.mergeDicts([__linkuri2segments(linkuri),changes])});
		ConnectionUtils.hideConnectionPathEditingOverlay();
		ConnectionUtils.showConnectionPathEditingOverlay(edgeIds);	
	};
	
	/**
	 * Removes the current control point
	 * @param overlay - the overlay to be used to identify the control point
	 */
	this.deleteControlPoint = function(overlay)	{
		ConnectionUtils.addOrDeleteControlPoint('-',overlay);
	};
	
	/**
	 * "Unconfirm" the last segment of the connection path (ie
	 * remove it). Do nothing if all segments have been "confirmed"
	 */
	this.deleteConnectionSegment = function() {
		var d = String(connectionPath.attr('path')),
		matches = d.match(/(M.*,.*)L(.*),(.*)/),
		_d = connectionPath.node.getAttribute('_d'),
		_matches = _d.match(/(M.*,.*)L.*,.*/);

		if( ! _matches )
			; // do nothing
		else if( matches )
		{
			var x = matches[2], y = matches[3];
			connectionPath.node.setAttribute('_d',_matches[1]);
			ConnectionUtils.updateConnectionSegment(x,y);
		}
	};
	
	/* 
	NOTE:: connectionSource is used to remember the uri of the icon at the 
			 start of the path
	NOTE:: _d is used ro remember the 'confirmed' portions of the path
	NOTE:: the call to connectionPath.toBack() causes mouse events that occur
			 on top of icons to be captured by those (as opposed to by the in-
			 progress connection path which would capture them otherwise) 
	 */
	/**
	 * Initializes a Raphael Path starting at (x, y) and that reports the
	 * mouseup event as if it were the canvas
	 */
	this.initConnectionPath = function(x,y,target){
		if( connectionPath != undefined )
			return;

		connectionSource = __vobj2uri(target);
		connectionPath = __canvas.path('M'+x+','+y);
		connectionPath.node.setAttribute('_d','M'+x+','+y);
		connectionPath.toBack();		
		connectionPath.node.onmouseup = function(event) {
			if( event.button == 0 )
				BehaviorManager.handleUserEvent(__EVENT_LEFT_RELEASE_CANVAS,event);
			else if( event.button == 1 )
				BehaviorManager.handleUserEvent(__EVENT_MIDDLE_RELEASE_CANVAS,event);
			else if( event.button == 2 )
				BehaviorManager.handleUserEvent(__EVENT_RIGHT_RELEASE_CANVAS,event);
		};
	};
	
	/**
	 * Saves the Raphael element associated with the specific overlay as the current
	 * control point. 
	 * 
	 * This provides a more robust defense against moving the mouse so quickly that it
	 * exits the overlay we're dragging.
	 */
	this.initControlPointTranslation = function(overlay){
		if( overlay.hasAttribute('__edgeId') )
			/* set currentControlPoint to normal overlay */								
		{
			var edgeId = overlay.getAttribute('__edgeId'),
				 num	  = overlay.getAttribute('__num');
			currentControlPoint = connectionPathEditingOverlay[edgeId][num];
		}
		else
			/* set currentControlPoint to central overlay */								
		{
			var linkuri = overlay.getAttribute('__linkuri');
			currentControlPoint = connectionPathEditingOverlay[linkuri][0];
		}
	};
	
	/**
	 * Hide and delete the connection path
	 */
	this.hideConnectionPath = function(){
		connectionPath.remove();
		connectionPath = undefined;
		connectionSource = undefined;
	};
	
	/**
	 * Hides the current connection path overlay
	 */
	this.hideConnectionPathEditingOverlay = function(){
		for( var _ in connectionPathEditingOverlay )
			connectionPathEditingOverlay[_].forEach(
					function(overlay)
					{
						overlay.remove();
					});
		
		connectionPathEditingOverlay = {};
		currentControlPoint = undefined;
	};

    /**
     * Moves the control point and its overlay to the specified coordinates
     */
    this.previewControlPointTranslation = function (x, y, ctrl_key_down) {

        // if the control key is not down,
        // restrict control point to within bounding box
        if (!ctrl_key_down) {
            let new_points = this.restrictControlPoint(x, y);
            x = new_points[0];
            y = new_points[1];
        }

        let _x = parseInt(currentControlPoint.node.getAttribute('_x')),
            _y = parseInt(currentControlPoint.node.getAttribute('_y'));

        currentControlPoint.translate(x - _x, y - _y);

        currentControlPoint.node.setAttribute('_x', x);
        currentControlPoint.node.setAttribute('_y', y);
        ConnectionUtils.updateConnectionPath(true);
    };

    /**
     * Restricts the control point to within an icon's bounding box
     */
    this.restrictControlPoint = function (x, y) {
        let start = currentControlPoint.node.getAttribute("__start");
        let end = currentControlPoint.node.getAttribute("__end");

        // something went wrong, or we're not an
		// outside edge, so return the points
        if (start == undefined && end == undefined) {
            return [x, y];
        }

        //get the bounding box rectangle
        let icon = __getIcon(start || end);
        let bbox = icon.getBBox();

        //get the dimensions
        let iconX = bbox.x;
        let iconY = bbox.y;

        let width = bbox.width;
        let height = bbox.height;

        //restrict x and y to within the bounding box
        if (x < iconX) {
            x = iconX;
        } else if (x > iconX + width) {
            x = iconX + width;
        }

        if (y < iconY) {
            y = iconY;
        } else if (y > iconY + height) {
            y = iconY + height;
        }
        return [Math.round(x), Math.round(y)];
    };
	
	/**
	 * Show the connection path editing overlay. This shows draggable circles
	 * above every control point along the selected edges. 
	 */
	this.showConnectionPathEditingOverlay = function(_edgeIds){
		var edgeIds 	 = 
				(_edgeIds ? _edgeIds : __selection['items']).
					filter( function(it)	{return it in __edges;} ),
			 onmousedown = 
				function(event)
				{
					if( event.button == 0 )
						BehaviorManager.handleUserEvent(__EVENT_LEFT_PRESS_CTRL_POINT,event);
				},
			 onmouseup = 
			 	function(event)
				{
					if( event.button == 0 )
						BehaviorManager.handleUserEvent(__EVENT_LEFT_RELEASE_CTRL_POINT,event);
					else if( event.button == 1 )
						BehaviorManager.handleUserEvent(__EVENT_MIDDLE_RELEASE_CTRL_POINT,event);
					else if( event.button == 2 )
						BehaviorManager.handleUserEvent(__EVENT_RIGHT_RELEASE_CTRL_POINT,event);
				};
	
		edgeIds.forEach(
			function(edgeId)
			{
				var points = __edges[edgeId]['segments'].match(/([\d\.]*,[\d\.]*)/g),
					linkuri = __edgeId2linkuri(edgeId),
					edgeToLink = edgeId.match(linkuri+'$');
	
				/* setup normal overlay */								
				connectionPathEditingOverlay[edgeId] = [];
				(edgeToLink ? 
				 	points.slice(0,points.length-1) :
					points.slice(1)).forEach(
					function(p)
					{
						var xy		= p.split(','),
							 x 		= xy[0],
							 y 		= xy[1],
							 overlay	= __canvas.circle(x,y,5);
						overlay.node.setAttribute('class','ctrl_point_overlay');
						overlay.node.setAttribute('__edgeId',edgeId);
						overlay.node.setAttribute('__offset',(edgeToLink ? 0 : 1));
						overlay.node.setAttribute('__num',
								connectionPathEditingOverlay[edgeId].length);
						overlay.node.setAttribute('_x',x);
						overlay.node.setAttribute('_y',y);
						overlay.node.onmouseup = onmouseup;
						overlay.node.onmousedown = onmousedown;
						connectionPathEditingOverlay[edgeId].push(overlay);
					});
	
				/* enhance start/end */							
				if( edgeToLink )
					utils.head(connectionPathEditingOverlay[edgeId]).node.
						setAttribute('__start', __edges[edgeId]['start']);
				else
					utils.tail(connectionPathEditingOverlay[edgeId]).node.
						setAttribute('__end', __edges[edgeId]['end']);
	
				/* setup central overlay */	
				var edgeListAttr = (edgeToLink ? '__edgesTo' : '__edgesFrom');
				if( ! (linkuri in connectionPathEditingOverlay) )
				{
					var xy			= (edgeToLink ?
				__edges[edgeId]['segments'].match(/.*L(.*)/) :
				__edges[edgeId]['segments'].match(/M([\d\.]*,[\d\.]*)/))[1].split(','),
						 x 			= xy[0],
						 y 			= xy[1],
						 overlay	= __canvas.circle(x,y,8);
					overlay.node.setAttribute('class','ctrl_point_center_overlay');
					overlay.node.setAttribute('_x',x);
					overlay.node.setAttribute('_y',y);
					overlay.node.setAttribute('_x0',x);
					overlay.node.setAttribute('_y0',y);
					overlay.node.setAttribute('__linkuri',linkuri);
					overlay.node.setAttribute('__edgesTo',utils.jsons([]));
					overlay.node.setAttribute('__edgesFrom',utils.jsons([]));
					overlay.node.onmouseup = onmouseup;
					overlay.node.onmousedown = onmousedown;
					connectionPathEditingOverlay[linkuri] = [overlay];
				}
	
				var centerOverlay	= connectionPathEditingOverlay[linkuri][0],
					 edgeList 		= utils.jsonp(centerOverlay.node.getAttribute(edgeListAttr));
				edgeList.push(edgeId);
				centerOverlay.node.setAttribute(edgeListAttr,utils.jsons(edgeList));
			});
	};
	
	/**
	 * Snaps the current segment to the x or y axis depending on its proximity
	 * to both axes
	 */
	this.snapConnectionSegment = function(x,y){
		var _d		 = connectionPath.node.getAttribute('_d'),
			 _matches = _d.match(/.*[L|M](.*),(.*)/),
			 _x 		 = parseInt( _matches[1] ),
			 _y 		 = parseInt( _matches[2] ),
			 d		 	 = String(connectionPath.attr('path')),
			 matches  = d.match(/.*[L|M](.*),(.*)/),
			 x 		 = parseInt( matches[1] ),
			 y 		 = parseInt( matches[2] );
		
		if( Math.abs(x-_x) > Math.abs(y-_y) )
			y = _y;
		else
			x = _x;
		ConnectionUtils.updateConnectionSegment(x,y);
	};
	
	/**
	 * Snap the current control point, if any
	 */
	this.snapControlPoint = function(){
		if( currentControlPoint == undefined )
			return;
	
		var cpn = currentControlPoint.node,
			 _x  = cpn.getAttribute('_x'),
			 _y  = cpn.getAttribute('_y');
	
		if( cpn.hasAttribute('__edgeId') )
			/* snapping normal overlay */				
		{
			var edgeId = cpn.getAttribute('__edgeId'),
				 num	  = parseInt(cpn.getAttribute('__num')),
				 offset = parseInt(cpn.getAttribute('__offset')),
				 points = __edges[edgeId]['segments'].match(/([\d\.]*,[\d\.]*)/g),
				 prevXY = points[num+offset-1];
			if( num+offset == 0 || num+offset == points.length-1 )
				/* don't snap end points */
				return;
		}
		else
			/* snapping central overlay */				
			var edgeId = utils.jsonp(cpn.getAttribute('__edgesTo'))[0],
				 points = __edges[edgeId]['segments'].match(/([\d\.]*,[\d\.]*)/g),
				 prevXY = points[points.length-2];
	
		prevXY = prevXY.split(',');
		if( Math.abs(prevXY[0]-_x) > Math.abs(prevXY[1]-_y) )
			_y = prevXY[1];
		else
			_x = prevXY[0];
		ConnectionUtils.previewControlPointTranslation(_x,_y);
		ConnectionUtils.updateConnectionPath();
	};
	
	/* 	NOTE:: when 'local' is false/omitted, edge and center-piece alterations are
		not merely displayed, but also persisted to the csworker 
	*/
	/**
	 * Alters edges and/or center-pieces to ensure they follow the changes
	 * effected to their overlays by ConnectionUtils.previewControlPointTranslation()
	 * and ConnectionUtils.snapConnectionSegment(). This function redraws edges and/or
	 * moves center pieces
	 */
	this.updateConnectionPath = function(local){
		var cpn = currentControlPoint.node,
			 _x  = cpn.getAttribute('_x'),
			 _y  = cpn.getAttribute('_y');
	
		function updatedCenterPiecePosition()
		{
			var linkuri = cpn.getAttribute('__linkuri'),
				 x0 		= parseInt( cpn.getAttribute('_x0') ),
				 y0 		= parseInt( cpn.getAttribute('_y0') ),
				 icon		= __icons[linkuri]['icon'];
			cpn.setAttribute('_x0',_x);
			cpn.setAttribute('_y0',_y);
			return [(_x-x0) + parseFloat(icon.getAttr('__x')), 
					  (_y-y0) + parseFloat(icon.getAttr('__y'))];
		}
	
		function updateEdgeExtremity(edgeId,start)
		{
			var matches	= __edges[edgeId]['segments'].
					 				match(/(M[\d\.]*,[\d\.]*)(.*)(L.*)/),
				 newpath	= (start ?
						 			'M'+_x+','+_y+matches[2]+matches[3] :
									matches[1]+matches[2]+'L'+_x+','+_y);
			__redrawEdge(edgeId,newpath);
			return newpath;
		}
	
		function updateInnerEdge(edgeId,idx)
		{
			var points = __edges[edgeId]['segments'].match(/([\d\.]*,[\d\.]*)/g);
			points.splice(idx,1,_x+','+_y);
			var newpath = 'M'+points.join('L');
			__redrawEdge(edgeId,newpath);
			return newpath;
		}
	
	
		if( cpn.hasAttribute('__edgeId') )
			/* dragging normal overlay */		
		{
			var edgeId 	= cpn.getAttribute('__edgeId'),
				 num		= cpn.getAttribute('__num'),
				 offset	= cpn.getAttribute('__offset'),
				 linkuri = __edgeId2linkuri(edgeId),
				 changes	= {};
			changes[edgeId] = updateInnerEdge(edgeId,parseInt(num)+parseInt(offset));
		}
		else	
			/* dragging central overlay */
		{
			var linkuri = cpn.getAttribute('__linkuri'),
				 changes = {};
			utils.jsonp( cpn.getAttribute('__edgesTo') ).forEach(
					function(edgeId)
					{
						changes[edgeId] = updateEdgeExtremity(edgeId,false);
					});
			utils.jsonp( cpn.getAttribute('__edgesFrom') ).forEach(
					function(edgeId)
					{
						changes[edgeId] = updateEdgeExtremity(edgeId,true);
					});
		}
		
		if( ! local )
			DataUtils.updatecs(
				linkuri,
				utils.mergeDicts([
					{'$segments':utils.mergeDicts(
												[__linkuri2segments(linkuri),changes])},
					(cpn.hasAttribute('__linkuri') ?
						 {'position' :updatedCenterPiecePosition()} : {})]));
	};
	
	/**
	 * Redraws the current segment such that its end is at (x, y)
	 */
	this.updateConnectionSegment = function(x,y){
		connectionPath.attr(
			'path',
			connectionPath.node.getAttribute('_d')+'L'+x+','+y);
	};

	return this;
}();