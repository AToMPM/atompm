/* This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
*  Copyright 2011 by the AToMPM team and licensed under the LGPL
*  See COPYING.lesser and README.md in the root of this project for full details
*/

/**
 * Gets the metamodel at the current URI
 */
function __getMetamodel(uri)
{
	return uri.match(/(.*)\/.*\/.*\.instance/)[1];
}

/**
 * Compiles? the current icon metamodel into a metamodel
 * @param imm
 * @returns
 */
function __iconMetamodelToMetamodel(imm)
{
	var matches = imm.match(/(.*)\..*Icons(\.pattern){0,1}(\.metamodel)$/);
	return matches[1]+(matches[2] || '')+matches[3];
}

/**
 * Returns whether or not the input model is a button model
 * @param str
 * @returns
 */
function __isButtonModel(str)
{
	return str.match(/\.buttons.model$/);
}


/* returns true if the given uri describes a Link */
function __isConnectionType(uri)
{
	return uri.match(/Link\/[0-9]*\.instance$/) &&
		 	 ! uri.match(/(.*\.instance)--(.*\.instance)/);
}


/* returns true if the given Link (specified via uri) is a containment link */
function __isContainmentConnectionType(linkuri)
{
	var matches = linkuri.match(/(.*)\..*Icons(\.pattern){0,1}\/(.*)Link/),
		 asmm		= matches[1]+(matches[2] || '')+'.metamodel',
		 type		= matches[3];
	return __loadedToolbars[asmm].connectorTypes[type] == __CONTAINMENT_LINK;
}

/**
 * Returns whether or not this is a metamodel
 * @param str
 * @returns {Boolean}
 */
function __isAbstractSyntaxMetamodel(str)
{
	return str.match(/\.metamodel$/) && !__isIconMetamodel(str);
}

/**
 * Returns whether or not this is an icon metamodel or
 * a regular metamodel
 * @param str
 * @returns {Boolean}
 */
function __isIconMetamodel(str)
{
	return str.match(/\..*Icons\.metamodel$/) || 
			 str.match(/\..*Icons\.pattern\.metamodel$/);
}

/**
 * Returns whether or not this is a model
 * @param str
 * @returns
 */
function __isModel(str)
{
	return str.match(/\.model$/);
}

/*--------------------------- PARSING [META]MODELS ---------------------------*/
/* update the client's state given the results of a 'csworker GET current.state'
	query

	1. retrieve all missing asmm information (information which we normally get
		as a side-effect of loading an icon definition metamodel but which isn't
		stored in csworker state, and thus not returned by 'GET current.state')
	2. force the AS and CS next sequence numbers to the values from the given 
		state
	3. construct a changelog mimicking the model and metamodel loads associated
		with the given state (via state2chlog())
	4. apply it */
function __handleState(state,csn)
{
	function state2chlog(csmms,asmms,m)
	{
		var chlog = [];
		for( var csmm in csmms )
			chlog.push(	{'op':'LOADMM', 
							 'name':csmm, 
							 'mm':utils.jsons(csmms[csmm])} );
		for( var asmm in asmms )
			chlog.push(	{'op':'LOADASMM', 
							 'name':asmm, 
							 'mm':asmms[asmm]} );
		for( var id in m.nodes )
		{
			m.nodes[ m.nodes[id]['$type']+'/'+id+'.instance' ] = m.nodes[id];
			delete m.nodes[id];
		}	
		chlog.push( {'op':'RESETM', 
						 'new_model':utils.jsons(m)} );
		return chlog;	
	}
	
	var mms	 = utils.jsonp(state['mms']),
		 m		 = utils.jsonp(state['m']),
		 asmms = {},
		 nbmms = utils.keys(mms).length;
	__aswid =  state['asw'];
	
	utils.keys(mms).forEach(
		function(csmm)
		{
			var asmm = __iconMetamodelToMetamodel(csmm+'.metamodel');
			HttpUtils.httpReq(
				'GET',
				HttpUtils.url(asmm,__NO_WID),
				undefined,
				function(_statusCode,resp)
				{
					asmms[asmm.substring(0,asmm.length-'.metamodel'.length)] = resp;
					if( utils.keys(asmms).length < nbmms )
						return;
						
					__forceNextCSWSequenceNumber(csn);
					__forceNextASWSequenceNumber(state['asn']);
					__handleChangelog(
						state2chlog(mms,asmms,m),
						csn,
						undefined);
					});
		});	
}

