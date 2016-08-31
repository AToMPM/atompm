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