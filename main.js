/**
 * Main Entry Point - Modular MODIS Albedo Comparison
 * 
 * Clean main script following MODIS_Albedo project architecture
 * Orchestrates UI setup and workflow execution
 * 
 * Author: Modular Comparison Framework
 * Date: 2025-06-30
 * Version: 2.0 - Modular Architecture
 */

// ============================================================================
// MODULE IMPORTS
// ============================================================================

var uiSetup = require('users/tofunori/MOD09A1_REN_METHOD:modules/ui/setup.js');
var comparisonWorkflow = require('users/tofunori/MOD09A1_REN_METHOD:modules/workflows/comparison.js');
var config = require('users/tofunori/MOD09A1_REN_METHOD:modules/config.js');

// ============================================================================
// GLOBAL VARIABLES
// ============================================================================

// Global UI system reference
var uiSystem;

// ============================================================================
// MAIN APPLICATION
// ============================================================================

/**
 * Main application entry point
 */
function main() {
  print('🏗️ MODULAR MODIS ALBEDO COMPARISON FRAMEWORK');
  print('📁 Architecture: modules/{methods,ui,utils,workflows}');
  print('🔬 Methods: Ren, MOD10A1, MCD43A3');
  print('');
  
  // Initialize UI with callback functions
  uiSystem = uiSetup.initializeUI(processCallback, exportCallback);
  
  print('✅ System ready - Use control panel to start comparison');
}

/**
 * Processing callback for UI
 */
function processCallback(startDate, endDate, successCallback, errorCallback) {
  try {
    // Validate inputs
    if (!uiSetup.validateUIInputs(uiSystem.components)) {
      return;
    }
    
    // Get processing parameters
    var params = uiSetup.getProcessingParameters(uiSystem.components, uiSystem.glacierData);
    
    // Run comparison workflow
    comparisonWorkflow.runModularComparison(
      params.startDate,
      params.endDate,
      params.methods,
      params.glacierOutlines,
      params.region,
      function(results) {
        // Success: Update UI with results
        uiSetup.updateUIAfterProcessing(uiSystem.components, results);
        if (successCallback) successCallback(results);
      },
      function(error) {
        // Error: Update UI with error
        uiSetup.updateUIWithError(uiSystem.components, error);
        if (errorCallback) errorCallback(error);
      }
    );
    
  } catch (error) {
    uiSetup.updateUIWithError(uiSystem.components, error.toString());
    if (errorCallback) errorCallback(error);
  }
}

/**
 * Export callback for UI
 */
function exportCallback(startDate, endDate, successCallback, errorCallback) {
  try {
    // Get parameters and validate
    var params = uiSetup.getProcessingParameters(uiSystem.components, uiSystem.glacierData);
    
    // Note: This requires previous processing results
    // In a production system, you'd store results or re-process
    print('📤 Export initiated - ensure you have run comparison first');
    
    // For now, indicate export started
    var exportDesc = 'export_' + startDate + '_to_' + endDate;
    uiSetup.updateUIAfterExport(uiSystem.components, exportDesc);
    
    if (successCallback) successCallback();
    
  } catch (error) {
    uiSetup.updateUIWithError(uiSystem.components, error.toString());
    if (errorCallback) errorCallback(error);
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Execute main application
main();

// ============================================================================
// DEVELOPMENT UTILITIES
// ============================================================================

/**
 * Development helper: Test individual method
 */
function testMethod(methodName, startDate, endDate) {
  if (!config.DEBUG_MODE) {
    print('Debug mode disabled');
    return;
  }
  
  print('🧪 Testing method: ' + methodName);
  
  var glacierData = require('users/tofunori/MOD09A1_REN_METHOD:modules/utils/glacier.js').initializeGlacierData();
  var methods = {};
  methods[methodName] = true;
  
  comparisonWorkflow.runModularComparison(
    startDate, endDate, methods, glacierData.outlines, glacierData.geometry,
    function(results) {
      print('✅ Test complete for ' + methodName);
      print('Results:', results);
    },
    function(error) {
      print('❌ Test failed for ' + methodName + ': ' + error);
    }
  );
}