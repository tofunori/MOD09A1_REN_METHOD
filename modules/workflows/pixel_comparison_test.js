/**
 * Pixel-by-Pixel Comparison Workflow Test Module
 *
 * SAFE TESTING VERSION - Does not modify existing workflow
 * 
 * Processes all three MODIS albedo methods with pixel-level export:
 * - MOD09GA Method: Topographic and BRDF correction (Ren et al.)
 * - MOD10A1: Snow albedo with advanced QA filtering  
 * - MCD43A3: BRDF/Albedo product with Collection 6.1 QA
 * 
 * Key Differences from comparison.js:
 * - Uses sample() instead of reduceRegion() for pixel-level data
 * - Adds pixel coordinate tracking with MODIS sinusoidal projection
 * - Maintains exact same processing algorithms and QA logic
 * - Output: One CSV row per valid glacier pixel per observation day
 *
 * Author: Pixel Analysis Enhancement
 * Date: 2025-07-02
 */

// ============================================================================
// MODULE IMPORTS
// ============================================================================

// global `ee` provided by Earth Engine runtime
var config      = require('users/tofunori/MOD09A1_REN_METHOD:modules/config.js');
var glacierUtils= require('users/tofunori/MOD09A1_REN_METHOD:modules/utils/glacier.js');
var mod09gaMethod = require('users/tofunori/MOD09A1_REN_METHOD:modules/methods/mod09ga.js');
var mod10a1Method = require('users/tofunori/MOD09A1_REN_METHOD:modules/methods/mod10a1.js');
var mcd43a3Method = require('users/tofunori/MOD09A1_REN_METHOD:modules/methods/mcd43a3.js');

// ============================================================================
// HELPER FUNCTIONS (IDENTICAL TO ORIGINAL)
// ============================================================================

/**
 * Filter MODIS collection by date, region, and apply Terra/Aqua daily compositing
 * IDENTICAL to comparison.js - preserves exact same logic
 */
function getFilteredCollection(startDate, endDate, region, collection) {
  function buildCollection(ids) {
    if (!ids) {
      return null;
    }
    if (typeof ids === 'string') {
      ids = [ids];
    }
    var merged = ee.ImageCollection(ids[0]);
    for (var i = 1; i < ids.length; i++) {
      merged = merged.merge(ee.ImageCollection(ids[i]));
    }
    return merged;
  }

  var col = buildCollection(collection);

  col = glacierUtils.applyStandardFiltering(
    col, startDate, endDate, region, config.PROCESSING_CONFIG.melt_season_only
  );

  col = col.map(function(img) { return ee.Image(img); });

  return col;
}

/**
 * Process MOD09GA collection using Ren method - IDENTICAL logic
 */
function processRenCollection(startDate, endDate, region, glacierOutlines) {
  var terraCol = getFilteredCollection(startDate, endDate, region, config.MODIS_COLLECTIONS.MOD09GA);
  var aquaCol = getFilteredCollection(startDate, endDate, region, config.MODIS_COLLECTIONS.MYD09GA);
  
  terraCol = terraCol.map(function(img) {
    return img.set('is_terra', true);
  });
  
  aquaCol = aquaCol.map(function(img) {
    return img.set('is_terra', false);
  });
  
  var collection = terraCol.merge(aquaCol).sort('system:time_start');
  
  var createGlacierMask = glacierUtils.createGlacierMask;
  return collection.map(function (img) {
    return mod09gaMethod.processMOD09GAMethod(img, glacierOutlines, createGlacierMask);
  });
}

/**
 * Process MOD10A1 snow albedo collection - IDENTICAL logic
 */
function processMOD10A1Collection(startDate, endDate, region, glacierOutlines) {
  var terraCol = getFilteredCollection(startDate, endDate, region, config.MODIS_COLLECTIONS.MOD10A1);
  var aquaCol = getFilteredCollection(startDate, endDate, region, config.MODIS_COLLECTIONS.MYD10A1);
  
  terraCol = terraCol.map(function(img) {
    return img.set('is_terra', true);
  });
  
  aquaCol = aquaCol.map(function(img) {
    return img.set('is_terra', false);
  });
  
  var collection = terraCol.merge(aquaCol).sort('system:time_start');
  
  var createGlacierMask = glacierUtils.createGlacierMask;
  return collection.map(function (img) {
    return mod10a1Method.processMOD10A1(img, glacierOutlines, createGlacierMask);
  });
}

