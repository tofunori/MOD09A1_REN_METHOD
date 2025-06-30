/**
 * Main Orchestrator - Modular MODIS Albedo Methods Comparison
 * 
 * Clean entry point that coordinates the comparison of three MODIS albedo methods:
 * 1. MOD09A1 Ren Method (2021/2023) - Complete scientific methodology
 * 2. MOD10A1 Snow Albedo - NDSI-based snow albedo with advanced QA
 * 3. MCD43A3 BRDF/Albedo - Collection 6.1 with comprehensive QA filtering
 * 
 * Author: Modular Comparison Framework (Refactored)
 * Date: 2025-06-30
 * Purpose: Clean orchestration of modular components
 */

// ============================================================================
// MODULE IMPORTS
// ============================================================================

// TODO: In Google Earth Engine, require these modules:
// var constants = require('users/tofunori/MOD09A1_REN_METHOD:modular_comparison/config/constants');
// var renMethod = require('users/tofunori/MOD09A1_REN_METHOD:modular_comparison/methods/ren_method');
// var mod10a1Method = require('users/tofunori/MOD09A1_REN_METHOD:modular_comparison/methods/mod10a1_method');
// var mcd43a3Method = require('users/tofunori/MOD09A1_REN_METHOD:modular_comparison/methods/mcd43a3_method');
// var commonFunctions = require('users/tofunori/MOD09A1_REN_METHOD:modular_comparison/utils/common_functions');
// var exportFunctions = require('users/tofunori/MOD09A1_REN_METHOD:modular_comparison/utils/export_functions');
// var gui = require('users/tofunori/MOD09A1_REN_METHOD:modular_comparison/utils/gui');
// var mapViz = require('users/tofunori/MOD09A1_REN_METHOD:modular_comparison/utils/map_visualization');

// For demonstration, load simplified processing functions inline
var gui = require('./utils/gui.js');
var mapViz = require('./utils/map_visualization.js');

// ============================================================================
// GLOBAL CONFIGURATION
// ============================================================================

// Load glacier data
var glacierImage = ee.Image('projects/tofunori/assets/Saskatchewan_glacier_2024_updated');
var glacierBounds = glacierImage.geometry().bounds();
var glacierOutlines = glacierImage.gt(0).selfMask().reduceToVectors({
  geometry: glacierBounds,
  scale: 30,
  geometryType: 'polygon'
});

// Global state
var currentResults = null;

// ============================================================================
// SIMPLIFIED PROCESSING FUNCTIONS (INLINE FOR DEMONSTRATION)
// ============================================================================

/**
 * Create glacier mask for processing
 */
function createGlacierMask(glacierOutlines, glacierImage) {
  if (glacierOutlines) {
    var glacierBounds = glacierOutlines.geometry().bounds();
    var glacierMap = ee.Image(0).paint(glacierOutlines, 1).unmask(0)
      .clip(glacierBounds)
      .setDefaultProjection({
        crs: 'EPSG:4326',
        scale: 30
      });
    
    var glacierFraction = glacierMap
      .reduceResolution({
        reducer: ee.Reducer.mean(),
        maxPixels: 1000
      })
      .reproject({
        crs: 'EPSG:4326',
        scale: 500
      });
    
    var mask50 = glacierFraction.gt(0.50);
    var glacierBoundsMask = ee.Image().paint(glacierOutlines, 1).gt(0);
    
    return mask50.and(glacierBoundsMask);
  } else {
    return glacierImage.gt(0.50);
  }
}

/**
 * Filter collection to melt season (June-September)
 */
function filterMeltSeason(collection) {
  return collection.filter(ee.Filter.calendarRange(6, 9, 'month'));
}

/**
 * Simplified Ren Method processing
 */
function processRenMethod(image, glacierOutlines, createGlacierMask) {
  var mask = createGlacierMask(glacierOutlines, null);
  var reflectance = image.select(['sur_refl_b01', 'sur_refl_b02', 'sur_refl_b03', 'sur_refl_b05', 'sur_refl_b07']);
  
  var broadband = reflectance.expression(
    '0.160*b1 + 0.291*b2 + 0.243*b3 + 0.112*b5 + 0.081*b7', {
      'b1': reflectance.select('sur_refl_b01').multiply(0.0001),
      'b2': reflectance.select('sur_refl_b02').multiply(0.0001),
      'b3': reflectance.select('sur_refl_b03').multiply(0.0001),
      'b5': reflectance.select('sur_refl_b05').multiply(0.0001),
      'b7': reflectance.select('sur_refl_b07').multiply(0.0001)
    }).rename('broadband_albedo_ren');
  
  return image.addBands(broadband).updateMask(mask);
}

