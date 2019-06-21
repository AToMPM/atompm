/* This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
*  Copyright 2011 by the AToMPM team and licensed under the LGPL
*  See COPYING.lesser and README.md in the root of this project for full details
*/

/*TODO: look into reworking naming convention to be more intuitive
*ie: 
* button: btn_someFunc
* window: wnd_someFunc
* private: _someFunc
* etc
*/

/* NOTES: 

	NAMING CONVENTION...	functions and variables starting with '_' are meant to 
	be used from within Button code (most of them are directly associated to a 
	native back-end operation)... functions starting with '__' are meant to be 
	private and should only be used from within application code 

	WINDOW TITLE... window titles are set to pretty-print '__saveas'... if any
	changelogs have been received since we loaded/saved the model, the title is 
	changed to explicit this

	the BACKDOOR API section contains methods that are accessible from the 
	backend (or from anyone who has access to the backend, e.g., a synthesized
  	application)... they are all void (i.e., they don't return anything or any
	feedback to the 'caller') and should only be accessed remotely, via 
	'PUT /GET/console {CLIENT_BDAPI:...}' to the backend
 
	TBI:: add caching mechanism to avoid recompiling the same icon models into 
			the same SVG over and over 

	TBI:: add helper functions for parsing and manipulating path strings (see 
			Raphael.parsePathString()... not only would this elevate abstraction,
		  	but a lot of our connection-related operations could be optimized 
			(including less string matching and splitting) if segments were arrays
			of points rather than strings 


	TBI:: when SVG 1.2 gets Chrome support, the __SVG_TEXT_EDITOR dialog could be
			removed in favor of native SVG text editing facilities */


/******************************** GLOBAL VARS *********************************/
var __user = undefined,
	 __wid,
	 __aswid,
	 __prefs,
	 __typeToCreate,
	 __loadedToolbars = {},
	 __icons = {},
	 __edges = {},
	 __canvas,
	 __saveas;
	 __option = '',
	 __trafo = '',
	 __msg = '',
	 __name = '';
/******************************** GLOBAL VARS *********************************/

AtomPMClient = function(){
	
	/**
	 * Log deprecated function calls
	 */
	this.alertDeprecatedFunctionCall = function( funcName ){
		console.warn("Deprecated function call: " + funcName);
	};
	
	return this;
}();


/**
 * Automatically saves the current model.
 * 
 * If mode == backup, save the current model into a backup file
 * If mode == overwrite, overwrite the current file model
 */
function __autosave(mode)
{
	if( mode == 'backup' )
	{
		if( __saveas )
		{
			var matches = __saveas.match(/(.*\/)(.*)/);
			_saveModel(matches[1]+'.autosave.'+matches[2],true,true);
		}
		else
			_saveModel(undefined,true,true);
	}
	else if( mode == 'overwrite' )
		_saveModel(undefined,false,true);
}


/**
 * Launches the autosave daemon, which automatically tries to
 * save the model based on the interval stored in the preferences
 * array
 */
function __launchAutosave()
{
	if( __prefs['autosave-delay']['value'] > 0 )
		window.setInterval(
				__autosave, 
				__prefs['autosave-delay']['value'] * 1000,
				__prefs['autosave-mode']['value']);
}



/********************************* 'USER' API *********************************/

/**
 * Creates an SVG blob out of the current SVG elements on the canvas
 * 
 * Note 1: an alternative to the current implementation (though less
 *  efficient) would be to POST the data to the server and then have
 *  the returned file be downloadable
 * 
 * Note 2: a click is simulated instead of using 
 *  window.location.assign() so that the target filename can be 
 *  chosen
 *  
 * Note 3: the output width of the image is altered in order to fit
 *  the content. This would be fixed if we utilized a dynamically 
 *  expanding canvas
 * 
 * Note 4: the 'href' tags are changed to 'xlink:href' tags in the 
 *  generated SVG file. All images are embedded as data uris in the
 *  output in order to increase robustness.
 */