/**
 * Process MCD43A3 BRDF/Albedo product - IDENTICAL logic
 */
function processMCD43A3Collection(startDate, endDate, region, glacierOutlines) {
  var collection = getFilteredCollection(startDate, endDate, region, config.MODIS_COLLECTIONS.MCD43A3);
  var createGlacierMask = glacierUtils.createGlacierMask;
  return collection.map(function (img) {
    return mcd43a3Method.processMCD43A3(img, glacierOutlines, createGlacierMask);
  });
}

// ============================================================================
// PIXEL COORDINATE UTILITIES
// ============================================================================

/**
 * Generate pixel coordinate bands using MODIS sinusoidal projection
 * Creates row/col coordinates for robust pixel tracking
 */
function generatePixelCoordinates(referenceImage) {
  var projection = referenceImage.projection();
  
  var coords = ee.Image.pixelCoordinates(projection);
  var pixelRow = coords.select('y').int().rename('pixel_row');
  var pixelCol = coords.select('x').int().rename('pixel_col');
  
  // Create pixel ID using sinusoidal coordinates (SIN_row_col format)
  var pixelId = pixelRow.multiply(1000000).add(pixelCol).int().rename('pixel_id_numeric');
  
  return ee.Image.cat([pixelRow, pixelCol, pixelId]);
}

/**
 * Add pixel coordinates to processed image
 */
function addPixelCoordinates(image) {
  var pixelCoords = generatePixelCoordinates(image);
  return image.addBands(pixelCoords);
}

// ============================================================================
// PIXEL-LEVEL PROCESSING FUNCTIONS
// ============================================================================

/**
 * Run pixel-level comparison processing all selected methods
 * Same logic as runModularComparison but maintains pixel-level data
 */
function runPixelComparison(startDate, endDate, methods, glacierOutlines, region, successCb, errorCb) {
  try {
    var resultsObj = {};

    // Process MOD09A1 method if selected (uses MOD09GA)
    if (methods.ren) {
      var renCollection = processRenCollection(startDate, endDate, region, glacierOutlines);
      // Add pixel coordinates to each image in collection
      resultsObj.ren = renCollection.map(addPixelCoordinates);
    }

    // Process MOD10A1 method if selected
    if (methods.mod10a1) {
      var mod10a1Collection = processMOD10A1Collection(startDate, endDate, region, glacierOutlines);
      resultsObj.mod10a1 = mod10a1Collection.map(addPixelCoordinates);
    }

    // Process MCD43A3 method if selected
    if (methods.mcd43a3) {
      var mcd43a3Collection = processMCD43A3Collection(startDate, endDate, region, glacierOutlines);
      resultsObj.mcd43a3 = mcd43a3Collection.map(addPixelCoordinates);
    }

    if (successCb) successCb(resultsObj);
    return resultsObj;
  } catch (err) {
    if (errorCb) errorCb(err.toString());
    throw err;
  }
}

/**
 * Extract pixel samples from a single processed image
 * Returns feature collection with pixel-level data
 */
