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
  // Load MOD09GA collection (matches original full_script.js)
  var collection = ee.ImageCollection(config.MODIS_COLLECTIONS.MOD09GA);
  
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
// QA PROFILE COMPARISON WORKFLOW
// ============================================================================

/**
 * Execute QA profile comparison workflow for Ren method optimization
 * Generates comprehensive CSV exports comparing all 6 QA filter configurations
 */
function runQAProfileComparison(startDate, endDate, glacierOutlines, region, successCallback, errorCallback) {
  try {
    print('📊 Starting QA Profile Comparison Workflow...');
    print('📅 Date range: ' + startDate + ' to ' + endDate);
    print('🔬 Analyzing 6 QA filter configurations: Strict → Level 5');
    
    // Load MOD09GA collection for Ren method
    var collection = ee.ImageCollection(config.MODIS_COLLECTIONS.MOD09GA);
    
    // Apply standard filtering (without QA - that will be done per profile)
    var filtered = glacierUtils.applyStandardFiltering(
      collection, startDate, endDate, region, config.PROCESSING_CONFIG.melt_season_only
    );
    
    // Create glacier mask function
    var glacierImage = ee.Image(config.GLACIER_ASSET);
    var createGlacierMask = glacierUtils.createGlacierMask;
    
    // Generate export description
    var description = exportUtils.generateExportDescription(
      'qa_profile_analysis', startDate, endDate
    );
    
    // Export comprehensive QA profile comparison - SINGLE CSV with everything
    exportUtils.exportQAProfileComparison(
      filtered, glacierOutlines, createGlacierMask, region, description
    );
    
    print('✅ QA Profile Comparison workflow initiated');
    print('📁 Single CSV output:');
    print('  • ' + description + '_qa_complete_analysis.csv (all QA profiles, stats, and quality metrics)');
    
    if (successCallback) {
      successCallback({
        description: description,
        profileCount: 6,
        qualityAssessmentEnabled: true,
        expectedOutputs: [
          description + '_qa_complete_analysis.csv'
        ]
      });
    }
    
  } catch (error) {
    print('❌ Error in QA Profile Comparison workflow: ' + error.toString());
    if (errorCallback) {
      errorCallback(error.toString());
    }
    throw error;
  }
}

/**
 * Execute single QA profile test for quick iteration
 * Useful for testing specific configurations before full comparison
 */
function runSingleQAProfileTest(startDate, endDate, profileKey, glacierOutlines, region, successCallback, errorCallback) {
  try {
    var profile = config.QA_PROFILES[profileKey];
    if (!profile) {
      throw new Error('Invalid QA profile key: ' + profileKey);
    }
    
    print('🧪 Testing single QA profile: ' + profile.name);
    print('📋 Description: ' + profile.description);
    print('📈 Expected gain: ' + profile.expectedGain);
    print('⚠️ Risk level: ' + profile.risk);
    
    // Load and filter collection
    var collection = ee.ImageCollection(config.MODIS_COLLECTIONS.MOD09GA);
    var filtered = glacierUtils.applyStandardFiltering(
      collection, startDate, endDate, region, config.PROCESSING_CONFIG.melt_season_only
    );
    
    // Process with specific QA profile
    var createGlacierMask = glacierUtils.createGlacierMask;
    var processed = filtered.map(function(image) {
      return renMethod.processRenMethod(image, glacierOutlines, createGlacierMask, profile);
    });
    
    // Generate statistics
    var description = exportUtils.generateExportDescription(
      'qa_test_' + profileKey, startDate, endDate
    );
    
    exportUtils.exportIndividualMethod(
      processed, 'broadband_albedo_ren_masked', profile.name, region, description
    );
    
    // Print observation count for immediate feedback
    processed.size().evaluate(function(count) {
      print('📊 ' + profile.name + ' profile results: ' + count + ' valid observations');
    });
    
    if (successCallback) {
      successCallback({
        profile: profile,
        description: description,
        exportFile: description + '_' + profile.name + '.csv'
      });
    }
    
  } catch (error) {
    print('❌ Error in single QA profile test: ' + error.toString());
    if (errorCallback) {
      errorCallback(error.toString());
    }
    throw error;
  }
}

