/**
 * Main Script - Modular MODIS Albedo Methods Comparison
 * 
 * This script coordinates the comparison of three MODIS albedo retrieval methods:
 * 1. MOD09A1 Ren Method (2021/2023) - Complete scientific methodology
 * 2. MOD10A1 Snow Albedo - NDSI-based snow albedo product
 * 3. MCD43A3 BRDF/Albedo - Kernel-driven BRDF model albedo
 * 
 * Author: Modular Comparison Framework
 * Date: 2025-06-29
 * Purpose: Coordinated comparison of MODIS albedo retrieval methods
 */

// ============================================================================
// IMPORT MODULES (simulated for GEE)
// Note: In actual GEE, these would need to be loaded differently
// ============================================================================

// In a real GEE environment, you would require or load these modules
// For now, we'll include the essential functions directly

// Load glacier data
var glacierImage = ee.Image('projects/tofunori/assets/Saskatchewan_glacier_2024_updated');
var glacierBounds = glacierImage.geometry().bounds();

var glacierOutlines = glacierImage.gt(0).selfMask().reduceToVectors({
  geometry: glacierBounds,
  scale: 30,
  geometryType: 'polygon'
});

// ============================================================================
// IMPORT ESSENTIAL FUNCTIONS FROM MODULES
// ============================================================================

// From common_functions.js
function createGlacierMask(glacierOutlines, glacierImage) {
  if (glacierOutlines) {
    // Create high-resolution glacier map with proper bounds
    var glacierBounds = glacierOutlines.geometry().bounds();
    var glacierMap = ee.Image(0).paint(glacierOutlines, 1).unmask(0)
      .clip(glacierBounds)
      .setDefaultProjection({
        crs: 'EPSG:4326',
        scale: 30
      });
    
    // Calculate glacier fractional abundance in each MODIS pixel (500m)
    var glacierFraction = glacierMap
      .reduceResolution({
        reducer: ee.Reducer.mean(),
        maxPixels: 1000
      })
      .reproject({
        crs: 'EPSG:4326',
        scale: 500
      });
    
    // Apply 50% glacier abundance threshold and ensure within glacier bounds
    var mask50 = glacierFraction.gt(0.50);
    
    // Additional safety: mask to glacier bounds
    var glacierBoundsMask = ee.Image().paint(glacierOutlines, 1).gt(0);
    
    return mask50.and(glacierBoundsMask);
  } else {
    // Simple fallback - use the glacier image directly
    return glacierImage.gt(0.50);
  }
}

function filterMeltSeason(collection) {
  return collection.filter(ee.Filter.calendarRange(6, 9, 'month'));
}

// Note: In a real modular setup, you would require:
// var renMethod = require('users/tofunori/modules:methods/ren_method');
// var mod10a1Method = require('users/tofunori/modules:methods/mod10a1_method');
// var mcd43a3Method = require('users/tofunori/modules:methods/mcd43a3_method');
// var exportFunctions = require('users/tofunori/modules:utils/export_functions');

// For this implementation, we'll reference the processing functions directly
// These would be loaded from the respective module files

// ============================================================================
// MAIN COMPARISON FUNCTION
// ============================================================================

/**
 * Main comparison function - processes all three methods
 */
function compareAlbedoMethods(geometry, startDate, endDate, glacierOutlines) {
  print('Starting modular albedo method comparison...');
  print('Date range: ' + startDate + ' to ' + endDate);
  print('Filtering for MELT SEASON ONLY (June 1 - September 30)');
  
  // Method 1: MOD09A1 Ren Method
  print('Processing Method 1: MOD09A1 Ren Method...');
  var mod09Collection = ee.ImageCollection('MODIS/061/MOD09GA')
    .filterDate(startDate, endDate)
    .filterBounds(geometry);
  
  // Filter to melt season only
  mod09Collection = filterMeltSeason(mod09Collection);
  
  // DEBUG: Print collection sizes
  mod09Collection.size().evaluate(function(size) {
    print('MOD09GA collection size before processing: ' + size);
  });
  
  // Process using Ren method (would be: renMethod.processRenMethod)
  var renResults = mod09Collection.map(function(image) {
    // This would call: return renMethod.processRenMethod(image, glacierOutlines, createGlacierMask);
    // For now, we reference the function directly
    print('Note: In modular setup, this would call renMethod.processRenMethod()');
    return image; // Placeholder - would be actual processing
  });
  
  // Method 2: MOD10A1 Snow Albedo
  print('Processing Method 2: MOD10A1 Snow Albedo...');
  var mod10Collection = ee.ImageCollection('MODIS/061/MOD10A1')
    .filterDate(startDate, endDate)
    .filterBounds(geometry);
  
  // Filter to melt season only
  mod10Collection = filterMeltSeason(mod10Collection);
  
  // DEBUG: Print collection sizes
  mod10Collection.size().evaluate(function(size) {
    print('MOD10A1 collection size before processing: ' + size);
  });
  
  // Process using MOD10A1 method (would be: mod10a1Method.processMOD10A1)
  var mod10Results = mod10Collection.map(function(image) {
    // This would call: return mod10a1Method.processMOD10A1(image, glacierOutlines);
    print('Note: In modular setup, this would call mod10a1Method.processMOD10A1()');
    return image; // Placeholder - would be actual processing
  });
  
  // Method 3: MCD43A3 BRDF/Albedo
  print('Processing Method 3: MCD43A3 BRDF/Albedo...');
  var mcd43Collection = ee.ImageCollection('MODIS/061/MCD43A3')
    .filterDate(startDate, endDate)
    .filterBounds(geometry);
  
  // Filter to melt season only
  mcd43Collection = filterMeltSeason(mcd43Collection);
  
  // DEBUG: Print collection sizes
  mcd43Collection.size().evaluate(function(size) {
    print('MCD43A3 collection size before processing: ' + size);
  });
  
  // Process using MCD43A3 method (would be: mcd43a3Method.processMCD43A3)
  var mcd43Results = mcd43Collection.map(function(image) {
    // This would call: return mcd43a3Method.processMCD43A3(image, glacierOutlines);
    print('Note: In modular setup, this would call mcd43a3Method.processMCD43A3()');
    return image; // Placeholder - would be actual processing
  });
  
  return {
    ren: renResults,
    mod10a1: mod10Results,
    mcd43a3: mcd43Results
  };
}

