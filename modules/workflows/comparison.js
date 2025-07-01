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
  if (!collection) {
    collection = [
      config.MODIS_COLLECTIONS.MOD09GA, // Terra morning pass
      config.MODIS_COLLECTIONS.MYD09GA  // Aqua afternoon pass
    ];
  }

  var col = buildCollection(collection);

  return glacierUtils.applyStandardFiltering(
    col, startDate, endDate, region, config.PROCESSING_CONFIG.melt_season_only
  );
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
// DAILY GLACIER DATA FUNCTIONS FOR CALENDAR INTEGRATION
// ============================================================================

/**
 * Get daily glacier pixel statistics for calendar visualization
 */
function getDailyGlacierStats(date, methods, glacierOutlines, glacierMask) {
  var stats = {};
  var startDate = ee.Date(date);
  var endDate = startDate.advance(1, 'day');
  
  methods.forEach(function(method) {
    try {
      var collection, image, albedoBand;
      var createGlacierMask = glacierUtils.createGlacierMask;
      
      if (method === 'ren') {
        collection = getFilteredCollection(startDate, endDate, glacierOutlines.geometry());
        if (collection.size().getInfo() > 0) {
          image = processRenCollection(collection, glacierOutlines).first();
          albedoBand = 'broadband_albedo_ren_masked';
        }
      } else if (method === 'mod10a1') {
        collection = processMOD10A1Collection(startDate, endDate, glacierOutlines.geometry(), glacierOutlines);
        if (collection.size().getInfo() > 0) {
          image = collection.first();
          albedoBand = 'NDSI_Snow_Cover';
        }
      } else if (method === 'mcd43a3') {
        collection = processMCD43A3Collection(startDate, endDate, glacierOutlines.geometry(), glacierOutlines);
        if (collection.size().getInfo() > 0) {
          image = collection.first();
          albedoBand = 'Albedo_BSA_vis';
        }
      }
      
      if (image && albedoBand) {
        var maskedImage = image.updateMask(glacierMask);
        var pixelStats = maskedImage.select(albedoBand).reduceRegion({
          reducer: ee.Reducer.mean()
            .combine(ee.Reducer.count(), '', true)
            .combine(ee.Reducer.stdDev(), '', true)
            .combine(ee.Reducer.min(), '', true)
            .combine(ee.Reducer.max(), '', true),
          geometry: glacierOutlines.geometry(),
          scale: 500,
          maxPixels: 1e9,
          bestEffort: true
        });
        
        stats[method] = {
          mean: pixelStats.get(albedoBand + '_mean'),
          count: pixelStats.get(albedoBand + '_count'),
          stdDev: pixelStats.get(albedoBand + '_stdDev'),
          min: pixelStats.get(albedoBand + '_min'),
          max: pixelStats.get(albedoBand + '_max'),
          available: true
        };
      } else {
        stats[method] = {
          mean: null,
          count: 0,
          stdDev: null,
          min: null,
          max: null,
          available: false
        };
      }
      
    } catch (error) {
      print('Error processing ' + method + ' for ' + date + ': ' + error);
      stats[method] = {
        mean: null,
        count: 0,
        stdDev: null,
        min: null,
        max: null,
        available: false
      };
    }
  });
  
  return stats;
}

/**
 * Create time series analysis around a selected date
 */
function createGlacierTimeSeries(centerDate, windowDays, methods, glacierOutlines, glacierMask) {
  var centerDateObj = ee.Date(centerDate);
  var startDate = centerDateObj.advance(-windowDays, 'day');
  var endDate = centerDateObj.advance(windowDays, 'day');
  
  var dateList = ee.List.sequence(0, windowDays * 2).map(function(day) {
    return startDate.advance(day, 'day');
  });
  
  var timeSeriesData = [];
  
  dateList.getInfo().forEach(function(dateMillis) {
    var currentDate = ee.Date(dateMillis).format('YYYY-MM-dd').getInfo();
    var dayStats = getDailyGlacierStats(currentDate, methods, glacierOutlines, glacierMask);
    
    timeSeriesData.push({
      date: currentDate,
      stats: dayStats
    });
  });
  
  return timeSeriesData;
}

/**
 * Export daily glacier data for calendar system
 */
function exportDailyGlacierData(date, methods, glacierOutlines, glacierMask, description) {
  var dailyStats = getDailyGlacierStats(date, methods, glacierOutlines, glacierMask);
  
  var features = [];
  Object.keys(dailyStats).forEach(function(method) {
    var stats = dailyStats[method];
    if (stats.available) {
      var feature = ee.Feature(null, {
        date: date,
        method: method,
        pixel_count: stats.count,
        mean_albedo: stats.mean,
        std_dev: stats.stdDev,
        min_albedo: stats.min,
        max_albedo: stats.max,
        geometry_type: 'glacier_pixels'
      });
      features.push(feature);
    }
  });
  
  if (features.length > 0) {
    var exportCollection = ee.FeatureCollection(features);
    
    Export.table.toDrive({
      collection: exportCollection,
      description: description || ('glacier_daily_' + date.replace(/-/g, '')),
      fileFormat: 'CSV',
      folder: 'GEE_Calendar_Exports'
    });
    
    print('✅ Daily glacier export started: ' + date);
    return true;
  } else {
    print('❌ No glacier data available for export on ' + date);
    return false;
  }
}