function _exportSVG(fname)
{
	var BlobBuilder = window.WebKitBlobBuilder || window.MozBlobBuilder,
		 URL			 = window.URL || window.webkitURL,
		 a  			 = $('<a>'),
		 bb 			 = undefined,
		 iconsbbox	 = __getGlobalBBox( 
				 					utils.keys(__icons).concat(utils.keys(__edges)) ),
		 svg			 =  $('#div_canvas').html().
			 					replace(/^(<svg.*? width=")(.*?)(".*?>)/,
											'$1'+(2*iconsbbox.x+iconsbbox.width)+'$3').
								replace(/^(<svg.*? height=")(.*?)(".*?>)/,
											'$1'+(2*iconsbbox.y+iconsbbox.height)+'$3'),

		 exportSVG	= 
			 function()
			 {
				 bb = new Blob([svg], {"type": "text\/xml"});
			 	 a.attr("href", URL.createObjectURL(bb));
			 	 a.attr("download", fname || "model.svg");
			 	 a.get(0).click();
			 	 URL.revokeObjectURL(a.href);
			 };

	if( (images = svg.match(/<image.*? href=".*?".*?>/g)) )
	{
		var datauris = [];
		images.forEach(
			function(image,i)
			{
				HttpUtils.imageToDataURI(
					image.match(/^<image.*? href="(.*?)".*?>$/)[1],
					function(datauri)	
					{
						 datauris[i] = datauri;
						 if( datauris.length == images.length &&
							  ! utils.contains(datauris,undefined) )
						 {
							 svg = svg.replace(
								 /(<image.*? )href=".*?"(.*?>)/g,
								 function(p0,p1,p2)
								 {
									 return p1+' xlink:href="'+datauris.shift()+'"'+p2;
	 							 });
							 exportSVG();
						 }
					});
			});
	}
	else
		exportSVG();
}

/**
 * Retrieves the value that matches the subset, and then passes
 * it back into the callback function
 * 
 * @param callback the function that the value is passed to
 * @param subset the matching preference entry
 */
function _getUserPreferences(callback,subset)
{
	console.debug("Get User Preferences");
	console.debug(subset);
	HttpUtils.httpReq(
		'GET',
		HttpUtils.url('/prefs',__NO_WID),
		(subset == undefined ? 
		 	undefined : 
			'?subset='+encodeURIComponent(utils.jsons(subset))),
		function(statusCode,resp)
		{
			console.debug("Callback Get User Preferences");
			console.debug(statusCode);
			console.debug(resp);
			if( ! utils.isHttpSuccessCode(statusCode) )
                UserManagement.logout();
			else
				callback(utils.jsonp(resp));
		});
}

/**
 * Generates an HTTP request
 * 
 * @param method GET/DELETE/POST/PUT
 * @param url the URL to hit
 * @param params the parameters to pass in
 * @param onresponse the callback function to perform on response
 * @param sync whether or not this request is synchronous
 */
function _httpReq(method,url,params,onresponse,sync)
{
	if( method != 'GET' )
		BehaviorManager.handleUserEvent(__EVENT_CODED_CANVAS_EDIT);
	HttpUtils.httpReq(method,url,params,onresponse,sync);
}


/**
 * Inserts another model into the current canvas
 */
function _insertModel(fname)	
{
	if( ! __isModel(fname) )
		WindowManagement.openDialog(
			_ERROR,
			'invalid extension... loadable models are "*.model" files');
	else
		DataUtils.loadm(fname,true);
}

/**
 * Loads a model from the selected file name. This automatically
 * strips out the .autosave portion of the filename, if it is
 * present
 * 
 * @param fname the name of the file to load
 */
