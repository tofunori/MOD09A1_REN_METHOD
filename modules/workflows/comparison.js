/**
 * Comparison Workflow – Ren Method with Full Export
 *
 * Processes the Ren method and provides full CSV export functionality
 * for comprehensive albedo analysis results.
 */

// ============================================================================
// MODULE IMPORTS
// ============================================================================

// global `ee` provided by Earth Engine runtime
var config      = require('users/tofunori/MOD09A1_REN_METHOD:modules/config.js');
var glacierUtils= require('users/tofunori/MOD09A1_REN_METHOD:modules/utils/glacier.js');
var renMethod   = require('users/tofunori/MOD09A1_REN_METHOD:modules/methods/ren.js');
var exportUtils = require('users/tofunori/MOD09A1_REN_METHOD:modules/utils/export.js');

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
 * Export comparison results to CSV
 */
function exportComparisonResults(startDate, endDate, results, region, successCb, errorCb) {
  try {
    var description = exportUtils.generateExportDescription('modular_albedo_comparison', startDate, endDate);
    exportUtils.exportComparisonStats(results, region, description);
    print('✅ CSV export completed: ' + description);
    if (successCb) successCb();
  } catch (err) {
    print('❌ CSV export failed: ' + err.toString());
    if (errorCb) errorCb(err.toString());
  }
}

/**
 * Run QA profile comparison analysis
 */
function runQAProfileComparison(startDate, endDate, glacierOutlines, region, successCb, errorCb) {
  try {
    var filtered = getFilteredCollection(startDate, endDate, region);
    var createGlacierMask = glacierUtils.createGlacierMask;
    var description = exportUtils.generateExportDescription('qa_profile_comparison', startDate, endDate);
    
    exportUtils.exportQAProfileComparison(filtered, glacierOutlines, createGlacierMask, region, description);
    print('✅ QA Profile comparison export completed: ' + description);
    
    if (successCb) successCb({ expectedOutputs: [description + '_qa_profile_comparison'] });
  } catch (err) {
    print('❌ QA Profile comparison failed: ' + err.toString());
    if (errorCb) errorCb(err.toString());
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

exports.runModularComparison     = runModularComparison;
exports.exportComparisonResults  = exportComparisonResults;
exports.runQAProfileComparison   = runQAProfileComparison; 