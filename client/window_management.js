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

///////////////////////////////////////////////////////////////////////////////
// DEPRECATED FUNCTIONS
///////////////////////////////////////////////////////////////////////////////
function _openDialog(type, args, callback){
	AtomPMClient.alertDeprecatedFunctionCall("_openDialog");
	WindowManagement.openDialog(type, args, callback);
}

function _spawnClient(fname,callbackURL){
	AtomPMClient.alertDeprecatedFunctionCall("_spawnClient");
	WindowManagement.spawnClient(fname, callbackURL);
}

function _spawnHeadlessClient(context,onready,onchlog){
	AtomPMClient.alertDeprecatedFunctionCall("_spawnHeadlessClient");
	WindowManagement.spawnHeadlessClient(context, onready, onchlog);
}

function __showDialog(){
	alert(AtomPMClient);
	AtomPMClient.alertDeprecatedFunctionCall("__showDialog");
	WindowManagement.showDialog();
}

function __closeDialog(){
	AtomPMClient.alertDeprecatedFunctionCall("__closeDialog");
	WindowManagement.closeDialog();
}
///////////////////////////////////////////////////////////////////////////////
//DEPRECATED FUNCTIONS
///////////////////////////////////////////////////////////////////////////////

WindowManagement = function(){
	/**
	 * Hides the login screen
	 */
	this.hideLoginScreen = function()
	{
		//$('#div_login').style.display = 'none';
		$('#div_login').css('display', 'none');
		__setCanvasScrolling(true);
	};
	
	/**
	 * Shows the login screen
	 */
	this.showLoginScreen = function()
	{
		//$('#div_login').style.display = 'inline';
		$('#div_login').css('display', 'inline');
		__setCanvasScrolling(false);
	};
	
	//Todo: Shred this function into smaller functions, as this should
	// really just amount to a switch statement
	//TBI: complete comments about each dialog (copy from user's manual)
	/**
	 * Opens a general dialog window
	 */
	this.openDialog = function(type,args,callback)	
	{
		args = args || {};
		
		function error(err,fatal)
		{
			console.error("Error! " + err);
			GUIUtils.setupAndShowDialog(
					[GUIUtils.getTextSpan(
						err,
						'error')],
					undefined,
					(fatal ? __NO_BUTTONS : __ONE_BUTTON),
					(fatal ? 'FATAL ERROR (restart required)' : 'ERROR'));
			//console.error(err,args);
		}
	
		// TODO: Fix this, convert to JQuery
		if( type == _CLOUD_DATA_MANAGER )
			/* args: extensions,readonly,title */		
		{
			HttpUtils.httpReq(
				'GET',
				HttpUtils.url('/filelist',__NO_WID),
				undefined,
				function(statusCode,resp){
					var fnames = __localizeFilenames( 
							__filterFilenamesByExtension(
								resp.split('\n'),
								args['extensions'] || ['.*'])).sort(),
								maxFnameLength = 
									utils.max(fnames, function(_) {
										return _.length;
									}),
						 
								fileb 			= GUIUtils.getFileBrowser(fnames,true),
								feedbackarea	= $('<div>'),
								feedback		 = GUIUtils.getTextSpan(''),
								progressbar	 = $('<div>'),
								progressfill	 = $('<div>'),
								download 	 	 = $('<div>'),					 
								trash 		 	 = $('<div>'),
								div_dldel		 = $('<div>'),
								hldropzone 	 = 
							/* highlight or unhighlight the dropzone */
						 	function(zone)
							{
								if( zone == undefined )
								{
									fileb['filepane']().attr('class', 'fileb_pane');
									download.attr('class', 'dropzone');
									trash.attr('class', 'dropzone');
								}
								else if( zone == 'upload' )
								{
									var filepane = fileb['filepane']();
									filepane.attr('class', 'fileb_pane droppable');							
									filepane.get(0).ondrop = onfilepanedrop;
								}
								else if( zone == 'dl/del' )
								{
									download.attr('class', 'dropzone droppable');
									trash.attr('class', 'dropzone droppable');
								}
							},
						 cancelevt 		 = 
							/* prevent event bubbling */
						 	function(event) 
							{
								event.stopPropagation();
	  							event.preventDefault();
								return false;
							},
						 ondownloaddrop = 
						 	function(event) 
							{
		  						cancelevt(event);
								hldropzone();
								window.location.assign(event.dataTransfer.getData('uri'));
							},
						 ontrashdrop = 
						 	function(event) 
							{
		  						cancelevt(event);
								hldropzone();
								var uri = event.dataTransfer.getData('uri');
								DataUtils.deleteFromCloud(uri,
									function(statusCode,resp)
									{
										if( ! utils.isHttpSuccessCode(statusCode) )
											return error(resp);
	
	  									feedback.html('deleted '+uri.match(/.*\/(.+)\.file/)[1]);									
									});
							},
					  	 onfilepanedrop = 
							/* react to file drop from desktop 
							 	1. exit with error if non-zip files 
								2. move to handleFiles() otherwise */
						 	function(event) 
							{
		  						cancelevt(event);
								hldropzone();
								var files = event.dataTransfer.files;
								for( var i=0; i<files.length; i++ )
									if( files[i].type != 'application/zip' )
										return error('uploaded files must zip archives');
		  						handleFiles(event.dataTransfer.files,0);
							},
						 handleFiles = 
							/* handle each dropped file from desktop 
							 	1. retrieve next file to handle 
								2. update feedback message and show progress bar
								3. init file reader event handlers
							  		. onprogress updates progress bar
									. onload reacts to upload completion by adjusting 
									  feedback message, hiding progress bar and sending
								  	  file to backend
								4. start upload */
							 function(files,i) 
							 {
			 					 if( i >= files.length)
			 						 return;
								 var file = files[i];
	
								 feedback.html('uploading '+file.name);
				 				 progressbar.css("display", 'inline-block');
	
								 var reader = new FileReader();
								 reader.onprogress = 
									 function(event) 
									 {
										 if( event.lengthComputable )
										 	progressfill.css("width",  
												(100*event.loaded/event.total)+'%');
									 };
								 reader.onload = 
									 function(event) 
									 {
										 progressfill.css("width", '100%');
										 feedback.html('processing '+file.name+' ...');
										 progressbar.css("display", 'none');
										 DataUtils.uploadToCloud(
											 fileb['getcurrfolder'](), 
											 event.target.result, 
											 function(statusCode,resp) 
											 {
												 if( ! utils.isHttpSuccessCode(statusCode) )
													 return error(resp);
	
												 feedback.html('successfully processed '+file.name);
												 handleFiles(files,++i);
		 									 });
									 };
								 
								 reader.readAsBinaryString(file);
							 },
						 cloudmgrClosed = 
							 function()
							 {
								 return fileb['filebrowser'].parent() == null;
							 };
	
					document.body.ondragenter =
						/* show dropzone when file drag from desktop enters window */
						function(event) 
						{
							if(cloudmgrClosed())	return true;
	
							cancelevt(event); 
							hldropzone( 
								(event.dataTransfer.effectAllowed == 'copyMove' ? 'dl/del' : 'upload'));
							return false;
						};
					document.body.ondragleave =
						/* hide dropzone when file drag from desktop leaves window (which
						  	causes event.pageX == 0) */
						function(event) 
						{
							if(cloudmgrClosed())	return true;
	
							cancelevt(event); 							
							if( event.pageX == 0 )
								hldropzone();
							return false;
						};
					document.body.ondrop 	 =
						function(event)
						{
							if(cloudmgrClosed())	return true;
	
							cancelevt(event); 							
							hldropzone();
							console.warn('non-dropzone drops are ignored');		
							return false;
						};
	
					fileb['filebrowser'].attr('title', 
						'drag\'n\'drop files to file pane to upload\n'+
						'(close and re-open dialog to observe effects)');
					download.attr('title', 'drag\'n\'drop files from file pane to download');
					trash.attr('title', 'drag\'n\'drop files from file pane to delete\n'+
										  '(close and re-open dialog to observe effects)');
	
					progressfill.attr('class', 'progress_fill');
					progressfill.html('&nbsp;');
					progressbar.attr('class', 'progress_bar');
					progressbar.append(progressfill);
					progressbar.css("display", 'none');
					feedbackarea.append(feedback);
					feedbackarea.append(progressbar);
	
					download.css("backgroundImage", 'url(client/media/download.png)');
					trash.css("backgroundImage", 'url(client/media/trash.png)');
					download.attr('class', 'dropzone');
					trash.attr('class', 'dropzone');
					download.css("cssFloat", 'left');
					trash.css("cssFloat", 'right');
					download.get(0).ondragover = cancelevt;
					trash.get(0).ondragover 	  = cancelevt;
					download.get(0).ondrop = ondownloaddrop;
					trash.get(0).ondrop	 = ontrashdrop;
					div_dldel.append(download);
					div_dldel.append(trash);
	
					if( args['readonly'] )
						trash.css("display", 'none');
	
					GUIUtils.setupAndShowDialog(
						[fileb['filebrowser'],div_dldel,feedbackarea],
						undefined,
						__ONE_BUTTON,
						args['title'] || 
							'manage your cloud data\n(note:: you must close and re-open '+
							'dialog to view upload and deletion effects)');
				});	
		}
	
		else if( type == _CUSTOM )
			/* args: widgets, title
	
				'widgets' must be a list where each entry is either
					['id':___,'type':'input','label':___,'default':___], or
					['id':___,'type':'select','choices':___,'multipleChoice':___] */
		{
			var elements = [],
				 getinputs = [];
			args['widgets'].forEach(
				function(w)
				{
					if( w['type'] == 'select' )
					{
						var select = GUIUtils.getSelector(w['choices'],w['multipleChoice']);
						getinputs.push(function(_) 
											{
												_[w['id']] = HttpUtils.getSelectorSelection(select);
											});
						elements.push(select);
					}
					else if( w['type'] == 'input' )
					{
						var label = GUIUtils.getTextSpan(w['label'] || ''),
							 input = GUIUtils.getStringInput(w['default'] || '');
						getinputs.push(function(_) 
											{
												_[w['id']] = input[0].value;
											});
						elements.push(label,input);
					}
				});
	
			GUIUtils.setupAndShowDialog(
					elements,
					function()
					{
						var values = {};
						getinputs.forEach( function(gi) {gi(values);} );
						return values;
					},
					__TWO_BUTTONS,
					args['title'],
					callback);
		}
		
		else if( type == _ENTITY_EDITOR )	
			/* args: uri */
		{
			var uri  	= (args['uri'] || __selection['items'][0]),
				 matches = uri.match(/.*\/(.*)Icon\/(.*)\.instance/) ||
					 		  uri.match(/.*\/(.*)Link\/(.*)\.instance/),
				 type 	= matches[1],
				 id		= matches[2];
	
	
			HttpUtils.httpReq(
				'GET',
				HttpUtils.url(uri),
				undefined,
				function(statusCode,resp)
				{
					if( ! utils.isHttpSuccessCode(statusCode) )
						return error(resp);
	
					return openDialog(
						_DICTIONARY_EDITOR,
						{'data':		utils.jsonp( utils.jsonp(resp)['data'] ),
						 'ignoreKey':	
						 		function(attr,val) 
						 		{
									return attr.charAt(0) == '$' || val == undefined;
								},
						 'keepEverything':
							 	function() 
						 		{
									return __changed(uri);
								},
						 'title':'edit '+type+' #'+id},
						callback || function(changes) {DataUtils.update(uri,changes);});
				});	
		}
	
		else if( type == _ERROR )
			error(args);
	
		else if( type == __FATAL_ERROR )
			error(args,true);
	
		else if( type == _FILE_BROWSER )
			/* args: extensions,multipleChoice,manualInput,title,startDir */
		{
			HttpUtils.httpReq(
				'GET',
				HttpUtils.url('/filelist',__NO_WID),
				undefined,
				function(statusCode,resp)
				{
                    args['extensions'].push('/');
					var fnames = __localizeFilenames(
							__filterFilenamesByExtension(
								resp.split('\n'),
								args['extensions'] || ['.*'])
							).sort(),
							maxFnameLength = 
								utils.max(fnames,function(_) {return _.length;}),
                             folder_buttons = $('<div>'),
                             new_folder_b = $('<button>'),
                             rename_folder_b = $('<button>'),
                             delete_folder_b = $('<button>'),
                             move_folder_b = $('<button>'),
                             file_buttons = $('<div>'),
                             rename_file_b = $('<button>'),
                             delete_file_b = $('<button>'),
                             move_file_b = $('<button>'),                
                             feedbackarea = $('<div>'),
                             feedback = GUIUtils.getTextSpan('',"feedback"),
							 fileb = 
								 GUIUtils.getFileBrowser(fnames,false,args['manualInput'],__getRecentDir(args['startDir']));
                    
                    new_folder_b.html('new folder')
                    .click(function(ev) {
                        var folder_name = prompt("please fill in a name for the folder");
                        if (folder_name != null) {
                            folder_name = folder_name.replace(/^\s+|\s+$/g, ''); // trim
                            if (!folder_name.match(/^[a-zA-Z0-9_\s]+$/i)) {
                                feedback.html("invalid folder name: " + folder_name);
                            } else {
                                console.log("/" + window.localStorage.getItem('user') + fileb['getcurrfolder']() + folder_name + '.folder');
                                DataUtils.createFolder("/" + window.localStorage.getItem('user') + fileb['getcurrfolder']() + folder_name + '.folder', function(statusCode, resp) {
                                    if( ! utils.isHttpSuccessCode(statusCode) ) {
                                        feedback.html(resp)
                                    } else {
                                        feedback.html('created ' + folder_name);
                                        fnames.push(fileb['getcurrfolder']() + folder_name + "/")
                                        fileb['refresh'](fnames);
                                    }
                                });
                            }
                        }
                    });
                    folder_buttons.append(new_folder_b);
                    
                    rename_folder_b.html('rename folder')
                    .click(function(ev) {
                        var value = fileb['getcurrfolder']();
                        var folder_name = prompt("please fill in a new name for folder " + value);
                        if (folder_name != null) {
                            folder_name = folder_name.replace(/^\s+|\s+$/g, ''); // trim
                            if (!folder_name.match(/^[a-zA-Z0-9_\s]+$/i)) {
                                feedback.html("invalid folder name: " + folder_name);
                            } else {
                                DataUtils.renameInCloud("/" + window.localStorage.getItem('user') + value.slice(0, -1) + ".folder", folder_name, function(statusCode,resp)
                                    {
                                        if( ! utils.isHttpSuccessCode(statusCode) ) {
                                            feedback.html(resp);
                                        } else {
                                            var matches = value.match(/^\/(.*\/)?(.*)\/$/),
                                                newvalue = "/" + (matches[1] || "") + folder_name + "/";
                                            for (var idx in fnames) {
                                                fnames[idx] = fnames[idx].replace(new RegExp("^("+value+")(.*)"), newvalue+"$2"); 
                                            }
                                            fileb['refresh'](fnames, newvalue);
                                            fileb['clearselection']();
                                            feedback.html('renamed ' + value + ' to ' + newvalue);
                                        }
                                    });
                            }
                        }
                    });
                    folder_buttons.append(rename_folder_b);
                    
                    delete_folder_b.html('delete folder')
                    .click(function(ev) {
                        var value = fileb['getcurrfolder']();
                        if (confirm("are you sure you want to delete " + value + "?")) {
                            DataUtils.deleteFromCloud("/" + window.localStorage.getItem('user') + value.slice(0, -1) + ".folder", function(statusCode,resp)
                                {
                                    if( ! utils.isHttpSuccessCode(statusCode) ) {
                                        feedback.html(resp);
                                    } else {
                                        var matches = value.match(/^\/(.*\/)?(.*)\/$/),
                                            newvalue = "/_Trash_" + value;
                                        for (var idx in fnames) {
                                            fnames[idx] = fnames[idx].replace(new RegExp("^("+value+")(.*)"), newvalue+"$2");
                                        }
                                        fileb['refresh'](fnames);
                                        fileb['clearselection']();
                                        feedback.html('deleted ' + value);
                                    }
                                });
                        }
                    });
                    folder_buttons.append(delete_folder_b);
                    
                    move_folder_b.html('move folder')
                    .click(function(ev) {
                        var value = fileb['getcurrfolder']();
                        var folder_loc = prompt("please fill in a new parent folder for folder " + value);
                        if (folder_loc != null) {
                            folder_loc = folder_loc.replace(/^\s+|\s+$/g, ''); // trim
                            if (!folder_loc.match(/^\/([a-zA-Z0-9_\s]+\/)*$/i)) {
                                feedback.html("invalid parent location: " + folder_loc);
                            } else {
                                DataUtils.moveInCloud("/" + window.localStorage.getItem('user') + value.slice(0, -1) + ".folder", folder_loc, function(statusCode,resp)
                                    {
                                        if( ! utils.isHttpSuccessCode(statusCode) ) {
                                            feedback.html(resp);
                                        } else {
                                            var matches = value.match(/^\/(.*\/)?(.*)\/$/),
                                                newvalue = folder_loc + matches[2] + "/";
                                            for (var idx in fnames) {
                                                fnames[idx] = fnames[idx].replace(new RegExp("^("+value+")(.*)"), newvalue+"$2"); 
                                            }
                                            fileb['refresh'](fnames, newvalue);
                                            fileb['clearselection']();
                                            feedback.html('moved ' + value + ' to ' + folder_loc);
                                        }
                                    });
                            }
                        }
                    });
                    folder_buttons.append(move_folder_b);
                    
                    rename_file_b.html('rename file')
                    .click(function(ev) {
                        var value = fileb['getselection']();
                        var file_name = prompt("please fill in a new name for file " + value);
                        if (file_name != null) {
                            file_name = file_name.replace(/^\s+|\s+$/g, ''); // trim
                            if (!file_name.match(/^[a-zA-Z0-9_\s\.]+$/i)) {
                                feedback.html("invalid folder name: " + file_name);
                            } else {
                                DataUtils.renameInCloud("/" + window.localStorage.getItem('user') + value.slice(0, -1) + ".file", file_name, function(statusCode,resp)
                                    {
                                        if( ! utils.isHttpSuccessCode(statusCode) ) {
                                            feedback.html(resp);
                                        } else {
                                            var matches = value.match(/^\/(.*\/)?(.*)\/$/),
                                                newvalue = "/" + (matches[1] || "") + file_name;
                                            var idx = fnames.indexOf(value);
                                            if (idx >= 0) {
                                                fnames[idx] = newvalue;
                                            }
                                            fileb['refresh'](fnames);
                                            fileb['clearselection']();
                                            feedback.html('renamed ' + value + ' to ' + newvalue);
                                        }
                                    });
                            }
                        }
                    });
                    file_buttons.append(rename_file_b);
                    
                    delete_file_b.html('delete file')
                    .click(function(ev) {
                        var value = fileb['getselection']();
                        if (confirm("are you sure you want to delete " + value + "?")) {
                            DataUtils.deleteFromCloud("/" + window.localStorage.getItem('user') + value + ".file", function(statusCode,resp)
                                {
                                    if( ! utils.isHttpSuccessCode(statusCode) ) {
                                        feedback.html(resp);
                                    } else {
                                        feedback.html('deleted ' + value);
                                        var idx = fnames.indexOf(value);
                                        if (idx >= 0) {
                                            fnames.splice(idx, 1);
                                        }
                                        fileb['refresh'](fnames);
                                        fileb['clearselection']();
                                    }
                                });
                        }
                    });
                    file_buttons.append(delete_file_b);                    
                    
                    move_file_b.html('move file')
                    .click(function(ev) {
                        var value = fileb['getselection']();
                        var folder_loc = prompt("please fill in a new parent folder for file " + value);
                        if (folder_loc != null) {
                            folder_loc = folder_loc.replace(/^\s+|\s+$/g, ''); // trim
                            if (!folder_loc.match(/^\/([a-zA-Z0-9_\s]+\/)*$/i)) {
                                feedback.html("invalid parent location: " + folder_loc);
                            } else {
                                DataUtils.moveInCloud("/" + window.localStorage.getItem('user') + value + ".file", folder_loc, function(statusCode,resp)
                                    {
                                        if( ! utils.isHttpSuccessCode(statusCode) ) {
                                            feedback.html(resp);
                                        } else {
                                            var matches = value.match(/^\/(.*\/)?(.*)$/),
                                                newvalue = folder_loc + matches[2];
                                            feedback.html('moved ' + value + ' to ' + folder_loc);
                                            var idx = fnames.indexOf(value);
                                            if (idx >= 0) {
                                                fnames[idx] = newvalue;
                                            }
                                            fileb['refresh'](fnames);
                                            fileb['clearselection']();
                                        }
                                    });
                            }
                        }
                    });
                    file_buttons.append(move_file_b);
	
					GUIUtils.setupAndShowDialog(
						[fileb['filebrowser'],folder_buttons,file_buttons,feedback],
						function() 
						{
							var value = [fileb['getselection']()];
							if (value.length > 0 && value[0] != "" && args['startDir']) {
								__setRecentDir(args['startDir'],value[0].substring(0, value[0].lastIndexOf('/') + 1));
							}
							return value;
						},
						__TWO_BUTTONS,
						args['title'],
						callback);
				});	
		}
	
		else if( type == _LEGAL_CONNECTIONS )
			/* args: uri1, uri2, ctype, forceCallback */
		{
			var legalConnections = __legalConnections(args['uri1'],args['uri2'],args['ctype']);
			if( legalConnections.length == 0 )
			{
				var err = 'no valid connection between selected types';
				if( args['forceCallback'] )
					callback({'$err':err});
				else
					error(err);
			}
			else if( legalConnections.length == 1 ) 
				callback( legalConnections[0]+'Link.type' );
			else
			{
				var select = GUIUtils.getSelector(legalConnections);
				GUIUtils.setupAndShowDialog(
					[select],
					function() {return HttpUtils.getSelectorSelection(select)+'Link.type';},
					__TWO_BUTTONS,
					'choose connection type',
					callback);
			}
		}
	
		else if( type == _LOADED_TOOLBARS )
			/* args: multipleChoice, type, title */
		{
			var choosableToolbars = [];
			for( var tb in __loadedToolbars )
			{
				if( (args['type'] == undefined && 
							(__isIconMetamodel(tb) || __isButtonModel(tb))) ||
					 (args['type'] == 'metamodels' && 
					  		__isIconMetamodel(tb))									||
					 (args['type'] == 'buttons' && 
					  		__isButtonModel(tb)) )		 
					choosableToolbars.push(tb);
			}
			var select = GUIUtils.getSelector(choosableToolbars,args['multipleChoice']);
			GUIUtils.setupAndShowDialog(
					[select],
					function() {return HttpUtils.getSelectorSelection(select);},
					__TWO_BUTTONS,
					args['title'],
					callback);
		}
	
		else if( type == _DICTIONARY_EDITOR )
			/* args: data, ignoreKey, keepEverything, title */
		{
			var form 	 = $('<form>'),
				 table 	 = $('<table>'),
				 attrs2ii = {};
			form.onsubmit = function()	{return false;};
			form.append(table);
	
			for( var attr in args['data'] )
			{
				if( args['ignoreKey'] != undefined && 
					 args['ignoreKey'](attr,args['data'][attr]['value']) )
					continue;
	
				var tr = $('<tr>');
				var ii = GUIUtils.getInputField(
						args['data'][attr]['type'],
						args['data'][attr]['value']);
//				var tr = table.append( $('<tr>') ),
//					 ii = GUIUtils.getInputField(
//							 args['data'][attr]['type'],
//							 args['data'][attr]['value']);
	
				tr.append( $('<td>').append( GUIUtils.getTextSpan(attr)) );
				tr.append( $('<td>').append(ii.input) );
				attrs2ii[attr] = ii;
				
				table.append( tr );
			}
	
			GUIUtils.setupAndShowDialog(
					[form],
					function() 
					{
						var changes = {},
							 keepAll = (args['keepEverything'] != undefined &&
								 			args['keepEverything']());
						for( var attr in attrs2ii )
						{
							var am	  = attrs2ii[attr];
							var newVal = am['getinput'](am['input']);
							
							if( keepAll || 
									utils.jsons(newVal) != utils.jsons(am['oldVal']) )
								changes[attr] = newVal;
						}	
						return changes;
					},
					__TWO_BUTTONS,
					args['title'],
					callback);
		}
	
		else if( type == __SVG_TEXT_EDITOR )
		{
			if( args.tagName != 'tspan' )
			{
				console.warn('SVG text editing only works on "Text" VisualObjects');
				return;
			}
	
			var vobj		= args.parentNode,
			 	 vobjuri = vobj.getAttribute('__vobjuri'),
				 iconuri = __vobj2uri(vobj),
				 lines	= [];
			for( var i=0; i < vobj.children.length; i++ )
				if( vobj.children[i].tagName == 'tspan' )
					lines.push(vobj.children[i].textContent);
			var input	= 
				GUIUtils.getTextInput( 
						lines.join('\n'), 
						undefined, 
						Math.min(lines.length,__MAX_TEXTAREA_LINES) );
			GUIUtils.setupAndShowDialog(
					[input],
					function() {return input.value;},
					__TWO_BUTTONS,
					'enter new text',
					function(newVal)	
					{
						DataUtils.update(
							iconuri+'/'+vobjuri+'.vobject',{'textContent':newVal});			
					});
		}
	};
	
	/* spawn a new instance of atompm... if a model is specified (as 'fname'), it is
		loaded into the new instance... if a callback url is specified, critical 
	information about the new instance is POSTed to it
	
	NOTE:: window.open returns a reference to the created window... however, this
			 reference is not always complete (e.g. body.onload has not necessarily
			 run its course)... for this reason, before proceeding with handling 
		    'fname' and 'callbackURL', we poll the reference to ensure its 
			 completion */
	this.spawnClient = function (fname,callbackURL)
	{
		var c 		= window.open(window.location.href, '_blank'),
		onspawn = 
			 function()
			 {
				 if( (fname || callbackURL)	 &&
					  (c.__wid == undefined 	 || 
					   c.__aswid == undefined 	 || 
					   c._loadModel == undefined) )
			 		 return window.setTimeout(onspawn,250);
	
				 c.__user = __user;
	
			 	 if( fname )
			 		 c._loadModel(fname);
				 
			 	 if( callbackURL )
			 		 _httpReq(
				 		 'POST',
			 			 callbackURL,
			 			 {'aswid':c.__aswid,
						  'cswid':c.__wid,
						  'fname':fname,
						  'host':window.location.host}); 
			 };
	
		onspawn();
	};
	
	/* initialize a headless client, i.e. a client with a proper backend but whose
	socket-message handling code is user-defined
	
	1. setup new backend csworker and subscribe to it
	2. call 'onready'
	3. from this point on, all incoming socket messages are dispatched to 
		'onchlog'
	
	NOTE:: this code and the above comments are simplified versions of what's in
				 initClient() (TBI:: merge this function with initClient()??)
		 
		NOTE:: the context object gets populated with the headless client's wids and
			 with a pointer to a function that closes it (as 'close') */
	this.spawnHeadlessClient = function (context,onready,onchlog)
	{
		var socket = io.connect(
						window.location.hostname,
						{'port':8124,'reconnect':false,'force new connection':true});
		socket.on('message',
		function(msg)	
		{
			console.debug(' >>> '+utils.jsons(msg));
			if( msg['statusCode'] != undefined )
			{
				if( msg['statusCode'] == 201 )	
				{
					HttpUtils.httpReq(
						'PUT',
						'/aswSubscription?wid='+context.__wid,
						undefined,						
						function(statusCode,resp)
						{
							context.__aswid = utils.jsonp(resp)['data'];
							onready();
						});
	
					context.close = socket.socket.disconnect;	
				}
				else 
					console.error('headless client failed to connect to back-end');
			}
			else
				onchlog(
					msg['data']['changelog'],
					msg['data']['sequence#'],
					msg['data']['hitchhiker']);
		});
		socket.on('disconnect', 
		function()
		{  
			console.debug('headless client lost connection to back-end');
		});
		socket.on('connect', 
		function()	
		{  
			HttpUtils.httpReq(
				'POST',
				'/csworker',
				undefined,
				function(statusCode,resp)
				{
					console.debug("Connect!");
					console.debug(statusCode);
					console.debug(resp);
					context.__wid = resp;
					socket.emit(
						'message',
						{'method':'POST','url':'/changeListener?wid='+context.__wid});
				});								
		});
	};
	
	/**
	 * Sets whether to update the window title or not
	 * @param changed whether or not the title has changed
	 */
	this.setWindowTitle = function(changed)
	{
		if( __saveas == undefined )
			document.title = 
				__TITLE +' - '+
				(changed ? '+ ' :'')+
				'[Unnamed]';
	
		else
			document.title = 
				__TITLE+' - '+
				(changed ? '+ ' :'')+
				__saveas.match(/(.*\/){0,1}(.*)\.model/)[2]+' - '+
				__saveas;
	};
	
	/**
	 * Displays the modal dialog
	 */
	this.showDialog = function()
	{
		var dialog = $('#div_dialog'),
			 dim_bg = $('#div_dim_bg');
		dim_bg.css("display", 'inline');
		dialog.css("display", 'block');
		
		dialog.css("left", document.body.scrollLeft + 
									window.innerWidth/2 - 
									dialog.width()/2 + "px");
		dialog.css("top", document.body.scrollTop + 
									window.innerHeight/2 - 
									dialog.height()/2 + "px");
		__setCanvasScrolling(false);
	};
	
	/**
	 * Closes the modal dialog if it is currently opened
	 */
	this.closeDialog = function()
	{
		var dialog = $('#div_dialog');
		dialog.css("display", 'none');
		$('#div_dim_bg').css("display", 'none');
		HttpUtils.removeChildren(dialog);
		__setCanvasScrolling(true);
	  	BehaviorManager.setActiveBehaviourStatechart(__SC_CANVAS);	
	};
	
	/**
	 * Closes the modal dialog if it is currently opened (with arg js event)
	 * Huseyin Ergin
	 * HUSEYIN-ENTER
	 */
	this.closeDialog = function(ev)
	{
		if(ev!=null && ev.keyCode==13) {
			$('#okbutton').click();
		}
		var dialog = $('#div_dialog');
		dialog.css("display", 'none');
		$('#div_dim_bg').css("display", 'none');
		HttpUtils.removeChildren(dialog);
		__setCanvasScrolling(true);
	  	BehaviorManager.setActiveBehaviourStatechart(__SC_CANVAS);		
	};
	
	return this;
}();