function _loadModel(fname)	
{
	if( ! __isModel(fname) )
		WindowManagement.openDialog(
			_ERROR,
			'invalid extension... loadable models are "*.model" files');
	else
	{
		if( (matches = fname.match(/(.*)\.autosave\.(.+\.model)/)) )
			__saveas = matches[1]+matches[2];
		else
			__saveas = fname;
		DataUtils.loadm(fname);
		if (__msg != '' && __msg != null)
			WindowManagement.openDialog(_CUSTOM,{'widgets':[{'id':'1','type':'text','label':'text message','default':''}],"title":__msg});
	}
}

/**
 * Loads a new toolbar onto the current canvas
 * @param fname the name of the file to load
 */
function _loadToolbar(fname)	
{
	if( __isButtonModel(fname) )
		DataUtils.loadbm(fname);
	else if( __isIconMetamodel(fname) )
		DataUtils.loadmm(fname);
	if (__msg != '' && __msg != null)
		WindowManagement.openDialog(_CUSTOM,{'widgets':[{'id':'1','type':'text','label':'text message','default':''}],"title":__msg});
}

/* save model

	1. if no filename is specified,
		a) if autosave is specified,
			- if __saveas is specified, use it
			- otherwise, use __DEFAULT_SAVEAS
		b) else, ask the user to choose a file to save to (first time user saves a model)
	2. otherwise, if an incorrect filename is specified, show error and return
	3. save model 
	4. if this isn't an automated backup (i.e., the backup flag is unset), 
		remember filename in __saveas and adjust window title to reflect fact that
		all changes are saved */
function _saveModel(fname,backup,autosave)
{
	if( fname == undefined ) {
		if (!autosave && (__saveas == undefined || __saveas == null)) {
			var options = {'extensions':['\\.model'],
						   'multipleChoice':false,
						   'manualInput':true,
						   'title':'specify target model\nextension: .model',
						   'startDir':'model'},
				callback =
					function(fnames)
					{
						_saveModel(fnames[0]);
					};
			WindowManagement.openDialog(_FILE_BROWSER,options,callback);
			return;
		} else {
			fname = (__saveas || __DEFAULT_SAVEAS);
		}
	} else if( ! __isModel(fname) )	{
		WindowManagement.openDialog(
			_ERROR,
			'invalid extension on \'' + fname +'\' - models must be saved as "*.model" files');
		return;
	}

	DataUtils.savem(fname);
	if( ! backup )
	{
		__saveas = fname;
		WindowManagement.setWindowTitle();
	}
}


/* TBI:: 
	. unselect invisible items
	. remember visibility settings s.t. newly created items (e.g., by 
	  collaborator) inherit them */
function _setInvisibleMetamodels(mms)
{
	mms = mms.map( function(mm) {return mm.match(/(.*)\.metamodel/)[1];} );

	function hideOrShow(uri,icon)
	{
		if( ! mms.some(
					function(mm)
					{
						if( uri.match(mm+'/') )
						{
							icon.hide();
							return true;
						}
					}) )
			icon.show();		
	}

	for( var uri in __icons )
		hideOrShow(uri,__icons[uri]['icon']);
	for( var uri in __edges )
		hideOrShow(uri,__edges[uri]['icon']);	
}


/**
 * Updates the current user preferences and then
 * executes the passed in callback function
 * 
 * @param prefs the new user preferences
 * @param callback the function to be executed
 */
function _setUserPreferences(prefs,callback)
{
	HttpUtils.httpReq(
		'PUT',
		HttpUtils.url('/prefs',__NO_WID),
		prefs,
		function(statusCode,resp)
		{
			if( ! utils.isHttpSuccessCode(statusCode) )
				WindowManagement.openDialog(_ERROR, 'failed to update user preferences :: '+resp);
			else if( callback )
				callback();
		});
}

/**
 * Creates a new formalism under /Formalisms/ with the specified name.
 * 
 * @param formalism_name the name of the new formalism
 */
