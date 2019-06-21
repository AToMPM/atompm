/* This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
*  Copyright 2011 by the AToMPM team and licensed under the LGPL
*  See COPYING.lesser and README.md in the root of this project for full details
*/


/********************************** IMPORTS ***********************************/
try			
{
	var _utils = (typeof(utils) == 'undefined' ? require('./utils') : utils);
}
catch(ex) 	
{
	throw 'missing utils.js dependency';
}	


var SVG = {'types':{},'fns':{}};




/**************************** CONVENIENCE WRAPPERS ****************************/
/*---------------------------------- PUBLIC ----------------------------------*/
SVG.fns.getPointOnPathAtRatio = 
	function(path,ratio)
	{
		return new SVG.types.LinearPath(path).getPointOnPathAtRatio(ratio);
	};



/*--------------------------------- INTERNAL ---------------------------------*/
SVG.fns.__getRotationMatrix = 
	function(a,cx,cy)
	{
		cx = cx || 0;
		cy = cy || 0;
		a *= Math.PI/180;
		var cosa = Math.cos(a),
			 sina = Math.sin(a),
			 _T	= SVG.fns.__getTranslationMatrix(cx,cy),
			 R  	= new SVG.types.Matrix(cosa,sina,-sina,cosa,0,0),
			 T  	= SVG.fns.__getTranslationMatrix(-cx,-cy);
		return T.mult(R).mult(_T);
	};


SVG.fns.__getScalingMatrix = 
	function(sx,sy,cx,cy)
	{
		cx = cx || 0;
		cy = cy || 0;
		sy = sy||sx;
		var _T = SVG.fns.__getTranslationMatrix(cx,cy),
			 S  = new SVG.types.Matrix(sx,0,0,sy,0,0),
			 T  = SVG.fns.__getTranslationMatrix(-cx,-cy);
		return T.mult(S).mult(_T);
	};


/* return a transformation matrix given a transformation string 
	
	supported string formats are SVG and RaphaelJS
		SVG: space separated mix of 
					rotate(_[,_,_])
					translate(_,_)
					scale(_[,_])
					matrix(_,_,_,_,_,_)
		RaphaelJS: mix of 
					r_[,_,_] 
					t_,_
				  	s_[_[,_,_]]
					m_,_,_,_,_,_,_ */
SVG.fns.__getTransformationMatrix = 
	function(tstr)	
	{
		if( tstr == undefined )
			return;

		var M = new SVG.types.Matrix(),
			 f;

		if( tstr.indexOf('translate') >= 0 ||
			 tstr.indexOf('rotate')		>= 0 ||
			 tstr.indexOf('scale') 		>= 0 )
		{
			tstr.split(' ').forEach(
				function(t)
				{
					if( (_ = t.match(/^rotate\((.*),(.*),(.*)\)$/))  ||
						 (_ = t.match(/^rotate\((.*)\)$/)) )
						f = SVG.fns.__getRotationMatrix;
					else if( (_ = t.match(/^translate\((.*),(.*)\)$/)) )
						f = SVG.fns.__getTranslationMatrix;
					else if( (_ = t.match(/^scale\((.*),(.*)\)$/)) ||
								(_ = t.match(/^scale\((.*)\)$/)) )
						f = SVG.fns.__getScalingMatrix;
					else if( (_ = t.match(
									/^matrix\((.*),(.*),(.*),(.*),(.*),(.*)\)$/)) )
						f = SVG.types.Matrix;
					else
						throw 'invalid transformation string :: '+tstr;

					M = M.mult( f.apply(this,_.slice(1).map(parseFloat)) );
				});
		}
		else
		{
			tstr.match(/([rst][-\d\.,]+)/g).forEach(
				function(t)
				{
					if( (_ = t.match(/r(.*),(.*),(.*)$/)) || 
						 (_ = t.match(/^r(.*)$/)) )
						f = SVG.fns.__getRotationMatrix;
					else if( (_ = t.match(/^t(.*),(.*)$/)) )
						f = SVG.fns.__getTranslationMatrix;
					else if( (_ = t.match(/^s(.*),(.*),(.*),(.*)$/)) || 
					  			(_ = t.match(/^s(.*),(.*)$/)) ||
								(_ = t.match(/^s(.*)$/)) )
						f = SVG.fns.__getScalingMatrix;
					else if( (_ = t.match(/^m(.*),(.*),(.*),(.*),(.*),(.*)$/)) )
						f = SVG.types.Matrix;
					else
						throw 'invalid transformation string :: '+tstr;

					M = M.mult( f.apply(this,_.slice(1).map(parseFloat)) );
				});
		}

		return M;
	};


