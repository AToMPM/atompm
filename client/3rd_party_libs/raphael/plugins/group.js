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

/* inspired by https://github.com/rhyolight/Raphael-Plugins (raphael.group.js) */

Raphael.fn.group = function() {
	
	var r = this;
	
	function Group() 
	{
		var inst,
 			 set 	 	= r.set(),
 			 group 	= r.raphael.vml ? 
						 	document.createElement("group") : 
		 				 	document.createElementNS("http://www.w3.org/2000/svg", "g"),
			 overlay = r.raphael.vml ? 
						 	document.createElement("group") : 
		 				 	document.createElementNS("http://www.w3.org/2000/svg", "g");


		 /* transform a series of translate|rotate|scale commands into t|r|s
			 NOTE :: the parameters for 'SVG.scale()' are not exactly the same
						as those for 'Raphael.scale()'... this because the former
					  	scales wrt. (0,0) while the latter defaults to scaling wrt.
					  	the center of the element... for consistency, we force Raphael
					  	transform() to scale around (0,0)
		 	NOTE ::	the same goes for SVG.rotate() and Raphael.rotate() */
		function svg2raphaelTransformString()
		{
			var rT = '';
			group.getAttribute('transform').split(' ').forEach(
					function(svgt)
					{
						if( (args = svgt.match(/translate\((.*),(.*)\)/)) )
							rT += 't'+args[1]+','+args[2];
						else if( (args = svgt.match(/rotate\((.*),(.*),(.*)\)/)) )
							rT += 'r'+args[1]+','+args[2]+','+args[3];
						else if( (args = svgt.match(/rotate\((.*)\)/)) )
							rT += 'r'+args[1]+',0,0';
						else if( (args = svgt.match(/scale\((.*),(.*)\)/)) )
							rT += 's'+args[1]+','+args[2]+',0,0';
						else if( (args = svgt.match(/scale\((.*)\)/)) )
							rT += 's'+args[1]+','+args[1]+',0,0';
						else if( (args = svgt.match(
										/matrix\((.*),(.*),(.*),(.*),(.*),(.*)\)/)) )
							rT += 'm'+args[1]+','+args[2]+','+args[3]+','+
										 args[4]+','+args[5]+','+args[6];
					});
			return rT;
		}


		r.canvas.appendChild(group);
		group.setAttribute('transform','');

		inst = 
			{'forEach':
				function(callback)
				{
					for( var i=0; i<group.childNodes.length; i++ )
						callback(group.childNodes[i],i,group.childNodes);
				},

			 'getAttr':
				 function(attr)
				 {
 					 return group.getAttribute(attr);
				 },


				/* NOTE :: set.getBBox() doesn't include group's transformations... to
				 			  get an appropriate bbox, i do a little hack 
								1. create a Rect identical to set.getBBox()
								2. apply the groups transformations on that Rect
								3. save the Rect's bbox
								4. delete the Rect
								5. return the computed bbox

					the above procedure yields imperfect results when shapes are 
					rotated... we end up returning the bbox of the shapes post-
					transform bbox... to correct this, we would need a way to get
					the 'world bbox' (i.e., parallel to screen) of a transformed 
					shape 
				 
					NOTE :: Paths can produce bboxes with 0 height or width... to 
							  avoid this, before proceeding with step 1. (above), we
							  ensure that the result of set.getBBox() has at least 1px
							  width and height */
			 'getBBox': 
				function() 
				{
					var bbox = set.getBBox();
					if( bbox.height == 0 )
					{
						bbox.y -= 0.5;
						bbox.height = 1;
					}
					if( bbox.width == 0 )
					{
						bbox.x -= 0.5;
						bbox.width = 1;
					}

					var rect = r.rect(bbox.x,bbox.y,bbox.width,bbox.height);
					rect.transform( svg2raphaelTransformString() );
					bbox = rect.getBBox();
					rect.remove();
					return bbox;
				},


			 'hasAttr':
				 function(attr)
				 {
 					 return group.hasAttribute(attr);
				 },


			 'hide':
				 function()
				 {
					 group.style.display = 'none';
				 },


			 /* render a highlighting effect 
			  		1. remove current highlighting if any 
			  		2. extract effect arguments 
			  		3. construct rectangle matching set bbox (not group's because we
						want bbox in group coordinates, not world coordinates)
			 		4. setup rectangle appearance based on step 2.
					5. add rectangle to group.overlay  */
			 'highlight':
				 function(args)
				 {
					 this.unhighlight();

					 var color	 = args['color'],
						  opacity = args['opacity'] || 0.3,
						  width	 = args['width'] || 20,
						  bbox 	 = set.getBBox(),
					 	  rect 	 = r.rect(bbox.x,bbox.y,bbox.width,bbox.height,10);

					 rect.attr('stroke',color);
					 rect.attr('opacity',opacity);
					 rect.attr('stroke-width',width);
					 rect.node.setAttribute('__highlight',1);
					 if( args['fill'] )
						 rect.attr('fill',color);
					 
					 overlay.appendChild(rect.node);
					 if( group.lastChild != overlay )
						 group.appendChild(overlay);
				 },


			 'insertBefore':
				 function(obj)
				 {
					 for( var i=0; i<r.canvas.childNodes.length; i++ )
						 if( r.canvas.childNodes[i] == obj )
							 return r.canvas.insertBefore(
									 					r.canvas.removeChild(group), obj);
					 throw 'can\'t insert before unknown element :: '+obj ;
				 },


			 'isVisible':
				 function()
				 {
					 return group.style.display != 'none';
				 },


			 'matrixTransform':
				 function(a,b,c,d,e,f)
				 {
					 var mstr = 
							 (b == undefined ?
							  	a :
	  							'matrix('+a+','+b+','+c+','+d+','+e+','+f+')');
 					 group.setAttribute(
 							 'transform', 
 							 mstr+' '+group.getAttribute('transform'));
				 },


			 'node': group,


			 'pop': 
			 	function()
				{
					var res = set.pop();
					group.removeChild(group.lastChild);
					return res;					
				},


			 'push': 
 				function(item) 
				{
					function __push(it)
					{
						if( it.type == 'set' ) 
							it.items.forEach( __push );
						else 
						{
							group.appendChild(it.node);
							set.push(it);
						}
					}
					__push(item);
				},


			 'remove':
				function()
				{
					group.parentNode.removeChild(group);
				},


 			 'rotate': 
 				function(deg,cx,cy) 
				{
					var params =
						(deg + (cx == undefined || cy == undefined ?
						 	'' :
							','+cx+','+cy));
					group.setAttribute(
							'transform', 
							'rotate('+params+') '+group.getAttribute('transform'));
				},


			 'scale': 
			 	function(sx,sy) 
				{
					var params = 
						(sx + (sy == undefined ?
	 							 ','+sx :
	 							 ','+sy ));
					group.setAttribute(
							'transform', 
							'scale('+params+') '+group.getAttribute('transform'));
				},


			 'setAttr':
				function(attr,val)
				{
					group.setAttribute(attr,val);
				},


			 'show':
				 function()
				 {
					 group.style.display = 'inline';
				 },	


			 /* render a tag 
 					 1. if 'text' is empty or 'append' is false, remove any current 
					 	 tags
					 1. otherwise, compute total height of current tags (to know what
					 	 Y-offset to give to future tag)
					 2. if 'text' is not empty, setup new tag given 'text' and 
					 	 'style' and add it to group.overlay */
			 'tag':
				 function(text,style,append)
				 {
					 var offsetY = 0;
					 if( !append || !text )
					 {
					 	for( var i=overlay.childNodes.length-1; i>=0; i-- )
							 if( overlay.childNodes[i].hasAttribute('__tag') )
 								 overlay.removeChild(overlay.childNodes[i]);
					 }
					 else
					 {
 						 for( var i=0; i<overlay.childNodes.length; i++ )
							 if( overlay.childNodes[i].hasAttribute('__tag') )
								 offsetY += overlay.childNodes[i].offsetHeight;
					 }

					 if( text )
					 {
						 var t = __canvas.text(0,offsetY,text);
					 	 t.attr('text-anchor','start');
					 	 t.attr(style);
						 t.node.setAttribute('__tag',1);
					 	 t.node.setAttribute('class','tag unselectable');
 						 overlay.appendChild(t.node);
					 }

					 if( group.lastChild != overlay )
						 group.appendChild(overlay);
				 },


			 /* make the current group the first/last element of the canvas 
				 (i.e., the first/last one to be rendered) */
			 'toBack':
				function()
				{
					var firstChild = group.parentNode.firstChild;
					if( firstChild == group )
						return;	
					else 
						group.parentNode.insertBefore(
							group.parentNode.removeChild(group), 
							firstChild);
				},


 			 'toFront' :
				function()
				{
					if( group.parentNode.lastChild == group )
						return;	
					else 
						group.parentNode.appendChild(
							group.parentNode.removeChild(group));
				},


			 'translate': 
				function(x,y) 
				{
					group.setAttribute(
							'transform', 
							'translate('+x+','+y+') '+group.getAttribute('transform'));
				},
			 'type': 'group',


			 /* remove current highlighting effect, if any */
			 'unhighlight':
				 function(args)
				 {
					 for( var i=0; i < overlay.childNodes.length; i++ )
						 if( overlay.childNodes[i].hasAttribute('__highlight') )
						 {
							 overlay.removeChild(overlay.childNodes[i]);
							 break;
						 }
				 }};
	 	 return inst;
	}

	return Group();
};