function _newFormalism(formalism_name) {
    HttpUtils.httpReq(
		'POST',
		window.localStorage.getItem('user') + "/" + formalism_name + '.formalism',
		undefined,
		function(statusCode,resp)
		{
			if( ! utils.isHttpSuccessCode(statusCode) ) {
				WindowManagement.openDialog(_ERROR, 'failed to create new formalism :: '+resp);
            } else {
                WindowManagement.spawnClient("/Formalisms/" + formalism_name + "/" + formalism_name + ".model");
                WindowManagement.spawnClient("/Formalisms/" + formalism_name + "/" + formalism_name + ".defaultIcons.model");
            }
		});
}

/**
 * Creates a new transformation on the specified location.
 * 
 * @param transformation_loc the location of the new transformation
 */
function _newTransformation(transformation_loc) {
    if (transformation_loc.match(/.*\/T_.*\.model$/)) {
        HttpUtils.httpReq(
            'POST',
            window.localStorage.getItem('user') + transformation_loc + '.transformation',
            undefined,
            function(statusCode,resp)
            {
                if( ! utils.isHttpSuccessCode(statusCode) ) {
                    WindowManagement.openDialog(_ERROR, 'failed to create new transformation :: '+resp);
                } else {
                    WindowManagement.spawnClient(transformation_loc);
                }
            });
    } else {
        WindowManagement.openDialog(_ERROR, 'failed to create new transformation :: '+transformation_loc+" is not a valid transformation name");
    }
}

/**
 * Creates a new rule on the specified location.
 * 
 * @param rule_loc the location of the new rule
 */
function _newRule(rule_loc) {
    if (rule_loc.match(/.*\/R_.*\.model$/)) {
        HttpUtils.httpReq(
            'POST',
            window.localStorage.getItem('user') + rule_loc + '.rule',
            undefined,
            function(statusCode,resp)
            {
                if( ! utils.isHttpSuccessCode(statusCode) ) {
                    WindowManagement.openDialog(_ERROR, 'failed to create new rule :: '+resp);
                } else {
                    WindowManagement.spawnClient(rule_loc);
                }
            });
    } else {
        WindowManagement.openDialog(_ERROR, 'failed to create new rule :: '+rule_loc+" is not a valid rule name");
    }
}

/**
 * Sets the current type of entity to be created
 * @param fulltype the type to be created
 */
function _setTypeToCreate(fulltype)
{
	__typeToCreate = fulltype;
}

/**
 * Unloads the selected toolbar from the current canvas
 * @param tb the toolbar to be unloaded
 */
function _unloadToolbar(tb)
{
	if( __isButtonModel(tb) )
		DataUtils.unloadbm(tb);
	else if( __isIconMetamodel(tb) )
		DataUtils.unloadmm(tb);
}

/**
 * Validates the current model
 */
function _validate()
{
	HttpUtils.httpReq(
			'GET',
			HttpUtils.url('/validatem',__NO_USERNAME));	
}

/******************************* 'BACKDOOR' API *******************************/
/* highlight the specified node or unhighlight any highlighted nodes... the
 	'followCrossFormalismLinks' parameter indicates whether or not (and which) 
	neighbors along cross-formalism links should also be highlighted... the 
	'timeout' parameter, if specified, indicates the duration of the highlight */
function _highlight(args/*asid[,followCrossFormalismLinks,timeout]*/)
{
	if( args == undefined )
		__unhighlight();
	else
	{
		var uri		= __asid2csuri(args['asid']),
	 		 fcfl		= args['followCrossFormalismLinks'],
			 timeout	= args['timeout'];
		__highlight(uri,fcfl,timeout);
	}
}

function _highlightState(args/*asid[,followCrossFormalismLinks,timeout]*/)
{
    var uri		= __asid2csuri(args['asid']),
        fcfl		= args['followCrossFormalismLinks'],
        timeout	= args['timeout'];
    __highlight(uri,fcfl,timeout);
}

/* unhighlight any highlighted nodes - sadaf */
function _unhighlight()
{
    __unhighlight();
}

/* unhighlight any highlighted nodes - sadaf */
function _unhighlightState(args/*asid*/)
{
    //var uri		= __asid2csuri(args['asid']);
    //__icons[uri]['icon'].unhighlight();
	__unhighlight(__asid2csuri(args['asid']));
}


