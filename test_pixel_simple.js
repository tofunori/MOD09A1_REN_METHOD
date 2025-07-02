/**
 * Simple Pixel Analysis Test - Debugging Version
 * 
 * This simplified version focuses on getting basic pixel export working
 * by using the exact same approach as the original regional analysis
 * but with sample() instead of reduceRegion()
 */

// ============================================================================
// MODULE IMPORTS
// ============================================================================

var glacierUtils = require('users/tofunori/MOD09A1_REN_METHOD:modules/utils/glacier.js');
var originalComparison = require('users/tofunori/MOD09A1_REN_METHOD:modules/workflows/comparison.js');

// ============================================================================
// SIMPLE PIXEL EXPORT FUNCTION
// ============================================================================

/**
 * Simple test that uses the original workflow but samples pixels instead of regional stats
 */
function testSimplePixelExport(date, region) {
  date = date || '2023-08-07';
  
  print('🔧 Testing simple pixel export for:', date);
  
  var startDate = ee.Date(date);
  var endDate = startDate.advance(1, 'day');
  var methods = {ren: true, mod10a1: true, mcd43a3: true}; // Test all three methods
  
  try {
    // Use the original comparison workflow to get processed results
    var results = originalComparison.runModularComparison(
      startDate, endDate, methods, 
      glacierUtils.initializeGlacierData().outlines, 
      region || glacierUtils.initializeGlacierData().geometry
    );
    
    print('✅ Got results from original workflow');
    
    var allSamples = ee.FeatureCollection([]);
    
    // Process MOD09GA (Ren method)
    if (results.ren && results.ren.size().gt(0)) {
      print('📊 Processing MOD09GA pixels...');
      var renImage = ee.Image(results.ren.first());
      
      // Add MODIS pixel coordinates using proper tile-based system (like MODIS_Albedo project)
      var projection = renImage.select('broadband_albedo_ren_masked').projection();
      var nominalScale = projection.nominalScale();
      
      // Generate pixel coordinates in MODIS sinusoidal space
      var coords = ee.Image.pixelCoordinates(projection);
      var x = coords.select('x');
      var y = coords.select('y');
      
      // MODIS grid constants (from MODIS_Albedo project)
      var TILE_SIZE_METERS = 1111950.51966;
      var X_OFFSET = 20015109.354;
      var Y_OFFSET = 10007554.677;
      
      // Handle negative coordinates by applying offsets
      var xShifted = x.add(X_OFFSET);
      var yShifted = y.add(Y_OFFSET);
      
      // Calculate MODIS tile indices (h = horizontal, v = vertical)
      var h = xShifted.divide(TILE_SIZE_METERS).floor().int().rename('tile_h');
      var v = yShifted.divide(TILE_SIZE_METERS).floor().int().rename('tile_v');
      
      // Calculate within-tile pixel coordinates
      var xInTile = xShifted.mod(TILE_SIZE_METERS);
      var yInTile = yShifted.mod(TILE_SIZE_METERS);
      
      var pixelRow = yInTile.divide(nominalScale).floor().int().rename('pixel_row');
      var pixelCol = xInTile.divide(nominalScale).floor().int().rename('pixel_col');
      
      // Create proper pixel ID using tile-based system (no overflow)
      // Format: h*1e9 + v*1e8 + row*1e4 + col
      var pixelId = h.multiply(1e9)
        .add(v.multiply(1e8))
        .add(pixelRow.multiply(1e4))
        .add(pixelCol)
        .double()  // Use double precision to prevent overflow
        .rename('pixel_id');
      
      var imageWithCoords = renImage.addBands([h, v, pixelRow, pixelCol, pixelId]);
      
      var renSamples = imageWithCoords.select(['broadband_albedo_ren_masked', 'tile_h', 'tile_v', 'pixel_row', 'pixel_col', 'pixel_id']).sample({
        region: region || glacierUtils.initializeGlacierData().geometry,
        scale: 500,
        geometries: true  // Remove numPixels to get ALL available pixels
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
      
      allSamples = allSamples.merge(renSamples);
      print('✅ MOD09GA pixels processed');
    }
    
    // Process MOD10A1
    if (results.mod10a1 && results.mod10a1.size().gt(0)) {
      print('📊 Processing MOD10A1 pixels...');
      var mod10Image = ee.Image(results.mod10a1.first());
      
      // Add MODIS pixel coordinates using proper tile-based system
      var projection = mod10Image.select('broadband_albedo_mod10a1').projection();
      var nominalScale = projection.nominalScale();
      
      // Generate pixel coordinates in MODIS sinusoidal space
      var coords = ee.Image.pixelCoordinates(projection);
      var x = coords.select('x');
      var y = coords.select('y');
      
      // MODIS grid constants
      var TILE_SIZE_METERS = 1111950.51966;
      var X_OFFSET = 20015109.354;
      var Y_OFFSET = 10007554.677;
      
      // Handle negative coordinates by applying offsets
      var xShifted = x.add(X_OFFSET);
      var yShifted = y.add(Y_OFFSET);
      
      // Calculate MODIS tile indices
      var h = xShifted.divide(TILE_SIZE_METERS).floor().int().rename('tile_h');
      var v = yShifted.divide(TILE_SIZE_METERS).floor().int().rename('tile_v');
      
      // Calculate within-tile pixel coordinates
      var xInTile = xShifted.mod(TILE_SIZE_METERS);
      var yInTile = yShifted.mod(TILE_SIZE_METERS);
      
      var pixelRow = yInTile.divide(nominalScale).floor().int().rename('pixel_row');
      var pixelCol = xInTile.divide(nominalScale).floor().int().rename('pixel_col');
      
      // Create proper pixel ID (no overflow)
      var pixelId = h.multiply(1e9)
        .add(v.multiply(1e8))
        .add(pixelRow.multiply(1e4))
        .add(pixelCol)
        .double()
        .rename('pixel_id');
      
      var imageWithCoords = mod10Image.addBands([h, v, pixelRow, pixelCol, pixelId]);
      
      var mod10Samples = imageWithCoords.select(['broadband_albedo_mod10a1', 'tile_h', 'tile_v', 'pixel_row', 'pixel_col', 'pixel_id']).sample({
        region: region || glacierUtils.initializeGlacierData().geometry,
        scale: 500,
        geometries: true  // Remove numPixels to get ALL available pixels
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
      
      allSamples = allSamples.merge(mod10Samples);
      print('✅ MOD10A1 pixels processed');
    }
    
    // Process MCD43A3
    if (results.mcd43a3 && results.mcd43a3.size().gt(0)) {
      print('📊 Processing MCD43A3 pixels...');
      var mcd43Image = ee.Image(results.mcd43a3.first());
      
      // Add MODIS pixel coordinates using proper tile-based system
      var projection = mcd43Image.select('broadband_albedo_mcd43a3').projection();
      var nominalScale = projection.nominalScale();
      
      // Generate pixel coordinates in MODIS sinusoidal space
      var coords = ee.Image.pixelCoordinates(projection);
      var x = coords.select('x');
      var y = coords.select('y');
      
      // MODIS grid constants
      var TILE_SIZE_METERS = 1111950.51966;
      var X_OFFSET = 20015109.354;
      var Y_OFFSET = 10007554.677;
      
      // Handle negative coordinates by applying offsets
      var xShifted = x.add(X_OFFSET);
      var yShifted = y.add(Y_OFFSET);
      
      // Calculate MODIS tile indices
      var h = xShifted.divide(TILE_SIZE_METERS).floor().int().rename('tile_h');
      var v = yShifted.divide(TILE_SIZE_METERS).floor().int().rename('tile_v');
      
      // Calculate within-tile pixel coordinates
      var xInTile = xShifted.mod(TILE_SIZE_METERS);
      var yInTile = yShifted.mod(TILE_SIZE_METERS);
      
      var pixelRow = yInTile.divide(nominalScale).floor().int().rename('pixel_row');
      var pixelCol = xInTile.divide(nominalScale).floor().int().rename('pixel_col');
      
      // Create proper pixel ID (no overflow)
      var pixelId = h.multiply(1e9)
        .add(v.multiply(1e8))
        .add(pixelRow.multiply(1e4))
        .add(pixelCol)
        .double()
        .rename('pixel_id');
      
      var imageWithCoords = mcd43Image.addBands([h, v, pixelRow, pixelCol, pixelId]);
      
      var mcd43Samples = imageWithCoords.select(['broadband_albedo_mcd43a3', 'tile_h', 'tile_v', 'pixel_row', 'pixel_col', 'pixel_id']).sample({
        region: region || glacierUtils.initializeGlacierData().geometry,
        scale: 500,
        geometries: true  // Remove numPixels to get ALL available pixels
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
      
      allSamples = allSamples.merge(mcd43Samples);
      print('✅ MCD43A3 pixels processed');
    }
    
    // Export all methods combined
    Export.table.toDrive({
      collection: allSamples,
      description: 'ALL_pixels_three_methods_' + date.replace(/-/g, ''),
      folder: 'pixel_test_complete',
      fileFormat: 'CSV'
    });
    
    print('🎉 ALL PIXELS export for three methods initiated');
    print('📁 Check Tasks tab for: ALL_pixels_three_methods_' + date.replace(/-/g, ''));
    print('⚠️  This may be a large dataset - could take time to process');
    
    // Print sample counts
    allSamples.size().evaluate(function(count) {
      print('📊 Total pixels sampled from all methods:', count);
    });
    
  } catch (error) {
    print('❌ Error in simple pixel test:', error);
  }
}

// ============================================================================
// AUTO-RUN
// ============================================================================

print('🔧 Simple Pixel Analysis Test Loaded');
print('🎯 Auto-running simple test...');

// Initialize glacier data
var glacierData = glacierUtils.initializeGlacierData();
testSimplePixelExport('2023-08-07', glacierData.geometry);