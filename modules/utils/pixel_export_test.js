/**
 * Pixel Export Utility Functions - Test Version
 * 
 * Enhanced export functions for pixel-level albedo analysis
 * Preserves exact same processing logic as original export.js but outputs
 * individual pixel data instead of regional statistics
 * 
 * Key Features:
 * - Pixel-level CSV export with spatial coordinates
 * - MODIS sinusoidal projection pixel tracking
 * - Compatibility with existing 3-method workflow
 * - Enhanced spatial analysis capabilities
 * 
 * Author: Pixel Analysis Enhancement  
 * Date: 2025-07-02
 */

// ============================================================================
// MODULE IMPORTS
// ============================================================================

var config = require('users/tofunori/MOD09A1_REN_METHOD:modules/config.js');

// ============================================================================
// PIXEL ID UTILITIES (adapted from MODIS_Albedo project)
// ============================================================================

/**
 * Generate pixel coordinate bands using MODIS sinusoidal projection
 * Creates robust pixel tracking with row/col coordinates
 */
function generatePixelCoordinates(referenceImage) {
  var projection = referenceImage.projection();
  
  var coords = ee.Image.pixelCoordinates(projection);
  var pixelRow = coords.select('y').int().rename('pixel_row');
  var pixelCol = coords.select('x').int().rename('pixel_col');
  
  // Create pixel ID using sinusoidal coordinates (format: SIN_row_col)
  var pixelId = pixelRow.multiply(1000000).add(pixelCol).int().rename('pixel_id_numeric');
  
  return ee.Image.cat([pixelRow, pixelCol, pixelId]);
}

/**
 * Format pixel ID for CSV export (human readable)
 */
function formatPixelId(pixelRow, pixelCol) {
  if (pixelRow === null || pixelCol === null || 
      pixelRow === undefined || pixelCol === undefined ||
      isNaN(pixelRow) || isNaN(pixelCol)) {
    return 'invalid_coords';
  }
  
  return 'SIN_' + pixelRow + '_' + pixelCol;
}

/**
 * Validate pixel coordinates
 */
function validatePixelCoords(pixelRow, pixelCol) {
  return pixelRow !== null && pixelCol !== null && 
         pixelRow !== undefined && pixelCol !== undefined &&
         !isNaN(pixelRow) && !isNaN(pixelCol) &&
         isFinite(pixelRow) && isFinite(pixelCol);
}

// ============================================================================
// PIXEL-LEVEL EXPORT FUNCTIONS
// ============================================================================

/**
 * Export pixel-level comparison of all three albedo methods to CSV
 * Each row represents one valid glacier pixel with albedo value and metadata
 */
