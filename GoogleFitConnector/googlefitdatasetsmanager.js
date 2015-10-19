/**
 * Created by Fernando on 10/17/2015.
 *
 */
var google = require('googleapis'), fitnessApi = google.fitness('v1');
var readline = require('readline');
var fs = require('fs');

var ACTIVITY_TYPE_WALK = 7;
var ACTIVITY_TYPE_RUN = 8;
var ACTIVITY_TYPE_CYCLE = 15;

var WALK_REFERENCE = {
  type1: {speedKm: 3.20, stepsPerMin: 67}, type2: {speedKm: 4.80, stepsPerMin: 100},
  type3: {speedKm: 6.40, stepsPerMin: 152}, type4: {speedKm: 8, stepsPerMin: 242}
};
var RUN_REFERENCE = {
  type1: {speedKm: 8, stepsPerMin: 185}, type2: {speedKm: 9.65, stepsPerMin: 230},
  type3: {speedKm: 12.90, stepsPerMin: 305}, type4: {speedKm: 16.10, stepsPerMin: 350}
};
var CYCLE_REFERENCE = {
  type1: {speedKm: 8, stepsPerMin: 55}, type2: {speedKm: 16.10, stepsPerMin: 93},
  type3: {speedKm: 24.15, stepsPerMin: 160}, type4: {speedKm: 32.20, stepsPerMin: 200}
};

var dataset = {
  "dataSourceId": undefined,
  "maxEndTimeNs": undefined,
  "minStartTimeNs": undefined,
  "activityType": undefined,
  "point": [
    {
      "dataTypeName": undefined,
      "startTimeNanos": undefined,
      "originDataSourceId": undefined,
      "endTimeNanos": undefined,
      "value": [
        {
          "fpVal": undefined
        }
      ]
    }
  ]
};

var oauth2;
var dataSourceDistance;
var sessionsFound;
var datasetsToConvertSteps = null;

var SESSIONS_PATH = './datasets.json';

