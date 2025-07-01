/**
 * Main Entry Point - Modular MODIS Albedo Comparison
 * 
 * Simple CSV export comparing all three MODIS albedo methods
 * Processes all observations and exports comprehensive comparison
 * 
 * Author: Modular Comparison Framework
 * Date: 2025-07-01
 * Version: 4.0 - Simplified CSV Export System
 */

// ============================================================================
// MODULE IMPORTS
// ============================================================================

var comparisonWorkflow = require('users/tofunori/MOD09GA_REN_METHOD:modules/workflows/comparison.js');
var glacierUtils = require('users/tofunori/MOD09GA_REN_METHOD:modules/utils/glacier.js');
var config = require('users/tofunori/MOD09GA_REN_METHOD:modules/config.js');

// ============================================================================
// GLOBAL VARIABLES
// ============================================================================

// Global results storage
var lastProcessingResults = null;
var glacierData = null;

// Initialization state flag to prevent duplicate processing
var isInitialized = false;

// ============================================================================
// MAIN APPLICATION
// ============================================================================

/**
 * Main application entry point
 */
function main() {
  // Prevent duplicate initialization
  if (isInitialized) {
    print('⚠️ System already initialized - skipping duplicate initialization');
    return lastProcessingResults;
  }
  
  print('🏗️ MODULAR MODIS ALBEDO COMPARISON FRAMEWORK');
  print('📊 Simple CSV Export System');
  print('🔬 Methods: Ren (MOD09GA), MOD10A1, MCD43A3');
  print('🏔️ Processing 2017-2024 melt seasons (June 1 - September 30)');
  print('📊 Comprehensive 7-year glacier albedo comparison');
  print('');
  
  // Initialize glacier data
  print('🏔️ Initializing glacier data...');
  glacierData = glacierUtils.initializeGlacierData();
  print('✅ Glacier data initialized');
  
  // Set default date range (full melt seasons 2017-2024)
  var startDate = '2017-06-01';
  var endDate = '2024-09-30';
  var methods = {ren: true, mod10a1: true, mcd43a3: true};
  
  print('📅 Processing period: ' + startDate + ' to ' + endDate);
  print('🔄 Starting comparison workflow...');
  
  // Run the comparison and export
  exportComparisonCSV(startDate, endDate, methods);
  
  isInitialized = true;
  return glacierData;
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

/**
 * Export full comparison CSV for all three methods
 */
function exportComparisonCSV(startDate, endDate, methods) {
  if (!glacierData) {
    glacierData = glacierUtils.initializeGlacierData();
  }
  
  methods = methods || {ren: true, mod10a1: true, mcd43a3: true};
  
  print('📤 Starting CSV comparison export...');
  print('📅 Date range: ' + startDate + ' to ' + endDate);
  print('🔬 Methods: ' + Object.keys(methods).filter(function(k) { return methods[k]; }).join(', '));
  
  comparisonWorkflow.runModularComparison(
    startDate, endDate, methods, 
    glacierData.outlines, glacierData.geometry,
    function(results) {
      print('✅ Processing complete, starting CSV export...');
      lastProcessingResults = results;
      
      comparisonWorkflow.exportComparisonResults(
        startDate, endDate, results, glacierData.geometry,
        function() {
          print('✅ CSV export completed successfully');
          print('📁 Check your Google Drive for the exported CSV file');
        },
        function(error) {
          print('❌ CSV export failed: ' + error);
        }
      );
    },
    function(error) {
      print('❌ Comparison processing failed: ' + error);
    }
  );
}

/**
 * Export QA profile comparison
 */
function exportQAComparison(startDate, endDate) {
  if (!glacierData) {
    glacierData = glacierUtils.initializeGlacierData();
  }
  
  startDate = startDate || '2017-06-01';
  endDate = endDate || '2024-09-30';
  
  print('📤 Starting QA profile comparison export...');
  
  comparisonWorkflow.runQAProfileComparison(
    startDate, endDate, glacierData.outlines, glacierData.geometry,
    function(results) {
      print('✅ QA profile comparison completed');
    },
    function(error) {
      print('❌ QA profile comparison failed: ' + error);
    }
  );
}

/**
 * Quick single date export (Ren method)
 */
function exportSingleDate(date, options) {
  if (!glacierData) {
    glacierData = glacierUtils.initializeGlacierData();
  }
  
  options = options || {};
  
  print('📤 Exporting single date: ' + date);
  
  try {
    comparisonWorkflow.exportRenAlbedoSingleDate(
      date, glacierData.outlines, glacierData.geometry, options
    );
    print('✅ Single date export started for ' + date);
  } catch (error) {
    print('❌ Single date export failed: ' + error);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Set custom date range for processing
 */
function setDateRange(startDate, endDate) {
  print('📅 Setting custom date range: ' + startDate + ' to ' + endDate);
  exportComparisonCSV(startDate, endDate);
}

/**
 * Process specific methods only
 */
function processSelectedMethods(startDate, endDate, selectedMethods) {
  var methods = {
    ren: selectedMethods.includes('ren'),
    mod10a1: selectedMethods.includes('mod10a1'), 
    mcd43a3: selectedMethods.includes('mcd43a3')
  };
  
  exportComparisonCSV(startDate, endDate, methods);
}

/**
 * Get last processing results
 */
function getLastResults() {
  if (lastProcessingResults) {
    print('📊 Last processing results available');
    return lastProcessingResults;
  } else {
    print('❌ No processing results available - run main() first');
    return null;
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Execute main application automatically
main();

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

print('');
print('📝 USAGE EXAMPLES:');
print('• exportComparisonCSV("2017-06-01", "2024-09-30") - Export full 2017-2024 comparison');
print('• setDateRange("2023-06-01", "2023-09-30") - Process 2023 melt season only');
print('• processSelectedMethods("2020-06-01", "2020-09-30", ["ren", "mod10a1"]) - Selected methods');
print('• exportQAComparison() - Export QA profiles (2017-2024)');
print('• exportSingleDate("2022-07-15") - Single date export');
print('');