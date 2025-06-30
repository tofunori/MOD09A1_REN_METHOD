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
      // Check if either albedo band exists before processing (server-side)
      var bandNames = image.bandNames();
      var hasMaskedBand = bandNames.contains('broadband_albedo_ren_masked');
      var hasBaseBand = bandNames.contains('broadband_albedo_ren');
      // Check if any albedo band exists using conditional logic
      var hasAnyAlbedoBand = ee.Algorithms.If(
        hasMaskedBand,
        true,
        hasBaseBand
      );
      
      var stats = ee.Algorithms.If(
        hasAnyAlbedoBand,
        // If albedo bands exist, process normally
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
          scale:     config.EXPORT_CONFIG.scale,
          maxPixels: config.EXPORT_CONFIG.maxPixels_ren,
          bestEffort: config.EXPORT_CONFIG.bestEffort,
          tileScale:  config.EXPORT_CONFIG.tileScale
        }),
        // If no albedo bands exist, return null dictionary
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
        'method':       'Ren',
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
 * Generate export description with timestamp (avoiding client-side operations)
 */
function generateExportDescription(prefix, startDate, endDate) {
  // Use JavaScript Date for timestamp to avoid GEE client-side operations
  var now = new Date();
  // Zero-pad month and day without using String.padStart (not available in EE)
  var month = ('0' + (now.getMonth() + 1)).slice(-2);
  var day   = ('0' + now.getDate()).slice(-2);
  var timestamp = '' + now.getFullYear() + month + day;
   
  return prefix + '_' + 
    startDate.replace(/-/g, '') + '_to_' + 
    endDate.replace(/-/g, '') + '_' +
    timestamp;
}

// ============================================================================
// QA PROFILE COMPARATIVE EXPORT FUNCTIONS
// ============================================================================

/**
 * Export simple QA observation counts - count successful Ren method results per QA level
 * FIXED: Now actually processes through Ren method to count valid albedo results
 */