/* create and return an edge 

	0. do nothing if provided edge ends are invalid (this happens during CS
		switches)
	1. draw the path, save it in __edges and style it according to the given 
		style (via CompileUtils.compileAndDrawEdge(..))
	2. remember the associated linktype's uri in the edge
	3. remember incoming and outgoing edges within __icons
	
	NOTE:: step 3 is redundant but allows for constant-time operations rather
  			 than O(|E|), specifically for implementing edge end following during
			 connected icon transformations */
function __createEdge(segments,style,edgeId,linkuri)
{
	var ids 	= __edgeId2ends(edgeId);
	if( !(ids[0] in __icons) || !(ids[1] in __icons) )
		return;

	var edge = CompileUtils.compileAndDrawEdge(
						 segments,
						 style,
						 ids[0],
						 ids[1],
						 linkuri);
	__icons[ids[0]]['edgesOut'].push(edgeId);
	__icons[ids[1]]['edgesIn'].push(edgeId);
    
    // sort and draw
    for (var id in __icons) {
        __icons[id]['ordernr'] = undefined;
    }
    function getOrderNr(id,visited) {
        var icon = __icons[id];
        if (visited.indexOf(icon) > 0) return;
        if (icon['ordernr']) return;
        visited.push(icon);
        if (__isConnectionType(id)) {
            // I like my edges as I like my women: always on top
            icon['ordernr'] = 9999;
        } else if (icon['edgesIn'].length > 0) {
            for (var edgeId in icon['edgesIn']) {
                var associationid = __edges[icon['edgesIn'][edgeId]]['start'];
                if (__isContainmentConnectionType(associationid)) {
                    getOrderNr(__edges[__icons[associationid]['edgesIn'][0]]['start'], visited);
                    icon['ordernr'] = __icons[__edges[__icons[associationid]['edgesIn'][0]]['start']]['ordernr'] + 1;
                }
            }
            if (!icon['ordernr']) icon['ordernr'] = 0;
        } else {
            icon['ordernr'] = 0;
        }
    }
    for (var id in __icons) {
        getOrderNr(id, []);
    }
    
    Object.keys(__icons).concat().sort(function(a, b) {return __icons[a]['ordernr'] - __icons[b]['ordernr'];}).forEach(function(el) {
        __icons[el]['icon'].toFront();
    });
    Object.keys(__edges).forEach(function(el) {
        // I like my edges as I like my women: always on top
        __edges[el]['icon'].toFront();
    });
    
	return edge;
}


/* create and return an icon 

	1. draw the icon and save it in __icons (via CompileUtils.compileAndDrawIconModel(..))
		... if the icon is a linktype, we also give it a __linkStyle attribute */
function __createIcon(node,id)
{
	var attrs = utils.mergeDicts(
						[{'__asuri'	:node['$asuri']['value'],
						  '__r' 		:node['orientation']['value'],
						  '__sx'		:node['scale']['value'][0],
			 			  '__sy'		:node['scale']['value'][1]},
						 ('link-style' in node ? 
							{'__linkStyle':utils.jsons(node['link-style']['value'])} :
						   {})] ),
	 	 icon  =  CompileUtils.compileAndDrawIconModel(
						 node['$contents']['value'],
 						 __canvas,
 						 {'id':id,
						  'attrs':attrs,
 						  'behaviours':true}),
		 bbox  = icon.getBBox(),
		 pos	 = node['position']['value'];
	icon.setAttr('__x',__getAbsoluteCoordinate(pos[0],bbox.width));
	icon.setAttr('__y',__getAbsoluteCoordinate(pos[1],bbox.height));
	icon.setAttr('vector-effect','inherit');
	__setIconTransform(id);
	return icon;
}


/* icon positions may be set to [x,a%,y,b%], meaning that the point at a% of the
  	icon's width and at b% of the icon's height should be located at x,y... for
	instance, if a and b == 50, the icon is centered on x,y... given a coordinate 
	of the form 'c,a%', this function returns an equivalent coordinate of the 
	form 'c' (returns unchanged input on coordinates of the form 'c') */
