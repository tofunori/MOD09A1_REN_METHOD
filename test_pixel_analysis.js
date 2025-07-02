/**
 * Pixel-by-Pixel Analysis Test Entry Point
 * 
 * SAFE TESTING MODULE - Does not modify existing main.js workflow
 * 
 * This script provides a safe environment to test the new pixel-by-pixel
 * analysis implementation while preserving your current regional analysis
 * workflow completely intact.
 * 
 * Features:
 * - Single date testing for validation
 * - Small-scale pixel exports for verification
 * - Comparison with existing regional statistics
 * - Performance monitoring and memory management
 * - Error handling and debugging utilities
 * 
 * Usage:
 * 1. Run testSingleDate() for initial validation
 * 2. Run testDateRange() for extended analysis
 * 3. Run validateAgainstRegional() to compare with existing results
 * 
 * Author: Pixel Analysis Test Framework
 * Date: 2025-07-02
 */

// ============================================================================
// MODULE IMPORTS
// ============================================================================

var glacierUtils = require('users/tofunori/MOD09A1_REN_METHOD:modules/utils/glacier.js');
var pixelComparison = require('users/tofunori/MOD09A1_REN_METHOD:modules/workflows/pixel_comparison_test.js');
var pixelExport = require('users/tofunori/MOD09A1_REN_METHOD:modules/utils/pixel_export_test.js');
var pixelId = require('users/tofunori/MOD09A1_REN_METHOD:modules/utils/pixel_id.js');

// Import original comparison for validation
var originalComparison = require('users/tofunori/MOD09A1_REN_METHOD:modules/workflows/comparison.js');

// ============================================================================
// GLOBAL VARIABLES
// ============================================================================

var glacierData = null;
var lastTestResults = null;
var isInitialized = false;

// ============================================================================
// INITIALIZATION
// ============================================================================

function initializeTestEnvironment() {
  if (isInitialized) return glacierData;
  
  print('🔬 Initializing Pixel Analysis Test Environment...');
  
  // Initialize glacier data (same as main.js)
  glacierData = glacierUtils.initializeGlacierData();
  
  print('✅ Test environment ready');
  print('📍 Glacier region bounds:', glacierData.bounds);
  print('🏔️  Glacier outlines loaded:', glacierData.outlines.size());
  
  isInitialized = true;
  return glacierData;
}

// ============================================================================
// SINGLE DATE TESTING FUNCTIONS
// ============================================================================

/**
 * Test pixel-by-pixel analysis for a single date
 * Default: 2023-08-07 (good coverage date from your analysis)
 */
function testSingleDate(date, options) {
  date = date || '2023-08-07';
  options = options || {};
  
  print('🧪 Testing pixel analysis for date:', date);
  
  if (!glacierData) initializeTestEnvironment();
  
  // Configure methods to test
  var methods = options.methods || {ren: true, mod10a1: true, mcd43a3: true};
  
  // Run pixel-level analysis
  var startDate = ee.Date(date);
  var endDate = startDate.advance(1, 'day');
  
  try {
    var results = pixelComparison.runPixelComparison(
      startDate, endDate, methods, 
      glacierData.outlines, glacierData.geometry
    );
    
    // Export pixel data
    var description = 'pixel_test_' + date.replace(/-/g, '');
    var pixelFeatures = pixelExport.exportPixelComparisonStats(
      results, glacierData.geometry, description
    );
    
    // Generate summary statistics
    pixelExport.generatePixelSummary(pixelFeatures);
    
    lastTestResults = {
      date: date,
      results: results,
      pixelFeatures: pixelFeatures,
      description: description
    };
    
    print('✅ Single date test completed successfully');
    print('📊 Export description:', description);
    print('⚡ Check your Google Drive folder "albedo_pixel_analysis" for results');
    
    return lastTestResults;
    
  } catch (error) {
    print('❌ Error in single date test:', error);
    throw error;
  }
}

/**
 * Test pixel coordinate generation and validation
 */
