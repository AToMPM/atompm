/* enables/disables scrolling the canvas */
function __setCanvasScrolling(on)
{
	//document.body.style.overflow = (on ? 'auto' : 'hidden');
	$(document.body).css("overflow", on ? 'auto' : 'hidden');
}

/* draw and return an appropriately styled rectangle matching the give bbox */
function __bbox2rect(bbox,className)
{
	var rect = __canvas.rect(
						bbox.x,
						bbox.y,
						bbox.width,
						bbox.height);
	rect.node.setAttribute('class',className);
	return rect;
}


/* given the knowledge that a transformation matrix looks like
		[a c e
		 b d f
		 0 0 1],
	and that translation, rotation and scaling matrices respectively look like
		[1 0 tx				[cosA -sinA 0			[sx 0 0
		 0 1 ty				 sinA cosA  0			 0 sy 0
		 0 0 1]				 0		0		1]			 0 0  1],
	this function extracts tx, ty, A, sx and sy from the given transformation 
	matrix */
function __decomposeTransformationMatrix(m)
{
	/* returns the angle that produces the given values of cos and sin.. this 
		function's main use is to encapsulate and get around the fact that 
		Image(acos) = 0..180 and Image(asin) = -90..90 */
	function angle(cos,sin)
	{
		var acos = Math.acos(cos),
			 asin	= Math.asin(sin);
		return (asin > 0 ? acos : 2*Math.PI - acos);
	}

	var matches = m.match(/matrix\((.*),(.*),(.*),(.*),(.*),(.*)\)/),
		 a			= matches[1],
		 b			= matches[2],
		 c			= matches[3],
		 d			= matches[4],
		 e			= matches[5],
		 f			= matches[6],
		 b2		= b*b,
		 d2		= d*d,
		 b2d2		= b2 + d2;

	if( b2/b2d2 + d2/b2d2 == 1 )
	{
		var sy = Math.sqrt(b2d2),
			 sx = Math.sqrt(a*a+c*c),
			 r	 = angle(a/sx,b/sy) * (180/Math.PI);
	}
	else
	{
		var sy = Math.sqrt(c*c+d2),
			 sx = Math.sqrt(a*a+b2),
			 r	 = angle(a/sx,b/sx) * (180/Math.PI);
	}
	return {'tx':parseFloat(e),'ty':parseFloat(f),'sx':sx,'sy':sy,'r':r%360};
}


/* draw specified polygon... this function's reason for being is simply to hide
 	some details related to the how Raphael draws Polygons...

	1. draw the requested polygon
	2. save its construction attributes within it
	3. place its top-left corner at (x,y)

	detail #1: (0,0)
	the drawn polygon is centered on (x,y)... we move each of its control points 
	by (w/2,h/2) to ensure its (0,0) is at its top-left corner

	detail #2: paths...
	internally, Polygons are just paths... and SVG.Paths have no 'r' or 'sides' 
	attributes... these 2 variables are merely used to compute the internal path
	describing the requested polygon...  hence, to support altering the above
	variables (and getting appropriate visible feedback), they need to be saved
  	inside as attributes for future reference... for more on how updating 'r' and 
	'sides' alters the rendered polygon, see __editPolygon(..) */
function __drawPolygon(canvas,x,y,r,sides)
{
	var pgn   = canvas.polygon(x,y,r,sides),
		 bbox  = pgn.getBBox();
	pgn.node.setAttribute('___x',x);
	pgn.node.setAttribute('___y',y);
	pgn.node.setAttribute('___r',r);
	pgn.node.setAttribute('___sides',sides);
	__translatePath(pgn,bbox.width/2,bbox.height/2);
	return pgn;
}

/* see comments for __drawPolygon(..) */
function __drawStar(canvas,x,y,r,rays)
{
	var star  = canvas.star(x,y,r,undefined,rays),
		 bbox  = star.getBBox();
	star.node.setAttribute('___x',x);
	star.node.setAttribute('___y',y);
	star.node.setAttribute('___r',r);
	star.node.setAttribute('___rays',rays);
	__translatePath(star,bbox.width/2,bbox.height/2);
	return star;
}

/* alters a polygon's 'r' or 'sides'... this is a non-trivial operation because
	polygon's aren't SVG primitives, they're just paths drawn to look like 
	polygons... thus, changing a polygon's 'r' or 'sides' implies changing its 
	path... 
	
	1. draw a polygon matching the old one but with the new 'r'/'sides'
	2. update the old polygon's internal attribute corresponding to 'attr'
  		(see __drawPolygon(..))
	3. update the old polygon's path to match that of the newly drawn polygon
	4. remove the new polygon 

	NOTE:: an alternative to this approach would be to return the new polygon and
			 use Raphael.insertBefore/After() to place the new polygon on the same 
			 layer the old one was on */
function __editPolygon(pgn,attr,val)
{
	var _pgn = __canvas.polygon(
			parseFloat( pgn.node.getAttribute('___x') ),
			parseFloat( pgn.node.getAttribute('___y') ),
			parseFloat(attr == 'r' ? val : pgn.node.getAttribute('___r')),
			parseFloat(attr == 'sides' ? val : pgn.node.getAttribute('___sides')) );
	pgn.node.setAttribute('___'+attr,val);
	pgn.attr('path', _pgn.node.getAttribute('d') );
	_pgn.remove();
}