SVG.fns.__getTranslationMatrix = 
	function(dx,dy)
	{
		return new SVG.types.Matrix(1,0,0,1,dx,dy);
	};





/*********************************** TYPES ************************************/
/*------------------------------ TRANSFORMABLE -------------------------------*/
SVG.types.ATransformable = 
	function()	
	{
		throw 'can\'t instantiate abstract type ATransformable';
	};

/* rotate this element by 'a' degrees around (cx,cy) or (0,0) */
SVG.types.ATransformable.prototype.rotate = 
	function(a,cx,cy)
	{
		return this.__transform(SVG.fns.__getRotationMatrix(a,cx,cy));
	};

/* scale this element by 'sx,sy' w.r.t. (cx,cy) or (0,0) */
SVG.types.ATransformable.prototype.scale = 
	function(sx,sy,cx,cy)
	{
		return this.__transform(SVG.fns.__getScalingMatrix(sx,sy,cx,cy));
	};

/* apply the given transformation string to this element */
SVG.types.ATransformable.prototype.transform = 
	function(tstr)
	{
		return this.__transform(SVG.fns.__getTransformationMatrix(tstr));
	};

/* apply the given transformation matrix to this element */
SVG.types.ATransformable.prototype.__transform = 
	function(T)	
	{
		throw 'ATransformable subtype must overwrite __transform :: '+
					this.constructor.name;
	};

/* translate this element by 'dx,dy' */
SVG.types.ATransformable.prototype.translate =
	function(dx,dy)
	{
		return this.__transform(SVG.fns.__getTranslationMatrix(dx,dy));
	};



/*---------------------------------- MATRIX ----------------------------------*/
/* an SVG matrix:
		[ a  c  e
		  b  d  f
 		  0  0  1 ] 
 	(default init is Identity) */
SVG.types.Matrix =
	function(a,b,c,d,e,f)
	{
		if( !(this instanceof SVG.types.Matrix) ) 
			return new SVG.types.Matrix(a,b,c,d,e,f);


		if( a == undefined )
		{
			this.a = 1;
			this.b = 0;
			this.c = 0;
			this.d = 1;
			this.e = 0;
			this.f = 0;
		}
		else
		{
			this.a = a;
			this.b = b;
			this.c = c;
			this.d = d;
			this.e = e;
			this.f = f;
		}
	};

/* return the result of multiplying this matrix by another */
SVG.types.Matrix.prototype.mult =
	function(M)
	{
		return new SVG.types.Matrix(
					this.a*M.a + this.c*M.b,
					this.b*M.a + this.d*M.b,
					this.a*M.c + this.c*M.d,
					this.b*M.c + this.d*M.d,
					this.a*M.e + this.c*M.f + this.e,
					this.b*M.e + this.d*M.f + this.f ); 
	};



/*---------------------------------- POINT -----------------------------------*/
/* a 2D point:
	  	{x:_,y:_} 
 
	callable via
		SVG.types.Point(x,y)
		SVG.types.Point(pointStr)
		SVG.types.Point(point) */
SVG.types.Point =
	function(__1,__2)
	{
		if( !(this instanceof SVG.types.Point) ) 
			return new SVG.types.Point(__1,__2);

		if( typeof(__1) == 'string' )
		{
			var _p = __1.split(',');
			this.x = parseFloat(_p[0]);
			this.y = parseFloat(_p[1]);
		}
		else if( __1 instanceof SVG.types.Point )
		{
			this.x = __1.x;
			this.y = __1.y;
		}
		else
		{
			this.x = __1;
			this.y = __2;
		}

		this._x = this.x;
		this._y = this.y;
	};

/* return the distance between this point and another */
SVG.types.Point.prototype.dist =
	function(p)
	{
		return Math.sqrt(Math.pow(this.x-p.x,2) + Math.pow(this.y-p.y,2));
	};

/* return the slope of an imaginary line between 2 points as the counter-
	clockwise angle between line p1->p2 and the X-axis */