/* interface to WindowManagement.spawnClient() 'USER' API function */
function _loadModelInNewWindow(args/*fname[,callback-url]*/)
{
	WindowManagement.spawnClient(args['fname'],args['callback-url']);
}

/**
 * Function to load a model in a new window, it's part of Workflows components
 * @param args json that contains the parameter list
 */
function _loadModelInWindow(args/*fname[]*/)
{
	var aid = args['atompmId'];
	var jsontext = args['fname'];
	var res = jsontext.replace('{', '{"');
	var res = res.replace('}', '"}');
	var res = res.replace(/:/g, '":"');
	var res = res.replace(/,/g, '","');
	var res = res.replace(/;/g, ',');
	loc = JSON.parse(res);
	var path = parseInt(aid)+2;
	var msg = parseInt(aid)+1;
	vas = '';
	if (loc[path] == undefined){
		vas = 'VAS';
		path = parseInt(aid);}
	as = loc[aid].indexOf("MM");
	cs = loc[aid].indexOf("Icons");
	tr = loc[aid].indexOf("R_");
	tf = loc[path].indexOf("T_");
	option = '';
	if( as > 0 )
		option = 'AS';
	else if(cs > 0 )
		option = 'CS';
	else if(tr > 0 )
		option = 'TR';
	else if(tf > 0 )
		option = 'TF';
	else if (vas == 'VAS')
		option = 'VAS';
	WindowManagement.spawnClientOption(loc[aid],'',loc[path],option,loc[msg]);
}

/**
 * Function to open a popup dialog for run-time parameters, it's part of Workflows components 
 * @param args list of parameters of the workflow
 */

function _openNewDialog(args)
{
	var jsontext = JSON.stringify(args['args']),
	jsontext=JSON.parse(jsontext),
	ext = args['labels'],
	pid = args['paramId'],
	res = ext.replace('{', '{"'),
	res = res.replace('}', '"}'),
	res = res.replace(/:/g, '":"'),
	res = res.replace(/,/g, '","'),
	msg =  args['msg'];
	if( ext == '{}' )
		WindowManagement.openDialog(_ERROR, 'No parameters to load');
	else {
		ext = JSON.parse(res);		
		data = '';
		i = 0;
		callback = 
			function(inputs) 
		 	{
				for( var x in inputs ){
					if (data){ 
						data += ',';
					}
					lab = jsontext.widgets[i].label;
					n = lab.lastIndexOf("(");
					lab = lab.substring(n);
					i = i + 1;
					t = [];	
					switch(lab) {
						case '(OpenModel)Location@2':
							data += x+':'+inputs[x]+'.'+ext[x];
						break;
						case '(SaveModel)Location@2':
							if (ext[x] == 'Icons.model' || ext[x] == 'Icons.metamodel'|| ext[x] == 'Icons.pattern.metamodel')						
								data += x+':'+inputs[x]+ext[x];
							else
								data += x+':'+inputs[x]+'.'+ext[x];								
						break;
						case '(LoadToolbar)Location@2':
							toolbars = inputs[x].split(";");
							extensions = ext[x].split(";");
							for ( var n in toolbars){
								if (extensions[n] == 'Icons.model' || extensions[n] == 'Icons.metamodel'|| extensions[n] == 'Icons.pattern.metamodel')
									t[n] = toolbars[n]+extensions[n];
								else
									t[n] = toolbars[n]+'.'+extensions[n];
							}
							txt = t.join(";");
							data += x+':'+txt;
						break;
						case '(GeneratePMM)Location@2':
							data += x+':'+inputs[x]+'.'+ext[x];
						break;	
						case '(OpenTransformation)Location@2':
							data += x+':'+inputs[x]+'.'+ext[x];
						break;			
					} 
					_updateAttr({"asid":x,"attr":"Location@2","val":inputs[x]});
				}
				data += ','+msg;				
				data = '{'+data;
				data += '}';
				_updateAttr({"asid":pid,"attr":"parameterList","val":data});
				play = function()
               {
					_httpReq(
                       'PUT',
                       '/__mt/execmode?wid='+__wid,
                       {'mode':'play'});
               };
				_httpReq(
					'PUT',
					'/__mt/current.transform?wid='+__wid,
					{'transfs':['/Formalisms/Workflows/simulate/T_WorkflowsAddDependParam.model'],
					'username':__user},
					play);
			 };
		WindowManagement.openDialog(
				_CUSTOM,
				args['args'],
				 callback);
	}
}

