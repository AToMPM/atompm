/* This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
*  Copyright 2011 by the AToMPM team and licensed under the LGPL
*  See COPYING.lesser and README.md in the root of this project for full details
*/

var __nextASWSequenceNumber = '/asworker#1',
	 __nextCSWSequenceNumber = '/csworker#1',	
	 __pendingASWChangelogs = [],
	 __pendingCSWChangelogs = [];


/* delete pending changelogs older than the specified sequence number */
function __clearObsoleteChangelogs(pendingChangelogs,sn)
{
	pendingChangelogs = 
		pendingChangelogs.filter(
			function(c)
			{
				return utils.sn2int(pc['sequence#']) > utils.sn2int(sn);
			});
}


/* set the value of __nextASWSequenceNumber to the given sequence number */
function __forceNextASWSequenceNumber(sn)
{
	__nextASWSequenceNumber = sn;
	__clearObsoleteChangelogs(__pendingASWChangelogs,sn);
}


/* set the value of __nextCSWSequenceNumber to the given sequence number */
function __forceNextCSWSequenceNumber(sn)
{
	__nextCSWSequenceNumber = sn;
	__clearObsoleteChangelogs(__pendingCSWChangelogs,sn);
}

//Todo: Shred this into smaller functions
/* apply a changelog (or postpone its application)
	
	0. check the changelog's sequence number to know if we should handle it 
		now or later... note that we will be receiving changelogs with both 
		asworker and csworker sequence numbers
	1. iterate through and handle the changelog's steps 
	2. apply next pending changelog, if any and if applicable */