function exportPixelComparisonStats(results, region, description) {
  
  var allPixels = ee.FeatureCollection([]);
  
  // Process MOD09GA method (Ren)
  if (results.ren) {
    var renPixels = results.ren.map(function(image) {
      var bandNames = image.bandNames();
      var hasMaskedBand = bandNames.contains('broadband_albedo_ren_masked');
      var hasBaseBand = bandNames.contains('broadband_albedo_ren');
      var hasAnyAlbedoBand = ee.Algorithms.If(hasMaskedBand, true, hasBaseBand);
      
      return ee.FeatureCollection(ee.Algorithms.If(
        hasAnyAlbedoBand,
        // Sample pixels if albedo band exists
        ee.Image(
          ee.Algorithms.If(
            hasMaskedBand,
            image.select(['broadband_albedo_ren_masked', 'pixel_row', 'pixel_col', 'pixel_id_numeric']),
            image.select(['broadband_albedo_ren', 'pixel_row', 'pixel_col', 'pixel_id_numeric'])
          )
        ).sample({
          region: region,
          scale: config.EXPORT_CONFIG.scale,
          tileScale: config.EXPORT_CONFIG.tileScale,
          geometries: true,
          maxPixels: config.EXPORT_CONFIG.maxPixels_ren
        }).map(function(feature) {
          var coords = feature.geometry().coordinates();
          var date = ee.Date(image.get('system:time_start'));
          
          // Extract albedo value (handle both masked and unmasked versions)
          var albedoValue = ee.Algorithms.If(
            hasMaskedBand,
            feature.get('broadband_albedo_ren_masked'),
            feature.get('broadband_albedo_ren')
          );
          
          // Calculate additional predictors at pixel level
          var szaDeg = image.select('SolarZenith').multiply(0.01)
            .sample(feature.geometry(), config.EXPORT_CONFIG.scale).first().get('SolarZenith');
          
          var ndsiValue = image.expression('(b4 - b6) / (b4 + b6)', {
            'b4': image.select('sur_refl_b04').multiply(0.0001),
            'b6': image.select('sur_refl_b06').multiply(0.0001)
          }).sample(feature.geometry(), config.EXPORT_CONFIG.scale).first().get('constant');
          
          var elevValue = config.dem.sample(feature.geometry(), config.EXPORT_CONFIG.scale)
            .first().get('DSM');
          
          return feature.set({
            'albedo_value': albedoValue,
            'pixel_row': feature.get('pixel_row'),
            'pixel_col': feature.get('pixel_col'),
            'pixel_id': feature.get('pixel_id_numeric'),
            'longitude': ee.List(coords).get(0),
            'latitude': ee.List(coords).get(1),
            'date': date.format('YYYY-MM-dd'),
            'year': date.get('year'),
            'month': date.get('month'),
            'day_of_year': date.getRelative('day', 'year'),
            'method': ee.Algorithms.If(image.get('is_terra'), 'MOD09GA_Terra', 'MOD09GA_Aqua'),
            'solar_zenith': szaDeg,
            'ndsi_value': ndsiValue,
            'elevation': elevValue,
            'system:time_start': image.get('system:time_start')
          });
        }),
        // Return empty collection if no albedo band
        ee.FeatureCollection([])
      ));
    }).flatten().filter(ee.Filter.notNull(['albedo_value']));
    
    allPixels = allPixels.merge(renPixels);
  }
  
  // Process MOD10A1 method
  if (results.mod10a1) {
    var mod10Pixels = results.mod10a1.map(function(image) {
      var bandNames = image.bandNames();
      var hasBand = bandNames.contains('broadband_albedo_mod10a1');
      
      return ee.FeatureCollection(ee.Algorithms.If(
        hasBand,
        image.select(['broadband_albedo_mod10a1', 'pixel_row', 'pixel_col', 'pixel_id_numeric'])
          .sample({
            region: region,
            scale: config.EXPORT_CONFIG.scale_simple,
            tileScale: config.EXPORT_CONFIG.tileScale,
            geometries: true,
            maxPixels: config.EXPORT_CONFIG.maxPixels_simple
          }).map(function(feature) {
            var coords = feature.geometry().coordinates();
            var date = ee.Date(image.get('system:time_start'));
            
            var elevValue = config.dem.sample(feature.geometry(), config.EXPORT_CONFIG.scale_simple)
              .first().get('DSM');
            
            return feature.set({
              'albedo_value': feature.get('broadband_albedo_mod10a1'),
              'pixel_row': feature.get('pixel_row'),
              'pixel_col': feature.get('pixel_col'),
              'pixel_id': feature.get('pixel_id_numeric'),
              'longitude': ee.List(coords).get(0),
              'latitude': ee.List(coords).get(1),
              'date': date.format('YYYY-MM-dd'),
              'year': date.get('year'),
              'month': date.get('month'),
              'day_of_year': date.getRelative('day', 'year'),
              'method': ee.Algorithms.If(image.get('is_terra'), 'MOD10A1_Terra', 'MOD10A1_Aqua'),
              'elevation': elevValue,
              'system:time_start': image.get('system:time_start')
            });
          }),
        ee.FeatureCollection([])
      ));
    }).flatten().filter(ee.Filter.notNull(['albedo_value']));
    
    allPixels = allPixels.merge(mod10Pixels);
  }
  
  // Process MCD43A3 method
  if (results.mcd43a3) {
    var mcd43Pixels = results.mcd43a3.map(function(image) {
      var bandNames = image.bandNames();
      var hasBand = bandNames.contains('broadband_albedo_mcd43a3');
      
      return ee.FeatureCollection(ee.Algorithms.If(
        hasBand,
        image.select(['broadband_albedo_mcd43a3', 'pixel_row', 'pixel_col', 'pixel_id_numeric'])
          .sample({
            region: region,
            scale: config.EXPORT_CONFIG.scale_simple,
            tileScale: config.EXPORT_CONFIG.tileScale,
            geometries: true,
            maxPixels: config.EXPORT_CONFIG.maxPixels_simple
          }).map(function(feature) {
            var coords = feature.geometry().coordinates();
            var date = ee.Date(image.get('system:time_start'));
            
            var elevValue = config.dem.sample(feature.geometry(), config.EXPORT_CONFIG.scale_simple)
              .first().get('DSM');
            
            return feature.set({
              'albedo_value': feature.get('broadband_albedo_mcd43a3'),
              'pixel_row': feature.get('pixel_row'),
              'pixel_col': feature.get('pixel_col'), 
              'pixel_id': feature.get('pixel_id_numeric'),
              'longitude': ee.List(coords).get(0),
              'latitude': ee.List(coords).get(1),
              'date': date.format('YYYY-MM-dd'),
              'year': date.get('year'),
              'month': date.get('month'),
              'day_of_year': date.getRelative('day', 'year'),
              'method': 'MCD43A3',
              'elevation': elevValue,
              'system:time_start': image.get('system:time_start')
            });
          }),
        ee.FeatureCollection([])
      ));
    }).flatten().filter(ee.Filter.notNull(['albedo_value']));
    
    allPixels = allPixels.merge(mcd43Pixels);
  }
  
  // Export pixel-level results to CSV
  Export.table.toDrive({
    collection: allPixels,
    description: description,
    folder: 'albedo_pixel_analysis',
    fileFormat: 'CSV'
  });
  
  // Print summary statistics for verification
  print('Pixel export initiated:', description);
  print('Total pixel features:', allPixels.size());
  
  return allPixels;
}

