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
 * Export statistical comparison of all three albedo methods to CSV
 * Includes mean, std, min, max, count for each method and date
 */
function exportComparisonStats(results, region, description) {
  
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

      // --- Additional predictors -------------------------------------------------
      // (1) Solar-zenith angle (degrees)
      var szaDeg = image.select('SolarZenith').multiply(0.01);
      var szaMean = szaDeg.reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: region,
        scale: config.EXPORT_CONFIG.scale,
        maxPixels: config.EXPORT_CONFIG.maxPixels_ren,
        bestEffort: config.EXPORT_CONFIG.bestEffort,
        tileScale: config.EXPORT_CONFIG.tileScale
      }).get('SolarZenith');

      // (2) Scene-mean NDSI (computed from MODIS bands 4 and 6)
      var ndsiImg = image.expression(' (b4 - b6) / (b4 + b6) ', {
        'b4': image.select('sur_refl_b04').multiply(0.0001),
        'b6': image.select('sur_refl_b06').multiply(0.0001)
      }).rename('NDSI');
      var ndsiMean = ndsiImg.reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: region,
        scale: config.EXPORT_CONFIG.scale,
        maxPixels: config.EXPORT_CONFIG.maxPixels_ren,
        bestEffort: config.EXPORT_CONFIG.bestEffort,
        tileScale: config.EXPORT_CONFIG.tileScale
      }).get('NDSI');

      // (3) Mean elevation of valid pixels (DEM masked by image & glacier)
      // Use a single-band validity mask derived from the image. The native
      // image.mask() returns one mask band per image band (e.g. 67 for MOD09GA),
      // which is incompatible with updateMask on a single-band DEM. Reducing
      // the mask with `ee.Reducer.min()` collapses it to one band that is 1
      // only where *all* image bands are valid.
      var demValidMask = image.mask().reduce(ee.Reducer.min());
      var demMasked = config.dem.updateMask(demValidMask);
      var elevMean = demMasked.reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: region,
        scale: config.EXPORT_CONFIG.scale,
        maxPixels: config.EXPORT_CONFIG.maxPixels_ren,
        bestEffort: config.EXPORT_CONFIG.bestEffort,
        tileScale: config.EXPORT_CONFIG.tileScale
      }).get('DSM');

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
        'method':       ee.Algorithms.If(image.get('is_terra'), 'MOD09GA', 'MYD09GA'),
        'solar_zenith': szaMean,
        'ndsi_mean':    ndsiMean,
        'mean_elev':    elevMean,
        'system:time_start': image.get('system:time_start')
      });
    }).filter(ee.Filter.notNull(['albedo_mean']));
    
    // Note: Deduplication handled at collection level, not here to avoid memory issues
    
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
        'method': ee.Algorithms.If(image.get('is_terra'), 'MOD10A1', 'MYD10A1'),
        'system:time_start': image.get('system:time_start')
      });
    }).filter(ee.Filter.notNull(['albedo_mean']));
    
    // Note: Deduplication handled at collection level, not here to avoid memory issues
    
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
  
  
  // Print data counts for verification
  printDataCounts(results);
}

/**
 * Print data counts for verification
 */
function printDataCounts(results) {
}

/**
 * Generate timestamped export description for file naming
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
  
}

/**
 * Export per-pixel pairs (daily product vs MCD43A3) for MOD09GA and MOD10A1
 * Produces a large CSV/TFRecord where each row = 1 valid glacier pixel.
 */
function exportPixelPairs(results, region, description) {
  var pairs = ee.FeatureCollection([]);

  // Helper to find the reference image with identical timestamp
  function findRef(img, mcd43Col) {
    var ts = ee.Number(img.get('system:time_start'));
    return ee.Image(ee.Algorithms.If(
      mcd43Col.filter(ee.Filter.eq('system:time_start', ts)).size().gt(0),
      mcd43Col.filter(ee.Filter.eq('system:time_start', ts)).first(),
      null
    ));
  }

  var refCol = results.mcd43a3;
  if (!refCol) {
    throw new Error('MCD43A3 collection must be present for pixel pair export.');
  }

  function addPairs(collection, family) {
    var fc = collection.map(function(img) {
      var ref = findRef(img, refCol);
      return ee.FeatureCollection(ee.Algorithms.If(ref,
        img.addBands(ref.select('broadband_albedo_mcd43a3').rename('alb_ref'))
          .sample({
            region: region,
            scale: config.EXPORT_CONFIG.scale,
            tileScale: config.EXPORT_CONFIG.tileScale,
            geometries: false
          })
          .map(function(ft){
            var base = {
              'family': family,
              'date': ee.Date(img.get('system:time_start')).format('YYYY-MM-dd'),
              'is_terra': img.get('is_terra')
            };
            // Attach predictors only for MOD09GA family
            var enriched = ee.Dictionary(base);
            if (family === 'MOD09GA') {
              enriched = enriched.set({
                'solar_zenith': img.get('solar_zenith'),
                'ndsi_mean':    img.get('ndsi_mean'),
                'mean_elev':    img.get('mean_elev')
              });
            }
            return ft.set(enriched).rename(['alb_daily','alb_ref']);
          }),
        ee.FeatureCollection([])
      ));
    }).flatten();
    return fc;
  }

  if (results.ren) {
    pairs = pairs.merge(addPairs(results.ren, 'MOD09GA'));
  }
  if (results.mod10a1) {
    pairs = pairs.merge(addPairs(results.mod10a1, 'MOD10A1'));
  }

  Export.table.toDrive({
    collection: pairs,
    description: description + '_pixel_pairs',
    folder: 'albedo_pixel_pairs',
    fileFormat: 'CSV'
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

exports.exportComparisonStats = exportComparisonStats;
exports.printDataCounts = printDataCounts;
exports.generateExportDescription = generateExportDescription;
exports.exportIndividualMethod = exportIndividualMethod;
exports.exportPixelPairs = exportPixelPairs;