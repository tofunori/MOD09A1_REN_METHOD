/**
 * Glacier Statistics and Pixel Extraction Module
 * 
 * Functions for extracting and analyzing pixel values within glacier boundaries
 * for daily calendar visualization
 * 
 * Author: Calendar Visualization Framework
 * Date: 2025-07-01
 * Version: 1.0 - Glacier-focused pixel analysis
 */

// ============================================================================
// MODULE IMPORTS
// ============================================================================

var config = require('users/tofunori/MOD09A1_REN_METHOD:modules/config.js');
var glacierUtils = require('users/tofunori/MOD09A1_REN_METHOD:modules/utils/glacier.js');
var mod09a1Method = require('users/tofunori/MOD09A1_REN_METHOD:modules/methods/mod09a1.js');
var mod10a1Method = require('users/tofunori/MOD09A1_REN_METHOD:modules/methods/mod10a1.js');
var mcd43a3Method = require('users/tofunori/MOD09A1_REN_METHOD:modules/methods/mcd43a3.js');

// ============================================================================
// GLACIER PIXEL EXTRACTION FUNCTIONS
// ============================================================================

/**
 * Get glacier pixel statistics for a specific date and method
 */
function getGlacierPixelStats(date, method, glacierOutlines, glacierMask) {
  try {
    var startDate = ee.Date(date);
    var endDate = startDate.advance(1, 'day');
    
    var image = getImageForDateAndMethod(startDate, endDate, method, glacierOutlines);
    
    if (!image) {
      return {
        mean: null,
        count: 0,
        stdDev: null,
        min: null,
        max: null,
        available: false
      };
    }
    
    // Apply glacier mask and calculate statistics
    var maskedImage = image.updateMask(glacierMask);
    var albedoBand = getAlbedoBandForMethod(method);
    
    var stats = maskedImage.select(albedoBand).reduceRegion({
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
    
    return {
      mean: stats.get(albedoBand + '_mean'),
      count: stats.get(albedoBand + '_count'),
      stdDev: stats.get(albedoBand + '_stdDev'),
      min: stats.get(albedoBand + '_min'),
      max: stats.get(albedoBand + '_max'),
      available: true
    };
    
  } catch (error) {
    print('Error getting glacier pixel stats for ' + date + ' ' + method + ': ' + error);
    return {
      mean: null,
      count: 0,
      stdDev: null,
      min: null,
      max: null,
      available: false
    };
  }
}

/**
 * Get processed image for specific date and method
 */
function getImageForDateAndMethod(startDate, endDate, method, glacierOutlines) {
  var createGlacierMask = glacierUtils.createGlacierMask;
  
  try {
    if (method === 'ren') {
      // MOD09A1 method using MOD09GA
      var collection = ee.ImageCollection(config.MODIS_COLLECTIONS.MOD09GA)
        .merge(ee.ImageCollection(config.MODIS_COLLECTIONS.MYD09GA))
        .filterDate(startDate, endDate)
        .filterBounds(glacierOutlines.geometry());
      
      if (collection.size().getInfo() === 0) return null;
      
      var img = ee.Image(collection.first());
      return mod09a1Method.processMOD09A1Method(img, glacierOutlines, createGlacierMask);
      
    } else if (method === 'mod10a1') {
      // MOD10A1 method
      var collection = ee.ImageCollection(config.MODIS_COLLECTIONS.MOD10A1)
        .filterDate(startDate, endDate)
        .filterBounds(glacierOutlines.geometry());
      
      if (collection.size().getInfo() === 0) return null;
      
      var img = ee.Image(collection.first());
      return mod10a1Method.processMOD10A1(img, glacierOutlines, createGlacierMask);
      
    } else if (method === 'mcd43a3') {
      // MCD43A3 method
      var collection = ee.ImageCollection(config.MODIS_COLLECTIONS.MCD43A3)
        .filterDate(startDate, endDate)
        .filterBounds(glacierOutlines.geometry());
      
      if (collection.size().getInfo() === 0) return null;
      
      var img = ee.Image(collection.first());
      return mcd43a3Method.processMCD43A3(img, glacierOutlines, createGlacierMask);
    }
    
    return null;
    
  } catch (error) {
    print('Error processing image for ' + method + ': ' + error);
    return null;
  }
}

/**
 * Get the appropriate albedo band name for each method
 */
function getAlbedoBandForMethod(method) {
  switch (method) {
    case 'ren':
      return 'broadband_albedo_ren_masked';
    case 'mod10a1':
      return 'NDSI_Snow_Cover';  // MOD10A1 uses snow cover as proxy
    case 'mcd43a3':
      return 'Albedo_BSA_vis';   // MCD43A3 visible albedo
    default:
      return 'albedo';
  }
}

/**
 * Get glacier statistics for all methods on a specific date
 */
function getAllMethodsGlacierStats(date, glacierOutlines, glacierMask) {
  var methods = ['ren', 'mod10a1', 'mcd43a3'];
  var allStats = {};
  
  methods.forEach(function(method) {
    allStats[method] = getGlacierPixelStats(date, method, glacierOutlines, glacierMask);
  });
  
  return allStats;
}

/**
 * Generate color code based on glacier data availability and quality
 */
function getColorForGlacierData(glacierStats) {
  var availableMethods = 0;
  var totalPixels = 0;
  
  Object.keys(glacierStats).forEach(function(method) {
    if (glacierStats[method].available && glacierStats[method].count > 0) {
      availableMethods++;
      totalPixels += glacierStats[method].count;
    }
  });
  
  // Color coding based on method availability and pixel count
  if (availableMethods === 3) {
    if (totalPixels > 150) return '#0066cc';      // Deep blue - excellent coverage
    if (totalPixels > 75) return '#3399ff';       // Blue - good coverage  
    return '#66ccff';                             // Light blue - fair coverage
  } else if (availableMethods === 2) {
    return '#66ff66';                             // Green - two methods
  } else if (availableMethods === 1) {
    return '#ffff66';                             // Yellow - one method
  } else {
    return '#cccccc';                             // Gray - no data
  }
}

/**
 * Format glacier statistics for display
 */
function formatGlacierStats(glacierStats) {
  var lines = [];
  
  Object.keys(glacierStats).forEach(function(method) {
    var stats = glacierStats[method];
    if (stats.available && stats.count > 0) {
      var meanValue = stats.mean ? stats.mean.getInfo().toFixed(3) : 'N/A';
      lines.push(method.toUpperCase() + ': ' + stats.count + ' px (μ=' + meanValue + ')');
    }
  });
  
  return lines.length > 0 ? lines.join('\n') : 'No data';
}

/**
 * Calculate monthly glacier statistics summary
 */
function getMonthlyGlacierSummary(year, month, glacierOutlines, glacierMask) {
  var startDate = ee.Date.fromYMD(year, month, 1);
  var endDate = startDate.advance(1, 'month');
  
  var daysInMonth = endDate.difference(startDate, 'day').getInfo();
  var summary = {
    totalDays: daysInMonth,
    daysWithData: 0,
    methodCoverage: {ren: 0, mod10a1: 0, mcd43a3: 0},
    averagePixelCount: {ren: 0, mod10a1: 0, mcd43a3: 0}
  };
  
  for (var day = 1; day <= daysInMonth; day++) {
    var currentDate = startDate.advance(day - 1, 'day').format('YYYY-MM-dd').getInfo();
    var dayStats = getAllMethodsGlacierStats(currentDate, glacierOutlines, glacierMask);
    
    var hasAnyData = false;
    Object.keys(dayStats).forEach(function(method) {
      if (dayStats[method].available && dayStats[method].count > 0) {
        summary.methodCoverage[method]++;
        summary.averagePixelCount[method] += dayStats[method].count;
        hasAnyData = true;
      }
    });
    
    if (hasAnyData) {
      summary.daysWithData++;
    }
  }
  
  // Calculate averages
  Object.keys(summary.averagePixelCount).forEach(function(method) {
    if (summary.methodCoverage[method] > 0) {
      summary.averagePixelCount[method] = Math.round(
        summary.averagePixelCount[method] / summary.methodCoverage[method]
      );
    }
  });
  
  return summary;
}

// ============================================================================
// EXPORTS
// ============================================================================

exports.getGlacierPixelStats = getGlacierPixelStats;
exports.getImageForDateAndMethod = getImageForDateAndMethod;
exports.getAlbedoBandForMethod = getAlbedoBandForMethod;
exports.getAllMethodsGlacierStats = getAllMethodsGlacierStats;
exports.getColorForGlacierData = getColorForGlacierData;
exports.formatGlacierStats = formatGlacierStats;
exports.getMonthlyGlacierSummary = getMonthlyGlacierSummary;