/**
 * Function to load a toolbar in a new window, it's part of Workflows components 
 * @param args json that contains the parameter list
 */
function _loadToolbarInWindow(args/*fname[]*/)	
{
	var aid = args['atompmId'];
	var jsontext = args['fname'];
	var res = jsontext.replace('{', '{"');
	var res = res.replace('}', '"}');
	var res = res.replace(/:/g, '":"');
	var res = res.replace(/,/g, '","');
	var res = res.replace(/;/g, ',');
	loc = JSON.parse(res);
	var path = parseInt(aid)+2;
	var msg = parseInt(aid)+1;
	as = loc[aid].indexOf("SimpleClassDiagram");
	cs = loc[aid].indexOf("ConcreteSyntax");
	tr = loc[aid].indexOf("Rule");
	tf = loc[aid].indexOf("MoTif");
	option = '';
	if( as > 0 )
		option = 'AS';
	else if(cs > 0 )
		option = 'CS';
	else if(tr > 0 )
		option = 'TR';
	else if(tf > 0 )
		option = 'TF';	
	WindowManagement.spawnClientOption(loc[path],loc[aid],option,'',loc[msg]);
}

/**
 * Function to compile a Pattern metamodel, it's part of Workflows components 
 * @param args json that contains the parameter list
 */
function _compilePMMInWindow(args/*fname[]*/)	
{
	var aid = args['atompmId'];
	var jsontext = args['fname'];
	var res = jsontext.replace('{', '{"');
	var res = res.replace('}', '"}');
	var res = res.replace(/:/g, '":"');
	var res = res.replace(/,/g, '","');
	loc = JSON.parse(res);
	console.log(loc[aid]);	
	CompileUtils.compileToPatternMM(loc[aid]);
}

/* tag the specified node with some text, possibly appending it to an existing 
	tag...  the 'timeout' parameter, if specified, indicates how long the tag 
	should be displayed */
function _tag(args/*asid,text[,style,append,timeout]*/)
{
	var uri		= __asid2csuri(args['asid']),
		 text		= args['text'],
		 style	= utils.mergeDicts(
				 		[{'font-size':'16px', 'font-style':'italic', 'fill':'#ffffff'},
						 args['style']]),
		 append	= args['append'],
		 timeout	= args['timeout'];
	__tag(uri,text,style,append,timeout);
}


/* update an attribute of the specified node, possibly highlighting the node to
	indicate the change (note that this doesn't unhighlight any currently 
	highlighted nodes) */
function _updateAttr(args/*asid,attr,val[,highlight]*/)
{
	var uri		= __asid2csuri(args['asid']),
		 changes = {};
	changes[args['attr']] = args['val'];
	DataUtils.update(uri,changes);

	if( args['highlight'] )
		__flash(uri);
}



/******************************** CRUD QUERIES ********************************/

/*************************** HANDLE QUERY RESPONSE ****************************/

/***************************** EDIT CONFLICTS... ******************************/
var __watchList = {};


function __changed(uri,set)
{
	if( set )
		__watchList[uri] = __EDIT_CONFLICT;
	else
		return __watchList[uri] == __EDIT_CONFLICT;
}


//TBC place calls to this appropriately (with CS/AS uris...)
function __unwatch(uri)
{
	delete __watchList[uri];
}