function __handleChangelog(changelog,seqNum,hitchhiker)
{
	console.debug(' ++ ('+seqNum+') ',changelog);

	var isCSWChangelog 	 = seqNum.match(/csworker/);
		 nextSeqNum 	 	 = 
			 (isCSWChangelog ? __nextCSWSequenceNumber : __nextASWSequenceNumber),
		 pendingChangelogs = 
			 (isCSWChangelog ? __pendingCSWChangelogs : __pendingASWChangelogs);

	if( utils.sn2int(seqNum) > utils.sn2int(nextSeqNum) )
	{
		pendingChangelogs.push(
				{'changelog':changelog,
				 'sequence#':seqNum,
				 'hitchhiker':hitchhiker});
		pendingChangelogs.sort(
			function(a,b)
			{
				return utils.sn2int(a['sequence#']) - utils.sn2int(b['sequence#']);
			});
		return;
	}
	else if( utils.sn2int(seqNum) < utils.sn2int(nextSeqNum) )
	{
		WindowManagement.openDialog(
				__FATAL_ERROR, 
				'invalid changelog sequence# :: '+utils.sn2int(seqNum));
		return;
	}

	changelog.forEach(
		function(step)
		{
			if( (step['op'] == 'RMNODE' ||
  				  step['op'] == 'RMEDGE' ||
  				  step['op'] == 'CHATTR') &&
			 	 __watching(step['id']) )
			{
				console.warn(
					'someone has altered the node you are currently editing...'+
					'to keep your changes, click OK... to discard them and see'+
					' what has changed, click CANCEL');
				__changed(step['id'],true);
			}

			// record the changes that mark the model as unsaved
			// (as well, note that SYSOUT can change the model through
			// the back-door API 'CLIENT_BDAPI')
			let dirty_ops = ['MKEDGE', 'RMEDGE',
				'MKNODE', 'RMNODE', 'CHATTR',
				'LOADMM', 'LOADASMM', 'DUMPMM'];
			if (dirty_ops.includes(step['op'])){
				WindowManagement.setWindowTitle(true);
			}
				
			if( step['op'] == 'MKEDGE' )
				;

			/* react to the removal of an edge */
			else if( step['op'] == 'RMEDGE' )	
			{
				__removeEdge(
						step['id1']+'--'+step['id2'],
						[step['id1'],step['id2']]);

				if( __selection != undefined )
					__select( utils.filter(__selection['items'],[edgeId]) );
			}

			/* react to the creation of a node */
			else if( step['op'] == 'MKNODE' )
			{
				var node  = utils.jsonp(step['node']),
					 icon = __createIcon(node,step['id']);

				if( '$segments' in node )
				{	
					var linkStyle = node['link-style']['value'],
						 segments  = node['$segments']['value'];
					icon.setAttr('__segments',utils.jsons(segments));
					for( var edgeId in segments )
						__createEdge(segments[edgeId], linkStyle, edgeId, step['id']);
				}
			}

			/* react to the removal of a node */	
			else if( step['op'] == 'RMNODE' )	
			{
				__icons[step['id']]['icon'].remove();
				__icons[step['id']]['edgesOut'].forEach(__removeEdge);
				__icons[step['id']]['edgesIn'].forEach(__removeEdge);
				delete __icons[step['id']];

				if( __selection != undefined )
					__select( utils.filter(__selection['items'],[step['id']]) );
			}

			/* react to attribute update
					CASE 1	: Icon/Link layout attribute (position, etc.)
						update the corresponding attribute of the corresponding icon 
						in __icons + actually effect the layout transformation (via
						__setIconTransform())

					CASE 2	: Link attribute ($segments / link-style)
						redraw existing edges and create any new ones

					CASE 3	: VisualObject attribute update
						update the corresponding attribute of the corresponding icon's
						corresponding vobject */
			else if( step['op'] == 'CHATTR' )
			{
				/* CASE 1 */
				if(utils.contains(['position','orientation','scale'],step['attr']))
				{
					var newVal = step['new_val'],
						 icon	  = __icons[step['id']]['icon'];
						 
					/* bugfix where newVal would get a string instead of the array of values 
					should search for reason why it has string in the first place - Vasco - 02-02-2017*/
					if( typeof newVal == 'string'){
						newVal = newVal.replace('[','');
						newVal = newVal.replace(']','');
						newVal = newVal.split(',');
					}
					/* endbugfix*/
					
					if( step['attr'] == 'position' )
					{
						var bbox = icon.getBBox();
						icon.setAttr('__x', __getAbsoluteCoordinate(newVal[0],bbox.width) );
						icon.setAttr('__y', __getAbsoluteCoordinate(newVal[1],bbox.height) );
					}
					else if( step['attr'] == 'orientation' )
						icon.setAttr('__r',newVal);

					else if( step['attr'] == 'scale' )
					{
						icon.setAttr('__sx',newVal[0]);
						icon.setAttr('__sy',newVal[1]);
					}
					__setIconTransform(step['id']);
				}

				/* CASE 2 */
				else if(utils.contains(['$segments','link-style','arrowTail','arrowHead'],step['attr']))
				{
					var icon		   = __icons[step['id']]['icon'],
						 segments,
						 linkStyle;

					if( step['attr'] == '$segments' )
					{
						segments  = step['new_val'];
						linkStyle = utils.jsonp(icon.getAttr('__linkStyle'));
						icon.setAttr('__segments',utils.jsons(segments));
					}
					else if (step['attr'] == 'link-style')
					{
						segments  = utils.jsonp(icon.getAttr('__segments'));
						linkStyle = step['new_val'];
						icon.setAttr('__linkStyle',utils.jsons(linkStyle));
					}
					else
					{
						segments  = utils.jsonp(icon.getAttr('__segments'));
						linkStyle = utils.jsonp(icon.getAttr('__linkStyle'));
					}
					for( var edgeId in segments )
						if( edgeId in __edges )
							__redrawEdge(edgeId,segments[edgeId],linkStyle);
						else
							/* react to the creation of an edge */
							__createEdge( 
									segments[edgeId], linkStyle, edgeId, step['id']);
				}

				/* CASE 3
					
					NOTE:: certain VisualObject parameters need some special care...
						a) position, orientation, scale: these can only be changed by
					  		the csworker layout constraint solver and link decorator 
							positioner... after each change, the transformation applied
						  	to the vobject is overwritten
						b) r/rx/ry: changing these causes relevant shapes to grow 
							around their center thereby changing their top-left corner
							... we translate the said shapes to compensate
						c) Polygons/Stars: see __editPolygon/Star(..)
						d) style: pass {...,attr:val,...} hash directly to attr(..)
						e) src: make sure URL is valid / make it valid 
						f) Text VisualObject: see __valignText(..) */
				else
				{
					var matches = step['attr'].match(/.*\/(.*)\/(.*)/),
						 vid		= matches[1],
						 vobj		= __icons[step['id']]['vobjects'][vid],
						 attr		= matches[2];

					if(utils.contains(['position','scale','orientation'],attr))
					{		
						var newVal = (utils.isArray(step['new_val']) ? 
									[__getVobjGeomAttrVal(step['new_val'][0]).latest,
									 __getVobjGeomAttrVal(step['new_val'][1]).latest] :
									parseFloat(
										__getVobjGeomAttrVal(step['new_val']).latest) );
						if( attr == 'position' )
						{
							vobj.node.setAttribute('__x',
									utils.buildVobjGeomAttrVal(
										vobj.node.getAttribute('__x'), newVal[0]) );
							vobj.node.setAttribute('__y',
									utils.buildVobjGeomAttrVal(
										vobj.node.getAttribute('__y'), newVal[1]) );
						}
						else if( attr == 'scale' )
						{
							var sx = vobj.node.getAttribute('__sx'),
								 sy = vobj.node.getAttribute('__sy');
							vobj.node.setAttribute('__sx',
									utils.buildVobjGeomAttrVal(
										sx, newVal[0]*__getVobjGeomAttrVal(sx).initial) );
							vobj.node.setAttribute('__sy',
									utils.buildVobjGeomAttrVal(
										sy, newVal[1]*__getVobjGeomAttrVal(sy).initial) );
						}
						else
						{
							var r = vobj.node.getAttribute('__r');
							vobj.node.setAttribute('__r',
									utils.buildVobjGeomAttrVal(
										r, newVal+__getVobjGeomAttrVal(r).initial) );
						}

						__setVobjectTransform(vobj);
					}

					if(utils.contains(['r','rx','ry'],attr))
					{
						var oldVal = vobj.attr(attr) || vobj.node.getAttribute('__'+attr);
							 offset = step['new_val'] - oldVal;
						vobj.translate(
								utils.contains(['r','rx'],attr) ? offset : 0,
								utils.contains(['r','ry'],attr) ? offset : 0);
					}

					if( step['id'].match(/\/PolygonIcon\//) &&
						 utils.contains(['r','sides'],attr) )
						__editPolygon(vobj,attr,step['new_val']);

					else if( step['id'].match(/\/StarIcon\//) &&
						 		utils.contains(['r','rays'],attr) )
						__editStar(vobj,attr,step['new_val']);

					try 			{var newVal = utils.jsonp(step['new_val']);}
					catch(err)	{var newVal = step['new_val'];}
					if( attr == 'style' )
						vobj.attr( newVal );
					else if( attr == 'src' )
						vobj.attr( 'src', __relativizeURL(newVal) );
					else
						vobj.attr( __ATTR_MAP[attr] || attr, newVal );

					if( vobj.type == 'text' )
						__valignText(vobj);
				}

				if( __isSelected(step['id']) )
					utils.doAfterUnlessRepeated(
						function(selection) {
							__select(selection);
						}, [__selection['items']], 5
					);
			}

			/* react to loading of an IconDefinition (CS metamodel)
				1. setup and show appropriate toolbar
				2. replace default toolbar button icons by icons described in
					the loaded metamodel */
			else if( step['op'] == 'LOADMM' )
			{
				var data = eval('('+step['mm']+')');
	 			GUIUtils.setupAndShowToolbar(
					step['name']+'.metamodel',
					data,
					__METAMODEL_TOOLBAR);
	
				for( var t in data.types )
				{
					if( t.match(/(.*)Link$/) )
						continue;
					else if( ! GUIUtils.$$(step['name']+'.metamodel/'+t) )
					{
						if( !t.match(/(.*)Icon$/) )
							console.error('Icon typenames must be "<AbstractType>Icon", the following does not conform :: '+t);
						else
							console.error('found icon definition for unknwon abstract type :: '+t);
						continue;
					}

					var im = 
						data.types[t].filter( 
							function(attr) 
							{
								return attr['name'] == '$contents';
							})[0]['default'];
					CompileUtils.compileAndDrawIconModel(
							im,
							Raphael(GUIUtils.$$(step['name']+'.metamodel/'+t)),
							{'size':__ICON_SIZE, 
							 'wrap':true});
					GUIUtils.$$(step['name']+'.metamodel/'+t).removeChild(
							GUIUtils.$$(step['name']+'.metamodel/'+t).lastChild );
				}
			}

			else if( step['op'] == 'LOADASMM' )
				__loadedToolbars[step['name']+'.metamodel'] = 
					eval('('+step['mm']+')');

			else if( step['op'] == 'DUMPMM' )
			{
				var csmmPath = step['name']+'.metamodel';
				GUIUtils.removeToolbar(csmmPath);
			}

			else if( step['op'] == 'RESETM' )	
			{
				var m = utils.jsonp(step['new_model']);
				GUIUtils.resetCanvas();

				for( var id in m.nodes )
				{
					var node  = m.nodes[id],
						 icon  = __createIcon(node,id);

					if( '$segments' in node )
					{
						var linkStyle = node['link-style']['value'],
							 segments  = node['$segments']['value'];
						icon.setAttr('__segments',utils.jsons(segments));
						for( var edgeId in segments )
							__createEdge( segments[edgeId], linkStyle, edgeId, id);
					}
				}
				WindowManagement.setWindowTitle(false);
			}

			else if( step['op'] == 'SYSOUT' )
			{
				if( step['text'].match(/^ERROR :: /) )
					console.error(step['text']);
				else if( step['text'].match(/^WARNING :: /) )
					console.warn(step['text']);
				else if( step['text'].match(/^CLIENT_BDAPI :: /) )
				{
					var op = utils.jsonp(step['text'].match(/^CLIENT_BDAPI :: (.*)/)[1]);
					this[op['func']](op['args']);
					WindowManagement.setWindowTitle(true);
				}
				else
					console.log('MESSAGE :: '+step['text']);
			}
			///////
			else if (step['op'] == 'CHAT') 
			{
				Collaboration.updateChat(step['text']);
			}
		});


	if( isCSWChangelog )
		nextSeqNum = __nextCSWSequenceNumber = 
			utils.incrementSequenceNumber(nextSeqNum);
	else
		nextSeqNum = __nextASWSequenceNumber = 
			utils.incrementSequenceNumber(nextSeqNum);

	if( pendingChangelogs.length > 0 &&
		 nextSeqNum == pendingChangelogs[0]['sequence#'] )
	{
		var pc = pendingChangelogs.shift();
		__handleChangelog(
				pc['changelog'],
				pc['sequence#'],
				pc['hitchhiker']);
	}
}