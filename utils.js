/* This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
*  Copyright 2011 by the AToMPM team and licensed under the LGPL
*  See COPYING.lesser and README.md in the root of this project for full details
*/


var utils = {};


/* return a vobject geometric attribute (i.e., position, etc.) value given its
	current and new values... 

		oldVal		newVal		result
		aa;bbbb		ccccc 		aa;cccc
		aa				ccccc 		aa;cccc */
utils.buildVobjGeomAttrVal = 
	function(oldVal,newVal)
		{
			if( (matches = String(oldVal).match(/^(.*?)(;.*){0,1}$/)) )
				oldVal = matches[1];
			return oldVal+';'+newVal;
		};



utils.clone =	
	function(obj)
	{
		return (obj == undefined ? undefined : utils.jsonp(utils.jsons(obj)));
	};



utils.contains = 
	function(arr,x)
	{
		return arr.indexOf(x) > -1;
	};



/* cause one type to inherit properties from another */
utils.extend = 
	function(child,parent)
	{
		for( var prop in parent.prototype )
		 	if( !(prop in child.prototype) )
		  		child.prototype[prop] = parent.prototype[prop];
	};



/* remove specified elements from the array in-place, and return array */
utils.filter = 
	function(arr,items)
	{
		for( var i=0; i<arr.length; )
			if( utils.contains(items,arr[i]) )
				arr.splice(i,1);
			else
				i++;
		return arr;
	};



/* flatten an array of arrays into a single array */
utils.flatten = 
	function(arrays)
	{
		return (arrays.length == 0 ?
					[] :
					[].concat.apply([], arrays));
	};
	


/* return the given array's first element */
utils.head = 
	function(arr)
	{
		return arr[0];
	};



utils.isArray = 
	function(obj)
	{
		return Object.prototype.toString.call(obj) == '[object Array]';
	};



utils.isObject = 
	function(obj)
	{
		return Object.prototype.toString.call(obj) == '[object Object]';
	};