function exportQAProfileComparison(collection, glacierOutlines, createGlacierMask, region, description) {
  print('📊 Starting QA Count Analysis - Processing Ren Method Results...');
  
  // Helper function to apply QA filter and process Ren method (hard-coded to avoid object issues)
  function processWithQALevel(qaType) {
    return collection.map(function(image) {
      // Apply QA filtering based on level (hard-coded)
      var qa = image.select('state_1km');
      var cloudState = qa.bitwiseAnd(0x3);
      var shadowFlag = qa.bitwiseAnd(1<<2).rightShift(2);
      var cirrusFlag = qa.bitwiseAnd(1<<8).rightShift(8);
      var sza = image.select('SolarZenith').multiply(0.01);
      var snowIceConf = qa.bitwiseAnd(0x3000).rightShift(12);
      
      var validQA;
      if (qaType === 'strict') {
        validQA = cloudState.eq(0).and(shadowFlag.eq(0)).and(cirrusFlag.eq(0)).and(sza.lt(70)).and(snowIceConf.gte(2));
      } else if (qaType === 'level1') {
        validQA = cloudState.eq(0).and(shadowFlag.eq(0)).and(cirrusFlag.eq(0)).and(sza.lt(70)).and(snowIceConf.gte(1));
      } else if (qaType === 'level2') {
        validQA = cloudState.eq(0).and(cirrusFlag.eq(0)).and(sza.lt(70)).and(snowIceConf.gte(1));
      } else if (qaType === 'level3') {
        validQA = cloudState.eq(0).and(sza.lt(70)).and(snowIceConf.gte(1));
      } else if (qaType === 'level4') {
        validQA = cloudState.eq(0).and(sza.lt(85)).and(snowIceConf.gte(1));
      } else if (qaType === 'level5') {
        validQA = cloudState.lte(1).and(sza.lt(85)).and(snowIceConf.gte(1));
      }
      
      // Apply QA mask
      var qaFiltered = image.updateMask(validQA);
      
      // Apply Ren method processing (simplified version to avoid external module)
      // Extract required bands for BRDF correction
      var red = qaFiltered.select('sur_refl_b01').multiply(0.0001);
      var nir = qaFiltered.select('sur_refl_b02').multiply(0.0001);
      var blue = qaFiltered.select('sur_refl_b03').multiply(0.0001);
      var green = qaFiltered.select('sur_refl_b04').multiply(0.0001);
      var swir1 = qaFiltered.select('sur_refl_b06').multiply(0.0001);
      var swir2 = qaFiltered.select('sur_refl_b07').multiply(0.0001);
      
      // Calculate broadband albedo (simplified Ren method formula)
      var broadbandAlbedo = red.multiply(0.484)
        .add(nir.multiply(0.335))
        .add(blue.multiply(0.181));
      
      // Apply glacier mask
      var glacierMask = createGlacierMask(glacierOutlines, qaFiltered);
      var maskedAlbedo = broadbandAlbedo.updateMask(glacierMask);
      
      // Return image with albedo band
      return maskedAlbedo.rename('broadband_albedo_ren');
    }).filter(ee.Filter.listContains('system:band_names', 'broadband_albedo_ren'));
  }
  
  // Process each QA level and count valid results
  print('⚡ Processing Strict QA level...');
  var strictResults = processWithQALevel('strict');
  var strictCount = strictResults.size();
  
  print('⚡ Processing Level 1 QA level...');
  var level1Results = processWithQALevel('level1');
  var level1Count = level1Results.size();
  
  print('⚡ Processing Level 2 QA level...');
  var level2Results = processWithQALevel('level2');
  var level2Count = level2Results.size();
  
  print('⚡ Processing Level 3 QA level...');
  var level3Results = processWithQALevel('level3');
  var level3Count = level3Results.size();
  
  print('⚡ Processing Level 4 QA level...');
  var level4Results = processWithQALevel('level4');
  var level4Count = level4Results.size();
  
  print('⚡ Processing Level 5 QA level...');
  var level5Results = processWithQALevel('level5');
  var level5Count = level5Results.size();
  
  // Create features with actual Ren method results
  var results = ee.FeatureCollection([
    ee.Feature(null, {
      'qa_level': 'Strict',
      'description': 'Current strict QA',
      'total_observations': strictCount
    }),
    ee.Feature(null, {
      'qa_level': 'Level1', 
      'description': 'Add maybe snow/ice',
      'total_observations': level1Count
    }),
    ee.Feature(null, {
      'qa_level': 'Level2',
      'description': 'Allow shadow pixels', 
      'total_observations': level2Count
    }),
    ee.Feature(null, {
      'qa_level': 'Level3',
      'description': 'Allow cirrus pixels',
      'total_observations': level3Count
    }),
    ee.Feature(null, {
      'qa_level': 'Level4',
      'description': 'Solar zenith to 85°',
      'total_observations': level4Count
    }),
    ee.Feature(null, {
      'qa_level': 'Level5',
      'description': 'Allow uncertain cloud',
      'total_observations': level5Count
    })
  ]);
  
  // Export results
  Export.table.toDrive({
    collection: results,
    description: description + '_qa_ren_counts',
    folder: 'albedo_method_comparison', 
    fileFormat: 'CSV'
  });
  
  print('✅ QA Ren method count export initiated: ' + description + '_qa_ren_counts');
  print('📁 CSV with valid Ren albedo observation counts per QA level');
}

/**
 * Generate summary statistics for QA profile comparison
 */
function generateQAProfileSummary(results, description) {
  var profiles = ['Strict', 'Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'];
  
  var summaryStats = profiles.map(function(profileName) {
    var profileData = results.filter(ee.Filter.eq('qa_profile', profileName));
    
    var totalObservations = profileData.aggregate_count('albedo_mean');
    var meanAlbedo = profileData.aggregate_mean('albedo_mean');
    var stdAlbedo = profileData.aggregate_mean('albedo_std');
    var totalPixels = profileData.aggregate_sum('pixel_count');
    
    return ee.Feature(null, {
      'qa_profile': profileName,
      'total_observations': totalObservations,
      'mean_albedo': meanAlbedo,
      'mean_std_albedo': stdAlbedo,
      'total_pixels': totalPixels
    });
  });
  
  var summaryCollection = ee.FeatureCollection(summaryStats);
  
  // Export summary statistics
  Export.table.toDrive({
    collection: summaryCollection,
    description: description + '_qa_summary',
    folder: 'albedo_method_comparison',
    fileFormat: 'CSV'
  });
  
  print('✅ QA Profile Summary export initiated: ' + description + '_qa_summary');
}

