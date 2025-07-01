
var comparisonWorkflow = require('users/tofunori/MOD09A1_REN_METHOD:modules/workflows/comparison.js');
var glacierUtils = require('users/tofunori/MOD09A1_REN_METHOD:modules/utils/glacier.js');

var lastProcessingResults = null;
var glacierData = null;
var isInitialized = false;

function main() {
  if (isInitialized) return lastProcessingResults;
  
  glacierData = glacierUtils.initializeGlacierData();
  var startDate = '2017-06-01';
  var endDate = '2024-09-30';
  var methods = {ren: true, mod10a1: true, mcd43a3: true};
  
  exportComparisonCSV(startDate, endDate, methods);
  isInitialized = true;
  return glacierData;
}

function exportComparisonCSV(startDate, endDate, methods) {
  if (!glacierData) glacierData = glacierUtils.initializeGlacierData();
  methods = methods || {ren: true, mod10a1: true, mcd43a3: true};
  
  comparisonWorkflow.runModularComparison(
    startDate, endDate, methods, 
    glacierData.outlines, glacierData.geometry,
    function(results) {
      lastProcessingResults = results;
      comparisonWorkflow.exportComparisonResults(
        startDate, endDate, results, glacierData.geometry,
        function() {},
        function(error) {}
      );
    },
    function(error) {}
  );
}

function exportQAComparison(startDate, endDate) {
  if (!glacierData) glacierData = glacierUtils.initializeGlacierData();
  startDate = startDate || '2017-06-01';
  endDate = endDate || '2024-09-30';
  comparisonWorkflow.runQAProfileComparison(
    startDate, endDate, glacierData.outlines, glacierData.geometry,
    function(results) {},
    function(error) {}
  );
}

function exportSingleDate(date, options) {
  if (!glacierData) glacierData = glacierUtils.initializeGlacierData();
  options = options || {};
  comparisonWorkflow.exportRenAlbedoSingleDate(
    date, glacierData.outlines, glacierData.geometry, options
  );
}

function setDateRange(startDate, endDate) {
  exportComparisonCSV(startDate, endDate);
}

function processSelectedMethods(startDate, endDate, selectedMethods) {
  var methods = {
    ren: selectedMethods.includes('ren'),
    mod10a1: selectedMethods.includes('mod10a1'), 
    mcd43a3: selectedMethods.includes('mcd43a3')
  };
  exportComparisonCSV(startDate, endDate, methods);
}

function getLastResults() {
  return lastProcessingResults;
}

main();