//TBC place calls to this appropriately (with CS/AS uris...)
function __watch(uri)
{
	__watchList[uri] = __NO_CONFLICT;
}


function __watching(uri)
{
	return uri in __watchList;
}



/***************************** MMM-RELATED LOGIC ******************************/

/**************************** CANVAS BEHAVIOUR... *****************************/
/*------------------------ BEHAVIOUR-RELATED UTILITIES -----------------------*/

/*------------------------- SELECTING ICONS/EDGES... -------------------------*/

/*--------------------------- DRAWING CONNECTIONS ----------------------------*/

/*------------------------------ HIGHLIGHTING --------------------------------*/

/*--------------------------------- TAGGING ----------------------------------*/
/* tag the specified node and setup delayed tag removal, when applicable */
function __tag(uri,text,style,append,timeout)
{
	__icons[uri]['icon'].tag(text,style,append);

	if( timeout != undefined )
		window.setTimeout(__icons[uri]['icon'].tag,timeout,'');
}


/*------------------------------- LAYERING... --------------------------------*/
function __iconToBack(tgt)
{
	__icons[__vobj2uri(tgt)]['icon'].toBack();
}

function __iconToFront(tgt)
{
	__icons[__vobj2uri(tgt)]['icon'].toFront();
}

/*---------------------------- LAYOUT -----------------------------*/

function _autolayout()
{
    Layout.autolayout();
}

/*---------------------------- SELECTION OVERLAY -----------------------------*/

/*---------------- GEOMETRY CONTROLS AND TRANSFORMATIONS... ------------------*/

/*-------------------------- CONNECTION EDITING... ---------------------------*/

/************************* GRAPH TRAVERSAL UTILITIES **************************/
/* return the ids of edges connected to the specified node */
function __getConnectedEdges(uri)
{
	var edgeIds = [];
	for( var edgeId in __edges )
		if( __edges[edgeId]['start'] == uri ||
			 __edges[edgeId]['end'] == uri )
			edgeIds.push(edgeId);
	return edgeIds;
}


/* given an edge, returns an array containing that edge's start and/or end
	linktype(s), and its(their) connected edges (which include the given edge) */
function __getConnectionParticipants(edgeId)
{
	var start = __edges[edgeId]['start'],
		 end 	 = __edges[edgeId]['end'],
		 cm	 = [];
	if( __isConnectionType(start) )
	  cm = cm.concat(start, __getConnectedEdges(start));
	if( __isConnectionType(end) )
	  cm = cm.concat(end, __getConnectedEdges(end));
	return cm;
}


/* return all of the edges and nodes directly or indirectly connected to 'uri' 
	via cross-formalism links in direction 'dir'... the meaning of 'dir' follows
	from the convention that cross-formalism link go from higher-level constructs
  	to lower-level ones
 	
	1. filter __edges keeping only cross-formalism ones
	2. if dir is '*' or 'DOWN', recursively navigate the edges from step 1. 
		out of 'uri' marking appropriate nodes and edges
	3. if dir is '*' or 'UP', recursively navigate the edges from step 1. 
		into 'uri' marking appropriate nodes and edges */
function __getCrossFormalismNeighbors(uri,dir)
{
	var crossFormalismEdges = [];
	for( var edgeId in __edges )
		if( __getMetamodel(__edges[edgeId]['start']) !=
			 __getMetamodel(__edges[edgeId]['end']) )
	  		crossFormalismEdges.push(edgeId);


	function _(neighbors,lookfor,append)
	{
		var tovisit	= [uri];
		while( tovisit.length > 0 )
		{
			var curr = tovisit.shift();
	
			neighbors.nodes.push(curr);
			crossFormalismEdges.forEach(
				function(edgeId)
				{
					if( __edges[edgeId][lookfor] == curr )
					{
						var ext = __edges[edgeId][append];
						if( ! utils.contains(neighbors.nodes,ext) )
							tovisit.push(ext);
						if( ! utils.contains(neighbors.edges,edgeId) )
							neighbors.edges.push(edgeId);
					}
				});
		}
		return neighbors;
	}

	var dn = {'nodes':[],'edges':[]}, un = {'nodes':[],'edges':[]};
	if( dir == '*' || dir == 'DOWN' )
		_(dn,'start','end');
	if( dir == '*' || dir == 'UP' )
		_(un,'end','start');

	return {'nodes':utils.toSet(dn.nodes.concat(un.nodes)),
			  'edges':utils.toSet(dn.nodes.concat(un.nodes))};
}



