/* a simple plugin that outputs some general information about a model... the point here is to demo how to use _mmmk from a plugin */
{
	'interfaces'	: [{'method':'GET', 'url=':'/stats'}],


	'localcontext'	: {},

	
	'types2instances' :
		function()
		{
			var model = _utils.jsonp(_mmmk.read()),
				 t2i	 = {};
console.warn(model, typeof(model))			
			for( var id in model.nodes )
			{
				var node = model.nodes[id];
				t2i[node['$type']] = t2i[node['$type']] || 0;
				t2i[node['$type']]++;
			}
			return _utils.jsons(t2i,null,'\t');
		},


	'csworker'		: 
		function(resp,method,uri,reqData,wcontext)
		{
			var self = this;
			_do.chain(
				[__wHttpReq(method, uri+'?wid='+wcontext.__aswid, reqData)])(
				function()
				{
					__postMessage(
							{'statusCode':200, 
							 'changelog':
								 [{'op':'SYSOUT', 
								 	'text':'CS MODEL STATS\n'+self.types2instances()}],
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
						 [{'op':'SYSOUT', 
						 	'text':'AS MODEL STATS\n'+this.types2instances()}],
  					 'sequence#':__sequenceNumber(),
					 'respIndex':resp});
		}
}


