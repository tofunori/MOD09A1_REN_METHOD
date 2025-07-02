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

  var col = buildCollection(collection);

  // Apply temporal / spatial filters
  col = glacierUtils.applyStandardFiltering(
    col, startDate, endDate, region, config.PROCESSING_CONFIG.melt_season_only
  );

  // Ensure every element returned is explicitly an ee.Image so downstream
  // methods like .clip() are always available.
  col = col.map(function(img) { return ee.Image(img); });

  return col;
}

/**
 * Process MOD09GA collection using Ren method with topographic and BRDF correction
 */
function processRenCollection(startDate, endDate, region, glacierOutlines) {
  // Get Terra collection
  var terraCol = getFilteredCollection(startDate, endDate, region, config.MODIS_COLLECTIONS.MOD09GA);
  // Get Aqua collection  
  var aquaCol = getFilteredCollection(startDate, endDate, region, config.MODIS_COLLECTIONS.MYD09GA);
  
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
  
  // Ensure the required daily snow albedo band is available
  // Temporarily disabled to debug MOD10A1 export issue
  // collection = collection.filter(
  //   ee.Filter.listContains('band_names', 'Snow_Albedo_Daily_Tile')
  // );
  
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
      resultsObj.ren = processRenCollection(startDate, endDate, region, glacierOutlines);
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
// INTERACTIVE VISUALIZATION FUNCTIONS
// ============================================================================

// Variable globale pour stocker le panel
var globalPanel = null;

/**
 * Create date visualization widget with Inspector support
 */
function createDateVisualizationWidget(glacierOutlines, region) {
  var albedoPalette = ['8c2d04','cc4c02','ec7014','fe9929','fed98e','ffffbf',
                       'c7e9b4','7fcdbb','41b6c4','2c7fb8','253494'];
  
  var dateSlider = ui.DateSlider({
    start: '2017-01-01',
    end: '2024-12-31', 
    value: '2023-08-07',
    period: 1,
    onChange: function(dateRange) {
      var date = dateRange.start();
      visualizeThreeMethods(date, glacierOutlines, region, albedoPalette, globalPanel);
    }
  });
  
  globalPanel = ui.Panel({
    widgets: [
      ui.Label('Sélectionner une date:'),
      dateSlider,
      ui.Button('Clear layers', function() { 
        Map.clear(); 
        Map.add(globalPanel);
      }),
      ui.Label('Activez l\'Inspector pour voir les valeurs pixel')
    ],
    style: {
      position: 'top-left',
      width: '300px'
    }
  });
  
  Map.add(globalPanel);
  
  // Charger la date par défaut
  visualizeThreeMethods(ee.Date('2023-08-07'), glacierOutlines, region, albedoPalette, globalPanel);
}

/**
 * Visualize three methods for selected date with Inspector support
 */
function visualizeThreeMethods(date, glacierOutlines, region, palette, panel) {
  Map.clear();
  
  // Re-ajouter le panel après clear
  if (panel) {
    Map.add(panel);
  }
  
  var results = runModularComparison(date, date.advance(1,'day'), 
    {ren: true, mod10a1: true, mcd43a3: true}, glacierOutlines, region);
  
  var glacierMask = glacierUtils.createGlacierMask(glacierOutlines);
  var vizParams = {min: 0, max: 1, palette: palette};
  
  // Créer une image composite avec toutes les bandes pour l'Inspector
  var compositeImage = ee.Image([]);
  
  if (results.ren.size().gt(0)) {
    var renImg = results.ren.first();
    compositeImage = compositeImage.addBands(renImg.select('broadband_albedo_ren_masked').rename('MOD09GA_albedo'));
    compositeImage = compositeImage.addBands(renImg.select('SolarZenith').multiply(0.01).rename('solar_zenith_deg'));
    // Calculer NDSI
    var ndsi = renImg.expression('(b4 - b6) / (b4 + b6)', {
      'b4': renImg.select('sur_refl_b04').multiply(0.0001),
      'b6': renImg.select('sur_refl_b06').multiply(0.0001)
    }).rename('NDSI');
    compositeImage = compositeImage.addBands(ndsi);
  }
  
  if (results.mod10a1.size().gt(0)) {
    compositeImage = compositeImage.addBands(
      results.mod10a1.first().select('broadband_albedo_mod10a1').rename('MOD10A1_albedo')
    );
  }
  
  if (results.mcd43a3.size().gt(0)) {
    compositeImage = compositeImage.addBands(
      results.mcd43a3.first().select('broadband_albedo_mcd43a3').rename('MCD43A3_albedo')
    );
  }
  
  // Masquer avec le glacier
  compositeImage = compositeImage.updateMask(glacierMask);
  
  // Ajouter le contour du glacier EN PREMIER (sera sous les autres layers)
  Map.addLayer(glacierOutlines, {color: 'red', fillColor: 'rgba(0,0,0,0)'}, 'Glacier outline');
  
  // Ajouter les layers visuels
  Map.addLayer(results.ren.first().select('broadband_albedo_ren_masked'), vizParams, 'MOD09GA (Ren)');
  Map.addLayer(results.mod10a1.first().select('broadband_albedo_mod10a1').updateMask(glacierMask), vizParams, 'MOD10A1');
  Map.addLayer(results.mcd43a3.first().select('broadband_albedo_mcd43a3').updateMask(glacierMask), vizParams, 'MCD43A3');
  
  // Ajouter l'image composite invisible pour l'Inspector
  Map.addLayer(compositeImage, {}, 'Pixel Info (Inspector)', false);
  
  Map.centerObject(region, 12);
  
  print('Date:', date.format('YYYY-MM-dd').getInfo());
  print('Activez l\'Inspector et cliquez sur un pixel pour voir toutes les valeurs');
}

// ============================================================================
// EXPORTS
// ============================================================================

exports.runModularComparison     = runModularComparison;
exports.exportComparisonResults  = exportComparisonResults;
exports.runQAProfileComparison   = runQAProfileComparison;
exports.exportRenAlbedoSingleDate = exportRenAlbedoSingleDate;
exports.exportRenAlbedoSingleDateNative = exportRenAlbedoSingleDateNative;
exports.createDateVisualizationWidget = createDateVisualizationWidget;
exports.visualizeThreeMethods = visualizeThreeMethods; 