function __getAbsoluteCoordinate(c,full)
{
	if( (matches = String(c).match(/(.*),(.*)%/)) )
		return matches[1] - full*matches[2]/100.0;
	return c;
}


/* vobject geometric attribute (i.e., position, etc.) values contain the 
	attribute's initial and latest values... this is necessary to properly render
	and transform them... this function returns a parsed form of these values, 
	which look like: aa;bbbb or aa */
function __getVobjGeomAttrVal(val)
{
	if( (matches = String(val).match(/^(.*?)(;(.*)){0,1}$/)) )
		return {'initial' : parseFloat(matches[1]),
				  'latest':  matches[3]};
	else
		return {'initial' : val};
}


/* returns a list of fulltype legal connection types between specified nodes 
		1. extract info from ids
			a) csmm name
			b) asmm name
			c) astype
			d) asmm.legalconnections
		2. go through asmm1 and asmm2 adding all encoutered legal connections
			a) t1 -> t2 (when t1 and t2 are of the same mm)
			b) $* -> t2
			c) t1 -> t2
			d) $* -> $*
			if 'ctype' is specified (either CONTAINMENT_LINK or VISUAL_LINK), only
			add connections of the given ctype
		3. flatten and return resulting array of arrays 

	TBA/TBI
		add support for hyperedges (i.e., when uri1/uri2/?both? are links)...
		this might cause problems with the selection mechanism which is untested
		for anything else than edges connecting icons... will probably also need
	  	to make changes in csworker MKNODE and in worker urize-hack... copy-paste
		might also need to be updated to support more than 2 segments per Link */
function __legalConnections(uri1,uri2,ctype)
{
	/* helper function that takes an array of basic types (e.g., Below) and
		returns an array of fulltypes (e.g., /Formalisms/.../Below) */
	function t2ft(types,mm)
	{
		return types.map( 
					function(t) 
					{
						return mm+'/'+t;
					});
	}

	/* helper function that takes an array of basic types, and, if 'ctype' is
		defined, removes non-ctype types */
	function ctypes(types,connectorTypes)
	{
		return (ctype == undefined ?
					types :
					types.filter( function(t) {return connectorTypes[t]==ctype;}) );
	}

	var matches1		= uri1.match(/(.*)\/(.*)\/.*\.instance/),
		 csmm1			= matches1[1],
		 asmm1			= __iconMetamodelToMetamodel(matches1[1]+'.metamodel'),
		 asmatch1		= matches1[2].match(/(.*)Icon/),
		 astype1	 	= asmatch1 == null ? null : asmatch1[1],
		 lc1			= __loadedToolbars[asmm1].legalConnections,
		 ct1			= __loadedToolbars[asmm1].connectorTypes,
		 matches2		= uri2.match(/(.*)\/(.*)\/.*\.instance/),
		 csmm2			= matches2[2],
		 asmm2			= __iconMetamodelToMetamodel(matches2[1]+'.metamodel'),
		 asmatch2		= matches2[2].match(/(.*)Icon/),
		 astype2	 	= asmatch2 == null ? null : asmatch2[1],
		 lc2			= __loadedToolbars[asmm2].legalConnections,
		 ct2			= __loadedToolbars[asmm2].connectorTypes,
		 legalConnections = [];
		 
	if (astype1 == null || astype2 == null) {
		return [];
	}

 	if( asmm1 == asmm2 )
		// MM1=MM2: t1 -> t2
		// MM1=MM2: $* -> t2
		// MM1=MM2: __p$* -> t2
		[astype1,'$*','__p$*'].forEach(	
				function(t)
				{
					if( t in lc1  &&  astype2 in lc1[t] )
						legalConnections.push( 
							t2ft( ctypes(lc1[t][astype2],ct1), csmm1) );
				});
	else
		// MM2: $* -> t2
		// MM2: __p$* -> t2
		['$*','__p$*'].forEach(	
				function(t)
				{
					if( t in lc2  &&  astype2 in lc2[t] )
						legalConnections.push( 
							t2ft( ctypes(lc2[t][astype2],ct2), csmm2) );
				});
		
	// MM1: t1 -> $*
	// MM1: t1 -> __p$*
	['$*','__p$*'].forEach(	
			function(t)
			{
				if( astype1 in lc1  &&  t in lc1[astype1] )
					legalConnections.push( 
						t2ft( ctypes(lc1[astype1][t],ct1), csmm1) );
			});

	for( var tb in __loadedToolbars )
		if( __isIconMetamodel(tb)  										&& 
			 (asmm=__iconMetamodelToMetamodel(tb)) != asmm1			&&
			 asmm != asmm2	)													
			['$*','__p$*'].forEach(	
				function(t)
				{
					if( t in __loadedToolbars[asmm].legalConnections 	 &&
		  				 t in __loadedToolbars[asmm].legalConnections[t] )
						legalConnections.push( 
							t2ft(
								ctypes(
									__loadedToolbars[asmm].legalConnections[t][t],
									__loadedToolbars[asmm].connectorTypes),
								tb.match(/(.*)\.metamodel/)[1]) );
				});

	return utils.flatten(legalConnections);
}