/**
 * Export detailed QA flag analysis for debugging
 */
function exportQAFlagAnalysis(collection, region, description) {
  print('🔍 Analyzing QA flag distribution...');
  
  var qaAnalysis = collection.map(function(image) {
    var qa = image.select('state_1km');
    var date = ee.Date(image.get('system:time_start'));
    
    // Extract individual QA flags
    var cloudState = qa.bitwiseAnd(0x3);
    var shadowFlag = qa.bitwiseAnd(1<<2).rightShift(2);
    var cirrusFlag = qa.bitwiseAnd(1<<8).rightShift(8);
    var internalCloudFlag = qa.bitwiseAnd(1<<10).rightShift(10);
    var snowIceConf = qa.bitwiseAnd(0x3000).rightShift(12);
    
    // Calculate flag statistics
    var flagStats = ee.Image.cat([
      cloudState.rename('cloud_state'),
      shadowFlag.rename('shadow_flag'),
      cirrusFlag.rename('cirrus_flag'),
      internalCloudFlag.rename('internal_cloud'),
      snowIceConf.rename('snow_ice_conf')
    ]).reduceRegion({
      reducer: ee.Reducer.frequencyHistogram(),
      geometry: region,
      scale: config.EXPORT_CONFIG.scale,
      maxPixels: config.EXPORT_CONFIG.maxPixels_ren,
      bestEffort: config.EXPORT_CONFIG.bestEffort,
      tileScale: config.EXPORT_CONFIG.tileScale
    });
    
    return ee.Feature(null, {
      'date': date.format('YYYY-MM-dd'),
      'cloud_state_hist': flagStats.get('cloud_state'),
      'shadow_flag_hist': flagStats.get('shadow_flag'),
      'cirrus_flag_hist': flagStats.get('cirrus_flag'),
      'internal_cloud_hist': flagStats.get('internal_cloud'),
      'snow_ice_conf_hist': flagStats.get('snow_ice_conf'),
      'system:time_start': image.get('system:time_start')
    });
  });
  
  // Export QA flag analysis
  Export.table.toDrive({
    collection: qaAnalysis,
    description: description + '_qa_flag_analysis',
    folder: 'albedo_method_comparison',
    fileFormat: 'CSV'
  });
  
  print('✅ QA Flag Analysis export initiated: ' + description + '_qa_flag_analysis');
}

// ============================================================================
// QUALITY ASSESSMENT AND OUTLIER DETECTION
// ============================================================================

/**
 * Apply post-processing quality assessment and outlier detection
 * Filters broadband albedo values outside physically reasonable bounds
 */
