/**
 * Full Comparison Workflow – All Three Methods
 *
 * Processes all three MODIS albedo methods with full CSV export:
 * - MOD09GA Method: Topographic and BRDF correction
 * - MOD10A1: Snow albedo with advanced QA filtering  
 * - MCD43A3: BRDF/Albedo product with Collection 6.1 QA
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
var exportUtils = require('users/tofunori/MOD09A1_REN_METHOD:modules/utils/export.js');

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Filter MODIS collection by date, region, and apply Terra/Aqua daily compositing
 */
function getFilteredCollection(startDate, endDate, region, collection) {
  // Helper → turn a single ID or an array of IDs into one merged collection
  function buildCollection(ids) {
    if (!ids) {
      return null;
    }
    // If a single ID string is provided, wrap it in an array for uniformity
    if (typeof ids === 'string') {
      ids = [ids];
    }
    // Build the merged ImageCollection starting from the first ID
    var merged = ee.ImageCollection(ids[0]);
    for (var i = 1; i < ids.length; i++) {
      merged = merged.merge(ee.ImageCollection(ids[i]));
    }
    return merged;
  }

  // Default behaviour: merge Terra + Aqua surface-reflectance collections
  var isDefaultTerraAquaMerge = false; // flag to know if daily compositing needed
  var col;
  
  if (!collection) {
    // Build Terra and Aqua collections separately, then mark them
    var terraCol = ee.ImageCollection(config.MODIS_COLLECTIONS.MOD09GA).map(function(img) {
      return img.set('is_terra', true);
    });
    var aquaCol = ee.ImageCollection(config.MODIS_COLLECTIONS.MYD09GA).map(function(img) {
      return img.set('is_terra', false);
    });
    // Merge the pre-marked collections
    col = terraCol.merge(aquaCol);
    isDefaultTerraAquaMerge = true;
  } else {
    col = buildCollection(collection);
  }
  print('Initial collection size:', col.size());

  // Apply temporal / spatial filters
  col = glacierUtils.applyStandardFiltering(
    col, startDate, endDate, region, config.PROCESSING_CONFIG.melt_season_only
  );
  print('After standard filtering:', col.size());

  // -------------------------------------------------------------------
  // NEW: one-image-per-day compositing (Terra priority, Aqua fallback)
  // Per CLAUDE.md: use simple merge/sort as recommended in working solution
  // -------------------------------------------------------------------
  if (isDefaultTerraAquaMerge) {
    // Images are already marked with is_terra property during collection building
    var terra = col.filter(ee.Filter.eq('is_terra', true));
    var aqua = col.filter(ee.Filter.eq('is_terra', false));
    print('Terra count:', terra.size());
    print('Aqua count:', aqua.size());
    
    // Simple approach per CLAUDE.md: just merge and sort
    col = terra.merge(aqua).sort('system:time_start');
    print('After Terra/Aqua merge:', col.size());
  }

  // Ensure every element returned is explicitly an ee.Image so downstream
  // methods like .clip() are always available.
  col = col.map(function(img) { return ee.Image(img); });
  print('Final collection size:', col.size());

  return col;
}

/**
 * Process MOD09GA collection using Ren method with topographic and BRDF correction
 */
function processRenCollection(collection, glacierOutlines) {
  var createGlacierMask = glacierUtils.createGlacierMask;
  // Ensure every element is an ee.Image (distinct may return generic elements)
  collection = collection.map(function(img) {
    return ee.Image(img);
  });
  return collection.map(function (img) {
    return mod09gaMethod.processMOD09GAMethod(img, glacierOutlines, createGlacierMask);
  });
}

/**
 * Process MOD10A1 snow albedo collection with advanced QA filtering
 */
function processMOD10A1Collection(startDate, endDate, region, glacierOutlines) {
  // Get Terra collection
  var terraCol = getFilteredCollection(startDate, endDate, region, config.MODIS_COLLECTIONS.MOD10A1);
  // Get Aqua collection  
  var aquaCol = getFilteredCollection(startDate, endDate, region, config.MODIS_COLLECTIONS.MYD10A1);
  
  // Mark Terra images with is_terra flag
  terraCol = terraCol.map(function(img) {
    return img.set('is_terra', true);
  });
  
  // Mark Aqua images with is_terra flag
  aquaCol = aquaCol.map(function(img) {
    return img.set('is_terra', false);
  });
  
  // Merge with Terra first for priority
  var collection = terraCol.merge(aquaCol).sort('system:time_start');
  
  var createGlacierMask = glacierUtils.createGlacierMask;
  return collection.map(function (img) {
    return mod10a1Method.processMOD10A1(img, glacierOutlines, createGlacierMask);
  });
}

/**
 * Process MCD43A3 BRDF/Albedo product with Collection 6.1 QA filtering
 */
function processMCD43A3Collection(startDate, endDate, region, glacierOutlines) {
  var collection = getFilteredCollection(startDate, endDate, region, config.MODIS_COLLECTIONS.MCD43A3);
  var createGlacierMask = glacierUtils.createGlacierMask;
  return collection.map(function (img) {
    return mcd43a3Method.processMCD43A3(img, glacierOutlines, createGlacierMask);
  });
}

// ============================================================================
// PUBLIC API – minimal subset used by main.js
// ============================================================================

/**
 * Run modular comparison processing all selected methods
 */
