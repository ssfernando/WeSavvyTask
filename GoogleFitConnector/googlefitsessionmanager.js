/**
 * Created by Fernando on 10/18/2015.
 *
 */
var google = require('googleapis'), fitnessApi = google.fitness('v1');
var readline = require('readline');
var fs = require('fs');
var googleFitDatasetsManager = require('./googlefitdatasetsmanager.js');

var oauth2;

var SESSIONS_PATH = './sessions.json';

var dataSourceDistance;
var sessionsFound = null;

/**
 * Manage Session of Google Fit API
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
module.exports = function (auth, dataSource) {
  oauth2 = auth;
  dataSourceDistance = dataSource;
  startReadlineInterface()
};

function startReadlineInterface() {
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter code 1 to list, 2 to update/create and 3 to delete Sessions, 4 to continue or 0 to exit: ',
    function (code) {
    rl.close();
    if (code === '1') {
      listSessionsAPI();
    } else if (code === '2') {
      updateSessionAPI();
    } else if (code === '3') {
      deleteSessionsAPI();
    } else if (code === '4'){
      startDatasetsManager();
    } else if (code === '0'){
      process.exit();
    }
  });
}

function listSessionsAPI() {
  fitnessApi.users.sessions.list({
    auth: oauth2,
    userId: 'me'
  }, function (err, response) {
    if (err) {
      showApiError(err);
      return;
    }
    if (response.session != null && response.session.length > 0) {
      response.session.sort(function(a, b) {
        return (a.id - b.id);
      });
    }
    printListSessions(response.session, 'founded');
  });
}

function updateSessionAPI() {
  var sessionsUpdated = [];
  fs.readFile(SESSIONS_PATH, function(err, sessionsBuffer) {
    var sessions = JSON.parse(sessionsBuffer);
    if (err) {
      console.log('File of Sessions doesn\'t exist!');
      process.exit();
    } else {
      for (var i = 0; i < sessions.length; i++) {
        fitnessApi.users.sessions.update({
          auth: oauth2,
          userId: 'me',
          sessionId: i + 1,
          resource: sessions[i]
        }, function (err, response) {
          if (err) {
            showApiError(err);
            return;
          }
          sessionsUpdated.push(response);
          sessionsUpdated.sort(function(a, b) {
            return (a.id - b.id);
          });
        });
      }
      setTimeout(printListSessions, 2000, sessionsUpdated, 'created');
    }
  });
}

function deleteSessionsAPI() {
  fitnessApi.users.sessions.list({
    auth: oauth2,
    userId: 'me'
  }, function (err, response) {
    if (err) {
      showApiError(err);
      startReadlineInterface();
      return;
    }
    var sessions = response.session;
    if (sessions != null && sessions.length > 0) {
      for (var i = 0; i < sessions.length; i++) {
        fitnessApi.users.sessions.delete({
          auth: oauth2,
          userId: 'me',
          sessionId: i + 1
        }, function (err, response) {
          if (err) {
            showApiError(err);
          }
        });
      }
      printListSessions(sessions, 'deleted');
    } else {
      console.log('No sessions found for delete!');
      startReadlineInterface();
    }
  });
}

function startDatasetsManager() {
  if (sessionsFound != null && sessionsFound.length > 0) {
    googleFitDatasetsManager(oauth2, dataSourceDistance, sessionsFound);
  } else {
    console.log('List sessions to verify if have any created!');
    startReadlineInterface();
  }
}

function printListSessions(sessions, actionName) {
  if (sessions == null || sessions.length == 0) {
    console.log('No Sessions found.');
  } else {
    if (actionName !== 'deleted') {
      sessionsFound = sessions;
    } else if (actionName === 'deleted') {
      sessionsFound = null;
    }
    console.log('Sessions ' + actionName + ':');
    for (var i = 0; i < sessions.length; i++) {
      console.log('%s: %s (id: %s)', sessions[i].name, sessions[i].description,
        sessions[i].id);
    }
  }
  startReadlineInterface();
}

function showApiError(err) {
  console.log('The API returned an error: ' + err);
}