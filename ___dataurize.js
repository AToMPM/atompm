/*******************************************************************************
AToMPM - A Tool for Multi-Paradigm Modelling

Copyright (c) 2011 Raphael Mannadiar (raphael.mannadiar@mail.mcgill.ca)

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


/* return a datauri encoding of the resource at the given url */
exports.dataurize = 
	function(url,callback)
	{
		var request = 
			require('http').request(
				{'host':url.hostname || 'localhost', 
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

