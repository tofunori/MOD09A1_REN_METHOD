/**
 * Comparison Workflow Module
 * 
 * Main workflow orchestrator for MODIS albedo method comparison
 * Coordinates data processing across all three methods
 * 
 * Author: Modular Comparison Framework
 * Date: 2025-06-30
 */

// ============================================================================
// MODULE IMPORTS
// ============================================================================

var config = require('users/tofunori/MOD09A1_REN_METHOD:modules/config.js');
var glacierUtils = require('users/tofunori/MOD09A1_REN_METHOD:modules/utils/glacier.js');
var exportUtils = require('users/tofunori/MOD09A1_REN_METHOD:modules/utils/export.js');

// Method implementations
var renMethod = require('users/tofunori/MOD09A1_REN_METHOD:modules/methods/ren.js');
var mod10a1Method = require('users/tofunori/MOD09A1_REN_METHOD:modules/methods/mod10a1.js');
var mcd43a3Method = require('users/tofunori/MOD09A1_REN_METHOD:modules/methods/mcd43a3.js');

// ============================================================================
// MAIN COMPARISON WORKFLOW
// ============================================================================

/**
 * Execute complete comparison workflow
 */
function runModularComparison(startDate, endDate, methods, glacierOutlines, region, successCallback, errorCallback) {
  try {
    print('🚀 Starting modular MODIS albedo comparison...');
    print('📅 Date range: ' + startDate + ' to ' + endDate);
    print('🔬 Methods: ' + Object.keys(methods).filter(function(k) { return methods[k]; }).join(', '));
    
    // Initialize results container
    var results = {};
    
    // Process each selected method
    if (methods.ren) {
      print('⚡ Processing Ren Method...');
      results.ren = processRenMethod(startDate, endDate, glacierOutlines, region);
      print('✅ Ren Method complete');
    }
    
    if (methods.mod10a1) {
      print('❄️ Processing MOD10A1 Method...');
      results.mod10a1 = processMOD10A1Method(startDate, endDate, glacierOutlines, region);
      print('✅ MOD10A1 Method complete');
    }
    
    if (methods.mcd43a3) {
      print('🌍 Processing MCD43A3 Method...');
      results.mcd43a3 = processMCD43A3Method(startDate, endDate, glacierOutlines, region);
      print('✅ MCD43A3 Method complete');
    }
    
    // Log processing summary
    logProcessingSummary(results);
    
    // Call success callback with results
    if (successCallback) {
      successCallback(results);
    }
    
    return results;
    
  } catch (error) {
    print('❌ Error in comparison workflow: ' + error.toString());
    if (errorCallback) {
      errorCallback(error.toString());
    }
    throw error;
  }
}

// ============================================================================
// INDIVIDUAL METHOD PROCESSING
// ============================================================================

/**
 * Process Ren Method with complete workflow
 */
function processRenMethod(startDate, endDate, glacierOutlines, region) {
  // Load MOD09A1 collection (has band 6 needed for NDSI)
  var collection = ee.ImageCollection(config.MODIS_COLLECTIONS.MOD09A1);
  
  // Apply standard filtering
  var filtered = glacierUtils.applyStandardFiltering(
    collection, startDate, endDate, region, config.PROCESSING_CONFIG.melt_season_only
  );
  
  // Create glacier mask
  var glacierImage = ee.Image(config.GLACIER_ASSET);
  var createGlacierMask = glacierUtils.createGlacierMask;
  
  // Process each image with Ren method
  var processed = filtered.map(function(image) {
    return renMethod.processRenMethod(image, glacierOutlines, createGlacierMask);
  });
  
  return processed;
}

/**
 * Process MOD10A1 Method with advanced QA filtering
 */
function processMOD10A1Method(startDate, endDate, glacierOutlines, region) {
  // Load MOD10A1 collection
  var collection = ee.ImageCollection(config.MODIS_COLLECTIONS.MOD10A1);
  
  // Apply standard filtering
  var filtered = glacierUtils.applyStandardFiltering(
    collection, startDate, endDate, region, config.PROCESSING_CONFIG.melt_season_only
  );
  
  // Process each image with MOD10A1 method
  var processed = filtered.map(function(image) {
    return mod10a1Method.processMOD10A1(image, glacierOutlines);
  });
  
  return processed;
}

/**
 * Process MCD43A3 Method with Collection 6.1 QA
 */
function processMCD43A3Method(startDate, endDate, glacierOutlines, region) {
  // Load MCD43A3 collection
  var collection = ee.ImageCollection(config.MODIS_COLLECTIONS.MCD43A3);
  
  // Apply standard filtering
  var filtered = glacierUtils.applyStandardFiltering(
    collection, startDate, endDate, region, config.PROCESSING_CONFIG.melt_season_only
  );
  
  // Process each image with MCD43A3 method
  var processed = filtered.map(function(image) {
    return mcd43a3Method.processMCD43A3(image, glacierOutlines);
  });
  
  return processed;
}