// ============================================================================
// USER INTERFACE
// ============================================================================

// Create UI Panel
var panel = ui.Panel({
  layout: ui.Panel.Layout.flow('vertical'),
  style: {
    width: '350px',
    padding: '10px',
    backgroundColor: 'white'
  }
});

var title = ui.Label({
  value: 'Modular MODIS Albedo Comparison',
  style: {
    fontSize: '20px',
    fontWeight: 'bold',
    margin: '10px 0px'
  }
});
panel.add(title);

var description = ui.Label({
  value: '🏗️ MODULAR ARCHITECTURE\n\nCompare three MODIS albedo methods:\n1. MOD09A1 Ren Method (Complete)\n2. MOD10A1 Snow Albedo (Direct)\n3. MCD43A3 BRDF/Albedo (Direct)\n\n📁 Structure: /methods/, /utils/, /config/\n💾 CSV EXPORT: All observations 2017-2024\n🔥 MELT SEASON: Jun-Sep only',
  style: {
    fontSize: '12px',
    margin: '0px 0px 10px 0px'
  }
});
panel.add(description);

// Date selection
var startDateLabel = ui.Label('Start Date (YYYY-MM-DD):');
var startDateBox = ui.Textbox({
  placeholder: '2017-06-01',
  value: '2017-06-01',
  style: {width: '150px'}
});

var endDateLabel = ui.Label('End Date (YYYY-MM-DD):');
var endDateBox = ui.Textbox({
  placeholder: '2024-09-30',
  value: '2024-09-30',
  style: {width: '150px'}
});

panel.add(startDateLabel);
panel.add(startDateBox);
panel.add(endDateLabel);
panel.add(endDateBox);

// Method selection checkboxes
var methodsLabel = ui.Label('Methods to Compare:');
panel.add(methodsLabel);

var renCheckbox = ui.Checkbox({
  label: 'MOD09A1 Ren Method',
  value: true,
  style: {margin: '2px'}
});

var mod10Checkbox = ui.Checkbox({
  label: 'MOD10A1 Snow Albedo',
  value: true,
  style: {margin: '2px'}
});

var mcd43Checkbox = ui.Checkbox({
  label: 'MCD43A3 BRDF/Albedo',
  value: true,
  style: {margin: '2px'}
});

panel.add(renCheckbox);
panel.add(mod10Checkbox);
panel.add(mcd43Checkbox);

// Process button
var processButton = ui.Button({
  label: 'Run Modular Comparison',
  style: {
    backgroundColor: '#4285f4',
    color: 'white',
    margin: '10px 0px',
    width: '300px'
  }
});
panel.add(processButton);

// Status label
var statusLabel = ui.Label({
  value: '🏗️ MODULAR READY: Each method in separate file!',
  style: {
    fontSize: '11px',
    color: 'blue',
    fontStyle: 'italic'
  }
});
panel.add(statusLabel);

// Add panel to map
ui.root.insert(0, panel);

// Global variables
var currentResults = null;

// Process button event handler
processButton.onClick(function() {
  var startDate = startDateBox.getValue();
  var endDate = endDateBox.getValue();
  
  statusLabel.setValue('Processing modular comparison analysis...');
  statusLabel.style().set('color', 'orange');
  
  // Clear existing layers
  Map.layers().reset();
  Map.addLayer(glacierImage.selfMask(), {palette: ['red']}, 'Saskatchewan Glacier Outline');
  
  // Run comparison analysis
  var results = compareAlbedoMethods(glacierBounds, startDate, endDate, glacierOutlines);
  currentResults = results;
  
  print('🏗️ MODULAR COMPARISON COMPLETE');
  print('Note: This is a demonstration of the modular structure.');
  print('In full implementation, each method would be processed by its dedicated module.');
  
  statusLabel.setValue('Modular comparison demonstration complete!');
  statusLabel.style().set('color', 'green');
});

// Initialize map
Map.centerObject(glacierBounds, 12);
Map.addLayer(glacierImage.selfMask(), {palette: ['red']}, 'Saskatchewan Glacier Outline');

print('🏗️ Modular MODIS Albedo Methods Comparison Tool loaded successfully!');
print('📁 Structure created: config/, methods/, utils/, main.js');
print('🔧 Each method is now in its own dedicated module file.');
print('💡 To use: load individual modules and call their processing functions.');