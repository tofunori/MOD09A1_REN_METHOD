/**
 * Weekly Pixel Analysis Test - Corrected Stable Pixel IDs
 * 
 * This corrected version uses the enhanced pixel ID utilities for stable, unique
 * pixel identification across multiple days. Uses proper MODIS tile coordinates
 * and hierarchical pixel IDs that avoid overflow issues.
 * 
 * Key improvements:
 * - Fixed projection and scale before calculating coordinates
 * - Uses enhanced pixel ID system with proper MODIS h/v tiles
 * - Converts meters to indices for stable IDs
 * - Proper 64-bit pixel IDs: h*1e9 + v*1e8 + row*1e4 + col
 * - Distinct operation to avoid duplicates
 */

// ============================================================================
// MODULE IMPORTS
// ============================================================================

var glacierUtils = require('users/tofunori/MOD09A1_REN_METHOD:modules/utils/glacier.js');
var originalComparison = require('users/tofunori/MOD09A1_REN_METHOD:modules/workflows/comparison.js');
var pixelIdUtils = require('users/tofunori/MOD09A1_REN_METHOD:modules/utils/pixel_id.js');

// ============================================================================
// WEEKLY PIXEL EXPORT FUNCTION WITH STABLE IDs
// ============================================================================

/**
 * Corrected weekly test that uses stable pixel IDs with proper MODIS coordinates
 */
