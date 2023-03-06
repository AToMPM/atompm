/* This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
*  Copyright 2011 by the AToMPM team and licensed under the LGPL
*  See COPYING.lesser and README.md in the root of this project for full details
*/

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

var __dialog_stack = [];

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
	
	this.showAboutDialog = function () {

        let create_about = function (status, text) {

            let version = null;
            let time_at = null;

            if (utils.isHttpSuccessCode(status)) {
                let resp = JSON.parse(text);
                version = resp['tag_name'];

                time_at = resp['published_at'];
                time_at = time_at.split("T")[0];
            }

            let title = "About AToMPM";
            let elements = [];

            let website = "<a href= '" + __WEBPAGE__ + "' target='_blank'>Website and Tutorials</a>";
            elements.push(GUIUtils.getTextSpan(website));

            let doc_website = "<a href= '" + __DOC_WEBPAGE__ + "' target='_blank'>Documentation</a>";
            elements.push(GUIUtils.getTextSpan(doc_website));

            let curr_version_str = "Current Version: " + __VERSION__;
            elements.push(GUIUtils.getTextSpan(curr_version_str));

            elements.push(GUIUtils.getTextSpan("\n"));

            if (version != null) {
                let new_version_str = "Newest Version: " + version;
                elements.push(GUIUtils.getTextSpan(new_version_str));

                let time_at_str = "Released on: " + time_at;
                elements.push(GUIUtils.getTextSpan(time_at_str));

            }

            GUIUtils.setupAndShowDialog(
                elements,
                null,
                __ONE_BUTTON,
                title,
                null);
        };

        HttpUtils.httpReq("GET", "https://api.github.com/repos/AToMPM/atompm/releases/latest", null, create_about);
	};

	this.showCollabDialog = function () {

		let create_collab = function (status, data) {
			let title = "Collaboration Options";
			let elements = [];

			data = JSON.parse(data);

			let failed = false;
			if (status != 201 || data == undefined || data['screenShare'] == undefined) {
				let err_msg = "ERROR: Could not obtain collaboration links.";
				elements.push(GUIUtils.getTextSpan(err_msg));
				failed = true;
			}

			let collabText = "These options let you collaborate with another user on the same model.\n" +
				"<b>Usage:</b> Copy-and-paste the links below to your collaborators.\n" +
			"<b>Note:</b> If the links contain 'localhost', you will have to edit the links before sending them.\n" +
				"See the <a href=\"https://atompm.readthedocs.io/en/latest/collaboration.html\" target='_blank'>AToMPM documentation</a> for more information\n";
			elements.push(GUIUtils.getTextSpan(collabText));

			elements.push(GUIUtils.getTextSpan("<b>Screen Share:</b>"));

			if (!failed) {
				let screenShareURL = "<a href= '" + data['screenShare'] + "' target='_blank'>" + data['screenShare'] + "</a>";
				let screenShareLink = GUIUtils.getTextSpan(screenShareURL);
				screenShareLink.attr("id", "screenShareLink");
				elements.push(screenShareLink);

				let screenShareCopyBtn = $('<button class="okbutton">');
				screenShareCopyBtn.attr("id", "dialog_btn");
				screenShareCopyBtn.attr("title", "copy to clipboard");
				screenShareCopyBtn.html('copy');
				screenShareCopyBtn.click( function (ev) {
					navigator.clipboard.writeText(data['screenShare']);
				});
				elements.push(screenShareCopyBtn);
			}

			let screenShareText = "All collaborating users share the same concrete and abstract syntax.\nIf one user moves an entity or changes to another concrete syntax representation, the change will be replicated for all collaborators.\n\n"
			elements.push(GUIUtils.getTextSpan(screenShareText));


			elements.push(GUIUtils.getTextSpan("<b>Model Share:</b>"));

			if (!failed) {
				let modelShareURL = "<a href= '" + data['modelShare'] + "' target='_blank'>" + data['modelShare'] + "</a>";
				let modelShareLink = GUIUtils.getTextSpan(modelShareURL);
				modelShareLink.attr("id", "modelShareLink");
				elements.push(modelShareLink);

				let modelShareCopyBtn = $('<button class="okbutton">');
				modelShareCopyBtn.attr("id", "dialog_btn");
				modelShareCopyBtn.attr("title", "copy to clipboard");
				modelShareCopyBtn.html('copy');
				modelShareCopyBtn.click( function (ev) {
					navigator.clipboard.writeText(data['modelShare']);
				});
				elements.push(modelShareCopyBtn);
			}

			let modelShareText = "Only the abstract syntax is shared. This means that all collaborators can have distinct concrete syntax representations and distinct layouts (provided layout and abstract syntax are not intricately related), and are only affected by others’ abstract syntax changes (e.g., modifying abstract attribute values).\n\n"
			elements.push(GUIUtils.getTextSpan(modelShareText));


			GUIUtils.setupAndShowDialog(
				elements,
				null,
				__ONE_BUTTON,
				title,
				null);
		}

		let url = "/collabReq" + "?cid=" + __clientID + "&user=" + __user + "&address=" + window.location.href;
		HttpUtils.httpReq("GET", url, null, create_collab);
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
						 
								fileb 			= FileBrowser.getFileBrowser(fnames,true),
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
			/* args: extensions,manualInput,title,startDir */
		{
			FileBrowser.buildFileBrowser(args['extensions'], args['manualInput'], args['title'], args['startDir'], callback);
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
                tr.attr("id", "tr_" + attr);
                var ii = null;
                try {
                    ii = GUIUtils.getInputField(
                        args['data'][attr]['type'],
                        args['data'][attr]['value']);
                } catch (err) {
                    console.log(args['data'][attr]);
                    WindowManagement.openDialog(
                        _ERROR,
                        'unexpected error in editing mode ::\n ' + err + '\n' + utils.jsons(args['data'][attr]));
                }
//				var tr = table.append( $('<tr>') ),
//					 ii = GUIUtils.getInputField(
//							 args['data'][attr]['type'],
//							 args['data'][attr]['value']);
	
				tr.append( $('<td>').append( GUIUtils.getTextSpan(attr)) );
				tr.append( $('<td>').append(ii.input) );
				if (ii.input.extra_el) tr.append( $('<td>').append(ii.input.extra_el) );
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
		let c 		= window.open(window.location.href, '_blank');

		if (c == undefined){
			WindowManagement.openDialog(_ERROR, "Failed to open new window. Are pop-ups blocked?");
			return;
		}
			let onspawn =
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

	/* NOTE:: Automating activities 
	    spawn a new instance of atompm... if a model is specified (as 'fname'), it is
		loaded into the new instance, if a toolbar is especified (as 'tbname'), it's loaded
		into the new instance, if a message is especified a popup message will show in
		the instance*/	
	this.spawnClientOption = function (fname,tbname,option,trafo,msg)
	{
        let c = window.open(window.location.href, '_blank');

        if (c == undefined) {
            WindowManagement.openDialog(_ERROR, "Failed to open new window. Are pop-ups blocked?\n" +
                "Please reload the workflow model after allowing pop-ups.");
            return;
        }

		let onspawn =
			 function()
			 {
				if( (fname|| tbname)	 &&
					  (c.__wid == undefined 	 || 
					   c.__aswid == undefined 	 || 
					   c._loadModel == undefined	 ||
					   c._loadToolbar == undefined) )
			 		 return window.setTimeout(onspawn,250);				 
				 c.__user = __user;
				 c.__name = fname;
				 c.__option = option;
				 c.__trafo = trafo;
				 c.__msg = msg;
				if (trafo == undefined){
					trafo = option;
				}
                 if (tbname) {
                     let toolbars = tbname.split(",");
                     for (let toolbar of toolbars) {
                         c._loadToolbar(toolbar);
                     }
                 }
                 if( fname ){
						c.__saveas = fname;
						if( option.length > 2 ){
							c._loadModel(fname);
						}
				}	
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
		var dialog = __dialog_stack[__dialog_stack.length-1],
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
	 * Closes the modal dialog if it is currently opened (with arg js event)
	 * Huseyin Ergin
	 * HUSEYIN-ENTER
	 */
	this.closeDialog = function(ev)
	{
		if(ev!=null && ev.keyCode==13) {
			$('#div_dialog_' + (__dialog_stack.length-1).toString() + " .okbutton").click();
		}
        __dialog_stack.pop();
		var dialog = $('#div_dialog_'+__dialog_stack.length);
        dialog.remove();
		if (!__dialog_stack.length) {
            __setCanvasScrolling(true);            
            $('#div_dim_bg').css("display", 'none');
            BehaviorManager.setActiveBehaviourStatechart(__SC_CANVAS);
        }
	};
	
	return this;
}();