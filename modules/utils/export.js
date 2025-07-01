/**
 * Export Utility Functions
 * 
 * Simplified core functions for exporting albedo comparison results
 * 
 * Author: Modular Comparison Framework
 * Date: 2025-07-01
 */

// ============================================================================
// MODULE IMPORTS
// ============================================================================

var config = require('users/tofunori/MOD09A1_REN_METHOD:modules/config.js');

// ============================================================================
// CORE EXPORT FUNCTIONS
// ============================================================================

/**
 * Export comprehensive statistics for all methods to CSV
 * Includes mean, std, min, max, count for each method and date
 */
function exportComparisonStats(results, region, description) {
  print('📤 Exporting comprehensive statistics to CSV...');
  
  var allStats = ee.FeatureCollection([]);
  
  // Process MOD09GA method
  if (results.ren) {
    var renStats = results.ren.map(function(image) {
      var bandNames = image.bandNames();
      var hasMaskedBand = bandNames.contains('broadband_albedo_ren_masked');
      var hasBaseBand = bandNames.contains('broadband_albedo_ren');
      var hasAnyAlbedoBand = ee.Algorithms.If(hasMaskedBand, true, hasBaseBand);
      
      var stats = ee.Algorithms.If(
        hasAnyAlbedoBand,
        ee.Image(
          ee.Algorithms.If(
            hasMaskedBand,
            image.select('broadband_albedo_ren_masked'),
            image.select('broadband_albedo_ren')
          )
        ).rename('albedo').reduceRegion({
          reducer: ee.Reducer.mean()
            .combine({reducer2: ee.Reducer.stdDev(), sharedInputs: true})
            .combine({reducer2: ee.Reducer.min(),    sharedInputs: true})
            .combine({reducer2: ee.Reducer.max(),    sharedInputs: true})
            .combine({reducer2: ee.Reducer.count(),  sharedInputs: true}),
          geometry: region,
          scale: config.EXPORT_CONFIG.scale,
          maxPixels: config.EXPORT_CONFIG.maxPixels_ren,
          bestEffort: config.EXPORT_CONFIG.bestEffort,
          tileScale: config.EXPORT_CONFIG.tileScale
        }),
        ee.Dictionary({
          'albedo_mean': null,
          'albedo_stdDev': null,
          'albedo_min': null,
          'albedo_max': null,
          'albedo_count': null
        })
      );

      var statsDict = ee.Dictionary(stats);
      var date = ee.Date(image.get('system:time_start'));
      return ee.Feature(null, {
        'albedo_mean':  statsDict.get('albedo_mean', null),
        'albedo_std':   statsDict.get('albedo_stdDev', null),
        'albedo_min':   statsDict.get('albedo_min', null),
        'albedo_max':   statsDict.get('albedo_max', null),
        'pixel_count':  statsDict.get('albedo_count', null),
        'date':         date.format('YYYY-MM-dd'),
        'year':         date.get('year'),
        'month':        date.get('month'),
        'day_of_year':  date.getRelative('day', 'year'),
        'method':       'MOD09GA',
        'system:time_start': image.get('system:time_start')
      });
    }).filter(ee.Filter.notNull(['albedo_mean']));
    allStats = allStats.merge(renStats);
  }
  
  // Process MOD10A1 method
  if (results.mod10a1) {
    var mod10Stats = results.mod10a1.map(function(image) {
      var bandNames = image.bandNames();
      var hasBand = bandNames.contains('broadband_albedo_mod10a1');
      
      var stats = ee.Algorithms.If(
        hasBand,
        image.select('broadband_albedo_mod10a1').reduceRegion({
          reducer: ee.Reducer.mean()
            .combine({reducer2: ee.Reducer.stdDev(), sharedInputs: true})
            .combine({reducer2: ee.Reducer.min(), sharedInputs: true})
            .combine({reducer2: ee.Reducer.max(), sharedInputs: true})
            .combine({reducer2: ee.Reducer.count(), sharedInputs: true}),
          geometry: region,
          scale: config.EXPORT_CONFIG.scale_simple,
          maxPixels: config.EXPORT_CONFIG.maxPixels_simple,
          bestEffort: config.EXPORT_CONFIG.bestEffort,
          tileScale: config.EXPORT_CONFIG.tileScale
        }),
        ee.Dictionary({
          'broadband_albedo_mod10a1_mean': null,
          'broadband_albedo_mod10a1_stdDev': null,
          'broadband_albedo_mod10a1_min': null,
          'broadband_albedo_mod10a1_max': null,
          'broadband_albedo_mod10a1_count': null
        })
      );
      
      var date = ee.Date(image.get('system:time_start'));
      return ee.Feature(null, {
        'albedo_mean': ee.Dictionary(stats).get('broadband_albedo_mod10a1_mean'),
        'albedo_std': ee.Dictionary(stats).get('broadband_albedo_mod10a1_stdDev'),
        'albedo_min': ee.Dictionary(stats).get('broadband_albedo_mod10a1_min'),
        'albedo_max': ee.Dictionary(stats).get('broadband_albedo_mod10a1_max'),
        'pixel_count': ee.Dictionary(stats).get('broadband_albedo_mod10a1_count'),
        'date': date.format('YYYY-MM-dd'),
        'year': date.get('year'),
        'month': date.get('month'),
        'day_of_year': date.getRelative('day', 'year'),
        'method': 'MOD10A1',
        'system:time_start': image.get('system:time_start')
      });
    }).filter(ee.Filter.notNull(['albedo_mean']));
    allStats = allStats.merge(mod10Stats);
  }
  
  // Process MCD43A3 method
  if (results.mcd43a3) {
    var mcd43Stats = results.mcd43a3.map(function(image) {
      var bandNames = image.bandNames();
      var hasBand = bandNames.contains('broadband_albedo_mcd43a3');
      
      var stats = ee.Algorithms.If(
        hasBand,
        image.select('broadband_albedo_mcd43a3').reduceRegion({
          reducer: ee.Reducer.mean()
            .combine({reducer2: ee.Reducer.stdDev(), sharedInputs: true})
            .combine({reducer2: ee.Reducer.min(), sharedInputs: true})
            .combine({reducer2: ee.Reducer.max(), sharedInputs: true})
            .combine({reducer2: ee.Reducer.count(), sharedInputs: true}),
          geometry: region,
          scale: config.EXPORT_CONFIG.scale_simple,
          maxPixels: config.EXPORT_CONFIG.maxPixels_simple,
          bestEffort: config.EXPORT_CONFIG.bestEffort,
          tileScale: config.EXPORT_CONFIG.tileScale
        }),
        ee.Dictionary({
          'broadband_albedo_mcd43a3_mean': null,
          'broadband_albedo_mcd43a3_stdDev': null,
          'broadband_albedo_mcd43a3_min': null,
          'broadband_albedo_mcd43a3_max': null,
          'broadband_albedo_mcd43a3_count': null
        })
      );
      
      var date = ee.Date(image.get('system:time_start'));
      return ee.Feature(null, {
        'albedo_mean': ee.Dictionary(stats).get('broadband_albedo_mcd43a3_mean'),
        'albedo_std': ee.Dictionary(stats).get('broadband_albedo_mcd43a3_stdDev'),
        'albedo_min': ee.Dictionary(stats).get('broadband_albedo_mcd43a3_min'),
        'albedo_max': ee.Dictionary(stats).get('broadband_albedo_mcd43a3_max'),
        'pixel_count': ee.Dictionary(stats).get('broadband_albedo_mcd43a3_count'),
        'date': date.format('YYYY-MM-dd'),
        'year': date.get('year'),
        'month': date.get('month'),
        'day_of_year': date.getRelative('day', 'year'),
        'method': 'MCD43A3',
        'system:time_start': image.get('system:time_start')
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
  
  // Print data counts for verification
  printDataCounts(results);
}

/**
 * Print data counts for verification
 */
function printDataCounts(results) {
  var safeCount = function(col, label) {
    try {
      print('🔍 Debug: Starting safeCount for ' + label);
      var collection = ee.ImageCollection(col);
      print('🔍 Debug: Collection created for ' + label);
      var count = collection.size();
      print('🔍 Debug: Size operation called for ' + label);
      count.evaluate(function(n, error) {
        if (error) {
          print(label + ' observations: Error - ' + error);
        } else {
          print(label + ' observations: ' + n);
        }
      }, function(error) {
        print(label + ' observations: Evaluate failed - ' + error);
      });
      print('🔍 Debug: Evaluate called for ' + label);
    } catch (e) {
      print(label + ' observations: Exception - ' + e.toString());
    }
  };

  print('🔍 Debug: printDataCounts invoked');
  print('🔍 Debug: results keys = ' + Object.keys(results).join(', '));
  
  if (results.ren_count) {
    results.ren_count.evaluate(function(n, error) {
      if (error) {
        print('MOD09GA method observations: Error - ' + error);
      } else {
        print('MOD09GA method observations: ' + n);
      }
    });
  } else if (results.ren) {
    safeCount(results.ren, 'MOD09GA method');
  } else {
    print('MOD09GA method collection missing');
  }
  
  if (results.mod10a1)  safeCount(results.mod10a1, 'MOD10A1 method');
  else                  print('MOD10A1 method collection missing');
  if (results.mcd43a3)  safeCount(results.mcd43a3, 'MCD43A3 method');
  else                  print('MCD43A3 method collection missing');
}

/**
 * Generate export description with timestamp
 */
function generateExportDescription(prefix, startDate, endDate) {
  var now = new Date();
  var month = ('0' + (now.getMonth() + 1)).slice(-2);
  var day   = ('0' + now.getDate()).slice(-2);
  var timestamp = '' + now.getFullYear() + month + day;
   
  return prefix + '_' + 
    startDate.replace(/-/g, '') + '_to_' + 
    endDate.replace(/-/g, '') + '_' +
    timestamp;
}

/**
 * Export individual method results (for debugging)
 */
function exportIndividualMethod(collection, bandName, methodName, region, description) {
  var stats = collection.select(bandName).map(function(image) {
    var stats = image.reduceRegion({
      reducer: ee.Reducer.mean()
        .combine({reducer2: ee.Reducer.stdDev(), sharedInputs: true})
        .combine({reducer2: ee.Reducer.count(), sharedInputs: true}),
      geometry: region,
      scale: config.EXPORT_CONFIG.scale,
      maxPixels: config.EXPORT_CONFIG.maxPixels_ren,
      bestEffort: config.EXPORT_CONFIG.bestEffort,
      tileScale: config.EXPORT_CONFIG.tileScale
    });
    
    var date = ee.Date(image.get('system:time_start'));
    
    return ee.Feature(null, {
      'albedo_mean': stats.get(bandName + '_mean'),
      'albedo_std': stats.get(bandName + '_stdDev'),
      'pixel_count': stats.get(bandName + '_count'),
      'date': date.format('YYYY-MM-dd'),
      'year': date.get('year'),
      'month': date.get('month'),
      'day_of_year': date.getRelative('day', 'year'),
      'method': methodName,
      'system:time_start': image.get('system:time_start')
    });
  }).filter(ee.Filter.notNull(['albedo_mean']));
  
  Export.table.toDrive({
    collection: stats,
    description: description + '_' + methodName,
    folder: 'albedo_method_comparison',
    fileFormat: 'CSV'
  });
  
  print(methodName + ' export task initiated: ' + description + '_' + methodName);
}

// ============================================================================
// EXPORTS
// ============================================================================

exports.exportComparisonStats = exportComparisonStats;
exports.printDataCounts = printDataCounts;
exports.generateExportDescription = generateExportDescription;
exports.exportIndividualMethod = exportIndividualMethod;