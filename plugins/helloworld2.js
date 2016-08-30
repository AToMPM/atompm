/* a more advanced hello world plugin... it listens for "POST /hello.cs", "POST /hello.as" and "POST /hello" requests... "POST /hello.cs" requests are received and handled by "csworker"... "POST /hello.as" requests are received by "csworker" and forwarded to "asworker" for handling... "POST /hello" requests trigger a misuse error */
{
	'interfaces'	: 
		[{'method':'POST', 'urlm':'^/hello\.[ac]s$'},
		 {'method':'POST', 'url=':'/hello'}],


	'localcontext'	: {'counter':0},


	'csworker'		: 
		function(resp,method,uri,reqData,wcontext)
		{
			if( uri.match(/\/hello.cs$/) )
			{
				this.localcontext.counter++;
				__postMessage(
						{'statusCode':200, 
						 'changelog':
						 	[{'op':'SYSOUT', 
						 	 'text':'Hello #'+this.localcontext.counter+' from csworker #'+__wid}],
						 'sequence#':__sequenceNumber(),
						 'respIndex':resp});
			}

			else if( uri.match(/\/hello.as$/) )
				_do.chain(
					[__wHttpReq(method, uri+'?wid='+wcontext.__aswid, reqData)])(
					function() 
					{
						__postMessage(
							{'statusCode':200, 
							 'respIndex':resp});
					},
					function(err) 	{__postInternalErrorMsg(resp,err);}
				);	

			else if( uri.match(/\/hello$/) )
				__postInternalErrorMsg(resp,'must request /hello.cs or /hello.as');
		},
	

	'asworker'		: 
		function(resp,method,uri,reqData,wcontext)
		{
			this.localcontext.counter++;
			__postMessage(
					{'statusCode':200, 
					 'changelog':
					 	[{'op':'SYSOUT', 
						 'text':'Hello #'+this.localcontext.counter+' from asworker #'+__wid}],
					 'sequence#':__sequenceNumber(),
					 'respIndex':resp});
		}
}