function runModularComparison(startDate, endDate, methods, glacierOutlines, region, successCb, errorCb) {
  try {
    var resultsObj = {};

    // Process MOD09A1 method if selected (uses MOD09GA)
    if (methods.ren) {
      var filtered = getFilteredCollection(startDate, endDate, region);
      resultsObj.ren_count = filtered.size();
      resultsObj.ren = processRenCollection(filtered, glacierOutlines);
    }

    // Process MOD10A1 method if selected (uses MOD10A1)
    if (methods.mod10a1) {
      resultsObj.mod10a1 = processMOD10A1Collection(startDate, endDate, region, glacierOutlines);
    }

    // Process MCD43A3 method if selected (uses MCD43A3)
    if (methods.mcd43a3) {
      resultsObj.mcd43a3 = processMCD43A3Collection(startDate, endDate, region, glacierOutlines);
    }
    if (successCb) successCb(resultsObj);
    return resultsObj;
  } catch (err) {
    if (errorCb) errorCb(err.toString());
    throw err;
  }
}

/**
 * Export comparison results to CSV
 */
function exportComparisonResults(startDate, endDate, results, region, successCb, errorCb) {
  try {
    var description = exportUtils.generateExportDescription('modular_albedo_comparison', startDate, endDate);
    exportUtils.exportComparisonStats(results, region, description);
    if (successCb) successCb();
  } catch (err) {
    if (errorCb) errorCb(err.toString());
  }
}

/**
 * Run QA profile comparison analysis
 */
function runQAProfileComparison(startDate, endDate, glacierOutlines, region, successCb, errorCb) {
  try {
    var filtered = getFilteredCollection(startDate, endDate, region);
    var createGlacierMask = glacierUtils.createGlacierMask;
    var description = exportUtils.generateExportDescription('qa_profile_comparison', startDate, endDate);
    
    exportUtils.exportQAProfileComparison(filtered, glacierOutlines, createGlacierMask, region, description);
    if (successCb) successCb({ expectedOutputs: [description + '_qa_profile_comparison'] });
  } catch (err) {
    if (errorCb) errorCb(err.toString());
  }
}

// ============================================================================
// QUICK SINGLE-DATE EXPORT HELPER
// ============================================================================

/**
 * Export single-date MOD09GA albedo map as GeoTIFF using Ren method
 * @param {string} date ISO string 'YYYY-MM-DD'
 * @param {ee.FeatureCollection} glacierOutlines Glacier polygons
 * @param {ee.Geometry} region Region of interest for export
 * @param {Object} options Export parameters (description, scale, maxPixels)
 */
function exportRenAlbedoSingleDate(date, glacierOutlines, region, options) {
  options = options || {};
  var start = ee.Date(date);
  var end   = start.advance(1, 'day');

  // Collect Terra + Aqua surface-reflectance images for that day
  var col = getFilteredCollection(start, end, region);
  var first = ee.Image(col.first());
  if (!first) {
    throw new Error('No MOD09GA/MYD09GA data available on ' + date);
  }

  var processed = ee.Image(processRenCollection(col, glacierOutlines)
                    .first())
                    .select('broadband_albedo_ren_masked');

  var exportImg = processed.visualize({
    min: 0, max: 1,
    palette: ['8c2d04','cc4c02','ec7014','fe9929','fed98e','ffffbf',
              'c7e9b4','7fcdbb','41b6c4','2c7fb8','253494']
  }).blend(ee.Image().paint(glacierOutlines, 0, 2));

  Export.image.toDrive({
    image: exportImg,
    description: options.description || ('RenAlbedo_' + date.replace(/-/g, '')),
    folder: options.folder || 'GEE_Exports',
    region: region,
    scale: options.scale || 500,
    crs: 'EPSG:4326',
    maxPixels: options.maxPixels || 1e9,
    fileFormat: 'GeoTIFF'
  });
}

/**
 * Export the masked broadband albedo (Ren method) in its native MODIS
 * sinusoidal projection. Set `toAsset` true to export to EE Assets, otherwise
 * it exports to Drive (GeoTIFF).
 */
function exportRenAlbedoSingleDateNative(date, glacierOutlines, region, options) {
  options = options || {};
  var start = ee.Date(date);
  var end   = start.advance(1, 'day');

  var col = getFilteredCollection(start, end, region);
  var first = ee.Image(col.first());
  if (!first) {
    throw new Error('No MOD09GA/MYD09GA data available on ' + date);
  }
  var nativeProj = first.projection();

  var processed = ee.Image(processRenCollection(col, glacierOutlines)
                   .first())
                   .select('broadband_albedo_ren_masked');

  var exportParams = {
    image: processed,
    description: options.description || ('AlbedoNative_' + date.replace(/-/g, '')),
    region: region,
    scale: nativeProj.nominalScale(),
    crs: nativeProj,
    maxPixels: options.maxPixels || 1e9
  };

  if (options.toAsset) {
    exportParams.assetId = options.assetId || ('users/your_username/AlbedoNative_' + date.replace(/-/g, ''));
    Export.image.toAsset(exportParams);
  } else {
    exportParams.folder = options.folder || 'GEE_Exports';
    exportParams.fileFormat = 'GeoTIFF';
    Export.image.toDrive(exportParams);
  }
}


// ============================================================================
// EXPORTS
// ============================================================================

exports.runModularComparison     = runModularComparison;
exports.exportComparisonResults  = exportComparisonResults;
exports.runQAProfileComparison   = runQAProfileComparison;
exports.exportRenAlbedoSingleDate = exportRenAlbedoSingleDate;
exports.exportRenAlbedoSingleDateNative = exportRenAlbedoSingleDateNative; 