/* increment the numeric part of a sequence# of the form 'src#number' */
utils.incrementSequenceNumber = 
	function(sn,inc)
	{
		var matches = sn.match(/(.*)#(\d*)/);
		return matches[1]+'#'+(parseInt(matches[2])+(inc == undefined ? 1 : inc));
	};



utils.isHttpSuccessCode = 
	function(statusCode)
	{
		return Math.floor(statusCode/100.0) == 2;
	};



/* decode/encode a json string... in short, replace marked line breaks ('\\n')
	by placeholders so the source json string can be parsed... this enables 
	multiline json values */
utils.jsond =
	function(str,rep)
	{
		if( rep == undefined )
			rep = '\\\n';
		return str.replace(/\/\*newline\*\//g,rep);
	};
utils.jsone =
	function(str)
	{
		return str.replace(/\\\n/g,'/*newline*/');
	};



/* shortcuts for JSON.* functions */
utils.jsonp = 
	function(str)
	{
		return JSON.parse(str);
	};
utils.jsons = 
	function(obj,replacer,space)
	{
		return JSON.stringify(obj,replacer,space);
	};



/* return an array containing all the keys of a hash */
utils.keys = 
	function(hash)
	{
		var keys = [];
		for( var k in hash )
			keys.push(k);
		return keys;
	};



/* return the maximal value in an array given a measurement function */
utils.max = 
	function(arr,measure)
	{
		var max = -Infinity;
		arr.forEach(
				function(_) 
				{
					var meas = measure(_);
					if( meas > max )
						max = meas;
				});
		return max;
	};



/* merge an array of dictionaries into a single dictionary... in case of key 
	clashes, the value in the furthest dictionary is taken */
utils.mergeDicts = 
	function(dicts)
	{
		if( dicts.length == 0 )
			return {};
	
		var merged = {};
		dicts.forEach(
					function(d)
					{
						for( var key in d )
							merged[key] = d[key];
					});
		return merged;
	};



/* escapes regexp special characters from a string (so the string can be used as
  	data within a regexp) */
utils.regexpe = 
	function(str)
	{
		return str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
	};



/* return a dicts keys sorted by value according to the given function */
utils.sortDict = 
	function(dict,sortf)
	{
		var tuples = [];
		for(var key in dict) 
			tuples.push([key, dict[key]]);
	
		tuples.sort( function(a,b) {return sortf(a[1],b[1]);} );
		return tuples.map( function(t) {return t[0];} );
	};



/* remove specified keys from given dictionary (in-place) and return dictionary
  	of removed entries */
utils.splitDict = 
	function(dict,keys)
	{
		var other = {};
		keys.forEach(
				function(k)
				{
					if( k in dict )
					{
						other[k] = dict[k];
						delete dict[k];
					}
				});
		return other;	
	};



/* returns the numeric part of a sequence# of the form 'src#number' */
utils.sn2int = 
	function(sn)
	{
		return parseInt(sn.match(/.*#(\d*)/)[1]);
	};



/* return the given array's last element */
utils.tail = 
	function(arr)
	{
		return arr[arr.length-1];
	};



/* transform the given array into a set (i.e., remove duplicate elements) */
utils.toSet = 
	function(arr)
	{
		var set = [];
		arr.forEach(
				function(_)
				{
					if( ! utils.contains(set,_) )
						set.push(_);
				});
		return set;
	};



/* return an array containing all the values of a hash */
utils.values = 
	function(hash)
	{
		var values = [];
		for( var k in hash )
			values.push(hash[k]);
		return values;
	};

/* creates a cookie with given name and value, which expires after the given
amount of days (undefined == expire when browser closes) */
utils.createCookie =
	function(name,value,days) {
		if (days) {
			var date = new Date();
			date.setTime(date.getTime()+(days*24*60*60*1000));
			var expires = "; expires="+date.toGMTString();
		}
		else var expires = "";
		document.cookie = name+"="+value+expires+"; path=/";
	};

/* returns the value of the cookie with given name */
utils.readCookie =
	function(name) {
		var nameEQ = name + "=";
		var ca = document.cookie.split(';');
		for(var i=0;i < ca.length;i++) {
			var c = ca[i];
			while (c.charAt(0)==' ') c = c.substring(1,c.length);
			if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
		}
		return null;
	};

/* erases the cookie with given name */
utils.eraseCookie =
	function(name) {
		createCookie(name,"",-1);
	};
	
__pendingCalls = {};

/* performs a function after the specified amount of milleseconds
unless this call is repeated during that time interval. If it is,
the timer is reset. 'args' is an array containing arguments for the
function call. */
utils.doAfterUnlessRepeated =
	function(func, args, ms) {
		function doIt() {
			func.apply(undefined, args);
		}
		if (__pendingCalls[func]) {
			clearTimeout(__pendingCalls[func]);
		}
		__pendingCalls[func] = setTimeout(doIt, ms);
	};

/**
 * collapses a changelog for easier printing/logging
 */
utils.collapse_changelog =
	function(changelog){
		let log_chs = []
		if (changelog !== undefined) {
			for (let entry of changelog) {
				let e = {"op": entry["op"]};
				if (entry["name"]) {
					e["name"] = entry["name"]
				}
				log_chs.push(e)
			}
		}
		return log_chs;
	};

/**
 * collapses a hitchhiker for easier printing/logging
 */
utils.collapse_hitchhiker =
	function(hitchhiker){
		let k = []
		if (hitchhiker !== undefined){
			k = Object.keys(hitchhiker);
		}
		return k;
	};

/** Remove invalid characters from a string. **/
utils.__clean_string = function(s)
{
	if (s === undefined) {
		return s;
	}

	s = JSON.stringify(s);
	s = s.replace(/'/g, '');
	s = s.replace(/"/g, '');
	s = s.replace(/‘/g, '');
	s = s.replace(/’/g, '');
	s = s.replace(/\\/g, '\\');
	s = s.replace(/\//g, '\/');
	s = s.replace(/\\n/g, ' ');
	return s;
}

/** Syntactic sugar to build and send HTTP responses **/
utils.respond = function(response, statusCode, reason, data, headers)
{
	response.writeHead(
		statusCode,
		utils.__clean_string(reason),
		(headers || {'Content-Type': 'text/plain',
			'Access-Control-Allow-Origin': '*'}));

	let encoding =
			(headers &&
			(headers['Content-Type'].match(/image/) ||
				headers['Content-Type'].match(/pdf/) 	 ||
				headers['Content-Type'].match(/zip/) 	 ) ?
				'binary' :
				'utf8'),
		content = reason || data;

	if( this.isObject(content) )
		response.end(this.jsons(content,null,'\t'), encoding);
	else
		response.end(content, encoding);
}

/* NOTE: 'exports' exists in back-end 'require', but not in browser import...
			this ensures no errors are reported during browser imports */
var exports = exports || {};
exports.buildVobjGeomAttrVal		= utils.buildVobjGeomAttrVal;
exports.clone	 					= utils.clone;
exports.collapse_changelog			= utils.collapse_changelog;
exports.collapse_hitchhiker			= utils.collapse_hitchhiker;
exports.contains	 				= utils.contains;
exports.extend 						= utils.extend;
exports.filter 						= utils.filter;
exports.flatten 					= utils.flatten;
exports.head						= utils.head;
exports.isArray 					= utils.isArray;
exports.isObject					= utils.isObject;
exports.incrementSequenceNumber 	= utils.incrementSequenceNumber;
exports.isHttpSuccessCode 			= utils.isHttpSuccessCode;
exports.jsond						= utils.jsond;
exports.jsone						= utils.jsone;
exports.jsonp						= utils.jsonp;
exports.jsons						= utils.jsons;
exports.keys						= utils.keys;
exports.max							= utils.max;
exports.mergeDicts					= utils.mergeDicts;
exports.regexpe						= utils.regexpe;
exports.respond						= utils.respond;
exports.sortDict					= utils.sortDict;
exports.splitDict					= utils.splitDict;
exports.sn2int 						= utils.sn2int;
exports.tail						= utils.tail;
exports.toSet	 					= utils.toSet;
exports.values 						= utils.values;
exports.createCookie				= utils.createCookie;
exports.readCookie					= utils.readCookie;
exports.eraseCookie					= utils.eraseCookie;
exports.doAfterUnlessRepeated		= utils.doAfterUnlessRepeated;