/* see comments for __editPolygon(..) */
function __editStar(star,attr,val)
{
	var _star = __canvas.star(
			parseFloat( star.node.getAttribute('___x') ),
			parseFloat( star.node.getAttribute('___y') ),
			parseFloat(attr == 'r' ? val : star.node.getAttribute('___r')),
			undefined,
			parseFloat(attr == 'rays' ? val : star.node.getAttribute('___rays')) );
	star.node.setAttribute('___'+attr,val);
	star.attr('path', _star.node.getAttribute('d') );
	_star.remove();
}


/* wrapper around group.js' getBBox() that takes into account to-be-applied icon
  	transformations

	icon:		icon uri
	context:	map of icon uris to pending position/scale/orientation changes */
function __getBBox(icon,context)
{
	if( context && icon in context )
	{
		var bbox = __getIcon(icon).node.getBBox(),
			 rect = __canvas.rect(0,0,bbox.width,bbox.height);
		rect.transform( 
				't'+('position' in context[icon] ?
					context[icon]['position'][0]+','+
					context[icon]['position'][1] :
					__getIcon(icon).getAttr('__x')+','+
					__getIcon(icon).getAttr('__y'))+
				's'+('scale' in context[icon] ?
					context[icon]['scale'][0]+','+
					context[icon]['scale'][1] :
					__getIcon(icon).getAttr('__sx')+','+
					__getIcon(icon).getAttr('__sy'))+',0,0'+
				'r'+('orientation' in context[icon] ?
					context[icon]['orientation'] :
					__getIcon(icon).getAttr('__r'))+',0,0');
		bbox = rect.getBBox();
		rect.remove();
		return bbox;					
	}
	else
		return __getIcon(icon).getBBox();
}


/* returns the bbox of a collection of icons and/or edges (specified via uri) */
function __getGlobalBBox(icons)
{
	var bbox = {'x':Infinity,'y':Infinity,'width':0,'height':0};
	icons.forEach(
		function(it) 
		{
			var _bbox = __getIcon(it).getBBox();
			if( _bbox.x < bbox.x )	
			{	
				/* pull leftmost, fix rightmost (except when Infinity) */
				if( bbox.x != Infinity )
					bbox.width += bbox.x - _bbox.x;
				bbox.x = _bbox.x;
			}
			if( _bbox.y < bbox.y )
			{
				/* pull topmost, fix bottommost (except when Infinity) */
				if( bbox.y != Infinity )
					bbox.height += bbox.y - _bbox.y;
				bbox.y = _bbox.y;
			}
			if( _bbox.x + _bbox.width > bbox.x + bbox.width ) 
				/* pull rightmost, leftmost is fixed */
				bbox.width += (_bbox.x + _bbox.width) - (bbox.x + bbox.width);
			if( _bbox.y + _bbox.height > bbox.y + bbox.height ) 
				/* pull bottommost, topmost is fixed */
				bbox.height += (_bbox.y + _bbox.height) - (bbox.y + bbox.height);	
		});

	return bbox;
}


/* returns true if bbox1 is inside bbox2 */
function __isBBoxInside(bbox1,bbox2)
{
	return bbox1.x > bbox2.x && 
			 bbox1.y > bbox2.y && 
			 bbox1.x + bbox1.width  < bbox2.x + bbox2.width &&
			 bbox1.y + bbox1.height < bbox2.y + bbox2.height;
}

/* returns true if bbox1 and bbox2 are disjoint */
function __isBBoxDisjoint(bbox1,bbox2)
{
	return bbox1.x > bbox2.x + bbox2.width  || 
			 bbox1.x + bbox1.width < bbox2.x  ||
			 bbox1.y > bbox2.y + bbox2.height ||
			 bbox1.y + bbox1.height < bbox2.y;
}




/* returns an L-based SVG path from a C-based one... does so by stripping away 
	the control points in the C-path... this function won't modify the path 
	provided it is composed only of straight lines */
function __pathC2L(cpath)
{
	return cpath.replace(
				/C[\d\.]*,[\d\.]*,[\d\.]*,[\d\.]*,([\d\.]*),([\d\.]*)/g,
				'L$1,$2');
}


/* given a path, return 2 path strings that each represent one half of the path,
	as well as the center of the original path (for use in Link $segments)

	NOTE:: Raphael.path.getSubpath() appears to return incorrect results when its
			 2nd parameter is greater than the path length... incidently, probable 
			 internal rounding issues appear to confuse Raphael.path.getSubpath()
			 when the 2nd parameter is equal to the path length... to avoid this
			 'bug' (which causes the 2nd half of the segment to be 'M0,0'), we 
			 substract a small epsilon from the path length for path2_2 */