function extractPixelSamples(image, region, methodName) {
  // Determine the albedo band name based on method
  var albedoBand;
  if (methodName === 'MOD09GA') {
    albedoBand = image.bandNames().contains('broadband_albedo_ren_masked')
      .getInfo() ? 'broadband_albedo_ren_masked' : 'broadband_albedo_ren';
  } else if (methodName === 'MOD10A1') {
    albedoBand = 'broadband_albedo_mod10a1';
  } else if (methodName === 'MCD43A3') {
    albedoBand = 'broadband_albedo_mcd43a3';
  } else {
    throw new Error('Unknown method: ' + methodName);
  }

  // Check if albedo band exists
  var hasBand = image.bandNames().contains(albedoBand);
  
  return ee.FeatureCollection(ee.Algorithms.If(
    hasBand,
    // Sample pixels if band exists
    image.select([albedoBand, 'pixel_row', 'pixel_col', 'pixel_id_numeric'])
      .sample({
        region: region,
        scale: methodName === 'MOD09GA' ? config.EXPORT_CONFIG.scale : config.EXPORT_CONFIG.scale_simple,
        tileScale: config.EXPORT_CONFIG.tileScale,
        geometries: true  // Include lat/lon coordinates
      })
      .map(function(feature) {
        var coords = feature.geometry().coordinates();
        var date = ee.Date(image.get('system:time_start'));
        
        // Base properties
        var props = {
          'albedo_value': feature.get(albedoBand),
          'pixel_row': feature.get('pixel_row'),
          'pixel_col': feature.get('pixel_col'), 
          'pixel_id': feature.get('pixel_id_numeric'),
          'longitude': ee.List(coords).get(0),
          'latitude': ee.List(coords).get(1),
          'date': date.format('YYYY-MM-dd'),
          'year': date.get('year'),
          'month': date.get('month'),
          'day_of_year': date.getRelative('day', 'year'),
          'method': ee.Algorithms.If(image.get('is_terra'), methodName + '_Terra', methodName + '_Aqua'),
          'system:time_start': image.get('system:time_start')
        };
        
        // Add method-specific predictors for MOD09GA
        if (methodName === 'MOD09GA') {
          props = ee.Dictionary(props).combine(ee.Dictionary({
            'solar_zenith': image.select('SolarZenith').multiply(0.01).sample(feature.geometry(), 500).first().get('SolarZenith'),
            'ndsi_value': image.expression('(b4 - b6) / (b4 + b6)', {
              'b4': image.select('sur_refl_b04').multiply(0.0001),
              'b6': image.select('sur_refl_b06').multiply(0.0001)
            }).sample(feature.geometry(), 500).first().get('constant'),
            'elevation': config.dem.sample(feature.geometry(), 500).first().get('DSM')
          }));
        }
        
        return feature.set(props);
      }),
    // Return empty collection if band doesn't exist
    ee.FeatureCollection([])
  ));
}

/**
 * Process single method collection to pixel-level features
 */
function processMethodToPixels(collection, region, methodName) {
  return collection.map(function(image) {
    return extractPixelSamples(image, region, methodName);
  }).flatten();
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Run pixel-level comparison and export results
 */
function runPixelComparisonExport(startDate, endDate, methods, glacierOutlines, region, description) {
  // Get pixel-level results
  var results = runPixelComparison(startDate, endDate, methods, glacierOutlines, region);
  
  var allPixels = ee.FeatureCollection([]);
  
  // Process each method to pixel features
  if (methods.ren && results.ren) {
    var renPixels = processMethodToPixels(results.ren, region, 'MOD09GA');
    allPixels = allPixels.merge(renPixels);
  }
  
  if (methods.mod10a1 && results.mod10a1) {
    var mod10a1Pixels = processMethodToPixels(results.mod10a1, region, 'MOD10A1');
    allPixels = allPixels.merge(mod10a1Pixels);
  }
  
  if (methods.mcd43a3 && results.mcd43a3) {
    var mcd43a3Pixels = processMethodToPixels(results.mcd43a3, region, 'MCD43A3');
    allPixels = allPixels.merge(mcd43a3Pixels);
  }
  
  // Export pixel-level results
  Export.table.toDrive({
    collection: allPixels,
    description: description + '_pixel_level',
    folder: 'albedo_pixel_analysis',
    fileFormat: 'CSV'
  });
  
  return allPixels;
}

/**
 * Test function for single date pixel analysis
 */
function testSingleDatePixelAnalysis(date, glacierOutlines, region) {
  var startDate = ee.Date(date);
  var endDate = startDate.advance(1, 'day');
  
  var methods = {ren: true, mod10a1: true, mcd43a3: true};
  var description = 'pixel_test_' + date.replace(/-/g, '');
  
  return runPixelComparisonExport(startDate, endDate, methods, glacierOutlines, region, description);
}

// ============================================================================
// EXPORTS
// ============================================================================

exports.runPixelComparison = runPixelComparison;
exports.runPixelComparisonExport = runPixelComparisonExport;
exports.testSingleDatePixelAnalysis = testSingleDatePixelAnalysis;
exports.extractPixelSamples = extractPixelSamples;
exports.processMethodToPixels = processMethodToPixels;
exports.generatePixelCoordinates = generatePixelCoordinates;