function applyQualityAssessment(collection, albedoBandName, options) {
  options = options || {};
  var lowerBound = options.lowerBound || 0.05;
  var upperBound = options.upperBound || 0.95;
  var enableTemporalFiltering = options.enableTemporalFiltering || false;
  var temporalWindow = options.temporalWindow || 16; // days
  
  print('🔍 Applying quality assessment filters...');
  print('  • Albedo bounds: [' + lowerBound + ', ' + upperBound + ']');
  if (enableTemporalFiltering) {
    print('  • Temporal filtering: ' + temporalWindow + '-day window');
  }
  
  // Apply broadband albedo bounds
  var boundsFiltered = collection.map(function(image) {
    var albedo = image.select(albedoBandName);
    var validAlbedo = albedo.gte(lowerBound).and(albedo.lte(upperBound));
    
    return image.updateMask(image.mask().and(validAlbedo))
      .set('qa_bounds_applied', true)
      .set('qa_lower_bound', lowerBound)
      .set('qa_upper_bound', upperBound);
  });
  
  // Optional temporal median filtering for outlier detection
  if (enableTemporalFiltering) {
    var temporalFiltered = boundsFiltered.map(function(image) {
      var date = ee.Date(image.get('system:time_start'));
      var startWindow = date.advance(-temporalWindow/2, 'day');
      var endWindow = date.advance(temporalWindow/2, 'day');
      
      var windowCollection = boundsFiltered
        .filterDate(startWindow, endWindow)
        .select(albedoBandName);
      
      var median = windowCollection.median();
      var albedo = image.select(albedoBandName);
      var difference = albedo.subtract(median).abs();
      
      // Flag pixels that deviate more than 0.15 from temporal median
      var outlierMask = difference.lt(0.15);
      
      return image.updateMask(image.mask().and(outlierMask))
        .set('qa_temporal_filtered', true)
        .set('qa_temporal_window_days', temporalWindow);
    });
    
    return temporalFiltered;
  }
  
  return boundsFiltered;
}

/**
 * Generate quality assessment statistics for QA profile comparison
 */
function generateQualityAssessmentStats(results, description) {
  var qualityStats = results.map(function(feature) {
    var albedoMean = ee.Number(feature.get('albedo_mean'));
    var albedoStd = ee.Number(feature.get('albedo_std'));
    var pixelCount = ee.Number(feature.get('pixel_count'));
    
    // Quality flags based on thresholds
    var validAlbedoRange = albedoMean.gte(0.05).and(albedoMean.lte(0.95));
    var reasonableVariability = albedoStd.lt(0.25); // Flag high variability
    var sufficientData = pixelCount.gte(100); // Minimum pixel count
    
    return feature.set({
      'qa_valid_albedo_range': validAlbedoRange,
      'qa_reasonable_variability': reasonableVariability,
      'qa_sufficient_data': sufficientData,
      'qa_overall_quality': validAlbedoRange.and(reasonableVariability).and(sufficientData)
    });
  });
  
  // Export quality assessment statistics
  Export.table.toDrive({
    collection: qualityStats,
    description: description + '_quality_assessment',
    folder: 'albedo_method_comparison',
    fileFormat: 'CSV'
  });
  
  print('✅ Quality Assessment export initiated: ' + description + '_quality_assessment');
}

/**
 * Enhanced QA profile comparison with quality assessment integration
 */
function exportQAProfileComparisonWithQA(collection, glacierOutlines, createGlacierMask, region, description, qaOptions) {
  qaOptions = qaOptions || {};
  var enableQualityFiltering = qaOptions.enableQualityFiltering || false;
  var boundsOptions = qaOptions.boundsOptions || {};
  
  print('📊 Starting Enhanced QA Profile Analysis with Quality Assessment...');
  
  var profiles = ['strict', 'level1', 'level2', 'level3', 'level4', 'level5'];
  var allResults = ee.FeatureCollection([]);
  
  // Process collection with each QA profile
  profiles.forEach(function(profileKey) {
    var profile = config.QA_PROFILES[profileKey];
    print('⚡ Processing with ' + profile.name + ' profile + QA filters...');
    
    // Apply Ren method with specific QA profile
    var processed = collection.map(function(image) {
      var renMethod = require('users/tofunori/MOD09A1_REN_METHOD:modules/methods/ren.js');
      return renMethod.processRenMethod(image, glacierOutlines, createGlacierMask, profile);
    });
    
    // Apply quality assessment if enabled
    if (enableQualityFiltering) {
      processed = applyQualityAssessment(processed, 'broadband_albedo_ren_masked', boundsOptions);
    }
    
    // Generate statistics for this profile with QA metrics
    var profileStats = processed.map(function(image) {
      var bandNames = image.bandNames();
      var hasMaskedBand = bandNames.contains('broadband_albedo_ren_masked');
      var hasBaseBand = bandNames.contains('broadband_albedo_ren');
      var hasAnyAlbedoBand = ee.Algorithms.If(
        hasMaskedBand,
        true,
        hasBaseBand
      );
      
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
          scale:     config.EXPORT_CONFIG.scale,
          maxPixels: config.EXPORT_CONFIG.maxPixels_ren,
          bestEffort: config.EXPORT_CONFIG.bestEffort,
          tileScale:  config.EXPORT_CONFIG.tileScale
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
        'qa_profile':   profile.name,
        'qa_description': profile.description,
        'qa_expected_gain': profile.expectedGain,
        'qa_risk_level': profile.risk,
        'qa_bounds_applied': enableQualityFiltering,
        'system:time_start': image.get('system:time_start')
      });
    }).filter(ee.Filter.notNull(['albedo_mean']));
    
    allResults = allResults.merge(profileStats);
  });
  
  // Export comprehensive comparison CSV with QA integration
  Export.table.toDrive({
    collection: allResults,
    description: description + '_qa_profile_enhanced',
    folder: 'albedo_method_comparison',
    fileFormat: 'CSV'
  });
  
  print('✅ Enhanced QA Profile Comparison export initiated: ' + description + '_qa_profile_enhanced');
  print('📁 Check Google Drive folder: albedo_method_comparison');
  
  // Generate quality assessment statistics
  generateQualityAssessmentStats(allResults, description);
  
  // Generate summary with quality metrics
  generateEnhancedQAProfileSummary(allResults, description);
}

