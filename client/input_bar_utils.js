/* This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
*  Copyright 2011 by the AToMPM team and licensed under the LGPL
*  See COPYING.lesser and README.md in the root of this project for full details
*/

InputBarUtils = function(){
	this.processKey = function( event ){
		if( event.keyCode == KEY_ENTER ){
			
			var query = $('#mainInput')[0].value.split('(')[0].trim();
			var acceptedQueries = ["getCount", "toggleIncUpdate"];
			
			if(query=="help"){
				alert("See the text in the developer console (In Chrome, press F12)");
                console.log("WARNING :: All commands can be issued after a transformation is loaded!");
				console.log("INFO :: You can query the graph before/during/after a transformation using this system.");
				console.log("INFO :: Available queries: "+acceptedQueries.toString());
				console.log("INFO :: Query usage help");
				console.log("getCount :: type 'getCount(\"TypeName\")' to get the number of a specific type in the graph");
				console.log("getCount :: You can get the type names in the attribute popup of each element.");
                console.log("toggleIncUpdate :: type 'toggleIncUpdate()' to toggle incremental updates (default is on, which will update the model at each step)");
                console.log("toggleIncUpdate :: If you turn incremental updates off, the model will be updated at the end.");
			}
			else if ($.inArray(query, acceptedQueries) > -1) {	
				console.log("Query '"+query+"' sent! Waiting for reply.");
				HttpUtils.httpReq(
						'PUT',
						'/__mt/query.transform?wid='+__wid,
						{'query':$('#mainInput')[0].value.trim()});
			} else {
				console.log("ERROR :: Query '"+query+"' is not accepted.\n\tAccepted queries: "+acceptedQueries.toString());
			}
			
		}
	};
	
	return this;
}();
