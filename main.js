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

var comparisonWorkflow = require('users/tofunori/MOD09A1_REN_METHOD:modules/workflows/comparison.js');
var glacierUtils = require('users/tofunori/MOD09A1_REN_METHOD:modules/utils/glacier.js');
var config = require('users/tofunori/MOD09A1_REN_METHOD:modules/config.js');

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
  print('🔬 Methods: Ren (MOD09A1), MOD10A1, MCD43A3');
  print('🏔️ Processing all observations for comprehensive comparison');
  print('');
  
  // Initialize glacier data
  print('🏔️ Initializing glacier data...');
  glacierData = glacierUtils.initializeGlacierData();
  print('✅ Glacier data initialized');
  
  // Set default date range (current melt season)
  var startDate = config.PROCESSING_CONFIG.default_start_date || '2024-06-01';
  var endDate = config.PROCESSING_CONFIG.default_end_date || '2024-08-31';
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
  
  startDate = startDate || config.PROCESSING_CONFIG.default_start_date || '2024-06-01';
  endDate = endDate || config.PROCESSING_CONFIG.default_end_date || '2024-08-31';
  
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
print('• exportComparisonCSV("2024-06-01", "2024-08-31") - Export full comparison');
print('• setDateRange("2024-07-01", "2024-07-31") - Process July only');
print('• processSelectedMethods("2024-06-01", "2024-06-30", ["ren", "mod10a1"]) - Selected methods');
print('• exportQAComparison() - Export QA profiles');
print('• exportSingleDate("2024-06-15") - Single date export');
print('');