SVG.types.Point.prototype.slope = 
	function(p)
	{
		var dx = p.x - this.x,
			 dy = p.y - this.y;
		return Math.atan2(dy,dx)*180/Math.PI;
	};

/* apply the given transformation matrix to this point */
SVG.types.Point.prototype.__transform = 
	function(T)	
	{
		if( T )
		{
			var x = T.a*this.x + T.c*this.y + T.e,
				 y = T.b*this.x + T.d*this.y + T.f;
			this.x = x;
			this.y = y;
		}
		else
		{
			this.x = this._x;
			this.y = this._y;
		}
		return this;
	};

_utils.extend(SVG.types.Point, SVG.types.ATransformable);



/*---------------------------------- PATH ------------------------------------*/
/* an SVG path made only of Ms and Ls 
 
	callable via
		SVG.types.LinearPath(pathstr)
		SVG.types.Point(points) */
SVG.types.LinearPath = 
	function(__1)
	{
		if( !(this instanceof SVG.types.LinearPath) ) 
			return new SVG.types.LinearPath(__1);

		if( typeof(__1) == 'string' )
			this.points = __1.split(/[ML]/).slice(1).map(SVG.types.Point);
		else
			this.points = _utils.clone(__1);

		this.length  = -1;
		this.dists	 = [];
	};

/* compute total length while remembering each control point's distance
	from the start */
SVG.types.LinearPath.prototype.__buildControlPointToLengthMap =
	function()
	{
		this.length = 0;
		this.dists  = [0];
				
		for( var i = 1; i<this.points.length; i++ )
		{
			this.length += this.points[i-1].dist(this.points[i]);
			this.dists.push(this.length);
		}
	};

/* return the coordinates and orientation of the point along the path at the 
	specified ratio of the path's length
	 
	1. return first point if ratio is <= 0
	2. return last point if ratio is >= 1
	3. otherwise, 
		a. traverse 'dists' until find control points between which answer lies
		b. interpolate between said points and return answer 
 	#. in every case, the points orientation is returned along with it...
		this is computed by finding the slope between 
			case 1: first and second point 
			case 2: next-to-last and last point
			case 3: identified bounding points */
SVG.types.LinearPath.prototype.getPointOnPathAtRatio = 
	function(ratio)
	{
		var p;
		if( ratio <= 0 )
		{
			p   = new SVG.types.Point(_utils.head(this.points));
			p.O = p.slope(this.points[1]);
		}

		else if( ratio >= 1 )
		{
			p   = new SVG.types.Point(_utils.tail(this.points));
			p.O = this.points[this.points.length-2].slope(p);
		}

		else
		{
			if( this.length == -1 )
				this.__buildControlPointToLengthMap();
		
			for( var i = 1; i<this.points.length; i++ )
				if( this.dists[i]/this.length >= ratio )
				{
					var a  = this.dists[i-1]/this.length,
						 b  = this.dists[i]/this.length,
						 t  = (ratio-a)/(b-a),
						 p1 = this.points[i-1],
						 p2 = this.points[i];
					p   = new SVG.types.Point(
									p1.x+t*(p2.x-p1.x), 
									p1.y+t*(p2.y-p1.y));
					p.O = p1.slope(p2);
					break;
				}
		}

		return p;
	};

/* add/remove control points */
SVG.types.LinearPath.prototype.splice = 
	function(i,n,toadd)
	{
		//TBC
		this.__buildControlPointToLengthMap();
	};

/* apply the given transformation matrix to this path */
SVG.types.LinearPath.prototype.__transform = 
	function(T) 
	{
		this.points.forEach(
			function(p)
			{
				p.__transform(T);				
			});
		return this;
	};

_utils.extend(SVG.types.LinearPath, SVG.types.ATransformable);



/*----------------------------------------------------------------------------*/
SVG.types.CubicPath = function() {};	//TBC
SVG.types.Circle		= function() {};	//TBC
SVG.types.Ellipse	= function() {};	//TBC
SVG.types.Rectangle	= function() {};	//TBC
SVG.types.Polygon	= function() {};	//TBC
SVG.types.Star		= function() {};	//TBC
SVG.types.Image		= function() {};	//TBC



/* NOTE: 'exports' exists in back-end 'require', but not in browser import...
			this ensures no errors are reported during browser imports */
var exports = exports || {};
exports.SVG	= SVG;