/**
 * Manage Datasets of Google Fit API
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
module.exports = function (auth, dataSource, sessions) {
  oauth2 = auth;
  dataSourceDistance = dataSource;
  sessionsFound = sessions;
  sessions.sort(function (a, b) {
    return a.id - b.id;
  });
  startReadlineInterface()
};

function startReadlineInterface() {
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter code 1 to list, 2 to patch and 3 to delete Data sets, 4 to convert data into steps, ' +
    '5 to back to Data sources or 0 to exit: ', function (code) {
    rl.close();
    if (code === '1') {
      listDatasetsAPI(sessionsFound);
    } else if (code === '2') {
      patchDatasetsAPI();
    } else if (code === '3') {
      deleteDatasetsAPI(sessionsFound);
    } else if (code === '4') {
      createStepsFromDatasets();
    } else if (code === '5') {
      require('./googlefitdatasourcemanager.js')(oauth2);
    } else if (code === '0') {
      process.exit();
    }
  });
}

function listDatasetsAPI(sessionsFounded) {
  var datasetsFounded = [];
  for (var i = 0; i < sessionsFounded.length; i++) {
    fitnessApi.users.dataSources.datasets.get({
      auth: oauth2,
      userId: 'me',
      dataSourceId: dataSourceDistance.dataStreamId,
      datasetId: sessionsFounded[i].startTimeMillis * 1000000 + '-' + sessionsFounded[i].endTimeMillis * 1000000
    }, function (err, response) {
      if (err) {
        showApiError(err);
        return;
      }
      if (response.point != null) {
        datasetsFounded.push(response);
      }
    });
  }
  setTimeout(printListDatasets, 5000, datasetsFounded, "founded");
}

function patchDatasetsAPI() {
  var datasetsPatched = [];
  fs.readFile(SESSIONS_PATH, function (err, datasetsBuffer) {
    var datasets = JSON.parse(datasetsBuffer);
    if (err) {
      console.log('File of Datasets doesn\'t exist!');
      process.exit();
    } else {
      for (var i = 0; i < datasets.length; i++) {
        fitnessApi.users.dataSources.datasets.patch({
          auth: oauth2,
          userId: 'me',
          dataSourceId: dataSourceDistance.dataStreamId,
          datasetId: datasets[i].minStartTimeNs + '-' + datasets[i].maxEndTimeNs,
          resource: datasets[i]
        }, function (err, response) {
          if (err) {
            showApiError(err);
            return;
          }
          datasetsPatched.push(response);
        });
      }
      setTimeout(printListDatasets, 5000, datasetsPatched, 'created')
    }
  });
}

function deleteDatasetsAPI(sessionsFounded) {
  var datasetsDeleted = [];
  for (var i = 0; i < sessionsFounded.length; i++) {
    fitnessApi.users.dataSources.datasets.get({
      auth: oauth2,
      userId: 'me',
      dataSourceId: dataSourceDistance.dataStreamId,
      datasetId: sessionsFounded[i].startTimeMillis * 1000000 + '-' + sessionsFounded[i].endTimeMillis * 1000000
    }, function (err, response1) {
      if (err) {
        showApiError(err);
        return;
      }
      if (response1.point != null) {
        fitnessApi.users.dataSources.datasets.delete({
          auth: oauth2,
          userId: 'me',
          dataSourceId: response1.dataSourceId,
          datasetId: response1.minStartTimeNs + '-' + response1.maxEndTimeNs
        }, function (err, response2) {
          if (err) {
            showApiError(err);
            return;
          }
          datasetsDeleted.push(response1);
        });
      }
    });
  }
  setTimeout(printListDatasets, 5000, datasetsDeleted, 'deleted');
}

function createStepsFromDatasets() {
  if (datasetsToConvertSteps != null && datasetsToConvertSteps.length > 0) {
    linkActivityInDataset();
  } else {
    console.log('List Datasets to verify if have any created!');
    startReadlineInterface();
  }
}

function linkActivityInDataset() {
  for (var i = 0; i < datasetsToConvertSteps.length; i++) {
    for (var j = 0; j < sessionsFound.length; j++) {
      var startTimeDatasetInMillis = datasetsToConvertSteps[i].minStartTimeNs / 1000000;
      var endTimeDataSetInMillis = datasetsToConvertSteps[i].maxEndTimeNs / 1000000;
      if (sessionsFound[j].startTimeMillis == startTimeDatasetInMillis &&
        sessionsFound[j].endTimeMillis == endTimeDataSetInMillis) {
        datasetsToConvertSteps[i].activityType = sessionsFound[i].activityType;
      }
    }
  }
  setTimeout(calculateStepsFromDataSets, 3000);
}

function calculateStepsFromDataSets() {
  for (var i = 0; i < datasetsToConvertSteps.length; i++) {
    dataset = datasetsToConvertSteps[i];
    if (dataset.activityType == ACTIVITY_TYPE_WALK) {
      setTimeout(convertDataPointsToSteps, i * 2000, dataset, WALK_REFERENCE, 'Walking');
    } else if (dataset.activityType == ACTIVITY_TYPE_RUN) {
      setTimeout(convertDataPointsToSteps, i * 2000, dataset, RUN_REFERENCE, 'Running');
    } else if (dataset.activityType == ACTIVITY_TYPE_CYCLE) {
      setTimeout(convertDataPointsToSteps, i * 2000, dataset, CYCLE_REFERENCE, 'Biking');
    }
  }
  setTimeout(startReadlineInterface, (i * 1000) + 1000);
}

function convertDataPointsToSteps(dataset, reference, action) {
  var totalSteps = 0;
  var points = dataset.point;
  for (var i = 0; i < points.length; i++) {
    var point = points[i];
    var startTimeMillis = point.startTimeNanos / 1000000;
    var endTimeMillis = point.endTimeNanos / 1000000;
    var diffMsBetweenTimes = (endTimeMillis - startTimeMillis);
    var diffMinBetweenTimes = Math.round(((diffMsBetweenTimes % 86400000) % 3600000) / 60000);
    var speedKm = (point.value[0].fpVal / diffMinBetweenTimes) * 0.06;
    var steps;

    if (speedKm <= reference.type1.speedKm) {
      steps = diffMinBetweenTimes * reference.type1.stepsPerMin;
    } else if (speedKm <= reference.type2.speedKm) {
      steps = diffMinBetweenTimes * reference.type2.stepsPerMin;
    } else if (speedKm <= reference.type3.speedKm) {
      steps = diffMinBetweenTimes * reference.type3.stepsPerMin;
    } else if (speedKm > reference.type3.speedKm) {
      steps = diffMinBetweenTimes * reference.type4.stepsPerMin;
    }

    totalSteps += steps;
  }

  console.log(action + ' to steps = ' + totalSteps);
}

function printListDatasets(datasets, actionName) {
  if (datasets == null || datasets.length == 0) {
    console.log('No Datasets found.');
  } else {
    if (actionName !== 'deleted') {
      datasetsToConvertSteps = datasets;
    } else if (actionName === 'deleted') {
      datasetsToConvertSteps = null;
    }
    console.log('Datasets ' + actionName + ':');
    for (var i = 0; i < datasets.length; i++) {
      console.log(JSON.stringify(datasets[i]));
    }
  }
  startReadlineInterface();
}

function showApiError(err) {
  console.log('The API returned an error: ' + err);
}