/**
 * Generate monthly glacier coverage report
 */
function generateMonthlyGlacierReport(year, month, methods, glacierOutlines, glacierMask) {
  var startDate = ee.Date.fromYMD(year, month, 1);
  var endDate = startDate.advance(1, 'month');
  var daysInMonth = endDate.difference(startDate, 'day').getInfo();
  
  var report = {
    year: year,
    month: month,
    totalDays: daysInMonth,
    daysWithData: 0,
    methodStats: {}
  };
  
  methods.forEach(function(method) {
    report.methodStats[method] = {
      availableDays: 0,
      totalPixels: 0,
      averagePixels: 0,
      bestDay: null,
      bestPixelCount: 0
    };
  });
  
  for (var day = 1; day <= daysInMonth; day++) {
    var currentDate = startDate.advance(day - 1, 'day').format('YYYY-MM-dd').getInfo();
    var dayStats = getDailyGlacierStats(currentDate, methods, glacierOutlines, glacierMask);
    
    var hasAnyData = false;
    Object.keys(dayStats).forEach(function(method) {
      var stats = dayStats[method];
      if (stats.available && stats.count > 0) {
        report.methodStats[method].availableDays++;
        report.methodStats[method].totalPixels += stats.count;
        
        if (stats.count > report.methodStats[method].bestPixelCount) {
          report.methodStats[method].bestDay = currentDate;
          report.methodStats[method].bestPixelCount = stats.count;
        }
        
        hasAnyData = true;
      }
    });
    
    if (hasAnyData) {
      report.daysWithData++;
    }
  }
  
  // Calculate averages
  methods.forEach(function(method) {
    var methodStats = report.methodStats[method];
    if (methodStats.availableDays > 0) {
      methodStats.averagePixels = Math.round(methodStats.totalPixels / methodStats.availableDays);
    }
  });
  
  return report;
}

/**
 * Create pixel availability heatmap data for calendar
 */
function createPixelAvailabilityHeatmap(year, month, methods, glacierOutlines, glacierMask) {
  var startDate = ee.Date.fromYMD(year, month, 1);
  var endDate = startDate.advance(1, 'month');
  var daysInMonth = endDate.difference(startDate, 'day').getInfo();
  
  var heatmapData = {};
  
  for (var day = 1; day <= daysInMonth; day++) {
    var currentDate = startDate.advance(day - 1, 'day').format('YYYY-MM-dd').getInfo();
    var dayStats = getDailyGlacierStats(currentDate, methods, glacierOutlines, glacierMask);
    
    var availableMethods = 0;
    var totalPixels = 0;
    
    Object.keys(dayStats).forEach(function(method) {
      if (dayStats[method].available && dayStats[method].count > 0) {
        availableMethods++;
        totalPixels += dayStats[method].count;
      }
    });
    
    heatmapData[currentDate] = {
      methodCount: availableMethods,
      pixelCount: totalPixels,
      quality: getDataQualityScore(availableMethods, totalPixels)
    };
  }
  
  return heatmapData;
}

/**
 * Get data quality score for calendar color coding
 */
function getDataQualityScore(methodCount, pixelCount) {
  if (methodCount === 3 && pixelCount > 150) return 'excellent';
  if (methodCount === 3 && pixelCount > 75) return 'good';
  if (methodCount === 3) return 'fair';
  if (methodCount === 2) return 'partial';
  if (methodCount === 1) return 'limited';
  return 'none';
}

// ============================================================================
// EXPORTS
// ============================================================================

exports.runModularComparison     = runModularComparison;
exports.exportComparisonResults  = exportComparisonResults;
exports.runQAProfileComparison   = runQAProfileComparison;
exports.exportRenAlbedoSingleDate = exportRenAlbedoSingleDate;
exports.exportRenAlbedoSingleDateNative = exportRenAlbedoSingleDateNative;

// Calendar integration functions
exports.getDailyGlacierStats = getDailyGlacierStats;
exports.createGlacierTimeSeries = createGlacierTimeSeries;
exports.exportDailyGlacierData = exportDailyGlacierData;
exports.generateMonthlyGlacierReport = generateMonthlyGlacierReport;
exports.createPixelAvailabilityHeatmap = createPixelAvailabilityHeatmap; 