/***************************** HTML-GUI UTILITIES *****************************/

/****************************** SVG... UTILITIES ******************************/

/******************************* MISC UTILITIES *******************************/
/* returns the csuri associated to the given asid */
function __asid2csuri(asid)
{
	for( var uri in __icons )
		if( __icons[uri]['icon'].getAttr('__asuri').
				match(/.*\/(.*)\.instance/)[1] == asid )
			return uri;
}

/* returns the edgeId associated to the given edge DOM element */
function __edge2edgeId(edge)
{
	return edge.parentNode.getAttribute('__edgeId');
}


/* returns both ends contained in the given edgeId */
function __edgeId2ends(edgeId)
{
	if( edgeId in __edges )
		return [__edges[edgeId]['start'],__edges[edgeId]['end']];
	else
		return edgeId.match(/^(.*\.instance)--(.*\.instance)$/).slice(1);
}

/* returns the linkuri associated to the given edgeId */
function __edgeId2linkuri(edgeId)
{
	return __edges[edgeId]['icon'].getAttr('__linkuri');
}


/* filter a list of filenames given the specified extensions */
function __filterFilenamesByExtension(fnames,extensions)
{
	var ffnames = fnames.filter(
			function(fname)
			{
				return extensions.some( 
							function(ext) 
							{
								return fname.match(ext+'$');
							});
			});
	return ffnames;
}


/* return the icon associated to the given csuri or edgeid */
function __getIcon(_)
{
	return (_ in __icons ?
				__icons[_]['icon'] :
				(_ in __edges ?
					 __edges[_]['icon'] :
					 undefined));
}


/* return true if the current model contains no unsaved changes */
function __isSaved()
{
	return ! document.title.match(__TITLE+' - \\+');
}


/* return true if the given element is a toolbar or inside a toolbar */
function __isAToolbar(el)
{
	return Boolean(
				(el.id && el.id.match(/^div_toolbar_/)) 		||
			 	(el.parentNode && __isAToolbar(el.parentNode)) );
}


/* return true if the given element is the canvas or something drawn on it */
function __isCanvasElement(el)
{
	return el.attr("id") == 'div_canvas' ||
			 ( (el.parent().length > 0) && __isCanvasElement(el.parent()));
}


/* returns the $segments hash associated to the given edgeId */
function __linkuri2segments(linkuri)
{
	return utils.jsonp(__icons[linkuri]['icon'].getAttr('__segments'));
}


/* truncate './users/<username>' from a list of filenames */
function __localizeFilenames(fnames)
{
	return fnames.map( 
			function(n) 
			{
				return n.match(/^\.\/users\/.*?(\/.*)/)[1];
			});
}


/* modify a URL as needed to ensure GETting it will produce desired result:
  	. prepend username to user files
	. do nothing for WWW files */
function __relativizeURL(url)
{
	if( url.charAt(0) == '.' || url.charAt(0) == '/' )
		return HttpUtils.url(url,__NO_WID);
	return url;
}


/* returns the csuri of the icon that contains the specified VisualObject */
function __vobj2uri(vobj) {
    if (vobj != document.body) {
        return vobj.parentNode.getAttribute('__csuri') ||
            vobj.parentNode.getAttribute('__linkuri') ||
            __vobj2uri(vobj.parentNode);
    }
}

function __getRecentDir(name) {
	return utils.readCookie('recentDir'+name);
}

function __setRecentDir(name,value) {
	utils.createCookie('recentDir'+name,value);
}
