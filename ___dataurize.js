/* This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
*  Copyright 2011 by the AToMPM team and licensed under the LGPL
*  See COPYING.lesser and README.md in the root of this project for full details
*/


/* return a datauri encoding of the resource at the given url */
exports.dataurize = 
	function(url,callback)
	{
		var request = 
			require('http').request(
				{'host':url.hostname || '127.0.0.1', 
				 'port':url.port 		|| 80, 
				 'path':url.path 		|| '/'},
				function(resp)
				{
					var data = '';
					resp.setEncoding('binary');
					resp.on('data', function(chunk) {data += chunk;});
					resp.on('end',
						function()
						{
							if( resp.statusCode == 200 )
								callback(
									undefined,
									'data:'+resp.headers['content-type']+';base64,'+
										new Buffer(data,'binary').toString('base64'));
							else
								callback({'statusCode':resp.statusCode, 'reason':data});
						});
				});
			 request.on('error',
				 function(err)
				 {
					 callback({'statusCode':0, 'reason':err});
				 });
	
			 request.end();
		};

