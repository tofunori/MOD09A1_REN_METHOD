/**
 * Export Utility Functions
 * 
 * Functions for exporting comparison results with comprehensive statistics
 * 
 * Author: Modular Comparison Framework
 * Date: 2025-06-30
 */

// ============================================================================
// MODULE IMPORTS
// ============================================================================

var config = require('users/tofunori/MOD09A1_REN_METHOD:modules/config.js');

// ============================================================================
// CSV EXPORT FUNCTIONS
// ============================================================================

/**
 * Export comprehensive statistics for all methods to CSV
 * Includes mean, std, min, max, count for each method and date
 */
function exportComparisonStats(results, region, description) {
  print('📤 Exporting comprehensive statistics to CSV...');
  
  var allStats = ee.FeatureCollection([]);
  
  // Process each method with comprehensive statistics
  if (results.ren) {
    var renStats = results.ren.map(function(image) {
      // Prefer glacier-masked broadband albedo if present; fall back gracefully.
      var bandName = image.bandNames().contains('broadband_albedo_ren_masked')
        ? 'broadband_albedo_ren_masked'
        : 'broadband_albedo_ren';
      var stats = image.select(bandName).reduceRegion({
        reducer: ee.Reducer.mean().combine({
          reducer2: ee.Reducer.stdDev(),
          sharedInputs: true
        }).combine({
          reducer2: ee.Reducer.min(),
          sharedInputs: true
        }).combine({
          reducer2: ee.Reducer.max(),
          sharedInputs: true
        }).combine({
          reducer2: ee.Reducer.count(),
          sharedInputs: true
        }),
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
        'albedo_min': stats.get(bandName + '_min'),
        'albedo_max': stats.get(bandName + '_max'),
        'pixel_count': stats.get(bandName + '_count'),
        'date': date.format('YYYY-MM-dd'),
        'year': date.get('year'),
        'month': date.get('month'),
        'day_of_year': date.getRelative('day', 'year'),
        'method': 'Ren',
        'system:time_start': image.get('system:time_start')
      });
    }).filter(ee.Filter.notNull(['albedo_mean']));
    allStats = allStats.merge(renStats);
  }
  
  if (results.mod10a1) {
    var mod10Stats = results.mod10a1.map(function(image) {
      var bandNames = image.bandNames();
      var hasBand = bandNames.contains('broadband_albedo_mod10a1');
      
      var stats = ee.Algorithms.If(
        hasBand,
        image.select('broadband_albedo_mod10a1').reduceRegion({
          reducer: ee.Reducer.mean().combine({
            reducer2: ee.Reducer.stdDev(),
            sharedInputs: true
          }).combine({
            reducer2: ee.Reducer.min(),
            sharedInputs: true
          }).combine({
            reducer2: ee.Reducer.max(),
            sharedInputs: true
          }).combine({
            reducer2: ee.Reducer.count(),
            sharedInputs: true
          }),
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
  
  if (results.mcd43a3) {
    var mcd43Stats = results.mcd43a3.map(function(image) {
      var bandNames = image.bandNames();
      var hasBand = bandNames.contains('broadband_albedo_mcd43a3');
      
      var stats = ee.Algorithms.If(
        hasBand,
        image.select('broadband_albedo_mcd43a3').reduceRegion({
          reducer: ee.Reducer.mean().combine({
            reducer2: ee.Reducer.stdDev(),
            sharedInputs: true
          }).combine({
            reducer2: ee.Reducer.min(),
            sharedInputs: true
          }).combine({
            reducer2: ee.Reducer.max(),
            sharedInputs: true
          }).combine({
            reducer2: ee.Reducer.count(),
            sharedInputs: true
          }),
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
 * Export individual method results (for debugging)
 */
function exportIndividualMethod(collection, bandName, methodName, region, description) {
  var stats = collection.select(bandName).map(function(image) {
    var stats = image.reduceRegion({
      reducer: ee.Reducer.mean().combine({
        reducer2: ee.Reducer.stdDev(),
        sharedInputs: true
      }).combine({
        reducer2: ee.Reducer.count(),
        sharedInputs: true
      }),
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
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Print data counts for verification
 */
function printDataCounts(results) {
  if (results.ren) {
    results.ren.size().evaluate(function(renCount) {
      print('Ren method observations: ' + renCount);
    });
  }
  if (results.mod10a1) {
    results.mod10a1.size().evaluate(function(mod10Count) {
      print('MOD10A1 method observations: ' + mod10Count);
    });
  }
  if (results.mcd43a3) {
    results.mcd43a3.size().evaluate(function(mcd43Count) {
      print('MCD43A3 method observations: ' + mcd43Count);
    });
  }
}

/**
 * Generate export description with timestamp
 */
function generateExportDescription(prefix, startDate, endDate) {
  return prefix + '_' + 
    startDate.replace(/-/g, '') + '_to_' + 
    endDate.replace(/-/g, '') + '_' +
    ee.Date(Date.now()).format('YYYYMMdd').getInfo();
}

// ============================================================================
// EXPORTS
// ============================================================================

exports.exportComparisonStats = exportComparisonStats;
exports.exportIndividualMethod = exportIndividualMethod;
exports.printDataCounts = printDataCounts;
exports.generateExportDescription = generateExportDescription;