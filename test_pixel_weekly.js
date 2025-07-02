/**
 * Weekly Pixel Analysis Test - Fixed Coordinate System
 * 
 * This version uses the same pipeline as test_pixel_simple.js but processes
 * one full week (7 days) instead of a single day. Uses direct MODIS sinusoidal 
 * pixel coordinates for unique pixel IDs and spatial matching between methods.
 * 
 * Uses: row*1000000+col for pixel_id and rounded lat/lon for tile coordinates
 */

// ============================================================================
// MODULE IMPORTS
// ============================================================================

var glacierUtils = require('users/tofunori/MOD09A1_REN_METHOD:modules/utils/glacier.js');
var originalComparison = require('users/tofunori/MOD09A1_REN_METHOD:modules/workflows/comparison.js');

// ============================================================================
// WEEKLY PIXEL EXPORT FUNCTION
// ============================================================================

/**
 * Weekly test that uses the original workflow but samples pixels over 7 days
 */
function testWeeklyPixelExport(date, region) {
  date = date || '2023-08-07';
  
  print('🔧 Testing weekly pixel export starting from:', date);
  
  var startDate = ee.Date(date);
  var endDate = startDate.advance(7, 'day');
  var methods = {ren: true, mod10a1: true, mcd43a3: true}; // Test all three methods
  
  print('📅 Processing date range:', startDate.format('YYYY-MM-dd').getInfo(), 'to', endDate.advance(-1, 'day').format('YYYY-MM-dd').getInfo());
  
  try {
    // Use the original comparison workflow to get processed results
    var results = originalComparison.runModularComparison(
      startDate, endDate, methods, 
      glacierUtils.initializeGlacierData().outlines, 
      region || glacierUtils.initializeGlacierData().geometry
    );
    
    print('✅ Got results from original workflow for weekly period');
    
    var allSamples = ee.FeatureCollection([]);
    
    // Process MOD09GA (Ren method)
    if (results.ren && results.ren.size().gt(0)) {
      print('📊 Processing MOD09GA pixels for week...');
      
      // Process each image in the collection
      var renSamples = results.ren.map(function(renImage) {
        renImage = ee.Image(renImage);
        
        // Use direct pixel coordinates from MODIS sinusoidal projection (simpler approach)
        var projection = renImage.select('broadband_albedo_ren_masked').projection();
        
        // Generate direct pixel coordinates in MODIS sinusoidal space
        var coords = ee.Image.pixelCoordinates(projection);
        var pixelRow = coords.select('y').int().rename('pixel_row');
        var pixelCol = coords.select('x').int().rename('pixel_col');
        
        // Create simple coordinate-based pixel ID
        var pixelId = pixelRow.multiply(1000000).add(pixelCol).double().rename('pixel_id');
        
        // Create simple tile coordinates (rounded lat/lon for spatial matching)
        var lonRounded = ee.Image.pixelLonLat().select('longitude').multiply(100).round().int().rename('tile_h');
        var latRounded = ee.Image.pixelLonLat().select('latitude').multiply(100).round().int().rename('tile_v');
        
        var imageWithCoords = renImage.addBands([lonRounded, latRounded, pixelRow, pixelCol, pixelId]);
        
        return imageWithCoords.select(['broadband_albedo_ren_masked', 'tile_h', 'tile_v', 'pixel_row', 'pixel_col', 'pixel_id']).sample({
          region: region || glacierUtils.initializeGlacierData().geometry,
          scale: 500,
          geometries: true
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
      print('✅ MOD09GA weekly pixels processed');
    }
    
    // Process MOD10A1
    if (results.mod10a1 && results.mod10a1.size().gt(0)) {
      print('📊 Processing MOD10A1 pixels for week...');
      
      // Process each image in the collection
      var mod10Samples = results.mod10a1.map(function(mod10Image) {
        mod10Image = ee.Image(mod10Image);
        
        // Use direct pixel coordinates from MODIS sinusoidal projection
        var projection = mod10Image.select('broadband_albedo_mod10a1').projection();
        
        // Generate direct pixel coordinates in MODIS sinusoidal space
        var coords = ee.Image.pixelCoordinates(projection);
        var pixelRow = coords.select('y').int().rename('pixel_row');
        var pixelCol = coords.select('x').int().rename('pixel_col');
        
        // Create simple coordinate-based pixel ID
        var pixelId = pixelRow.multiply(1000000).add(pixelCol).double().rename('pixel_id');
        
        // Create simple tile coordinates (rounded lat/lon for spatial matching)
        var lonRounded = ee.Image.pixelLonLat().select('longitude').multiply(100).round().int().rename('tile_h');
        var latRounded = ee.Image.pixelLonLat().select('latitude').multiply(100).round().int().rename('tile_v');
        
        var imageWithCoords = mod10Image.addBands([lonRounded, latRounded, pixelRow, pixelCol, pixelId]);
        
        return imageWithCoords.select(['broadband_albedo_mod10a1', 'tile_h', 'tile_v', 'pixel_row', 'pixel_col', 'pixel_id']).sample({
          region: region || glacierUtils.initializeGlacierData().geometry,
          scale: 500,
          geometries: true
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
      print('✅ MOD10A1 weekly pixels processed');
    }
    
    // Process MCD43A3
    if (results.mcd43a3 && results.mcd43a3.size().gt(0)) {
      print('📊 Processing MCD43A3 pixels for week...');
      
      // Process each image in the collection
      var mcd43Samples = results.mcd43a3.map(function(mcd43Image) {
        mcd43Image = ee.Image(mcd43Image);
        
        // Use direct pixel coordinates from MODIS sinusoidal projection
        var projection = mcd43Image.select('broadband_albedo_mcd43a3').projection();
        
        // Generate direct pixel coordinates in MODIS sinusoidal space
        var coords = ee.Image.pixelCoordinates(projection);
        var pixelRow = coords.select('y').int().rename('pixel_row');
        var pixelCol = coords.select('x').int().rename('pixel_col');
        
        // Create simple coordinate-based pixel ID
        var pixelId = pixelRow.multiply(1000000).add(pixelCol).double().rename('pixel_id');
        
        // Create simple tile coordinates (rounded lat/lon for spatial matching)
        var lonRounded = ee.Image.pixelLonLat().select('longitude').multiply(100).round().int().rename('tile_h');
        var latRounded = ee.Image.pixelLonLat().select('latitude').multiply(100).round().int().rename('tile_v');
        
        var imageWithCoords = mcd43Image.addBands([lonRounded, latRounded, pixelRow, pixelCol, pixelId]);
        
        return imageWithCoords.select(['broadband_albedo_mcd43a3', 'tile_h', 'tile_v', 'pixel_row', 'pixel_col', 'pixel_id']).sample({
          region: region || glacierUtils.initializeGlacierData().geometry,
          scale: 500,
          geometries: true
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
      print('✅ MCD43A3 weekly pixels processed');
    }
    
    // Export all methods combined
    var endDateStr = endDate.advance(-1, 'day').format('YYYY-MM-dd').getInfo();
    Export.table.toDrive({
      collection: allSamples,
      description: 'WEEKLY_pixels_three_methods_' + date.replace(/-/g, '') + '_to_' + endDateStr.replace(/-/g, ''),
      folder: 'pixel_test_weekly',
      fileFormat: 'CSV'
    });
    
    print('🎉 WEEKLY PIXELS export for three methods initiated');
    print('📁 Check Tasks tab for: WEEKLY_pixels_three_methods_' + date.replace(/-/g, '') + '_to_' + endDateStr.replace(/-/g, ''));
    print('⚠️  This is a weekly dataset - will be significantly larger and may take longer to process');
    
    // Print sample counts
    allSamples.size().evaluate(function(count) {
      print('📊 Total pixels sampled from all methods over the week:', count);
    });
    
  } catch (error) {
    print('❌ Error in weekly pixel test:', error);
  }
}

// ============================================================================
// AUTO-RUN
// ============================================================================

print('🔧 Weekly Pixel Analysis Test Loaded');
print('🎯 Auto-running weekly test...');

// Initialize glacier data
var glacierData = glacierUtils.initializeGlacierData();
testWeeklyPixelExport('2023-08-07', glacierData.geometry);