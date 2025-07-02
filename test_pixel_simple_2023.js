/**
 * Simple Test Version - June 2023 Only
 * 
 * This script processes only June 2023 data to test the methodology
 * before running the full multi-year script.
 * 
 * Same logic as test_pixel_simple.js but for one month instead of one day
 */

// ============================================================================
// MODULE IMPORTS (Same as test_pixel_simple.js)
// ============================================================================

var glacierUtils = require('users/tofunori/MOD09A1_REN_METHOD:modules/utils/glacier.js');
var originalComparison = require('users/tofunori/MOD09A1_REN_METHOD:modules/workflows/comparison.js');

// ============================================================================
// CONFIGURATION
// ============================================================================

var CONFIG = {
  EXPORT_FOLDER: 'pixel_test_2023',
  SCALE: 500,
  TILE_SCALE: 2,
  BEST_EFFORT: true
};

// ============================================================================
// AUTO-RUN TEST FOR JUNE 2023
// ============================================================================

print('🧪 Testing with June 2023 data');
print('📅 This will process one month to verify the methodology');

var testStart = ee.Date('2023-06-01');
var testEnd = ee.Date('2023-07-01');
var glacierData = glacierUtils.initializeGlacierData();

var methods = {ren: true, mod10a1: true, mcd43a3: true};