function __path2segments(path)
{
	var eps		= 0.001,
		 length  = path.getTotalLength(),
		 center  = path.getPointAtLength(length/2.0),
		 path1_2	= __pathC2L(path.getSubpath(0,length/2.0)),
		 path2_2	= __pathC2L(path.getSubpath(length/2.0,length-eps));
	return [path1_2,center,path2_2];
}


/* redraw the specified edge if it has changed */
function __redrawEdge(edgeId,segments,linkStyle)
{
	var icon		  = __edges[edgeId]['icon'],
		 path 	  = icon.pop(),
		 _segments = String( path.attr('path') );
	if( segments != _segments )
	{
		path.attr('path', segments);
		__edges[edgeId]['segments'] = segments;
	}
	if( linkStyle != undefined )
		path.attr(linkStyle);
	icon.push( path );
}


/* remove an edge from the canvas and from internal data structures (i.e., 
	__edges and icon.edgesOut/In) if it isn't already removed */
function __removeEdge(edgeId,ends)	
{
	ends = (utils.isArray(ends) ? ends : __edgeId2ends(edgeId));

	__edges[edgeId]['icon'].remove();
	delete __edges[edgeId];	

	if( ends[0] in __icons )
		__icons[ends[0]]['edgesOut'] = 
			__icons[ends[0]]['edgesOut'].filter(
					function(eId)	{return eId != edgeId;});
	
	if( ends[1] in __icons )
		__icons[ends[1]]['edgesIn'] = 
			__icons[ends[1]]['edgesIn'].filter(
					function(eId)	{return eId != edgeId;});
}


/* sets specified icon's SVG.transform attribute based on its layout attributes

	1. extract the given icon's position, orientation and scale attributes
	2. use them to construct an appropriate SVG transformation string 
	3. set the icon's SVG.transform to the resulting transformation string

	NOTE:: we do not accumulate transformations... i.e., any transformation 
			 described by the icon's previous SVG.transform is overwritten */
function __setIconTransform(uri)
{
	var icon = __icons[uri]['icon'],
		 x		= icon.getAttr('__x'),
		 y		= icon.getAttr('__y'),
		 r		= icon.getAttr('__r'),
		 sx	= icon.getAttr('__sx'),
		 sy	= icon.getAttr('__sy');

	icon.setAttr('transform', 
						 'translate('+x+','+y+') scale('+sx+','+sy+') rotate('+r+') ');
}


/* sets specified vobject's Raphael.transform attribute based on its layout 
	attributes... see comments for __setIconTransform() for more info

	NOTE:: rotations and scales are relative to the *initial* top-left corner of
  			 the vobject (i.e., to its untransformed top-left corner) and are 
			 compounded with the *initial* scale and orientation
			
	NOTE:: for translations, both the 'x' and 'y' values are scaled against the
  			 vobject's width... this is because the ",__%" position component is 
			 used by the link decorator positioner to account for the *x* offset 
			 needed for vobjects to end at the same point as their associated links
			 ... i.e., the ",__%" encodes a translation by a certain % of the 
			 vobject's width

	TBI:: eliminate need for trick in 2nd note by enabling bbox computations from
			backend (i.e., s.t. vobject width and absolute offset can be computed
			on the backend) */						
function __setVobjectTransform(vobj)
{
	var x		= __getVobjGeomAttrVal(vobj.node.getAttribute('__x')),
		 y		= __getVobjGeomAttrVal(vobj.node.getAttribute('__y')),
		 r		= __getVobjGeomAttrVal(vobj.node.getAttribute('__r')),
		 sx 	= __getVobjGeomAttrVal(vobj.node.getAttribute('__sx')),
		 sy 	= __getVobjGeomAttrVal(vobj.node.getAttribute('__sy')),
		 bbox = vobj.getBBox();

	vobj.transform('t'+__getAbsoluteCoordinate(x.latest, bbox.width)+','
							+__getAbsoluteCoordinate(y.latest, bbox.width)+
						'r'+r.latest+','+x.initial+','+y.initial+
						's'+sx.latest+','+sy.latest+','+x.initial+','+y.initial);
}


/* translate a path by (dx,dy) without altering its transform property... this
 	done by translating all of the path's control points */
function __translatePath(path,dx,dy)
{
	var _path = '';
	path.attr('path').forEach(
		function(cp)
		{
			_path += cp[0];
			for( var i=1; i<cp.length; i+=2 )
				_path += (cp[i]+dx)+','+(cp[i+1]+dy);
		});
	path.attr('path',_path);
}


/* sets the given text element's y property to half of its height... this 
	function is used to compensate for the fact that an SVG.Text's (0,0) is
  	located at (0,height/2) rather than at its top-left corner */
function __valignText(t)
{
	var lines  = $(t.node).children().length,
		 lineH  = t.getBBox().height/2/lines,
		 _lines = t.node.getAttribute('__valignLines') || 0,
		 _lineH = t.node.getAttribute('__valignLineH') || 0,
		 delta  = lines*lineH - _lines*_lineH;
	t.attr('y',t.attr('y')+delta);	
	t.node.setAttribute('__valignLineH',lineH);
	t.node.setAttribute('__valignLines',lines);
}