var request = require('urllib-sync').request;
var fs	= require('fs-extra');



var restAdminKey = 'nr_admin_key';
var insightsApiKey = 'insight_insert_key';
var accountId = eu_account_id;


var notificationChannelName = 'Insights Alerts Webhook';
var dashboardTitle = 'Alerts Overview';
/////

// 1. Query Notifications
var notificationList = getCurrentNotifications()

// 2. Create NotificationChannel (If necessary)
var insightsWebhookNotification = createNotificationChannel(notificationList);

/* 3. Query Policies
var policyList = getPolicyList();

// 5. Iterate Policies,	Bind Notification Channel 
bindNotificationToPolicies(insightsWebhookNotification, policyList);
*/

//6. Create Dashboard If Necessary 
if(!hasDashboardDeployed()){
	deployDashboard();	
}

//======================================================================================

// 1. Query Notifications
function getCurrentNotifications() {
	
	var options = {
	    headers: {
	        'X-Api-Key': restAdminKey
	    },
	    timeout: 15000,
	    dataType: 'json'
	};
		
	var res = request('https://api.eu.newrelic.com/v2/alerts_channels.json', options);
	if (res.err || res.status != 200) {
		console.log("Error Requesting Current Notifications: ", res.err, res.status);
		throw new Error("Error Requesting Current Notifications");
	}

	console.log("Current Notification Channel List (total:" + res.data.channels.length + ")");
	return res.data.channels;	
}

// 2. Create NotificationChannel (If necessary)
function createNotificationChannel(notificationList){

	// iterating through notifications, simple search by name
	for(n in notificationList){
		if(notificationList[n].name === notificationChannelName){
			console.log("Insights Alerts Webhook found, not creating a new one");
			//already created, don't bother
			return notificationList[n].id; //sending just id, this is what we need for binding
		}
	}
	
	// notification channel not found, creating it
	var data = {
	  "channel": {
		  	"name": notificationChannelName,
	    		"type": "webhook",
	    		"configuration": {			        
		    		"base_url": 'https://insights-collector.newrelic.com/v1/accounts/'+accountId+'/events',
		    		"payload_type": "application/json",
		    		"payload": {"eventType": "Alerts",
		    	          "account_id": "$ACCOUNT_ID",
		    	          "account_name": "$ACCOUNT_NAME",
		    	          "condition_id": "$CONDITION_ID",
		    	          "condition_name": "$CONDITION_NAME",
		    	          "current_state": "$EVENT_STATE",
		    	          "details": "$EVENT_DETAILS",
		    	          "event_type": "$EVENT_TYPE",
		    	          "incident_acknowledge_url": "$INCIDENT_ACKNOWLEDGE_URL",
		    	          "incident_id": "$INCIDENT_ID",
		    	          "incident_url": "$INCIDENT_URL",
		    	          "owner": "$EVENT_OWNER",
		    	          "policy_name": "$POLICY_NAME",
		    	          "policy_url": "$POLICY_URL",
		    	          "runbook_url": "$RUNBOOK_URL",
		    	          "severity": "$SEVERITY",
		    	          "targets": "$TARGETS",
		    	          "timestamp": "$TIMESTAMP",
		    	          "violation_chart_url": "$VIOLATION_CHART_URL"},
		    		"headers": {"X-Insert-Key": insightsApiKey}
			}
		}
	};
	
	var createNewChannelUrl = 'https://api.eu.newrelic.com/v2/alerts_channels.json';
	var opts = {
			method: 'POST',
			   headers: {
			       'X-Api-Key': restAdminKey,
			       'Content-Type': 'application/json',
			       'Accept': 'application/json'
			    },
			    timeout: 15000,
			    data: data,
			    dataType: 'json'
			};
	
	console.log("Creating Notification Full Details = URL: " + createNewChannelUrl + ", Options: " + JSON.stringify(opts) + '\n');
	
	var res = request(createNewChannelUrl, opts);
	if (res.err || res.status != 201){
		console.log("Error creating Notification Channel. " + res.err, res.status);
		throw new Error("Error creating Notification Channel");
	}

	console.log("Created Notification Channel (Webhook) with the following details = " + JSON.stringify(res.data) + '\n');

	return res.data.channels[0].id;
}

// 3. Query Policies
function getPolicyList(){
	
	var options = {
		headers: {
	        'X-Api-Key': restAdminKey
	    },
	    timeout: 15000,
	    dataType: 'json'
	};
	
	var res = request('https://api.eu.newrelic.com/v2/alerts_policies.json', options);
	if (res.err || res.status != 200) {
		console.log("error requesting policies: ", res.err, res.status);
		throw new Error("Error retrieving legacy alert policies");
	}

	console.log("Getting Current Policies List (total:" + res.data.policies.length + ")");
	return res.data.policies;	
}


// 5. Iterate Policies,	Bind Notification Channel 
function bindNotificationToPolicies(channelId, policyList){

	var linkChannelUrl = 'https://api.eu.newrelic.com/v2/alerts_policy_channels.json';

	for(p in policyList){
		var data = {'policy_id': policyList[p].id, 'channel_ids': channelId};
		
		var opts = {
				method: 'PUT',
				   headers: {
				       'X-Api-Key': restAdminKey,
				       'Content-Type': 'application/json',
				       'Accept': 'application/json'
				    },
				    timeout: 15000,
				    data: data,
				    dataAsQueryString: true
				};
		
		console.log("Linking Notification Channel " + channelId + " to Policy " + policyList[p].id + " Full Details = URL: " + linkChannelUrl + ", Options: " + JSON.stringify(opts) + '\n');
		
		var res = request(linkChannelUrl, opts);
		if (res.err || res.status != 200){
			console.log("Error binding NotificationChannel to Policy  " + res.err, res.status);
			throw new Error("Error binding NotificationChannel to Policy");
		}
	
		console.log("Linked Webhook with the following details = " + JSON.stringify(res) + '\n');
	}
}

// A. Query Dashboards for DashName
function hasDashboardDeployed(){
	
	var options = {
			headers: {
		        'X-Api-Key': restAdminKey
		    },
		    timeout: 15000,
		    data: 'filter[title]=' + dashboardTitle.replace(/\s/g, '+'),
		    dataType: 'json'
		};
		
		var res = request('https://api.eu.newrelic.com/v2/dashboards.json', options);
		if (res.err || res.status != 200) {
			console.log("error requesting policies: ", res.err, res.status);
			throw new Error("Error retrieving legacy alert policies");
		}

		return res.data.dashboards.length != 0;
}

// B. Deploy Sample Dashboard (If necessary)
function deployDashboard(){
	
	var dashfile = JSON.parse(fs.readFileSync( __dirname + '/dashboard.json'));
	console.log(dashfile);
	
	var options = {
			headers: {
		        'X-Api-Key': restAdminKey,
		        'Content-Type':'application/json'
		    },
		    method: 'POST',
		    timeout: 15000,
		    data: dashfile,
		    dataType: 'json'
		};
		
		var res = request('https://api.eu.newrelic.com/v2/dashboards.json', options);
		if (res.err || res.status != 200) {
			console.log("error creating dashboard:", res.err, res.status);
			throw new Error("Error creating dashboard");
		}
		console.log(res.data.dashboard);
}