try {
  var results = originalComparison.runModularComparison(
    testStart, testEnd, methods, 
    glacierData.outlines, 
    glacierData.geometry
  );
  
  var allSamples = ee.FeatureCollection([]);
  var meltSeasonFilter = ee.Filter.calendarRange(6, 9, 'month');
  
  // Process MOD09GA
  if (results.ren && results.ren.size().gt(0)) {
    print('📊 Processing MOD09GA pixels...');
    var renCollection = results.ren.filter(meltSeasonFilter);
    var renSamples = renCollection.map(function(renImage) {
      var projection = renImage.select('broadband_albedo_ren_masked').projection();
      var coords = ee.Image.pixelCoordinates(projection);
      var pixelRow = coords.select('y').int().rename('pixel_row');
      var pixelCol = coords.select('x').int().rename('pixel_col');
      var pixelId = pixelRow.multiply(1000000).add(pixelCol).double().rename('pixel_id');
      var lonRounded = ee.Image.pixelLonLat().select('longitude').multiply(100).round().int().rename('tile_h');
      var latRounded = ee.Image.pixelLonLat().select('latitude').multiply(100).round().int().rename('tile_v');
      var imageWithCoords = renImage.addBands([lonRounded, latRounded, pixelRow, pixelCol, pixelId]);
      
      return imageWithCoords.select(['broadband_albedo_ren_masked', 'tile_h', 'tile_v', 'pixel_row', 'pixel_col', 'pixel_id']).sample({
        region: glacierData.geometry,
        scale: CONFIG.SCALE,
        geometries: true,
        tileScale: CONFIG.TILE_SCALE,
        bestEffort: CONFIG.BEST_EFFORT
      }).map(function(feature) {
        var coords = feature.geometry().coordinates();
        var date = ee.Date(renImage.get('system:time_start'));
        return feature.set({
          'albedo_value': feature.get('broadband_albedo_ren_masked'),
          'longitude': ee.List(coords).get(0),
          'latitude': ee.List(coords).get(1),
          'tile_h': feature.get('tile_h'),
          'tile_v': feature.get('tile_v'),
          'pixel_row': feature.get('pixel_row'),
          'pixel_col': feature.get('pixel_col'),
          'pixel_id': feature.get('pixel_id'),
          'date': date.format('YYYY-MM-dd'),
          'method': 'MOD09GA'
        });
      });
    }).flatten();
    allSamples = allSamples.merge(renSamples);
  }
  
  // Process MOD10A1
  if (results.mod10a1 && results.mod10a1.size().gt(0)) {
    print('📊 Processing MOD10A1 pixels...');
    var mod10Collection = results.mod10a1.filter(meltSeasonFilter);
    var mod10Samples = mod10Collection.map(function(mod10Image) {
      var projection = mod10Image.select('broadband_albedo_mod10a1').projection();
      var coords = ee.Image.pixelCoordinates(projection);
      var pixelRow = coords.select('y').int().rename('pixel_row');
      var pixelCol = coords.select('x').int().rename('pixel_col');
      var pixelId = pixelRow.multiply(1000000).add(pixelCol).double().rename('pixel_id');
      var lonRounded = ee.Image.pixelLonLat().select('longitude').multiply(100).round().int().rename('tile_h');
      var latRounded = ee.Image.pixelLonLat().select('latitude').multiply(100).round().int().rename('tile_v');
      var imageWithCoords = mod10Image.addBands([lonRounded, latRounded, pixelRow, pixelCol, pixelId]);
      
      return imageWithCoords.select(['broadband_albedo_mod10a1', 'tile_h', 'tile_v', 'pixel_row', 'pixel_col', 'pixel_id']).sample({
        region: glacierData.geometry,
        scale: CONFIG.SCALE,
        geometries: true,
        tileScale: CONFIG.TILE_SCALE,
        bestEffort: CONFIG.BEST_EFFORT
      }).map(function(feature) {
        var coords = feature.geometry().coordinates();
        var date = ee.Date(mod10Image.get('system:time_start'));
        return feature.set({
          'albedo_value': feature.get('broadband_albedo_mod10a1'),
          'longitude': ee.List(coords).get(0),
          'latitude': ee.List(coords).get(1),
          'tile_h': feature.get('tile_h'),
          'tile_v': feature.get('tile_v'),
          'pixel_row': feature.get('pixel_row'),
          'pixel_col': feature.get('pixel_col'),
          'pixel_id': feature.get('pixel_id'),
          'date': date.format('YYYY-MM-dd'),
          'method': 'MOD10A1'
        });
      });
    }).flatten();
    allSamples = allSamples.merge(mod10Samples);
  }
  
  // Process MCD43A3
  if (results.mcd43a3 && results.mcd43a3.size().gt(0)) {
    print('📊 Processing MCD43A3 pixels...');
    var mcd43Collection = results.mcd43a3.filter(meltSeasonFilter);
    var mcd43Samples = mcd43Collection.map(function(mcd43Image) {
      var projection = mcd43Image.select('broadband_albedo_mcd43a3').projection();
      var coords = ee.Image.pixelCoordinates(projection);
      var pixelRow = coords.select('y').int().rename('pixel_row');
      var pixelCol = coords.select('x').int().rename('pixel_col');
      var pixelId = pixelRow.multiply(1000000).add(pixelCol).double().rename('pixel_id');
      var lonRounded = ee.Image.pixelLonLat().select('longitude').multiply(100).round().int().rename('tile_h');
      var latRounded = ee.Image.pixelLonLat().select('latitude').multiply(100).round().int().rename('tile_v');
      var imageWithCoords = mcd43Image.addBands([lonRounded, latRounded, pixelRow, pixelCol, pixelId]);
      
      return imageWithCoords.select(['broadband_albedo_mcd43a3', 'tile_h', 'tile_v', 'pixel_row', 'pixel_col', 'pixel_id']).sample({
        region: glacierData.geometry,
        scale: CONFIG.SCALE,
        geometries: true,
        tileScale: CONFIG.TILE_SCALE,
        bestEffort: CONFIG.BEST_EFFORT
      }).map(function(feature) {
        var coords = feature.geometry().coordinates();
        var date = ee.Date(mcd43Image.get('system:time_start'));
        return feature.set({
          'albedo_value': feature.get('broadband_albedo_mcd43a3'),
          'longitude': ee.List(coords).get(0),
          'latitude': ee.List(coords).get(1),
          'tile_h': feature.get('tile_h'),
          'tile_v': feature.get('tile_v'),
          'pixel_row': feature.get('pixel_row'),
          'pixel_col': feature.get('pixel_col'),
          'pixel_id': feature.get('pixel_id'),
          'date': date.format('YYYY-MM-dd'),
          'method': 'MCD43A3'
        });
      });
    }).flatten();
    allSamples = allSamples.merge(mcd43Samples);
  }
  
  // Export test data
  Export.table.toDrive({
    collection: allSamples,
    description: 'TEST_pixels_three_methods_2023_06',
    folder: CONFIG.EXPORT_FOLDER,
    fileFormat: 'CSV',
    selectors: ['albedo_value', 'broadband_albedo_ren_masked', 'date', 'latitude', 'longitude', 'method', 'pixel_col', 'pixel_id', 'pixel_row', 'tile_h', 'tile_v', '.geo']
  });
  
  print('🎯 Test export initiated: TEST_pixels_three_methods_2023_06');
  print('✅ Check results before running the full multi-year script');
  
  allSamples.size().evaluate(function(count) {
    print('📊 Total pixels sampled for June 2023:', count);
  });
  
} catch (error) {
  print('❌ Error in test:', error);
}