function testWeeklyPixelExportCorrected(date, region) {
  date = date || '2023-08-07';
  
  print('🔧 Testing CORRECTED weekly pixel export starting from:', date);
  
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
      print('📊 Processing MOD09GA pixels for week with stable IDs...');
      
      // Process each image in the collection
      var renSamples = results.ren.map(function(renImage) {
        renImage = ee.Image(renImage);
        
        // Use direct pixel coordinates from MODIS sinusoidal projection
        var projection = renImage.select('broadband_albedo_ren_masked').projection();
        var coords = ee.Image.pixelCoordinates(projection);
        
        // Convert meters to indices for stable IDs (divide by nominal scale)
        var pixelRow = coords.select('y').divide(projection.nominalScale()).toInt().rename('pixel_row');
        var pixelCol = coords.select('x').divide(projection.nominalScale()).toInt().rename('pixel_col');
        
        // Generate enhanced pixel coordinates with proper MODIS tiles
        var enhancedCoords = pixelIdUtils.generateEnhancedPixelCoordinates(renImage);
        
        var imageWithCoords = renImage.addBands([
          enhancedCoords.select('tile_h'),
          enhancedCoords.select('tile_v'),
          pixelRow,
          pixelCol,
          enhancedCoords.select('pixel_id_enhanced')
        ]);
        
        return imageWithCoords.select([
          'broadband_albedo_ren_masked', 
          'tile_h', 'tile_v', 'pixel_row', 'pixel_col', 'pixel_id_enhanced'
        ]).sample({
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
            'pixel_id': feature.get('pixel_id_enhanced'),
            'date': date.format('YYYY-MM-dd'),
            'method': 'MOD09GA'
          });
        });
      }).flatten();
      
      allSamples = allSamples.merge(renSamples);
      print('✅ MOD09GA weekly pixels processed with stable IDs');
    }
    
    // Process MOD10A1
    if (results.mod10a1 && results.mod10a1.size().gt(0)) {
      print('📊 Processing MOD10A1 pixels for week with stable IDs...');
      
      // Process each image in the collection
      var mod10Samples = results.mod10a1.map(function(mod10Image) {
        mod10Image = ee.Image(mod10Image);
        
        // Use direct pixel coordinates from MODIS sinusoidal projection
        var projection = mod10Image.select('broadband_albedo_mod10a1').projection();
        var coords = ee.Image.pixelCoordinates(projection);
        
        // Convert meters to indices for stable IDs (divide by nominal scale)
        var pixelRow = coords.select('y').divide(projection.nominalScale()).toInt().rename('pixel_row');
        var pixelCol = coords.select('x').divide(projection.nominalScale()).toInt().rename('pixel_col');
        
        // Generate enhanced pixel coordinates with proper MODIS tiles
        var enhancedCoords = pixelIdUtils.generateEnhancedPixelCoordinates(mod10Image);
        
        var imageWithCoords = mod10Image.addBands([
          enhancedCoords.select('tile_h'),
          enhancedCoords.select('tile_v'),
          pixelRow,
          pixelCol,
          enhancedCoords.select('pixel_id_enhanced')
        ]);
        
        return imageWithCoords.select([
          'broadband_albedo_mod10a1', 
          'tile_h', 'tile_v', 'pixel_row', 'pixel_col', 'pixel_id_enhanced'
        ]).sample({
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
            'pixel_id': feature.get('pixel_id_enhanced'),
            'date': date.format('YYYY-MM-dd'),
            'method': 'MOD10A1'
          });
        });
      }).flatten();
      
      allSamples = allSamples.merge(mod10Samples);
      print('✅ MOD10A1 weekly pixels processed with stable IDs');
    }
    
    // Process MCD43A3
    if (results.mcd43a3 && results.mcd43a3.size().gt(0)) {
      print('📊 Processing MCD43A3 pixels for week with stable IDs...');
      
      // Process each image in the collection
      var mcd43Samples = results.mcd43a3.map(function(mcd43Image) {
        mcd43Image = ee.Image(mcd43Image);
        
        // Use direct pixel coordinates from MODIS sinusoidal projection
        var projection = mcd43Image.select('broadband_albedo_mcd43a3').projection();
        var coords = ee.Image.pixelCoordinates(projection);
        
        // Convert meters to indices for stable IDs (divide by nominal scale)
        var pixelRow = coords.select('y').divide(projection.nominalScale()).toInt().rename('pixel_row');
        var pixelCol = coords.select('x').divide(projection.nominalScale()).toInt().rename('pixel_col');
        
        // Generate enhanced pixel coordinates with proper MODIS tiles
        var enhancedCoords = pixelIdUtils.generateEnhancedPixelCoordinates(mcd43Image);
        
        var imageWithCoords = mcd43Image.addBands([
          enhancedCoords.select('tile_h'),
          enhancedCoords.select('tile_v'),
          pixelRow,
          pixelCol,
          enhancedCoords.select('pixel_id_enhanced')
        ]);
        
        return imageWithCoords.select([
          'broadband_albedo_mcd43a3', 
          'tile_h', 'tile_v', 'pixel_row', 'pixel_col', 'pixel_id_enhanced'
        ]).sample({
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
            'pixel_id': feature.get('pixel_id_enhanced'),
            'date': date.format('YYYY-MM-dd'),
            'method': 'MCD43A3'
          });
        });
      }).flatten();
      
      allSamples = allSamples.merge(mcd43Samples);
      print('✅ MCD43A3 weekly pixels processed with stable IDs');
    }
    
    // Remove duplicates after combining all methods and days
    var distinctSamples = allSamples.distinct(['pixel_id', 'date', 'method']);
    
    // Export all methods combined
    var endDateStr = endDate.advance(-1, 'day').format('YYYY-MM-dd').getInfo();
    Export.table.toDrive({
      collection: distinctSamples,
      description: 'CORRECTED_WEEKLY_pixels_three_methods_' + date.replace(/-/g, '') + '_to_' + endDateStr.replace(/-/g, ''),
      folder: 'pixel_test_weekly_corrected',
      fileFormat: 'CSV'
    });
    
    print('🎉 CORRECTED WEEKLY PIXELS export for three methods initiated');
    print('📁 Check Tasks tab for: CORRECTED_WEEKLY_pixels_three_methods_' + date.replace(/-/g, '') + '_to_' + endDateStr.replace(/-/g, ''));
    print('⚠️  This is a weekly dataset with stable pixel IDs - should have consistent IDs across days');
    
    // Print sample counts
    distinctSamples.size().evaluate(function(count) {
      print('📊 Total distinct pixels sampled from all methods over the week:', count);
    });
    
    // Print original vs distinct counts for comparison
    allSamples.size().evaluate(function(originalCount) {
      print('📊 Original total samples before distinct:', originalCount);
    });
    
  } catch (error) {
    print('❌ Error in corrected weekly pixel test:', error);
  }
}

// ============================================================================
// AUTO-RUN
// ============================================================================

print('🔧 Corrected Weekly Pixel Analysis Test Loaded');
print('🎯 Auto-running corrected weekly test...');

// Initialize glacier data
var glacierData = glacierUtils.initializeGlacierData();
testWeeklyPixelExportCorrected('2023-08-07', glacierData.geometry);