/**
 * Execute enhanced QA profile comparison with quality assessment integration
 * Combines QA filter optimization with post-processing quality controls
 */
function runEnhancedQAProfileComparison(startDate, endDate, glacierOutlines, region, qaOptions, successCallback, errorCallback) {
  try {
    qaOptions = qaOptions || {};
    var enableQualityFiltering = qaOptions.enableQualityFiltering !== false; // Default true
    var boundsOptions = qaOptions.boundsOptions || {
      lowerBound: 0.05,
      upperBound: 0.95,
      enableTemporalFiltering: false,
      temporalWindow: 16
    };
    
    print('🔬 Starting Enhanced QA Profile Comparison with Quality Assessment...');
    print('📅 Date range: ' + startDate + ' to ' + endDate);
    print('📊 Analyzing 6 QA filter configurations + quality controls');
    print('🔍 Quality filtering enabled: ' + enableQualityFiltering);
    if (enableQualityFiltering) {
      print('  • Albedo bounds: [' + boundsOptions.lowerBound + ', ' + boundsOptions.upperBound + ']');
      if (boundsOptions.enableTemporalFiltering) {
        print('  • Temporal filtering: ' + boundsOptions.temporalWindow + '-day window');
      }
    }
    
    // Load MOD09GA collection for Ren method
    var collection = ee.ImageCollection(config.MODIS_COLLECTIONS.MOD09GA);
    
    // Apply standard filtering (without QA - that will be done per profile)
    var filtered = glacierUtils.applyStandardFiltering(
      collection, startDate, endDate, region, config.PROCESSING_CONFIG.melt_season_only
    );
    
    // Create glacier mask function
    var glacierImage = ee.Image(config.GLACIER_ASSET);
    var createGlacierMask = glacierUtils.createGlacierMask;
    
    // Generate export description
    var description = exportUtils.generateExportDescription(
      'qa_enhanced_analysis', startDate, endDate
    );
    
    // Export enhanced QA profile comparison with quality assessment
    exportUtils.exportQAProfileComparisonWithQA(
      filtered, glacierOutlines, createGlacierMask, region, description, {
        enableQualityFiltering: enableQualityFiltering,
        boundsOptions: boundsOptions
      }
    );
    
    // Export detailed QA flag analysis for debugging
    exportUtils.exportQAFlagAnalysis(filtered, region, description);
    
    print('✅ Enhanced QA Profile Comparison workflow initiated');
    print('📁 Expected outputs:');
    print('  • ' + description + '_qa_profile_enhanced.csv (detailed observations with QA metrics)');
    print('  • ' + description + '_qa_enhanced_summary.csv (summary with quality metrics)');
    print('  • ' + description + '_quality_assessment.csv (quality assessment statistics)');
    print('  • ' + description + '_qa_flag_analysis.csv (QA flag distribution)');
    
    if (successCallback) {
      successCallback({
        description: description,
        profileCount: 6,
        qualityAssessmentEnabled: enableQualityFiltering,
        expectedOutputs: [
          description + '_qa_profile_enhanced.csv',
          description + '_qa_enhanced_summary.csv',
          description + '_quality_assessment.csv',
          description + '_qa_flag_analysis.csv'
        ]
      });
    }
    
  } catch (error) {
    print('❌ Error in Enhanced QA Profile Comparison workflow: ' + error.toString());
    if (errorCallback) {
      errorCallback(error.toString());
    }
    throw error;
  }
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
exports.runQAProfileComparison = runQAProfileComparison;
exports.runSingleQAProfileTest = runSingleQAProfileTest;
exports.runEnhancedQAProfileComparison = runEnhancedQAProfileComparison;