/**
 * Export pixel pairs for method comparison analysis
 * Creates pixel-to-pixel comparison dataset
 */
function exportPixelPairsComparison(results, region, description) {
  var pairs = ee.FeatureCollection([]);

  // Helper to find reference image with matching timestamp
  function findMatchingRef(img, refCol) {
    var ts = ee.Number(img.get('system:time_start'));
    return ee.Image(ee.Algorithms.If(
      refCol.filter(ee.Filter.eq('system:time_start', ts)).size().gt(0),
      refCol.filter(ee.Filter.eq('system:time_start', ts)).first(),
      null
    ));
  }

  var refCol = results.mcd43a3;
  if (!refCol) {
    throw new Error('MCD43A3 collection required as reference for pixel pairs.');
  }

  // Create pixel pairs for MOD09GA vs MCD43A3
  if (results.ren) {
    var renPairs = results.ren.map(function(img) {
      var ref = findMatchingRef(img, refCol);
      return ee.FeatureCollection(ee.Algorithms.If(
        ref,
        img.addBands(ref.select('broadband_albedo_mcd43a3').rename('albedo_ref'))
          .addBands(generatePixelCoordinates(img))
          .sample({
            region: region,
            scale: config.EXPORT_CONFIG.scale,
            tileScale: config.EXPORT_CONFIG.tileScale,
            geometries: true
          }).map(function(feature) {
            var coords = feature.geometry().coordinates();
            var date = ee.Date(img.get('system:time_start'));
            
            return feature.set({
              'albedo_primary': feature.get('broadband_albedo_ren_masked'),
              'albedo_reference': feature.get('albedo_ref'),
              'pixel_row': feature.get('pixel_row'),
              'pixel_col': feature.get('pixel_col'),
              'pixel_id': feature.get('pixel_id_numeric'),
              'longitude': ee.List(coords).get(0),
              'latitude': ee.List(coords).get(1),
              'date': date.format('YYYY-MM-dd'),
              'primary_method': 'MOD09GA',
              'reference_method': 'MCD43A3',
              'is_terra': img.get('is_terra')
            });
          }),
        ee.FeatureCollection([])
      ));
    }).flatten();
    
    pairs = pairs.merge(renPairs);
  }

  // Create pixel pairs for MOD10A1 vs MCD43A3
  if (results.mod10a1) {
    var mod10Pairs = results.mod10a1.map(function(img) {
      var ref = findMatchingRef(img, refCol);
      return ee.FeatureCollection(ee.Algorithms.If(
        ref,
        img.addBands(ref.select('broadband_albedo_mcd43a3').rename('albedo_ref'))
          .addBands(generatePixelCoordinates(img))
          .sample({
            region: region,
            scale: config.EXPORT_CONFIG.scale_simple,
            tileScale: config.EXPORT_CONFIG.tileScale,
            geometries: true
          }).map(function(feature) {
            var coords = feature.geometry().coordinates();
            var date = ee.Date(img.get('system:time_start'));
            
            return feature.set({
              'albedo_primary': feature.get('broadband_albedo_mod10a1'),
              'albedo_reference': feature.get('albedo_ref'),
              'pixel_row': feature.get('pixel_row'),
              'pixel_col': feature.get('pixel_col'),
              'pixel_id': feature.get('pixel_id_numeric'),
              'longitude': ee.List(coords).get(0),
              'latitude': ee.List(coords).get(1),
              'date': date.format('YYYY-MM-dd'),
              'primary_method': 'MOD10A1',
              'reference_method': 'MCD43A3',
              'is_terra': img.get('is_terra')
            });
          }),
        ee.FeatureCollection([])
      ));
    }).flatten();
    
    pairs = pairs.merge(mod10Pairs);
  }

  // Export pixel pairs
  Export.table.toDrive({
    collection: pairs,
    description: description + '_pixel_pairs',
    folder: 'albedo_pixel_pairs',
    fileFormat: 'CSV'
  });

  return pairs;
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
 * Validation function to compare pixel aggregation with regional statistics
 * Helps ensure pixel-level analysis produces consistent results
 */
function validatePixelAggregation(pixelCollection, expectedRegionalMean, tolerance) {
  tolerance = tolerance || 0.05; // 5% tolerance by default
  
  var actualMean = pixelCollection.aggregate_mean('albedo_value');
  
  return actualMean.getInfo(function(mean) {
    var difference = Math.abs(mean - expectedRegionalMean);
    var relativeError = difference / expectedRegionalMean;
    
    print('Validation Results:');
    print('  Expected regional mean:', expectedRegionalMean);
    print('  Actual pixel mean:', mean);
    print('  Absolute difference:', difference);
    print('  Relative error:', relativeError);
    print('  Within tolerance:', relativeError <= tolerance ? 'YES' : 'NO');
    
    return relativeError <= tolerance;
  });
}

// ============================================================================
// SUMMARY AND STATISTICS
// ============================================================================

/**
 * Generate pixel-level summary statistics
 */
function generatePixelSummary(pixelCollection) {
  var summary = pixelCollection.aggregate_stats('albedo_value');
  var pixelCount = pixelCollection.size();
  
  print('Pixel Analysis Summary:');
  print('  Total pixels:', pixelCount);
  print('  Mean albedo:', summary.get('mean'));
  print('  Std dev:', summary.get('stdDev'));
  print('  Min albedo:', summary.get('min'));
  print('  Max albedo:', summary.get('max'));
  
  return summary;
}

// ============================================================================
// EXPORTS
// ============================================================================

exports.exportPixelComparisonStats = exportPixelComparisonStats;
exports.exportPixelPairsComparison = exportPixelPairsComparison;
exports.generateExportDescription = generateExportDescription;
exports.validatePixelAggregation = validatePixelAggregation;
exports.generatePixelSummary = generatePixelSummary;
exports.generatePixelCoordinates = generatePixelCoordinates;
exports.formatPixelId = formatPixelId;
exports.validatePixelCoords = validatePixelCoords;