// ============================================================================
// EXPORT WORKFLOW
// ============================================================================

/**
 * Execute export workflow for comparison results
 */
function exportComparisonResults(startDate, endDate, results, region, successCallback, errorCallback) {
  try {
    print('📤 Starting export workflow...');
    
    // Generate export description
    var description = exportUtils.generateExportDescription(
      'modular_albedo_comparison', startDate, endDate
    );
    
    // Export comprehensive statistics
    exportUtils.exportComparisonStats(results, region, description);
    
    print('✅ Export workflow initiated');
    
    if (successCallback) {
      successCallback();
    }
    
  } catch (error) {
    print('❌ Error in export workflow: ' + error.toString());
    if (errorCallback) {
      errorCallback(error.toString());
    }
    throw error;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Log processing summary with data counts
 */
function logProcessingSummary(results) {
  print('📊 PROCESSING SUMMARY:');
  
  if (results.ren) {
    results.ren.size().evaluate(function(count) {
      print('  • Ren Method: ' + count + ' observations');
    });
  }
  
  if (results.mod10a1) {
    results.mod10a1.size().evaluate(function(count) {
      print('  • MOD10A1: ' + count + ' observations');
    });
  }
  
  if (results.mcd43a3) {
    results.mcd43a3.size().evaluate(function(count) {
      print('  • MCD43A3: ' + count + ' observations');
    });
  }
}

/**
 * Validate workflow parameters
 */
function validateWorkflowParameters(startDate, endDate, methods, glacierOutlines, region) {
  var errors = [];
  
  if (!startDate || !endDate) {
    errors.push('Start and end dates are required');
  }
  
  if (!methods || Object.keys(methods).length === 0) {
    errors.push('At least one method must be specified');
  }
  
  if (!glacierOutlines) {
    errors.push('Glacier outlines are required');
  }
  
  if (!region) {
    errors.push('Study region is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

/**
 * Get workflow status information
 */
function getWorkflowStatus(results) {
  var status = {
    totalMethods: 0,
    completedMethods: 0,
    totalObservations: 0,
    methodDetails: {}
  };
  
  if (results.ren) {
    status.totalMethods++;
    status.completedMethods++;
    results.ren.size().evaluate(function(count) {
      status.totalObservations += count;
      status.methodDetails.ren = { observations: count };
    });
  }
  
  if (results.mod10a1) {
    status.totalMethods++;
    status.completedMethods++;
    results.mod10a1.size().evaluate(function(count) {
      status.totalObservations += count;
      status.methodDetails.mod10a1 = { observations: count };
    });
  }
  
  if (results.mcd43a3) {
    status.totalMethods++;
    status.completedMethods++;
    results.mcd43a3.size().evaluate(function(count) {
      status.totalObservations += count;
      status.methodDetails.mcd43a3 = { observations: count };
    });
  }
  
  return status;
}

// ============================================================================
// CORRELATION ANALYSIS
// ============================================================================

/**
 * Perform correlation analysis between methods
 */
function performCorrelationAnalysis(results, region) {
  print('🔗 Performing correlation analysis...');
  
  var correlations = {};
  
  // Ren vs MOD10A1
  if (results.ren && results.mod10a1) {
    correlations.ren_mod10a1 = glacierUtils.calculateCollectionCorrelation(
      results.ren, results.mod10a1, 
      'broadband_albedo_ren', 'broadband_albedo_mod10a1', 
      region
    );
  }
  
  // Ren vs MCD43A3
  if (results.ren && results.mcd43a3) {
    correlations.ren_mcd43a3 = glacierUtils.calculateCollectionCorrelation(
      results.ren, results.mcd43a3, 
      'broadband_albedo_ren', 'broadband_albedo_mcd43a3', 
      region
    );
  }
  
  // MOD10A1 vs MCD43A3
  if (results.mod10a1 && results.mcd43a3) {
    correlations.mod10a1_mcd43a3 = glacierUtils.calculateCollectionCorrelation(
      results.mod10a1, results.mcd43a3, 
      'broadband_albedo_mod10a1', 'broadband_albedo_mcd43a3', 
      region
    );
  }
  
  print('✅ Correlation analysis complete');
  return correlations;
}

// ============================================================================
// EXPORTS
// ============================================================================

exports.runModularComparison = runModularComparison;
exports.exportComparisonResults = exportComparisonResults;
exports.processRenMethod = processRenMethod;
exports.processMOD10A1Method = processMOD10A1Method;
exports.processMCD43A3Method = processMCD43A3Method;
exports.validateWorkflowParameters = validateWorkflowParameters;
exports.getWorkflowStatus = getWorkflowStatus;
exports.performCorrelationAnalysis = performCorrelationAnalysis;