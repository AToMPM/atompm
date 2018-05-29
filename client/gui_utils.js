/* This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
*  Copyright 2011 by the AToMPM team and licensed under the LGPL
*  See COPYING.lesser and README.md in the root of this project for full details
*/

GUIUtils = function(){
	
	/**
	 * This is the old getElementById function
	 */
	this.$$ = function( id ){
		return document.getElementById( id );
	};
	
	/**
	 * Converts from page centric X coordinates to canvas centric X coordinates
	 */
	this.convertToCanvasX = function(pageX){
		return pageX + $('#div_container').scrollLeft() - $('#contentDiv').offset().left;
	};

	/**
	 * Converts from page centric Y coordinates to canvas centric Y coordinates
	 */	
	this.convertToCanvasY = function(pageY){
		return pageY + $('#div_container').scrollTop() - $('#contentDiv').offset().top;
	};
	
	/**
	 * Disables the dock bar
	 */
	this.disableDock = function(){
		$('#div_dock').attr('class', 'dock disabled_dock');
	};
	
	/**
	 * Enables the dock bar
	 */
	this.enableDock = function(){
		$('#div_dock').attr('class', 'dock');
	};
	
	/**
	 * Constructs and returns a checked checkbox
	 */
	this.getCheckbox = function(checked){
		var cb = $('<input>');
		cb.attr("type", 'checkbox');
		cb.prop("checked", checked);
		return cb;
	};
	
	/**
	 * Returns a <div> with an interactive file browser within it
	 * 
	 * @param fnames - a complete list of all files in the directory tree
	 * structure
	 * @param draggable - when true, files and folders can be meaningfully
	 * dragged
	 * @param newfile when true, an editable new file icon is present
	 * @param startfolder if set, starts navigation at the specified folder
	 */
	this.getFileBrowser = function(fnames, draggable, newfile, startfolder){
		var maxFnameLength = utils.max(fnames,function(_) {return _.length;}),
			 fileb = $("<div>"),
			 navdiv = $("<div>"),
			 input = $("<input>"),
			 selection = undefined,
			 currfolder = '/',
			 clearSelection = 
				 function()
				 {
					 if( selection )
					 {
						 selection.attr("class", 'fileb_icon');
						 selection = undefined;
						 input.val('');
					 }
				 },
			 navbuttononclick	=
				 /* 1 construct the full path associated to the clicked button
					 2 remove 'deeper' buttons
					 3 chdir to selected folder */
				 function(ev)
				 {
					 var path = '';
					 for( var i=0; i<navdiv.children("button").length; i++ )
					 {
						 path += $(navdiv.children()[i]).html() +'/';
						 if( $(navdiv.children()[i]).html() == $(ev.target).html() )
							 break;
					 }
					 
					 setCurrentFileBrowserFolder(path.substring(1), fnames);
				 },
			 setCurrentFileBrowserFolder = 
				 /* 1 determine files and folders from the given folder
					 2 produce icons for them and add them to to-be content div
					 3 create navigation toolbar for complete directory hierarchy
					 4 replace previous content div, if any, with new one 
				  	 5 clear past selection, if any, and remember current folder */
				 function(folder,fnames) 
				 {
					 var div = $('#div_fileb-contents'),
						  folders		  = [],
						  files			  = [],
						  maxFnameLength = 0,
						  exists = false;
					 
					 // If it already exists, remove everything!
					 if( div.length > 0 ) {
						 $('#div_fileb-contents').remove();
	//					 exists = true;
					 }
					 
					 div = $("<div>");
						 
					 div.attr("class", 'fileb_pane')
					 	.attr("id", 'div_fileb-contents');
					 
					 fnames.forEach( function(fname) {
						 var _folder = utils.regexpe(folder);
						 if( (matches=fname.match('^'+_folder+'(.+?/)')) )
						 {
							 if( ! utils.contains(folders,matches[1]) )
								 folders.push(matches[1]);
							 else
								 return;
						 }
						 else if( (matches=fname.match('^'+_folder+'(.*)')) ) {
                             if (matches[1].length > 0) {
                                 files.push(matches[1]);
                             } else {
                                 return;
                             }
                         }
						 else
							 return;
							 
						 maxFnameLength = 
							 Math.max(maxFnameLength,matches[1].length);
					 });
							 
	//				 var tmpDiv = $("<div>");
					 folders.concat(files).forEach( function(fname) {
						 var icon = HttpUtils.getFileIcon(fname);
						 if( icon )
						 {
							 icon.css("width", 8+maxFnameLength+'ex');
							 icon.click( function(ev) {
							 	 clearSelection();								 	
	
								 if( fname.match(/\/$/) )
									 setCurrentFileBrowserFolder(folder+fname,fnames);
								 else
								 {
									 input.val( folder+fname );
									 selection = icon;
									 selection.attr("class", 'fileb_icon_selected');
								 }
							 });
				 			 
				 			 if( draggable )
							 {
								 //icon.setAttribute('draggable',true);
				 				 icon.attr("draggable", true);
								 icon.get(0).ondragstart = 
									 function(event) 
									 {
										 var uri = HttpUtils.url(folder+fname+'.file',__NO_WID);
			  							 event.dataTransfer.effectAllowed = 'copyMove';
			  							 event.dataTransfer.setData(
											 'DownloadURL', 
											 'application/zip:'+fname+'.zip:'+
												 window.location.origin+uri);
										 event.dataTransfer.setData('uri',uri);
									 };
							 }
	
							 div.append(icon);
						 }
					 });
					 
					 if( newfile )
					 {
						 var icon = HttpUtils.getNewFileIcon( function(ev) {
							 input.val( folder+ev.target.textContent );
						 });
						 icon.css("width", 8+maxFnameLength+'ex');
						 div.append(icon);
					 }
					 
					 navdiv.empty();
					 
	//				 while (navdiv.children().length > 0) {
	//					navdiv.find(navdiv.lastChild).remove();
	//				 }
					 tmpDiv = $("<div>");
					 var subfolders = folder.split('/').filter(function(subf) {return subf != '';});
					 subfolders.unshift('/');
					 subfolders.forEach(function(subfolder) {
						var navbutton = $('<button>');
						navbutton.html( subfolder );
						navbutton.click(navbuttononclick);
						navdiv.append(navbutton);
					 });
					 
					 //navdiv.html( tmpDiv.html() );
					 
					 
					 if( exists ) {
	//					 $('#div_fileb-contents').html( div.html() );
	//					 fileb.append(div);
						 $('#div_fileb-contents').remove();
						 fileb.append(div);
					 } else
						 fileb.append(div);
	
					 clearSelection();				 
					 currfolder = folder;
				 };
	
		fileb.css("width", maxFnameLength+'ex')
			.css("maxWidth", '100%');
		
		navdiv.css("align",  'left');
		
		input.attr("type", 'hidden');
		
		fileb.append(navdiv);
		fileb.append(input);
		
		setCurrentFileBrowserFolder(startfolder ? startfolder : '/',fnames);
	
		return {'filebrowser':	 fileb,
				  'filepane':	 	 function() {return $('#div_fileb-contents');},
				  'getcurrfolder': function() {return currfolder;},	
				  'getselection':	 function()	{return input.val();},
                  'clearselection': function() {clearSelection()},
                  'refresh': function(fnames, the_folder) {
                      setCurrentFileBrowserFolder(the_folder || currfolder, fnames);
                  }};
	};
	
	// TODO: replace the bundled function with an actual object generation. The
	// current method is sloppy.
	/**
	 * Constructs and returns an input field given an attribute's type and value,
	 * bundled in the return value is a function to retrieve the input fields
	 * content as well as its initial value
	 * 
	 * For Maps and Lists, onfocus/onblur toggle a default entry to be shown.
	 */
	this.getInputField = function (type,value){
		/* recursively expand specialTypes, if any */
		function explodeType(t)
		{
			var exploded = __specialTypes[t] || t;
			while( exploded.match(/\$/) )
				exploded = exploded.replace(
									/(\$.+?)([,\]>])/g, 
									function(s,p1,p2){return __specialTypes[p1]+p2;});
			return exploded;
		}
	
		/* return a default value for the given exploded type string */
		function defaultEntry(et)
		{
			if( et == 'string' || et == 'code' )
				return "";
			else if( et == 'int' )
				return 0;
			else if( et == 'boolean' )
				return true;
			else if( et == 'double' )
				return 0.0;
			else if( et.match(/^ENUM/) )
				return et;
			else if( (matches=et.match(/^list<(.*)>$/)) )
				return [defaultEntry(matches[1])];
			else if( (matches=et.match(/^map<\[(.*?)\],\[(.*)\]>$/)) )
			{
				var m 	 = {},
					 keys  = matches[1].split(','),
					 types = [],
					 depth = 0,
					 index = 0;
				for( var i=0; i<matches[2].length; i++ )
				{
					if( matches[2].charAt(i) == '(' ||
						 matches[2].charAt(i) == '<' )
						depth++;
					else if( matches[2].charAt(i) == ')' ||
						 		matches[2].charAt(i) == '>' )
						depth--;
	
					if( matches[2].charAt(i) == ',' && depth == 0 )
					{
						types.push( matches[2].substring(index,i) );
						index = i+1;
					}
				}
				types.push( matches[2].substring(index) );
	
				for( var i=0; i<keys.length; i++ )
					m[keys[i]] = defaultEntry(types[i]);
				return m;
			}
			else if( (matches=et.match(/^map<(.*),(.*)>$/)) )
			{
				var m = {};
				m[defaultEntry(matches[1])] = defaultEntry(matches[2]);
				return m;
			}
		}
	
	
		if( type == 'code' )
			var input 	 = GUIUtils.getTextInput(utils.jsond(value,'\n')),
				 getinput = function(_){return _.val();};
		
		else if( type.match(/^map/) || 
					type.match(/^list/) )
		{
			var input 	 = GUIUtils.getTextInput(
										utils.jsond(utils.jsons(value,undefined,'   '))),
				 getinput = function(_){
					 return utils.jsonp(utils.jsone(_.val()));
				 };
	
			var de 	 = defaultEntry( explodeType(type) ),
				 isMap = type.match(/^map/),
                 matches = undefined;
			input.focus( 
					(isMap ?
						function()	
						{
						 	var newVal = utils.mergeDicts([getinput(input),de]);
						 	input.val( utils.jsond(utils.jsons(newVal,undefined,'   ')));
						} :
						function()	
						{
						 	var newVal = getinput(input).concat(de);
						 	input.val( utils.jsond(utils.jsons(newVal,undefined,'   ')));
						}));
			input.blur(
					(isMap ?
						function()	
						{
							var val = getinput(input);
							utils.splitDict(val,utils.keys(de));
						 	input.val( utils.jsond(utils.jsons(val,undefined,'   ')));
						} :
						function()	
						{
							var val = getinput(input);
							if( utils.jsons(utils.tail(val)) == utils.jsons(de[0]) )
								val.pop();
						 	input.val( utils.jsond(utils.jsons(val,undefined,'   ')));
						}));
		}
	
		else if( type.match(/^ENUM/) )
		{
			var vals 	 = type.match(/^ENUM\((.*)\)$/)[1],
				 input 	 = GUIUtils.getSelector(vals.split(','),false,[value]),
				 getinput = 
					 function(_){return HttpUtils.getSelectorSelection(_)[0]};
		}
	
		else if( type.match(/^boolean$/) )
		{
			var input 	 = GUIUtils.getCheckbox(value),
				 getinput = 
					 function(_){return _.prop("checked");};
		}
	
		else if( type.match(/^\$/) )
			return GUIUtils.getInputField(__specialTypes[type],value);
	
		else if (matches = type.match("^file<(.*)>")) {
			var input 	 = GUIUtils.getFileInput(value,matches[1],"code_style string_input",1),
				 getinput = function(_){return _.val();}
        }
	
		else
			var input 	 = GUIUtils.getTextInput(value,"code_style string_input",1),
				 getinput = (type == 'string' ?
						 function(_){return _.val();} :
						 function(_){return utils.jsonp(_.val());});
		
		input.title = explodeType(type);
		return {'input':input, 'getinput':getinput, 'oldVal':getinput(input)};
	};
	
	/**
	 * Constructs and returns a <select> element with the choices list converted into
	 * a list of <option> elements.
	 * 
	 * @param choices - the choices for the <select> element
	 * @param multipleChoice - if true, allows for multiple options to be selected
	 * @param defaultSelect - sets the default selection for the list
	 * @param numVisibleOptions - sets the number of visible options
	 */
	this.getSelector = function(choices,multipleChoice,defaultSelection,numVisibleOptions){
		var select = $('<select>');
		select.attr("class", 'default_style');
		select.attr("size", Math.min(choices.length,numVisibleOptions || __MAX_SELECT_OPTIONS));
		select.attr("multiple", multipleChoice);
	
		choices.forEach(
				function(choice)
				{
					var option = $('<option>');
					option.val( choice ); 
					option.html( choice );
					select.append(option);
					if( defaultSelection != undefined && 
						 utils.contains(defaultSelection,choice) )
						option.prop("selected", true);	
				});
	
		return select;
	};
	
	/* constructs an INPUT given some text and a CSS class */
	/**
	 * Constructs an <input> element
	 * 
	 * @param text - the default text for the input element
	 * @param className - the default class name for the input element
	 * @param width - the default width of the element. If this is omitted
	 * then the <input> defaults to 400px wide.
	 */
	this.getStringInput = function(text,className,width){
		var input = $('<input>');
		input.attr("type", 'text');
		input.attr("class", className || 'default_style');
		input.val( text );
		input.css("width", width || '400px');
		return input;
	};
    
    this.getFileInput = function(code,pattern,className,rows){
        var string_input = this.getTextInput(code, className, rows);
        var extra_el = $('<button>');
        extra_el.attr("width", 16);
        extra_el.attr("height", 16);
        extra_el.html("...");
        extra_el.click(function(event) {
            var options = {'extensions':[pattern],
                           'multipleChoice':false,
                           'manualInput':false,
                           'title':'choose a rule model',
                           'startDir':'model'},
                callback =
                    function(fnames)
                    {
                        string_input.val(fnames[0]);
                    };
            WindowManagement.openDialog(_FILE_BROWSER,options,callback);
            event.stopPropagation();
            event.preventDefault();
        });
        string_input.extra_el = extra_el;
        return string_input;
    }
	
	/**
	 * Constructs a <textarea> element. In this element, Alt + Right Arrow
	 * is treated as a tab.
	 * 
	 * @param code - the default code for this text area
	 * @param className - the default class name for the <textarea>
	 * @param rows - the default number of rows for this <textarea>
	 */
	this.getTextInput = function(code,className,rows){
		var input = $('<textarea>');
		input.attr("cols", 80);
        rows = rows || 7;
		input.attr("rows", (rows || 7));
		input.val(code);
		input.attr("class", className || 'code_style');
		input.keydown( function(event) {
			if( event.keyCode == KEY_RIGHT_ARROW /* This is to simulate a tab press */ ) {
				if( currentKeys[ KEY_ALT ] == 1 && currentKeys[ KEY_CTRL ] != 1){
					var cursorPos = event.target.selectionStart,
						 lineStart = input.val().lastIndexOf('\n',cursorPos-1)+1,
						 tabBy	  = __TAB_WIDTH - (cursorPos-lineStart)%__TAB_WIDTH,
						 tab		  = '';
					for(var i=0; i<tabBy; i++)	tab += ' ';
						 
					input.val( 
						input.val().substring(0,cursorPos)+tab+
					  	input.val().substring(cursorPos));
					input.get(0).setSelectionRange(cursorPos+tabBy,cursorPos+tabBy);
					return true;
				}
				
				return true;
			}
            // https://media.giphy.com/media/12XMGIWtrHBl5e/giphy.gif
			else if( event.keyCode == KEY_ENTER )
			{
                if (rows > 1) {
                    // only for multi-line input fields
                    var cursorPos = event.target.selectionStart;
                    input.val( 
                            input.val().substring(0,cursorPos)+'\r\n'+
                            input.val().substring(cursorPos));
                    input.get(0).setSelectionRange(cursorPos+1,cursorPos+1);
                }
				event.stopPropagation();
                event.preventDefault();
				return true;
			}
		});
        input.keyup( function (event) {
			if( event.keyCode == KEY_ENTER )
			{
				event.stopPropagation();
                event.preventDefault();
            }
        });
		return input;
	};
	
	/**
	 * Constructs a <span> element.
	 * 
	 * @param text - the default text to be displayed
	 * @param className - the default class name
	 */
	this.getTextSpan = function(text,className)
	{
		var span = $('<span>');
		span.html( text.replace(/\n/g,'<br/>') );
		span.attr("class", className || 'default_style');
		return span;
	};
	
	/**
	 * Finds and removes the specified toolbar, if present
	 * 
	 * @param tb - the toolbar to be removed
	 */
	this.removeToolbar = function(tb){
		tb_fixed = tb.replace(/\//g, "\\/");
		if( $('#div_toolbar_'+tb_fixed) )
		{
			//Find the toolbar in the dock bar and remove it
			//from the DOM
			$("#div_dock").children("div").each( function() {
				if( this.id == "div_toolbar_" + tb ){
					$(this).remove();
				}
			});
			
			// Now delete it from the list of loaded toolbars
			delete __loadedToolbars[tb];
		}
	};
	
	/**
	 * Throw out the current canvas, replace it with a new one.
	 * 1. Unselect any current selection
	 * 2. Clear canvas
	 * 3. Clear icon and edge data
	 * 4. reset canvas statechart
	 */
	this.resetCanvas = function (){
		__select();
		__canvas.clear();
		__icons = {};
		__edges = {};
		__canvasBehaviourStatechart.init();
	};
	
	/**
	 * Sets up a model popup window and displays it.
	 * 
	 * @param elements - DOM elements to be displayed in order
	 * @param getinput - function that retrieves the desired user-input
	 * from "elements". 
	 * @param type - Can be __NO_BUTTONS, __ONE_BUTTON,
	 * or __TWO_BUTTONS and controls the number of displayed buttons
	 * @param title	 - the dialog title
	 * @param callback	- called with the result of getinput when the ok
	 * button is clicked
	 */
	this.setupAndShowDialog = function(elements,getinput,type,title,callback){
		// BehaviorManager.handleUserEvent(__EVENT_CANCELED_DIALOG);

		var dialog 	  = $('#div_dialog'),
             the_id = __dialog_stack.length;
             dialog = dialog.clone().attr("id", 'div_dialog_'+the_id);
			 dim_bg 	  = $('#div_dim_bg'),
			 div_title = $('<div>');

        __dialog_stack.push(dialog);
        dialog.appendTo(document.body);
		div_title.attr("class", 'dialog_title');
		div_title.append(GUIUtils.getTextSpan(title || ''));
		dialog.append(div_title);

		elements.forEach( 
				function(e) 
				{
					dialog.append(e);
					dialog.append( $('<br>') );
				});
		dialog.append( $('<br>') );


		if( type != __NO_BUTTONS )
		{
			var ok = $('<button class="okbutton">'); // HUSEYIN-ENTER
			ok.click( function(ev) {
				if( getinput == undefined )
				{
					BehaviorManager.handleUserEvent(__EVENT_OKAYED_DIALOG);
					if( callback != undefined )
						callback();
				}
				else
				{
					try{
						var input = getinput();
					} catch(err) {
						console.error('failed to retrieve dialog input :: '+err);
						return;
					}
					input = (utils.isArray(input) ?
									input.map(function(i) {return String(i);}) : 
									input);
					BehaviorManager.handleUserEvent(__EVENT_OKAYED_DIALOG);
					callback(input); 
				}
			});
			ok.html('ok');
			dialog.append(ok);
		}
		
		if( type == __TWO_BUTTONS )
		{
			var cancel = $('<button>');
			cancel.click(function(ev) {
				BehaviorManager.handleUserEvent(__EVENT_CANCELED_DIALOG);
			});
			cancel.html('cancel');
			dialog.append(cancel);
		}

		BehaviorManager.setActiveBehaviourStatechart(__SC_DIALOG);
		BehaviorManager.handleUserEvent(__EVENT_SHOW_DIALOG);
	};
	
	/* 
	  NOTE:: the sortedButtonNames() function sorts icon definition metamodels and
				button models s.t. buttons appear in an order that reflects their
				model... to be perfectly clean, this should be absorbed into icon
				definition and button model compilers, but since button models aren't
			  	compiled, it was simpler to just let this relatively simple logic live
			  	here 
  	*/
	/**
	 * Sets up and shows a toolbar according to the given button model or metamodel.
	 * 
	 * This method:
	 * 1. Removes any old instance of the toolbar if it currently exists
	 * 2. Creates a <div> to hold the buttons
	 * 3. Creates each button and appends it to the <div>
	 * 4. Add the <div> to the dock
	 * 5. Map the toolbar to its data
	 * 
	 * @param tb - the toolbar to setup and show
	 * @param data - the data to bind the toolbar to
	 * @param type - the toolbar type, can be __BUTTON_TOOLBAR or __METAMODEL_TOOLBAR
	 */
	this.setupAndShowToolbar = function(tb,data,type)
	{
		var imgSrc = 
				function(name) 
				{
					return (type == __BUTTON_TOOLBAR ?
								tb.substring(0,tb.lastIndexOf('/')+1)+name+'.icon.png' :
								'/Formalisms/default.icon.png');
				},
			 className = 
				function()
					{return (type == __BUTTON_TOOLBAR ? 'toolbar_bm' : 'toolbar_mm');},
			 buttons = 
				 (type == __BUTTON_TOOLBAR ?	data.asm.nodes : data.types),
			 sortedButtons = 
				 function()
				 	{
						return (type == __BUTTON_TOOLBAR ?
							/* sort button names according to their position in their
								associated buttons model */
							utils.sortDict(data.csm.nodes,
								function(b1,b2)
								{
									var pos1 = b1['position']['value'],
										 pos2 = b2['position']['value'];
										 
	 								 if( (pos1[1] < pos2[1]) ||
										  (pos1[1] == pos2[1] && pos1[0] < pos2[0]) )
										 return -1;
									 return 1;									
								 }) :
							utils.sortDict(data.types,
							/* sort type names according to their IconIcon's position in 
								the associated icon definition model */
								function(b1,b2)
								{
									var pos1 = undefined,
										 pos2 = undefined;
	 								 b1.some( function(attr) 
												 {
													 if(attr['name'] == 'position')
														 pos1 = attr['default'];
	 												 return pos1;
	 											 });
									 b2.some( function(attr) 
												 {
													 if(attr['name'] == 'position')
														 pos2 = attr['default'];
	 												 return pos2;
	 											 });

										if( (pos1[1] < pos2[1]) ||
										  	 (pos1[1] == pos2[1] && pos1[0] < pos2[0]) )
											return -1;
										return 1;									
								}) );
					},
			 createButton = 
			 	 function(name,tooltip,code)
			 	 {
			 		 var div = $('<div>'),
						  img = $('<img>');
					 div.addClass( 'toolbar_button' );
					 div.attr("id", tb+'/'+name);
			 		 div.attr("title", tooltip);
			 		 div.click( function(ev){
						 var res = HttpUtils.safeEval(code);
		 				 if( res['$uerr'] )
		 					 WindowManagement.openDialog(
									 _ERROR,
									 'unexpected error in button code ::\n '+res['$uerr']);
						 else if( res['$err'] )
		 					 WindowManagement.openDialog(
									 _ERROR,
									 'error in button code ::\n '+res['$err']);
			 		 });
                     var url = HttpUtils.url(imgSrc(name),__NO_WID);
                     img.attr("src", url);

                     //handle missing icon
                     let defaultUrl = HttpUtils.url("/Formalisms/default.icon.png");
                     let missingMsg = "Warning: The icon \"" + url + "\" is missing! The default icon has been used.";
                     let onerrorStr = "this.onerror = ''; this.src = '" + defaultUrl + "'; console.log('" + missingMsg + "');";
                     img.attr('onerror', onerrorStr);

                     div.append(img);
                     return div;
			 	 };

		GUIUtils.removeToolbar(tb);

		var tb_div = $('<div>');
		tb_div.attr("id", 'div_toolbar_'+tb);
		tb_div.attr("class", className()+' toolbar unselectable' );
		tb_div.attr("title", tb);

		sortedButtons().forEach( 
			function(b)
			{
				if( type == __METAMODEL_TOOLBAR && b.match(/(.*)Link$/) )
					return;

				var spc1 = $('<span>'),
					 spc2 = $('<span>');
//				spc1.className = spc2.className = 'toolbar_space';
				spc1.attr("class", "toolbar_space" );
				spc2.attr("class", "toolbar_space" );
				tb_div.append(spc1);
				if( type == __BUTTON_TOOLBAR )
					tb_div.append(
		 				 createButton(
			 				 buttons[b]['name']['value'],						
			 				 buttons[b]['tooltip']['value'],
			 				 buttons[b]['code']['value']) );
				else if( (matches = b.match(/(.*)Icon/)) )
					tb_div.append(
						 createButton(
							 b,
							 'create instance(s) of '+b.match(/(.*)Icon/)[1],
							 '_setTypeToCreate("'+
								 tb.substring(0,tb.length-'.metamodel'.length)+
								 '/'+b+'");') );
				tb_div.append(spc2);
			} );

		if( tb_div.children().length == 0 )
			tb_div.append( GUIUtils.getTextSpan(tb,'toolbar_alt') );

        //get the toolbar
        let dock = $('#div_dock');

        //create an array and add the new toolbar
        let items = Array.from(dock[0].childNodes);
        items.push(tb_div[0]);

        //sort the dock
        items.sort(function(a, b) {

            //main menu comes first
            if (a.id.includes("MainMenu")){
                return -1;
            }

            //toolbars come first
            if (a.id.includes("Toolbars") && !(b.id.includes("Toolbars"))){
                return -1;
            }

            if (b.id.includes("Toolbars") && !(a.id.includes("Toolbars"))){
                return 1;
            }

            //otherwise, sort by name
            return a.id == b.id? 0 : (a.id > b.id ? 1 : -1);
        });

        //add the elements back into the dock
        for (let i = 0; i < items.length; ++i) {
            dock.append(items[i]);
        }


        __loadedToolbars[tb] = data;
	};
	
	return this;
}();