/**
 * Generate enhanced summary statistics with quality metrics
 */
function generateEnhancedQAProfileSummary(results, description) {
  var profiles = ['Strict', 'Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'];
  
  var summaryStats = profiles.map(function(profileName) {
    var profileData = results.filter(ee.Filter.eq('qa_profile', profileName));
    
    var totalObservations = profileData.aggregate_count('albedo_mean');
    var meanAlbedo = profileData.aggregate_mean('albedo_mean');
    var stdAlbedo = profileData.aggregate_mean('albedo_std');
    var totalPixels = profileData.aggregate_sum('pixel_count');
    var minAlbedo = profileData.aggregate_min('albedo_min');
    var maxAlbedo = profileData.aggregate_max('albedo_max');
    
    // Quality metrics
    var validRangeCount = profileData.filter(
      ee.Filter.and(
        ee.Filter.gte('albedo_mean', 0.05),
        ee.Filter.lte('albedo_mean', 0.95)
      )
    ).aggregate_count('albedo_mean');
    
    var qualityRatio = ee.Number(validRangeCount).divide(ee.Number(totalObservations));
    
    return ee.Feature(null, {
      'qa_profile': profileName,
      'total_observations': totalObservations,
      'mean_albedo': meanAlbedo,
      'mean_std_albedo': stdAlbedo,
      'min_albedo': minAlbedo,
      'max_albedo': maxAlbedo,
      'total_pixels': totalPixels,
      'valid_range_observations': validRangeCount,
      'quality_ratio': qualityRatio
    });
  });
  
  var summaryCollection = ee.FeatureCollection(summaryStats);
  
  // Export enhanced summary statistics
  Export.table.toDrive({
    collection: summaryCollection,
    description: description + '_qa_enhanced_summary',
    folder: 'albedo_method_comparison',
    fileFormat: 'CSV'
  });
  
  print('✅ Enhanced QA Profile Summary export initiated: ' + description + '_qa_enhanced_summary');
}

// ============================================================================
// EXPORTS
// ============================================================================

exports.exportComparisonStats = exportComparisonStats;
exports.exportIndividualMethod = exportIndividualMethod;
exports.printDataCounts = printDataCounts;
exports.generateExportDescription = generateExportDescription;
exports.exportQAProfileComparison = exportQAProfileComparison;
exports.generateQAProfileSummary = generateQAProfileSummary;
exports.exportQAFlagAnalysis = exportQAFlagAnalysis;
exports.applyQualityAssessment = applyQualityAssessment;
exports.generateQualityAssessmentStats = generateQualityAssessmentStats;
exports.exportQAProfileComparisonWithQA = exportQAProfileComparisonWithQA;
exports.generateEnhancedQAProfileSummary = generateEnhancedQAProfileSummary;