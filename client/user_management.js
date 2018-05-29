/* This file is part of AToMPM - A Tool for Multi-Paradigm Modelling
*  Copyright 2011 by the AToMPM team and licensed under the LGPL
*  See COPYING.lesser and README.md in the root of this project for full details
*/

/**
 * Creates the User Management object
 */
UserManagement = function(){
	
	/**
	 * Returns whether or not there is a current user logged in
	 */
	this.isUserLoggedIn = function()
	{
		return window.localStorage.getItem('user');
	};
	
	/**
	 * Logs in the current user
	 * @param username the user to log in
	 */
	this.login = function(username)
	{
		__user = username;
		window.localStorage.setItem('user',__user);
		__initClient();
	};
	
	/**
	 * Logs out the current user
	 */
	this.logout = function()
	{
		function innerLogout()
		{
			__user = undefined;
			window.localStorage.removeItem('user');
			window.location = window.location.href;
		}
	
		if( __prefs && __prefs['confirm-exit']['value'] && ! __isSaved() )
			WindowManagement.openDialog(_CUSTOM, {'widgets':[], 'title':__EXITWARNING}, innerLogout);
		else
			innerLogout();
	};
	
	/**
	 * Creates a new user
	 * @param username the username of the new user
	 * @param password the password for the user
	 */
	this.signup = function(username,password)
	{
		$('#div_signup_error').html('');
		HttpUtils.httpReq(
			'POST',
			'/user?username='+username+'&password='+Sha1.hash(password),
			undefined,
			function(statusCode,resp)
			{
				if( ! utils.isHttpSuccessCode(statusCode) )
					$('#div_signup_error').html(
						'acccount creation failed :: '+resp);
				else 
				{
					WindowManagement.hideLoginScreen();
					login(username);
				}
			});
	};
	
	/**
	 * Validates the associated username with a password
	 * @param username the user the validate
	 * @param password the password to validate against
	 */
	this.validateCredentials = function(username,password)
	{
		$('#div_login_error').html('');
		HttpUtils.httpReq(
			'GET',
			'/passwd',
			'?username='+username,
			function(statusCode,resp)
			{
				if( ! utils.isHttpSuccessCode(statusCode) )
					$('#div_login_error').html('login failed, user ' + username + ' not found or network error');
				else if( resp != Sha1.hash(password) )
					$('#div_login_error').html('incorrect password');
				else			
				{
					WindowManagement.hideLoginScreen();
					login(username);
				}
			});
	};
	
	return this;
}();