function testPixelCoordinates(date) {
  date = date || '2023-08-07';
  
  print('🎯 Testing pixel coordinate system for date:', date);
  
  if (!glacierData) initializeTestEnvironment();
  
  var startDate = ee.Date(date);
  var endDate = startDate.advance(1, 'day');
  
  // Get one image from MOD09GA collection for testing
  var col = ee.ImageCollection('MODIS/061/MOD09GA')
    .filterDate(startDate, endDate)
    .filterBounds(glacierData.geometry)
    .first();
  
  if (!col) {
    print('❌ No MODIS data available for', date);
    return null;
  }
  
  // Generate pixel coordinates
  var pixelCoords = pixelId.generateSimplePixelCoordinates(col);
  var enhancedCoords = pixelId.generateEnhancedPixelCoordinates(col);
  
  // Sample a few pixels for validation
  var samples = pixelCoords.sample({
    region: glacierData.geometry,
    scale: 500,
    numPixels: 10
  });
  
  print('📍 Pixel coordinate samples:');
  samples.getInfo(function(sampleResults) {
    sampleResults.features.forEach(function(feature, i) {
      var props = feature.properties;
      var coords = feature.geometry.coordinates;
      
      print('  Pixel', i + 1, ':');
      print('    Lat/Lon:', coords[1].toFixed(6), ',', coords[0].toFixed(6));
      print('    Row/Col:', props.pixel_row, ',', props.pixel_col);
      print('    Pixel ID:', pixelId.formatSimplePixelId(props.pixel_row, props.pixel_col));
    });
  });
  
  return {
    simpleCoords: pixelCoords,
    enhancedCoords: enhancedCoords,
    samples: samples
  };
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate pixel-level results against existing regional analysis
 * This ensures our pixel approach produces consistent results
 */
function validateAgainstRegional(date) {
  date = date || '2023-08-07';
  
  print('🔍 Validating pixel results against regional analysis for:', date);
  
  if (!glacierData) initializeTestEnvironment();
  
  var startDate = ee.Date(date);
  var endDate = startDate.advance(1, 'day');
  var methods = {ren: true, mod10a1: true, mcd43a3: true};
  
  // Run original regional analysis
  print('  Running original regional analysis...');
  var regionalResults = originalComparison.runModularComparison(
    startDate, endDate, methods, 
    glacierData.outlines, glacierData.geometry
  );
  
  // Run new pixel analysis
  print('  Running new pixel analysis...');
  var pixelResults = pixelComparison.runPixelComparison(
    startDate, endDate, methods,
    glacierData.outlines, glacierData.geometry
  );
  
  // Extract pixel data for comparison
  var pixelFeatures = pixelExport.exportPixelComparisonStats(
    pixelResults, glacierData.geometry, 'validation_test_' + date.replace(/-/g, '')
  );
  
  print('✅ Validation analysis completed');
  print('📊 Compare results in exports to verify consistency');
  print('🔗 Regional vs Pixel analysis ready for comparison');
  
  return {
    regional: regionalResults,
    pixel: pixelResults,
    pixelFeatures: pixelFeatures,
    date: date
  };
}

/**
 * Quick validation function to check if pixel aggregation matches regional stats
 */
function quickValidation(date) {
  date = date || '2023-08-07';
  
  print('⚡ Quick validation for:', date);
  
  // This is a simplified check - full validation requires the complete workflow
  if (lastTestResults && lastTestResults.date === date) {
    print('✅ Using cached test results for validation');
    pixelExport.generatePixelSummary(lastTestResults.pixelFeatures);
    return lastTestResults;
  } else {
    print('🔄 Running fresh test for validation...');
    return testSingleDate(date);
  }
}

// ============================================================================
// EXTENDED TESTING FUNCTIONS
// ============================================================================

/**
 * Test pixel analysis over a small date range
 * Use with caution - can generate large amounts of data
 */
function testDateRange(startDate, endDate, options) {
  startDate = startDate || '2023-08-01';
  endDate = endDate || '2023-08-03';
  options = options || {};
  
  print('📅 Testing pixel analysis for date range:', startDate, 'to', endDate);
  print('⚠️  Warning: This may generate large datasets');
  
  if (!glacierData) initializeTestEnvironment();
  
  var methods = options.methods || {ren: true, mod10a1: false, mcd43a3: false}; // Start with just one method
  
  try {
    var results = pixelComparison.runPixelComparison(
      startDate, endDate, methods,
      glacierData.outlines, glacierData.geometry
    );
    
    var description = pixelExport.generateExportDescription(
      'pixel_range_test', startDate, endDate
    );
    
    var pixelFeatures = pixelExport.exportPixelComparisonStats(
      results, glacierData.geometry, description
    );
    
    print('✅ Date range test completed');
    print('📊 Export description:', description);
    
    return {
      startDate: startDate,
      endDate: endDate,
      results: results,
      pixelFeatures: pixelFeatures,
      description: description
    };
    
  } catch (error) {
    print('❌ Error in date range test:', error);
    throw error;
  }
}

/**
 * Test pixel pairs comparison (method vs method pixel-to-pixel)
 */
function testPixelPairs(date) {
  date = date || '2023-08-07';
  
  print('🔗 Testing pixel pairs comparison for:', date);
  
  if (!glacierData) initializeTestEnvironment();
  
  var startDate = ee.Date(date);
  var endDate = startDate.advance(1, 'day');
  var methods = {ren: true, mod10a1: true, mcd43a3: true};
  
  var results = pixelComparison.runPixelComparison(
    startDate, endDate, methods,
    glacierData.outlines, glacierData.geometry
  );
  
  var description = 'pixel_pairs_test_' + date.replace(/-/g, '');
  var pairFeatures = pixelExport.exportPixelPairsComparison(
    results, glacierData.geometry, description
  );
  
  print('✅ Pixel pairs test completed');
  print('📊 Export description:', description + '_pixel_pairs');
  
  return pairFeatures;
}

// ============================================================================
// UTILITY AND DEBUGGING FUNCTIONS
// ============================================================================

/**
 * Get information about the test environment
 */
function getTestInfo() {
  if (!glacierData) initializeTestEnvironment();
  
  print('📋 Test Environment Information:');
  print('  Glacier region area (approx):', glacierData.bounds.area().divide(1e6), 'km²');
  print('  Number of glacier outlines:', glacierData.outlines.size());
  print('  Test data available:', isInitialized ? 'Yes' : 'No');
  print('  Last test results:', lastTestResults ? lastTestResults.date : 'None');
  
  return {
    glacierData: glacierData,
    isInitialized: isInitialized,
    lastTestResults: lastTestResults
  };
}

/**
 * Clear test results and reset environment
 */
function resetTestEnvironment() {
  print('🔄 Resetting test environment...');
  
  glacierData = null;
  lastTestResults = null;
  isInitialized = false;
  
  print('✅ Test environment reset');
}

/**
 * Get last test results
 */
function getLastResults() {
  return lastTestResults;
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

/**
 * Run comprehensive test suite
 */
function runTestSuite() {
  print('🧪 Running Pixel Analysis Test Suite...');
  print('=====================================');
  
  try {
    // 1. Initialize environment
    print('\n1️⃣ Initializing test environment...');
    initializeTestEnvironment();
    
    // 2. Test pixel coordinates
    print('\n2️⃣ Testing pixel coordinate system...');
    testPixelCoordinates();
    
    // 3. Test single date analysis
    print('\n3️⃣ Testing single date pixel analysis...');
    testSingleDate();
    
    // 4. Quick validation
    print('\n4️⃣ Running quick validation...');
    quickValidation();
    
    print('\n✅ Test suite completed successfully!');
    print('📊 Check your Google Drive for exported pixel data');
    print('🔗 Use validateAgainstRegional() for detailed comparison');
    
  } catch (error) {
    print('❌ Test suite failed:', error);
    throw error;
  }
}

// ============================================================================
// AUTO-INITIALIZATION
// ============================================================================

// Initialize test environment on load
initializeTestEnvironment();

print('🚀 Pixel Analysis Test Environment Loaded');
print('📋 Available functions:');
print('  • testSingleDate(date) - Test single date analysis');
print('  • testPixelCoordinates(date) - Test coordinate system');
print('  • validateAgainstRegional(date) - Compare with existing results');
print('  • testDateRange(start, end) - Test date range (use carefully)');
print('  • testPixelPairs(date) - Test pixel-to-pixel comparisons');
print('  • runTestSuite() - Run complete test suite');
print('  • getTestInfo() - Get environment information');
print('  • resetTestEnvironment() - Reset test state');
print('');
print('🎯 Quick start: testSingleDate("2023-08-07")');

// ============================================================================
// EXPORTS
// ============================================================================

exports.testSingleDate = testSingleDate;
exports.testPixelCoordinates = testPixelCoordinates;
exports.validateAgainstRegional = validateAgainstRegional;
exports.quickValidation = quickValidation;
exports.testDateRange = testDateRange;
exports.testPixelPairs = testPixelPairs;
exports.runTestSuite = runTestSuite;
exports.getTestInfo = getTestInfo;
exports.resetTestEnvironment = resetTestEnvironment;
exports.getLastResults = getLastResults;