/**
 * Simplified MOD10A1 processing
 */
function processMOD10A1(image, glacierOutlines) {
  var snowCover = image.select('NDSI_Snow_Cover').multiply(0.01).rename('broadband_albedo_mod10a1');
  return image.addBands(snowCover);
}

/**
 * Simplified MCD43A3 processing
 */
function processMCD43A3(image, glacierOutlines) {
  var albedo = image.select('Albedo_BSA_shortwave').multiply(0.001).rename('broadband_albedo_mcd43a3');
  return image.addBands(albedo);
}

// ============================================================================
// CORE PROCESSING FUNCTIONS
// ============================================================================

/**
 * Main comparison function - processes all three methods
 */
function compareAlbedoMethods(geometry, startDate, endDate, glacierOutlines) {
  print('🚀 Starting modular albedo method comparison...');
  print('📅 Date range: ' + startDate + ' to ' + endDate);
  print('🔥 Filtering for MELT SEASON ONLY (June 1 - September 30)');
  
  // Method 1: MOD09A1 Ren Method
  print('⚙️ Processing Method 1: MOD09A1 Ren Method...');
  var mod09Collection = ee.ImageCollection('MODIS/061/MOD09GA')
    .filterDate(startDate, endDate)
    .filterBounds(geometry);
  
  mod09Collection = filterMeltSeason(mod09Collection);
  print('📊 MOD09GA collection size: ' + mod09Collection.size().getInfo());
  
  var renResults = mod09Collection.map(function(image) {
    return processRenMethod(image, glacierOutlines, createGlacierMask);
  });
  
  // Method 2: MOD10A1 Snow Albedo
  print('⚙️ Processing Method 2: MOD10A1 Snow Albedo...');
  var mod10Collection = ee.ImageCollection('MODIS/061/MOD10A1')
    .filterDate(startDate, endDate)
    .filterBounds(geometry);
  
  mod10Collection = filterMeltSeason(mod10Collection);
  print('📊 MOD10A1 collection size: ' + mod10Collection.size().getInfo());
  
  var mod10Results = mod10Collection.map(function(image) {
    return processMOD10A1(image, glacierOutlines);
  });
  
  // Method 3: MCD43A3 BRDF/Albedo
  print('⚙️ Processing Method 3: MCD43A3 BRDF/Albedo...');
  var mcd43Collection = ee.ImageCollection('MODIS/061/MCD43A3')
    .filterDate(startDate, endDate)
    .filterBounds(geometry);
  
  mcd43Collection = filterMeltSeason(mcd43Collection);
  print('📊 MCD43A3 collection size: ' + mcd43Collection.size().getInfo());
  
  var mcd43Results = mcd43Collection.map(function(image) {
    return processMCD43A3(image, glacierOutlines);
  });
  
  var results = {
    ren: renResults,
    mod10a1: mod10Results,
    mcd43a3: mcd43Results
  };
  
  print('✅ MODULAR COMPARISON COMPLETE');
  print('📈 Processing completed for all three methods');
  
  return results;
}

/**
 * Export comparison statistics to CSV
 */
