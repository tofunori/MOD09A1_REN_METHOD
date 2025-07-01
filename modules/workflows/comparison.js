/**
 * Full Comparison Workflow – All Three Methods
 *
 * Processes all three MODIS albedo methods with full CSV export:
 * - MOD09A1 Method (MOD09GA): Topographic and BRDF correction
 * - MOD10A1: Snow albedo with advanced QA filtering  
 * - MCD43A3: BRDF/Albedo product with Collection 6.1 QA
 */

// ============================================================================
// MODULE IMPORTS
// ============================================================================

// global `ee` provided by Earth Engine runtime
var config      = require('users/tofunori/MOD09A1_REN_METHOD:modules/config.js');
var glacierUtils= require('users/tofunori/MOD09A1_REN_METHOD:modules/utils/glacier.js');
var mod09a1Method = require('users/tofunori/MOD09A1_REN_METHOD:modules/methods/mod09a1.js');
var mod10a1Method = require('users/tofunori/MOD09A1_REN_METHOD:modules/methods/mod10a1.js');
var mcd43a3Method = require('users/tofunori/MOD09A1_REN_METHOD:modules/methods/mcd43a3.js');
var exportUtils = require('users/tofunori/MOD09A1_REN_METHOD:modules/utils/export.js');

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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
  if (!collection) {
    collection = [
      config.MODIS_COLLECTIONS.MOD09GA, // Terra morning pass
      config.MODIS_COLLECTIONS.MYD09GA  // Aqua afternoon pass
    ];
    isDefaultTerraAquaMerge = true;
  }

  var col = buildCollection(collection);

  // Apply temporal / spatial filters
  col = glacierUtils.applyStandardFiltering(
    col, startDate, endDate, region, config.PROCESSING_CONFIG.melt_season_only
  );

  // -------------------------------------------------------------------
  // NEW: one-image-per-day compositing (Terra priority, Aqua fallback)
  // -------------------------------------------------------------------
  if (isDefaultTerraAquaMerge) {
    // Flag platform preference: Terra (0) preferred over Aqua (1)
    var tagged = col.map(function(img) {
      var dateStr = ee.Date(img.get('system:time_start')).format('YYYY-MM-dd');
      var id = ee.String(img.get('system:id'));
      var isTerra = id.slice(0, 7).compareTo('MOD09GA').eq(0);
      return img.set({
        'simple_date': dateStr,
        'platform_pref': ee.Number(ee.Algorithms.If(isTerra, 0, 1))
      });
    });

    // Sort by date then preference, keep first image per day
    col = tagged
            .sort('platform_pref')
            .distinct('simple_date')
            .sort('system:time_start'); // keep chronological order
  }

  return col;
}

function processRenCollection(collection, glacierOutlines) {
  var createGlacierMask = glacierUtils.createGlacierMask;
  return collection.map(function (img) {
    return mod09a1Method.processMOD09A1Method(img, glacierOutlines, createGlacierMask);
  });
}

function processMOD10A1Collection(startDate, endDate, region, glacierOutlines) {
  var collection = getFilteredCollection(startDate, endDate, region, config.MODIS_COLLECTIONS.MOD10A1);
  var createGlacierMask = glacierUtils.createGlacierMask;
  return collection.map(function (img) {
    return mod10a1Method.processMOD10A1(img, glacierOutlines, createGlacierMask);
  });
}

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
      print('🔬 Processing MOD09A1 method (MOD09GA)...');
      var filtered = getFilteredCollection(startDate, endDate, region);
      resultsObj.ren = processRenCollection(filtered, glacierOutlines);
    }

    // Process MOD10A1 method if selected (uses MOD10A1)
    if (methods.mod10a1) {
      print('🔬 Processing MOD10A1 method...');
      resultsObj.mod10a1 = processMOD10A1Collection(startDate, endDate, region, glacierOutlines);
    }

    // Process MCD43A3 method if selected (uses MCD43A3)
    if (methods.mcd43a3) {
      print('🔬 Processing MCD43A3 method...');
      resultsObj.mcd43a3 = processMCD43A3Collection(startDate, endDate, region, glacierOutlines);
    }

    print('✅ All selected methods processed successfully');
    if (successCb) successCb(resultsObj);
    return resultsObj;
  } catch (err) {
    print('❌ Error in runModularComparison: ' + err.toString());
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
    print('✅ CSV export completed: ' + description);
    if (successCb) successCb();
  } catch (err) {
    print('❌ CSV export failed: ' + err.toString());
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
    print('✅ QA Profile comparison export completed: ' + description);
    
    if (successCb) successCb({ expectedOutputs: [description + '_qa_profile_comparison'] });
  } catch (err) {
    print('❌ QA Profile comparison failed: ' + err.toString());
    if (errorCb) errorCb(err.toString());
  }
}

// ============================================================================
// QUICK SINGLE-DATE EXPORT HELPER
// ============================================================================

/**
 * Export the MOD09A1-Ren broadband albedo for a single date (Terra+Aqua merged).
 * @param {string}            date        ISO string 'YYYY-MM-DD'.
 * @param {ee.FeatureCollection} glacierOutlines   Glacier polygons (or null to use default mask).
 * @param {ee.Geometry}       region      Region of interest for export (geometry or bounds).
 * @param {Object}            options     { description, scale, maxPixels }
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

  var processed = processRenCollection(col, glacierOutlines)
                    .first()
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

  var processed = processRenCollection(col, glacierOutlines)
                   .first()
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