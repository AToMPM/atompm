/* This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
*  Copyright 2011 by the AToMPM team and licensed under the LGPL
*  See COPYING.lesser and README.md in the root of this project for full details
*/

///////////////////////////////////////////////////////////////////////////////
// DEPRECATED FUNCTIONS
///////////////////////////////////////////////////////////////////////////////
function _compileToASMM(fname){
	AtomPMClient.alertDeprecatedFunctionCall("_compileToASMM");
	CompileUtils.compileToASMM(fname);
}

function _compileToCSMM(fname){
	AtomPMClient.alertDeprecatedFunctionCall("_compileToCSMM");
	CompileUtils.compileToCSMM(fname);
}

function _compileToPatternMM(fname){
	AtomPMClient.alertDeprecatedFunctionCall("_compileToPatternMM");
	CompileUtils.compileToPatternMM(fname);
}
///////////////////////////////////////////////////////////////////////////////
// DEPRECATED FUNCTIONS
///////////////////////////////////////////////////////////////////////////////

/* draw the icon specified by the given icon model on the provided canvas 
	0. initialize a group that will contain the 'compiled' icon
	1. for every ConcreteSyntax primitive (e.g., Rectangle, Text) contained 
		within the given icon model
		a. create appropriate Raphael-SVG objects
		b. style these and position/orient/scale them
		c. initialize various attributes and remember various values that are used
			to manipulate and reason about vobjects later on
		d. apply layout constraint solver and/or link decorator positioner 
			transformations... to remain backward-compatible with existing 
			pre-lcs/ldp models, default values are provided if needed
		e. add objects to group from step 0.
	2. apply options:
			size:			force the icon to have a certain size
			wrap: 		wrap the canvas around the icon
			id:			this icon is a canvas icon (not a toolbar icon)... save it 
							and its vobjects in __icons and give it some default 
							parameters
			attrs:		add extra attributes to icon
			behaviour:	indicates that the icon should have event listeners

 	NOTE:: because text's origin defaults to (0,height/2), we move text elements
			 by (0,height/2) (via __valignText()) to ensure their top-left corner 
			 lands on the specified (x,y)... for the computed height to be correct,
			 we must style the text element beforehand

	NOTE:: because (x,y) are not parameters of Raphael.Paths, we translate paths
			 according to vobj['position'] manually

	NOTE:: when im.nodes is empty (this may occur when a Link defines no 
			 decorators), a Raphael.point is used to ensure the icon is not empty 
 
	NOTE:: text is made non-selectable to avoid default browser mouse dragging 
			 behaviour (select any encoutered text) and subsequent default browser
			 selected text dragging behaviour 
 
	NOTE:: throught this function, we use *.initial and *.latest values... the 
			 former are attributes of vobjects as they were drawn by the user...
			 the latter are added translations/rotations/scalings applied by the
			 layout constraint solver and link decorator positioner */