function exportComparisonStats(results, region, description) {
  print('📤 Exporting comprehensive statistics to CSV...');
  
  var allStats = ee.FeatureCollection([]);
  
  // Process each method with comprehensive statistics
  if (results.ren) {
    var renStats = results.ren.map(function(image) {
      var stats = image.select('broadband_albedo_ren').reduceRegion({
        reducer: ee.Reducer.mean().combine({
          reducer2: ee.Reducer.stdDev(),
          sharedInputs: true
        }).combine({
          reducer2: ee.Reducer.count(),
          sharedInputs: true
        }),
        geometry: region,
        scale: 500,
        maxPixels: 1e6,
        bestEffort: true
      });
      
      var date = ee.Date(image.get('system:time_start'));
      return ee.Feature(null, {
        'albedo_mean': stats.get('broadband_albedo_ren_mean'),
        'albedo_std': stats.get('broadband_albedo_ren_stdDev'),
        'pixel_count': stats.get('broadband_albedo_ren_count'),
        'date': date.format('YYYY-MM-dd'),
        'year': date.get('year'),
        'month': date.get('month'),
        'method': 'Ren'
      });
    }).filter(ee.Filter.notNull(['albedo_mean']));
    allStats = allStats.merge(renStats);
  }
  
  if (results.mod10a1) {
    var mod10Stats = results.mod10a1.map(function(image) {
      var stats = image.select('broadband_albedo_mod10a1').reduceRegion({
        reducer: ee.Reducer.mean().combine({
          reducer2: ee.Reducer.stdDev(),
          sharedInputs: true
        }).combine({
          reducer2: ee.Reducer.count(),
          sharedInputs: true
        }),
        geometry: region,
        scale: 500,
        maxPixels: 1e6,
        bestEffort: true
      });
      
      var date = ee.Date(image.get('system:time_start'));
      return ee.Feature(null, {
        'albedo_mean': stats.get('broadband_albedo_mod10a1_mean'),
        'albedo_std': stats.get('broadband_albedo_mod10a1_stdDev'),
        'pixel_count': stats.get('broadband_albedo_mod10a1_count'),
        'date': date.format('YYYY-MM-dd'),
        'year': date.get('year'),
        'month': date.get('month'),
        'method': 'MOD10A1'
      });
    }).filter(ee.Filter.notNull(['albedo_mean']));
    allStats = allStats.merge(mod10Stats);
  }
  
  if (results.mcd43a3) {
    var mcd43Stats = results.mcd43a3.map(function(image) {
      var stats = image.select('broadband_albedo_mcd43a3').reduceRegion({
        reducer: ee.Reducer.mean().combine({
          reducer2: ee.Reducer.stdDev(),
          sharedInputs: true
        }).combine({
          reducer2: ee.Reducer.count(),
          sharedInputs: true
        }),
        geometry: region,
        scale: 500,
        maxPixels: 1e6,
        bestEffort: true
      });
      
      var date = ee.Date(image.get('system:time_start'));
      return ee.Feature(null, {
        'albedo_mean': stats.get('broadband_albedo_mcd43a3_mean'),
        'albedo_std': stats.get('broadband_albedo_mcd43a3_stdDev'),
        'pixel_count': stats.get('broadband_albedo_mcd43a3_count'),
        'date': date.format('YYYY-MM-dd'),
        'year': date.get('year'),
        'month': date.get('month'),
        'method': 'MCD43A3'
      });
    }).filter(ee.Filter.notNull(['albedo_mean']));
    allStats = allStats.merge(mcd43Stats);
  }
  
  // Export to CSV
  Export.table.toDrive({
    collection: allStats,
    description: description,
    folder: 'albedo_method_comparison',
    fileFormat: 'CSV'
  });
  
  print('✅ CSV export initiated: ' + description);
  print('📁 Check Google Drive folder: albedo_method_comparison');
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Process button callback
 */
function handleProcessing(startDate, endDate, successCallback, errorCallback) {
  try {
    // Clear existing map layers
    mapViz.clearLayers();
    
    // Run comparison analysis
    var results = compareAlbedoMethods(glacierBounds, startDate, endDate, glacierOutlines);
    currentResults = results;
    
    // Add visualization layers
    mapViz.addAlbedoLayers(results, false);
    mapViz.addTemporalComposites(results, 'mean');
    mapViz.addComparisonLayers(results);
    
    // Call success callback
    successCallback(results);
    
  } catch (error) {
    print('❌ Processing error: ' + error.message);
    errorCallback(error.message);
  }
}

/**
 * Export button callback
 */
function handleExport(startDate, endDate, successCallback, errorCallback) {
  try {
    if (!currentResults) {
      throw new Error('Please run comparison first!');
    }
    
    var description = 'modular_albedo_comparison_' + 
      startDate.replace(/-/g, '') + '_to_' + 
      endDate.replace(/-/g, '');
    
    exportComparisonStats(currentResults, glacierBounds, description);
    
    // Call success callback
    successCallback();
    
  } catch (error) {
    print('❌ Export error: ' + error.message);
    errorCallback(error.message);
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the application
 */
function initializeApp() {
  print('🏗️ Initializing Modular MODIS Albedo Comparison Tool...');
  
  // Initialize map
  mapViz.initializeMap(glacierImage, glacierBounds);
  
  // Create UI interface
  var uiComponents = gui.createMainInterface();
  
  // Setup event handlers
  gui.setupEventHandlers(uiComponents, handleProcessing, handleExport);
  
  print('✅ Modular MODIS Albedo Methods Comparison Tool loaded successfully!');
  print('🏗️ Architecture: Clean separation of GUI, Map, and Processing logic');
  print('📁 Structure: main.js → utils/gui.js + utils/map_visualization.js');
  print('🚀 Instructions: 1) Run Comparison, 2) Check map layers, 3) Export CSV');
}

// Start the application
initializeApp();