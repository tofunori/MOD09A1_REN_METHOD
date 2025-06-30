/**
 * Simplified Workflow – Ren Method Only
 *
 * Provides the minimal set of functions expected by main.js
 * after the original (complex) comparison workflow was removed.
 *
 * Only the Ren method is processed; other methods are ignored.
 */

// ============================================================================
// MODULE IMPORTS
// ============================================================================

// global `ee` provided by Earth Engine runtime
var config      = require('users/tofunori/MOD09A1_REN_METHOD:modules/config.js');
var glacierUtils= require('users/tofunori/MOD09A1_REN_METHOD:modules/utils/glacier.js');
var renMethod   = require('users/tofunori/MOD09A1_REN_METHOD:modules/methods/ren.js');

// ============================================================================
// HELPER
// ============================================================================

function getFilteredCollection(startDate, endDate, region) {
  var col = ee.ImageCollection(config.MODIS_COLLECTIONS.MOD09GA);
  return glacierUtils.applyStandardFiltering(
    col, startDate, endDate, region, config.PROCESSING_CONFIG.melt_season_only
  );
}

function processRenCollection(collection, glacierOutlines) {
  var createGlacierMask = glacierUtils.createGlacierMask;
  return collection.map(function (img) {
    return renMethod.processRenMethod(img, glacierOutlines, createGlacierMask);
  });
}

// ============================================================================
// PUBLIC API – minimal subset used by main.js
// ============================================================================

/**
 * Replaces legacy runModularComparison. Processes ONLY the Ren method.
 */
function runModularComparison(startDate, endDate, methods, glacierOutlines, region, successCb, errorCb) {
  try {
    var filtered   = getFilteredCollection(startDate, endDate, region);
    var renResults = processRenCollection(filtered, glacierOutlines);

    var resultsObj = { ren: renResults };
    if (successCb) successCb(resultsObj);
    return resultsObj;
  } catch (err) {
    if (errorCb) errorCb(err.toString());
    throw err;
  }
}

/**
 * Stub for export – not needed in simplified workflow.
 */
function exportComparisonResults(startDate, endDate, results, region, successCb, errorCb) {
  print('ℹ️ exportComparisonResults: feature disabled in simplified workflow');
  if (successCb) successCb();
}

/**
 * Stub for QA profile comparison – disabled.
 */
function runQAProfileComparison(startDate, endDate, glacierOutlines, region, successCb, errorCb) {
  print('ℹ️ runQAProfileComparison: feature disabled in simplified workflow');
  if (successCb) successCb({ expectedOutputs: [] });
}

// ============================================================================
// EXPORTS
// ============================================================================

exports.runModularComparison     = runModularComparison;
exports.exportComparisonResults  = exportComparisonResults;
exports.runQAProfileComparison   = runQAProfileComparison; 