CompileUtils = function(){
	
	/* draw the edge specified by the given segments
  	1. draw the edge given the specified segments and style
	2. encapsulate it within a group, remember the uris of the start and end
  		icons, and save the edge and segments in __edges
	3. give the edge appropriate event handlers and return it 
 
	NOTE:: we use insertBefore() to ensure that edges get drawn beneath link
			 decorators, if any */
	/**
	 * Draws the edge specified by the given segments
	 * 
	 * 1. Draws the edge given the specified segments and style
	 * 2. Encapsulates it within a group and remembers the URIs of the start and
	 *    	end icons, then saves the edge and segments in the AtomPMClient edges
	 *    	variable
	 * 3. Assigns the appropriate event handles to the edge and then returns
	 */
	this.compileAndDrawEdge = function(segments, linkStyle, start, end, linkuri){
		var path   = __canvas.path(segments),
			edge   = __canvas.group(),
			edgeId = start+'--'+end;

		edge.insertBefore(__getIcon(linkuri).node);
		path.attr(linkStyle);
		edge.push(path);
		edge.setAttr('__edgeId',edgeId);
		edge.setAttr('__linkuri',linkuri);	
		edge.setAttr('class','clickable');
		__edges[edgeId] = 
			{'icon':edge,
			 'start':start,
			 'end':end,
			 'segments':segments};
	
		edge.node.onmousedown = 
			function(event)
			{
				if( event.button == 0 )
					BehaviorManager.handleUserEvent(__EVENT_LEFT_PRESS_ICON,event);
				else if( event.button == 2 )
					BehaviorManager.handleUserEvent(__EVENT_RIGHT_PRESS_ICON,event);
			};
		edge.node.onmouseup = 
			function(event)
			{
				if( event.button == 0 )
					BehaviorManager.handleUserEvent(__EVENT_LEFT_RELEASE_ICON,event);
				else if( event.button == 2 )
					BehaviorManager.handleUserEvent(__EVENT_RIGHT_RELEASE_ICON,event);
				else if( event.button == 1 )
					BehaviorManager.handleUserEvent(__EVENT_MIDDLE_RELEASE_ICON,event);
			};
		/*edge.node.onmouseover = 
			function(event)
			{
				BehaviorManager.handleUserEvent(__EVENT_MOUSE_OVER_ICON,event);
			}*/
	
		return edge;
	};
	
	// TODO: split this function up
	/**
	 * Compiles the icon and returns it in order to be placed
	 * on the canvas
	 */
	this.compileAndDrawIconModel = function( im, canvas, options ){
		var icon = canvas.group(),
			vobjects = {};

		for( var vid in im.nodes )
		{
			var vobj = im.nodes[vid],
				 x		= __getVobjGeomAttrVal(vobj['position']['value'][0]),
				 y		= __getVobjGeomAttrVal(vobj['position']['value'][1]);
	
			if( vobj['$type'].match(/\/Text$/) )
			{
				var tc = vobj['textContent']['value'];
				vobjects[vid] = canvas.text(x.initial,y.initial,tc);
				vobjects[vid].attr('text-anchor','start');
				vobjects[vid].attr(vobj['style']['value']);
				__valignText(vobjects[vid]);
				vobjects[vid].node.setAttribute('class','unselectable');			
			}
			else if( vobj['$type'].match(/\/Rectangle$/) )
			{
				var w	 = parseFloat(vobj['width']['value']),
					 h	 = parseFloat(vobj['height']['value']),
					 cr = parseFloat(vobj['cornerRadius']['value']);
				vobjects[vid] = canvas.rect(x.initial,y.initial,w,h,cr);
			}
			else if( vobj['$type'].match(/\/Circle$/) )
			{
				var r	= parseFloat(vobj['r']['value']);
				vobjects[vid] = canvas.circle(x.initial+r,y.initial+r,r);
			}
			else if( vobj['$type'].match(/\/Ellipse$/) )
			{
				var rx = parseFloat(vobj['rx']['value']),
					 ry = parseFloat(vobj['ry']['value']);
				vobjects[vid] = canvas.ellipse(x.initial+rx,y.initial+ry,rx,ry);
			}
			else if( vobj['$type'].match(/\/Polygon$/) )
			{
				var r 	 = parseFloat(vobj['r']['value']),
					 sides = parseInt(vobj['sides']['value']);
				vobjects[vid] = __drawPolygon(canvas,x.initial,y.initial,r,sides);
			}
			else if( vobj['$type'].match(/\/Star$/) )
			{
				var r 	= parseFloat(vobj['r']['value']),
					 rays = parseInt(vobj['rays']['value']);
				vobjects[vid] = __drawStar(canvas,x.initial,y.initial,r,rays);
			}		
			else if( vobj['$type'].match(/\/Path$/) )
			{
				var segments = vobj['segments']['value'];
				vobjects[vid] = canvas.path(segments);
				__translatePath(vobjects[vid],x.initial,y.initial);
			}		
			else if( vobj['$type'].match(/\/Image$/) )
			{
				var w	  = parseFloat(vobj['width']['value']),
					 h	  = parseFloat(vobj['height']['value']),
					 src = __relativizeURL(vobj['src']['value']);
				vobjects[vid] = canvas.image(src,x.initial,y.initial,w,h);
			}
	
			else
				/* ignore layout constraints */
				continue;
	
			var r  = __getVobjGeomAttrVal(vobj['orientation']['value']),
				 sx = __getVobjGeomAttrVal(vobj['scale']['value'][0])
				 sy = __getVobjGeomAttrVal(vobj['scale']['value'][1]);
			vobjects[vid].attr(vobj['style']['value']);
			vobjects[vid].transform(
					'r'+r.initial+','+x.initial+','+y.initial+
					's'+sx.initial+','+sy.initial+','+x.initial+','+y.initial);
	
			vobjects[vid].node.setAttribute('__vobjuri',vid);
			vobjects[vid].node.setAttribute('__x',	 
					utils.buildVobjGeomAttrVal(x.initial, x.latest || 0));
			vobjects[vid].node.setAttribute('__y',  
					utils.buildVobjGeomAttrVal(y.initial, y.latest || 0));
			vobjects[vid].node.setAttribute('__r',  
					utils.buildVobjGeomAttrVal(r.initial, r.latest || 0));
			vobjects[vid].node.setAttribute('__sx', 
					utils.buildVobjGeomAttrVal(sx.initial, sx.latest || 1));
			vobjects[vid].node.setAttribute('__sy', 
					utils.buildVobjGeomAttrVal(sy.initial, sy.latest || 1));
			__setVobjectTransform(vobjects[vid]);												
	
			icon.push(vobjects[vid]);
		}
	
		if( utils.keys(im.nodes).length == 0 )
		{
			icon.push( __canvas.point(0,0) );
			icon.setAttr('class','empty_icon');
		}
	
		if( options != undefined )
		{
			if( 'size' in options )
			{
				var size		= options['size'],
					 bbox		= icon.getBBox();
				scaleBy = Math.min(size/bbox.width,size/bbox.height);
				icon.scale( scaleBy, scaleBy );
			}
		
			if( 'wrap' in options )
			{
				var bbox = icon.getBBox(),
					 size = Math.max(bbox.width, bbox.height);
				icon.translate( -bbox.x, -bbox.y );
			
				bbox = icon.getBBox();
				if( bbox.width > bbox.height )
					icon.translate( 0, (size/2 - bbox.height/2) );
				else
					icon.translate( (size/2 - bbox.width/2), 0 );
				icon.translate( 1, 1 );
				canvas.setSize( size+2, size+2);
			}
		
			if( 'id' in options )
			{
				var id = options['id'];
				__icons[id] = 
					{'icon':icon, 
					 'vobjects':vobjects,
					 'edgesIn':[],
					 'edgesOut':[]};
				icon.setAttr('__csuri',id);
				icon.setAttr('__x',0);
				icon.setAttr('__y',0);
				icon.setAttr('__r',0);			
				icon.setAttr('__sx',1);
				icon.setAttr('__sy',1);
			}
	
			if( 'attrs' in options )
			{
				var attrs = options['attrs'];
				for( var attr in attrs )
					icon.setAttr(attr,attrs[attr]);
			}
	
			if( 'behaviours' in options )
			{
				icon.setAttr('class','clickable');
				icon.node.onmousedown = 
					function(event)
					{
						if( event.button == 0 )
							BehaviorManager.handleUserEvent(__EVENT_LEFT_PRESS_ICON,event);
						else if( event.button == 2 )
							BehaviorManager.handleUserEvent(__EVENT_RIGHT_PRESS_ICON,event);
					};
				icon.node.onmouseup = 
					function(event)
					{
						if( event.button == 0 )
						{
							if( event.shiftKey )
								BehaviorManager.handleUserEvent(__EVENT_SHIFT_LEFT_RELEASE_ICON,event);
							else
								BehaviorManager.handleUserEvent(__EVENT_LEFT_RELEASE_ICON,event);							
						}
						else if( event.button == 2 )
							BehaviorManager.handleUserEvent(__EVENT_RIGHT_RELEASE_ICON,event);
						else if( event.button == 1 )
						{
							if( event.shiftKey )
								BehaviorManager.handleUserEvent(__EVENT_SHIFT_MIDDLE_RELEASE_ICON,event);
							else
								BehaviorManager.handleUserEvent(__EVENT_MIDDLE_RELEASE_ICON,event);
						}
					};
				icon.node.onmousewheel = 
					function(event)
					{
						if( event.shiftKey )
						{
							BehaviorManager.handleUserEvent(__EVENT_SHIFT_WHEEL_ICON,event);
							return false;
						}
					};
				/*icon.node.onmouseover = 
					function(event)
					{
						BehaviorManager.handleUserEvent(__EVENT_MOUSE_OVER_ICON,event);
					};
				icon.node.onmouseout = 
					function(event)
					{
						BehaviorManager.handleUserEvent(__EVENT_MOUSE_OUT_ICON,event);
					};*/
			}
		}
	
		return icon;
	};
	
	/**
	 * Compile the current model to an Abstract Syntax Metamodel
	 */
	this.compileToASMM = function(fname){
		if( ! __isAbstractSyntaxMetamodel(fname) )
			WindowManagement.openDialog(
				_ERROR,
				'invalid extension... abstract syntax metamodels are "*.metamodel" files');
		else
			HttpUtils.httpReq('PUT', HttpUtils.url(fname,__FORCE_GET));
	};
	
	/**
	 * Compile the current model to a Concrete Syntax Metamodel
	 */
	this.compileToCSMM = function(fname){
		if( ! __isIconMetamodel(fname) )
			WindowManagement.openDialog(
				_ERROR,
				'invalid extension... icon definition metamodels are "*Icons.metamodel" files');
		else
			HttpUtils.httpReq('PUT', HttpUtils.url(fname,__FORCE_GET));
	};
	
	/**
	 * Compiles the current model to an Icon Pattern Metamodel
	 */
	this.compileToPatternMM = function(fname){
		if( ! __isAbstractSyntaxMetamodel(fname) )
			WindowManagement.openDialog(
				_ERROR,
				'invalid extension... abstract syntax metamodels are "*.metamodel" files');
		else
		{
			var patternmm = fname.substring(0,fname.length-'metamodel'.length)+'pattern.metamodel';
			HttpUtils.httpReq('PUT', HttpUtils.url(patternmm,__FORCE_GET));
		}
	};
	
	return this;
}();