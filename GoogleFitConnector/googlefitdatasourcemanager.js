/**
 * Created by Fernando on 10/17/2015.
 *
 */
var google = require('googleapis'), fitnessApi = google.fitness('v1');
var readline = require('readline');
var fs = require('fs');
var googleFitSessionManager = require('./googlefitsessionmanager.js');

var oauth2;

var DATA_SOURCES_PATH = './datasources.json';

var DISTANCE_DATA_TYPE_NAME = 'com.google.distance.delta';
var dataSourceDistance = null;

/**
 * Manage Data Sources of Google Fit API
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
module.exports = function (auth) {
  oauth2 = auth;
  startReadlineInterface()
};

function startReadlineInterface() {
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter code 1 to list, 2 to create and 3 to delete Data sources, 4 to continue or 0 to exit: ', function (code) {
    rl.close();
    if (code === '1') {
      listDataSourcesAPI();
    } else if (code === '2') {
      createDataSourcesAPI();
    } else if (code === '3') {
      deleteDataSourcesAPI();
    } else if (code === '4') {
      startSessionManager();
    } else if (code === '0'){
      process.exit();
    }
  });
}

function listDataSourcesAPI() {
  fitnessApi.users.dataSources.list({
    auth: oauth2,
    userId: 'me'
  }, function (err, response) {
    if (err) {
      showApiError(err);
      return;
    }
    printListDataSources(response.dataSource, 'founded');
  });
}

function createDataSourcesAPI() {
  var dataSourcesCreated = [];
  fs.readFile(DATA_SOURCES_PATH, function(err, dataSourcesBuffer) {
    var dataSources = JSON.parse(dataSourcesBuffer);
    if (err) {
      console.log('File of Data Sources doesn\'t exist!');
      process.exit();
    } else {
      for (var i = 0; i < dataSources.length; i++) {
        fitnessApi.users.dataSources.create({
          auth: oauth2,
          userId: 'me',
          resource: dataSources[i]
        }, function (err, response) {
          if (err) {
            showApiError(err);
            return;
          }
          dataSourcesCreated.push(response);
        });
      }
      setTimeout(printListDataSources, 2000, dataSourcesCreated, 'created');
    }
  });
}

function deleteDataSourcesAPI() {
  var dataSourcesDeleted = [];
  fitnessApi.users.dataSources.list({
    auth: oauth2,
    userId: 'me'
  }, function (err, response) {
    if (err) {
      showApiError(err);
      return;
    }
    var dataSources = response.dataSource;
    for (var i = 0; i < dataSources.length; i++) {
      if (dataSources[i].dataStreamId.indexOf('gms') == -1) {
        fitnessApi.users.dataSources.delete({
          auth: oauth2,
          userId: 'me',
          dataSourceId: dataSources[i].dataStreamId
        }, function (err, response) {
          if (err) {
            showApiError(err);
            return;
          }
          dataSourcesDeleted.push(response);
        });
      }
    }
    setTimeout(printListDataSources, 2000, dataSourcesDeleted, 'deleted');
  });
}

function startSessionManager() {
  if (dataSourceDistance != null) {
    googleFitSessionManager(oauth2, dataSourceDistance);
  } else {
    console.log('List datasources to verify if have any created! ' +
      '(obs: datasources with gms are created by the api)');
    startReadlineInterface();
  }
}

function printListDataSources(dataSources, actionName) {
  if (dataSources == null || dataSources.length == 0) {
    console.log('No DataSources found.');
  } else {
    console.log('DataSources ' + actionName + ':');
    for (var i = 0; i < dataSources.length; i++) {
      if (actionName !== 'deleted' && dataSources[i].dataStreamId.indexOf('gms') == -1 &&
        dataSources[i].dataType.name === DISTANCE_DATA_TYPE_NAME) {
        dataSourceDistance = dataSources[i];
      } else if (actionName === 'deleted') {
        dataSourceDistance = null;
      }
      console.log('%s: %s (%s)', dataSources[i].application.name, dataSources[i].dataStreamId,
        dataSources[i].dataType.name);
    }
  }
  startReadlineInterface();
}

function showApiError(err) {
  console.log('The API returned an error: ' + err);
}