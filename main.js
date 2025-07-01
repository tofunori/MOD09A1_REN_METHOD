/**
 * Main Entry Point - MODIS Albedo Calendar Visualization
 * 
 * Interactive calendar visualization for daily glacier albedo analysis
 * Displays three MODIS methods with glacier-focused pixel analysis
 * 
 * Author: Calendar Visualization Framework
 * Date: 2025-07-01
 * Version: 3.0 - Calendar Visualization System
 */

// ============================================================================
// MODULE IMPORTS
// ============================================================================

var calendarSetup = require('users/tofunori/MOD09A1_REN_METHOD:modules/ui/setup.js');
var comparisonWorkflow = require('users/tofunori/MOD09A1_REN_METHOD:modules/workflows/comparison.js');
var config = require('users/tofunori/MOD09A1_REN_METHOD:modules/config.js');

// ============================================================================
// GLOBAL VARIABLES
// ============================================================================

// Global calendar system reference
var calendarSystem;

// Initialization state flag to prevent duplicate initialization
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
    print('⚠️ Calendar system already initialized - skipping duplicate initialization');
    return calendarSystem;
  }
  
  print('🏗️ MODIS ALBEDO CALENDAR VISUALIZATION SYSTEM');
  print('📅 Interactive calendar for daily glacier analysis');
  print('🔬 Methods: Ren (MOD09A1), MOD10A1, MCD43A3');
  print('🏔️ Focus: Glacier pixel extraction and visualization');
  print('');
  
  // Initialize calendar visualization system
  calendarSystem = calendarSetup.initializeCalendarUI();
  isInitialized = true;
  
  print('✅ Calendar system ready - Click on calendar days to view glacier data');
  return calendarSystem;
}

// ============================================================================
// CALENDAR CONTROL FUNCTIONS
// ============================================================================

/**
 * Set calendar to specific date
 */
function setCalendarDate(year, month) {
  if (calendarSystem) {
    calendarSetup.setCalendarDate(year, month);
    print('📅 Calendar set to ' + year + '-' + (month + 1));
  } else {
    print('❌ Calendar system not initialized');
  }
}

/**
 * Get current calendar state and selected day data
 */
function getCalendarInfo() {
  if (calendarSystem) {
    var selectedData = calendarSetup.getSelectedDayData();
    print('📊 Calendar Info:');
    if (selectedData) {
      print('Selected Date: ' + selectedData.date);
      print('Available Methods:', Object.keys(selectedData.stats));
    } else {
      print('No date selected');
    }
    return selectedData;
  } else {
    print('❌ Calendar system not initialized');
    return null;
  }
}

/**
 * Export current month's glacier data
 */
function exportMonthData(year, month) {
  if (!calendarSystem) {
    print('❌ Calendar system not initialized');
    return;
  }
  
  year = year || new Date().getFullYear();
  month = month || new Date().getMonth();
  
  print('📤 Exporting glacier data for ' + year + '-' + (month + 1) + '...');
  
  var glacierData = calendarSystem.glacierData;
  var methods = ['ren', 'mod10a1', 'mcd43a3'];
  
  // Use the comparison workflow to export monthly data
  var report = comparisonWorkflow.generateMonthlyGlacierReport(
    year, month + 1, methods, glacierData.outlines, glacierData.mask
  );
  
  print('📊 Monthly Report:', report);
  print('💡 Use the calendar interface to select individual days for detailed export');
  print('💡 Click "Export Day Data" button on selected days');
  
  return report;
}

/**
 * Export full comparison CSV for date range
 */
function exportComparisonCSV(startDate, endDate, methods) {
  if (!calendarSystem) {
    print('❌ Calendar system not initialized');
    return;
  }
  
  methods = methods || {ren: true, mod10a1: true, mcd43a3: true};
  var glacierData = calendarSystem.glacierData;
  
  print('📤 Starting CSV comparison export from ' + startDate + ' to ' + endDate + '...');
  
  comparisonWorkflow.runModularComparison(
    startDate, endDate, methods, 
    glacierData.outlines, glacierData.geometry,
    function(results) {
      print('✅ Processing complete, starting CSV export...');
      comparisonWorkflow.exportComparisonResults(
        startDate, endDate, results, glacierData.geometry,
        function() {
          print('✅ CSV export completed successfully');
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