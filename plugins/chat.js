/* Chat plugin for collaboration, need to list available users.
, and notify when the message comes in by flashing chat "Open" link*/
{
	'interfaces'	: [{'method':'POST', 'url=':'/chat'}],


	'localcontext'	: {'messages':[]},


	'csworker'		: 
		function(resp,method,uri,reqData,wcontext)
		{
			var self = this;
			_do.chain(
				[__wHttpReq(method, uri+'?wid='+wcontext.__aswid, reqData)])(
				function()
				{
					self.localcontext.messages.push(reqData);
					__postMessage(
						{'statusCode':200, 
						 'changelog':
						 	[{'op':'CHAT', 
						 	 'text':self.localcontext.messages.pop()}],
						 'sequence#':__sequenceNumber(),
						 'respIndex':resp});
				},
				function(err) 	{__postInternalErrorMsg(resp,err);}
			);	
		},


	'asworker'		: 
		function(resp,method,uri,reqData,wcontext)
		{
		__postMessage(
				{'statusCode':200, 
				 'changelog':
				 	[],
				 'sequence#':__sequenceNumber(),
				 'respIndex':resp});
			
		}
}
