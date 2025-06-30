/**
 * Export Functions for MODIS Albedo Comparison
 * 
 * This module contains functions for exporting comparison results
 * with robust error handling and memory optimization.
 * 
 * Author: Modular Comparison Framework
 * Date: 2025-06-29
 */

// ============================================================================
// CSV EXPORT FUNCTIONS
// ============================================================================

/**
 * Export ALL observations to CSV with COMPREHENSIVE STATISTICS
 * Includes mean, std, min, max, count for each method and date
 */
function exportComparisonStats(results, region, description) {
  print('Exporting COMPREHENSIVE STATISTICS for each method (mean, std, min, max, count)...');
  
  // Ren Method - export comprehensive statistics
  var renStats = results.ren.select('broadband_albedo_ren').map(function(image) {
    var stats = image.reduceRegion({
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
      scale: 5000, // Large scale to ensure memory efficiency
      maxPixels: 1e4, // Very conservative to avoid memory issues
      bestEffort: true,
      tileScale: 16
    });
    
    var date = ee.Date(image.get('system:time_start'));
    
    return ee.Feature(null, {
      'albedo_mean': stats.get('broadband_albedo_ren_mean'),
      'albedo_std': stats.get('broadband_albedo_ren_stdDev'),
      'albedo_min': stats.get('broadband_albedo_ren_min'),
      'albedo_max': stats.get('broadband_albedo_ren_max'),
      'pixel_count': stats.get('broadband_albedo_ren_count'),
      'date': date.format('YYYY-MM-dd'),
      'year': date.get('year'),
      'month': date.get('month'),
      'day_of_year': date.getRelative('day', 'year'),
      'method': 'Ren',
      'system:time_start': image.get('system:time_start')
    });
  }).filter(ee.Filter.notNull(['albedo_mean']));
  
  // MOD10A1 Method - export comprehensive statistics
  var mod10Stats = results.mod10a1.map(function(image) {
    // Check if the band exists before processing
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
        scale: 10000, // Even larger scale for robustness
        maxPixels: 1e3, // Very small pixel limit
        bestEffort: true,
        tileScale: 16
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
  
  // MCD43A3 Method - export comprehensive statistics
  var mcd43Stats = results.mcd43a3.map(function(image) {
    // Check if the band exists before processing
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
        scale: 10000, // Even larger scale for robustness
        maxPixels: 1e3, // Very small pixel limit
        bestEffort: true,
        tileScale: 16
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
  
  // Combine all statistics
  var allStats = renStats.merge(mod10Stats).merge(mcd43Stats);
  
  // Export with enhanced metadata
  Export.table.toDrive({
    collection: allStats,
    description: description,
    folder: 'albedo_method_comparison',
    fileFormat: 'CSV'
  });
  
  print('CSV export task initiated: ' + description);
  print('Exporting COMPREHENSIVE STATISTICS: mean, std, min, max, pixel_count');
  print('Temporal metadata: date, year, month, day_of_year');
  print('Check Google Drive folder: albedo_method_comparison');
  
  // Print data counts for verification
  printDataCounts(renStats, mod10Stats, mcd43Stats);
}

/**
 * Print data counts for verification
 */
function printDataCounts(renStats, mod10Stats, mcd43Stats) {
  renStats.size().evaluate(function(renCount) {
    print('Ren method observations: ' + renCount);
  });
  mod10Stats.size().evaluate(function(mod10Count) {
    print('MOD10A1 method observations: ' + mod10Count);
  });
  mcd43Stats.size().evaluate(function(mcd43Count) {
    print('MCD43A3 method observations: ' + mcd43Count);
  });
}

/**
 * Export individual method results (for debugging)
 */
function exportIndividualMethod(collection, bandName, methodName, region, description) {
  var stats = collection.select(bandName).map(function(image) {
    var stats = image.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: region,
      scale: 5000,
      maxPixels: 1e4,
      bestEffort: true,
      tileScale: 16
    });
    
    var date = ee.Date(image.get('system:time_start'));
    
    return ee.Feature(null, {
      'albedo': stats.get(bandName),
      'date': date.format('YYYY-MM-dd'),
      'year': date.get('year'),
      'month': date.get('month'),
      'day_of_year': date.getRelative('day', 'year'),
      'method': methodName,
      'system:time_start': image.get('system:time_start')
    });
  }).filter(ee.Filter.notNull(['albedo']));
  
  Export.table.toDrive({
    collection: stats,
    description: description + '_' + methodName,
    folder: 'albedo_method_comparison',
    fileFormat: 'CSV'
  });
  
  print(methodName + ' export task initiated: ' + description + '_' + methodName);
}

// ============================================================================
// EXPORTS FOR USE IN MAIN SCRIPT
// ============================================================================

// Export functions for use in main script
exports.exportComparisonStats = exportComparisonStats;
exports.exportIndividualMethod = exportIndividualMethod;
exports.printDataCounts = printDataCounts;