/*----------------------------- CONTAINMENT... -------------------------------*/
/* returns the uris of the icons contained in the given container (specified via
  	uri)
	
	1. retrieve every icon that is explicitly contained (i.e., that has a 
		containment link from the given container or from any of its [recursive]
	  	contents)
		a. if container is a Link, return []
		b. foreach of the container's outgoing edges
			i.  if the edge's Link is not a containment Link, return []
			ii. otherwise, return all the ends of that Link's outgoing edges along
				 with the Link
		c. flatten the resulting array of arrays 
		d. recurse back to step 1a on every item returned by step 1c (i.e., on 
			all of the computed contents) and append results to those of step 1c

	2. retrieve icons that are implicity contained (i.e., icons of Links that 
		connect contained icons)... this achieved by iterating through every known
	  	Link and keeping aside those whose ends are contained

	3. return 'setified' concatenation of results from steps 1 and 2 */
function __getIconsInContainer(container)
{
	function getExplicitContents(container, explored)
	{
		if( __isConnectionType(container) )
			return [];
        
        if( explored.indexOf(container) > -1 ) {
            return [];
        }
	
		var contents = 
			utils.flatten(__icons[container]['edgesOut'].map(
				function(edgeId)
				{
					var linkuri	= __edgeId2linkuri(edgeId);
					if( ! __isContainmentConnectionType(linkuri) )
						return [];
		
					return __icons[linkuri]['edgesOut'].map(
								function(_edgeId)
								{
									return __edges[_edgeId]['end'];	
								}).concat([linkuri]);
				}));
                
        explored.push(container);

        for (var ct_idx in contents) {
            var to_concat = utils.flatten(getExplicitContents(contents[ct_idx], explored));
            contents = contents.concat(to_concat);
        }
        return utils.toSet(contents);
	}

	var explicitContents = getExplicitContents(container, []),
		 implicitContents = [];

	for( var uri in __icons )
		if( __isConnectionType(uri) 					&&
			 __icons[uri]['edgesIn'].every(
 				function(edgeId)
				{
					return utils.contains(explicitContents,__edges[edgeId]['start']);
		  	   }) 										 	&&
			 __icons[uri]['edgesOut'].every(
 				function(edgeId)
 				{
 					return utils.contains(explicitContents,__edges[edgeId]['end']);
			  	}) )
			implicitContents.push(uri);

	return utils.toSet(explicitContents.concat(implicitContents));
}


/* returns true if the given container (specified via uri) has a containment 
 	Link to the given icon (also specified via uri)
 
	1. foreach of the icon's incoming edges
		a. if the edge's Link is not a containment Link, loop to 1.
		b. if the edge's Link has an incoming edge from container, break and
	  		return true
	2. return false */  	
function __isDirectlyContainedIn(icon,container)
{
	return container != undefined &&
			 ! __isConnectionType(container) &&
			 __icons[icon]['edgesIn'].some(
				function(edgeId)
				{
					var linkuri	= __edgeId2linkuri(edgeId);
					if( ! __isContainmentConnectionType(linkuri) )
						return false;
						
					return __icons[linkuri]['edgesIn'].some(
						function(_edgeId)
						{
							return __edges[_edgeId]['start'] == container;	
						});
				});
}