/* a simple hello world plugin... it listens for "POST /hello" requests... requests are received by "csworker" and forwarded to "asworker"... both respond with their __worker\'s id and with a counter of the number of handled requests */
const {
    __errorContinuable,
    __httpReq,
	__wHttpReq,
    __postInternalErrorMsg, __postMessage,
    __sequenceNumber,
    __successContinuable,
	__uri_to_id
} = require("../__worker");

const _do = require("../___do");

module.exports = {
	'interfaces'	: [{'method':'POST', 'url=':'/hello'}],


	'localcontext'	: {'counter':0},


	'csworker'		: 
		function(resp,method,uri,reqData,wcontext)
		{
			var self = this;
			_do.chain(
				[__wHttpReq(method, uri+'?wid='+wcontext.__aswid, reqData)])(
				function()
				{
					self.localcontext.counter++;
					__postMessage(
						{'statusCode':200, 
						 'changelog':
						 	[{'op':'SYSOUT', 
						 	 'text':'Hello #'+self.localcontext.counter+' from csworker #'+__wid}],
						 'sequence#':__sequenceNumber(),
						 'respIndex':resp});
				},
				function(err) 	{__postInternalErrorMsg(resp,err);}
			);	
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
};
