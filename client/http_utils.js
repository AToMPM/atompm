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

//Todo: replace this with JQuery
//This remains outside for easier replacement later down the line
/**
 * Basic element getter
 */
//function $(id) 
//{
//  return document.getElementById(id);
//}

/**
 * The HTTP Utils object is a utility function that allows for
 * AToMPM to send HTTP requests
 */
HttpUtils = function(){
	/**
	 * Generates an HTTP request
	 */
	this.httpReq = function(method,url,params,onresponse,sync)
	{
		console.debug('??? '+method+' '+url, params);
		var req = new XMLHttpRequest();
		var onreadystatechange = function(ev) {
			 if( req.readyState == 4 )
			 {
	 			 console.debug(method+' '+url+' >> '+req.status);
				 if( req.status == 0 )
	 				 WindowManagement.openDialog(__FATAL_ERROR,'lost connection to back-end');
				 else if( onresponse )
					 onresponse(req.status,req.responseText);
				 else if( ! utils.isHttpSuccessCode(req.status) )
	 				 WindowManagement.openDialog(_ERROR,req.responseText);
			 }
 		 };
	
		if( method == 'GET' || method == 'DELETE' )
		{
//			console.log(method);
//			console.log(url);
//			console.log(params);
//			console.log(onresponse);
//			console.log(sync);
			req.open(method, url+(params ? params : ''), !sync);
			req.onreadystatechange = onreadystatechange;
			req.send(null);  
		}
		else if( method == 'POST' || method == 'PUT' )
		{
//			console.debug(method);
//			console.debug(url);
//			console.debug(params);
//			console.debug(onresponse);
//			console.debug(sync);
//			console.debug(utils.jsons(params));
			req.open(method, url, !sync); 
			req.onreadystatechange = onreadystatechange;
			req.send(utils.jsons(params));
		}
	};
	
	
	/**
	 * Construct a complete and valid backend URL
	 */
	this.url = function(uri,options,wid)
	{
//		console.log("Calling url");
		wid = (wid == undefined ? __wid : wid);
		return (options & __FORCE_GET ? '/GET' : '')+
				 (options & __NO_USERNAME ? '' : '/'+__user)+
	 			 (uri.charAt(0) == '/' ? uri : '/'+uri)+
	 			 (options & __NO_WID ? '' : '?wid='+wid);
	};
	
	/**
	 * Returns a file browser icon given the specified filename
	 */
	this.getFileIcon = function(fname)
	{
//		console.log("Calling getFileIcon " + fname);
		var src = '';
		if( fname.match(/\/$/) )
			src = 'client/media/fileb_folder.png';
		else if( fname.match(/\.pattern\.metamodel$/) )
			src = 'client/media/fileb_patternmm.png';
		else if( fname.match(/\..*Icons\.metamodel$/) )
			src = 'client/media/fileb_csmm.png';
		else if( fname.match(/\.metamodel$/) )
			src = 'client/media/fileb_asmm.png';
		else if( fname.match(/\.model$/) )
			src = 'client/media/fileb_m.png';
		else
			src = 'client/media/fileb_unknown.png';
	
	
		var span = $('<span>'),
			 img  = $('<img>'),
			 txt  = GUIUtils.getTextSpan( 
						 fname.match(/\/$/) ? fname.substring(0,fname.length-1) : fname,
	 					 'default_style clickable');
		img.attr("src", src)
			.attr("class", 'clickable');
		
		span.attr("class", 'fileb_icon');
//		img.attr("class", 'clickable');
		txt.css("padding", '5px');
		
		span.append(img);
		span.append(txt);
		
		return span;
	};
	
	/**
	 * Returns the new file icon
	 */
	this.getNewFileIcon = function(oninput,caption)
	{
//		console.log("Calling get new file icon " + caption);
		var span   = $('<span></span>'),
			 img    = $('<img></img>'),
			 txt  = GUIUtils.getTextSpan(
							 caption || '&lt;new file&gt;',
							 'default_style clickable');
		img.attr("src", 'client/media/fileb_newf.png');
		span.addClass('fileb_icon');
		img.addClass('clickable');
		txt.css("padding", '5px');
		txt.css("fontStyle", 'italic');
		txt.attr("contentEditable", true);
		// JQuery does not support HTML5 oninput
		txt.keyup( oninput );
		span.append(img);
		span.append(txt);
		return span;
	};
	
	/**
	 * Gets the selected entry in a Select input
	 */
	this.getSelectorSelection = function(select)
	{
		var selection = [];
		var options = select.children("option");
		for( var i = 0; i < options.length; i++) 
			if( $(options[i]).prop("selected") )
				selection.push( $(options[i]).html() );
		
		return selection;
	};
	
	
	/* given a path to an image, produce a data uri that 'describes' the image
	
		NOTE:: due to browser restrictions, cross-domain images need to be processed
				 by the backend */
	this.imageToDataURI = function(url,callback)
	{
		if( url.match('^\/'+__user+'/') )
		{
			var canvas = $('<canvas>'),
				 img	  = $('<img>');
	
			img.onload(
				function()
				{
					canvas.attr("width", img.attr("width") );
					canvas.attr("height", img.attr("height") );
					canvas.get().getContext('2d').drawImage(img, 0, 0);
					callback(canvas.get().toDataURL());
				});
			img.attr("src", url);
		}
		else
			httpReq(
				'GET',
				'/datauri?target='+encodeURIComponent(url),
				undefined,
				function(statusCode,resp)
				{
					if( ! utils.isHttpSuccessCode(statusCode) )
						callback(__DEFAULT_IMG_DATAURI);
					else
						callback(resp);
				});
	};
	
	/**
	 * Removes all children from a node
	 */
	this.removeChildren = function(node) 
	{
		node.empty();
//		while(node.children().length > 0 ) 
//			node.first().remove();
	};
	
	/**
	 * Attempt to evaluate user code.
	 * I don't understand why this is called "safeEval"
	 * though, considering this will execute
	 * anything passed in
	 */
	this.safeEval = function(code)
	{
		var _context = {
				'username':__user,
				'wid':__wid,
				'mms':utils.keys(__loadedToolbars).filter(__isIconMetamodel)};
		try			{eval(code); return {};}
		catch(err)	
		{
			if( err['$err'] )	return err;
			else 					return {'$uerr':err};
		}
	};
	
	return this;
}();