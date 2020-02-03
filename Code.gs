
// Taken from the Gist as the library wasn't using the latest version
//
// https://gist.github.com/patt0/8395003

/**
 *  ---  Continous Execution Library ---
 *
 *  Copyright (c) 2013 Patrick Martinent
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
 
// Constants
// ---------
 
// Object
// ------
 
var CBL_DISABLE_ = false

// For testing needs to be at least 45s to stop them overlapping, but the 
// timeout has to be less than this or they'll overlap
// var CBL_NEXT_TRIGGER_MS_ = 2 * 60 * 1000
var CBL_NEXT_TRIGGER_MS_ = 7 * 60 * 1000 // 7 mins

var CBL_FORCE_TIMEOUT_ = true

// var TIME_RUN_OUT_SECONDS = 30
var CBL_TIME_RUN_OUT_SECONDS_ = 300

var CBL_BATCH_FUNCTION_NAME_ = 'xxxxxxxxxxxxxx'
  
// CBL Library
// -----------

var CBL_ = (function() {

var interationStart

return {

/*************************************************************************
* Call this function at the start of your batch script
* it will create the necessary ScriptProperties with the fname
* so that it can keep managing the triggers until the batch
* execution is complete. It will store the start time for the
* email it sends out to you when the batch has completed
*
* @param {fname} str The batch function to invoke repeatedly.
*/

startOrResumeContinousExecutionInstance: function(fname){

  if (CBL_DISABLE_) {
    return
  }

  var properties = PropertiesService.getScriptProperties();
  var start = properties.getProperty('GASCBL_' + fname + '_START_BATCH');
  
  if (start === "" || start === null) {
    start = new Date();
    properties.setProperty('GASCBL_' + fname + '_START_BATCH', start);
    properties.setProperty('GASCBL_' + fname + '_KEY', "");
  }
  
  interationStart = new Date();
  
  deleteCurrentTrigger_(fname);
  enableNextTrigger_(fname); 
},
 
/*************************************************************************
* In order to be able to understand where your batch last executed you
* set the key ( or counter ) everytime a new item in your batch is complete
* when you restart the batch through the trigger, use getBatchKey to start 
* at the right place
*
* @param {fname} str The batch function we are continuously triggering.
* @param {key} str The batch key that was just completed.
*/

setBatchKey: function (fname, key){
  var properties = PropertiesService.getScriptProperties();
  properties.setProperty('GASCBL_' + fname + '_KEY', key);
},
 
/*************************************************************************
* This function returns the current batch key, so you can start processing at
* the right position when your batch resumes from the execution of the trigger
*
* @param {fname} str The batch function we are continuously triggering.
* @returns {string} The batch key which was last completed.
*/

getBatchKey: function (fname){
  var properties = PropertiesService.getScriptProperties();
  return properties.getProperty('GASCBL_' + fname + '_KEY');
},

/*************************************************************************
* When the batch is complete run this function, and pass it an email and
* custom title so you have an indication that the process is complete as
* well as the time it took
*
* @param {fname} str The batch function we are continuously triggering.
* @param {emailRecipient} str The email address to which the email will be sent.
* @param {customTitle} str The custom title for the email.
*/

endContinuousExecutionInstance: function (fname, emailRecipient, customTitle){

  if (CBL_DISABLE_) {
    return
  }

  var properties = PropertiesService.getScriptProperties();
  var end = new Date();
  var start = properties.getProperty('GASCBL_' + fname + '_START_BATCH');
  var key = properties.getProperty('GASCBL_' + fname + '_KEY');
 
  var emailTitle = customTitle + " : Continuous Execution Script for " + fname;
  var body = "Started : " + start + "<br>" + "Ended :" + end + "<br>" + "LAST KEY : " + key;
  
  if (emailRecipient) {
    MailApp.sendEmail(emailRecipient, emailTitle, "", {htmlBody:body});
  }
  
  deleteCurrentTrigger_(fname);
  properties.deleteProperty('GASCBL_' + fname + '_START_BATCH');
  properties.deleteProperty('GASCBL_' + fname + '_KEY');
  properties.deleteProperty('GASCBL_' + fname);
},
 
/*************************************************************************
* Call this function when finishing a batch item to find out if we have
* time for one more. if not exit elegantly and let the batch restart with
* the trigger
*
* @param {fname} str The batch function we are continuously triggering.
* @returns (boolean) whether we are close to reaching the exec time limit
*/

isTimeRunningOut: function (fname){

  if (CBL_DISABLE_) {
    return
  }

  if (CBL_FORCE_TIMEOUT_) {
    return true
  }

  if (!(interationStart instanceof Date)) {
    throw new Error('CBL_ not initialised - call CBL_.startOrResumeContinousExecutionInstance() first')
  }
  
  var now = new Date();  
  var timeElapsed = Math.floor((now.getTime() - interationStart.getTime())/1000);
  return (timeElapsed > CBL_TIME_RUN_OUT_SECONDS_);
},

} // CBL_ object return

// Private functions
// -----------------

/*
* Set the next trigger
*/

function enableNextTrigger_(fname) {

  var properties = PropertiesService.getScriptProperties();
  
  var nextTrigger = Utils.rateLimitExpBackoff(function() {
    return ScriptApp.newTrigger(fname).timeBased().after(CBL_NEXT_TRIGGER_MS_).create();
  })
  
  var triggerId = nextTrigger.getUniqueId();
 
  properties.setProperty('GASCBL_' + fname, triggerId);
}
 
/*
* Deletes the current trigger, so we don't end up with undeleted
* time based triggers all over the place
*/

function deleteCurrentTrigger_(fname) {

  var properties = PropertiesService.getScriptProperties();
  var triggerId = properties.getProperty('GASCBL_' + fname);
  var triggers = ScriptApp.getProjectTriggers();
  
  for (var i in triggers) {
  
    if (triggers[i].getUniqueId() === triggerId) {

      Utils.rateLimitExpBackoff(function() {
        ScriptApp.deleteTrigger(triggers[i]);
      })
      
      break;
    }
  }
  
  PropertiesService.getScriptProperties().setProperty('GASCBL_' + fname, "");
}

})() // CBL_  