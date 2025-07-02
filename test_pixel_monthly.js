/**
 * Monthly Pixel Analysis Test - Simplified Working System
 * 
 * This version uses the same pipeline as test_pixel_simple.js but processes
 * one full month (~30 days) instead of a single day. Uses simple, reliable 
 * pixel coordinates for unique pixel IDs and spatial matching between methods.
 * 
 * Uses: Earth Engine native pixel coordinates for consistent, working pixel IDs
 * Approach: Simplified system that prioritizes functionality over theoretical accuracy
 */

// ============================================================================
// MODULE IMPORTS
// ============================================================================

var glacierUtils = require('users/tofunori/MOD09A1_REN_METHOD:modules/utils/glacier.js');
var originalComparison = require('users/tofunori/MOD09A1_REN_METHOD:modules/workflows/comparison.js');
var pixelUtils = require('users/tofunori/MOD09A1_REN_METHOD:modules/utils/pixel_id.js');

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Add simple, working pixel coordinates to an image
 * Uses Earth Engine native coordinate system for reliability
 */
function addSimplePixelCoordinates(image) {
  var projection = image.projection();
  var coords = ee.Image.pixelCoordinates(projection);
  
  // Convert to integer pixel indices for consistency
  var scale = projection.nominalScale();
  var pixelRow = coords.select('y').divide(scale).floor().int().rename('pixel_row');
  var pixelCol = coords.select('x').divide(scale).floor().int().rename('pixel_col');
  
  // Create unique pixel ID: row * 1000000 + col
  var pixelId = pixelRow.multiply(1000000).add(pixelCol).int().rename('pixel_id');
  
  return image.addBands([pixelRow, pixelCol, pixelId]);
}

// ============================================================================
// MONTHLY PIXEL EXPORT FUNCTION
// ============================================================================

/**
 * Monthly test that uses the original workflow but samples pixels over 1 month
 */
function testMonthlyPixelExport(date, region) {
  date = date || '2023-08-01';
  
  print('🔧 Testing monthly pixel export starting from:', date);
  
  var startDate = ee.Date(date);
  var endDate = startDate.advance(1, 'month');
  var methods = {ren: true, mod10a1: true, mcd43a3: true}; // Test all three methods
  
  print('📅 Processing date range:', startDate.format('YYYY-MM-dd').getInfo(), 'to', endDate.advance(-1, 'day').format('YYYY-MM-dd').getInfo());
  
  try {
    // Use the original comparison workflow to get processed results
    var results = originalComparison.runModularComparison(
      startDate, endDate, methods, 
      glacierUtils.initializeGlacierData().outlines, 
      region || glacierUtils.initializeGlacierData().geometry
    );
    
    print('✅ Got results from original workflow for monthly period');
    
    var allSamples = ee.FeatureCollection([]);
    
    // Process MOD09GA (Ren method)
    if (results.ren) {
      print('📊 Processing MOD09GA pixels for month...');
      
      // Process each image in the collection
      var renSamples = results.ren.map(function(renImage) {
        renImage = ee.Image(renImage);
        
        // Add simple, working pixel coordinates
        var imageWithCoords = addSimplePixelCoordinates(renImage);
        
        return imageWithCoords.select(['broadband_albedo_ren_masked', 'pixel_row', 'pixel_col', 'pixel_id']).sample({
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
            'pixel_row': feature.get('pixel_row'),
            'pixel_col': feature.get('pixel_col'),
            'pixel_id': feature.get('pixel_id'),
            'date': date.format('YYYY-MM-dd'),
            'method': 'MOD09GA'
          });
        });
      }).flatten();
      
      allSamples = allSamples.merge(renSamples);
      print('✅ MOD09GA monthly pixels processed');
    }
    
    // Process MOD10A1
    if (results.mod10a1) {
      print('📊 Processing MOD10A1 pixels for month...');
      
      // Process each image in the collection
      var mod10Samples = results.mod10a1.map(function(mod10Image) {
        mod10Image = ee.Image(mod10Image);
        
        // Add simple, working pixel coordinates
        var imageWithCoords = addSimplePixelCoordinates(mod10Image);
        
        return imageWithCoords.select(['broadband_albedo_mod10a1', 'pixel_row', 'pixel_col', 'pixel_id']).sample({
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
            'pixel_row': feature.get('pixel_row'),
            'pixel_col': feature.get('pixel_col'),
            'pixel_id': feature.get('pixel_id'),
            'date': date.format('YYYY-MM-dd'),
            'method': 'MOD10A1'
          });
        });
      }).flatten();
      
      allSamples = allSamples.merge(mod10Samples);
      print('✅ MOD10A1 monthly pixels processed');
    }
    
    // Process MCD43A3
    if (results.mcd43a3) {
      print('📊 Processing MCD43A3 pixels for month...');
      
      // Process each image in the collection
      var mcd43Samples = results.mcd43a3.map(function(mcd43Image) {
        mcd43Image = ee.Image(mcd43Image);
        
        // Add simple, working pixel coordinates
        var imageWithCoords = addSimplePixelCoordinates(mcd43Image);
        
        return imageWithCoords.select(['broadband_albedo_mcd43a3', 'pixel_row', 'pixel_col', 'pixel_id']).sample({
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
            'pixel_row': feature.get('pixel_row'),
            'pixel_col': feature.get('pixel_col'),
            'pixel_id': feature.get('pixel_id'),
            'date': date.format('YYYY-MM-dd'),
            'method': 'MCD43A3'
          });
        });
      }).flatten();
      
      allSamples = allSamples.merge(mcd43Samples);
      print('✅ MCD43A3 monthly pixels processed');
    }
    
    // Export all methods combined
    var endDateStr = endDate.advance(-1, 'day').format('YYYY-MM-dd').getInfo();
    Export.table.toDrive({
      collection: allSamples,
      description: 'MONTHLY_pixels_three_methods_' + date.replace(/-/g, '') + '_to_' + endDateStr.replace(/-/g, ''),
      folder: 'pixel_test_monthly',
      fileFormat: 'CSV'
    });
    
    print('🎉 MONTHLY PIXELS export for three methods initiated');
    print('📁 Check Tasks tab for: MONTHLY_pixels_three_methods_' + date.replace(/-/g, '') + '_to_' + endDateStr.replace(/-/g, ''));
    print('⚠️  This is a MONTHLY dataset - will be very large and may take considerable time to process');
    print('💾 Expected file size could be several MB to GB depending on cloud cover and data availability');
    
    // Print sample counts
    allSamples.size().evaluate(function(count) {
      print('📊 Total pixels sampled from all methods over the month:', count);
    });
    
  } catch (error) {
    print('❌ Error in monthly pixel test:', error);
  }
}

// ============================================================================
// SIMPLE TEST FUNCTION FOR VALIDATION
// ============================================================================

/**
 * Test with a single day first to validate the approach
 */
function testSingleDayPixels(date, region) {
  date = date || '2023-08-01';
  
  print('🔧 Testing single day pixel export for:', date);
  
  var startDate = ee.Date(date);
  var endDate = startDate.advance(1, 'day');
  var methods = {ren: true, mod10a1: false, mcd43a3: false}; // Test just one method first
  
  try {
    var results = originalComparison.runModularComparison(
      startDate, endDate, methods, 
      glacierUtils.initializeGlacierData().outlines, 
      region || glacierUtils.initializeGlacierData().geometry
    );
    
    if (results.ren && results.ren.size().gt(0)) {
      print('✅ Got MOD09GA results for single day');
      
      var testImage = ee.Image(results.ren.first());
      var withCoords = addSimplePixelCoordinates(testImage);
      
      // Test with just a small sample first
      var samples = withCoords.select(['broadband_albedo_ren_masked', 'pixel_row', 'pixel_col', 'pixel_id']).sample({
        region: region || glacierUtils.initializeGlacierData().geometry,
        scale: 500,
        numPixels: 10 // Start very small
      });
      
      print('🔍 Sample pixel data:');
      samples.limit(5).evaluate(function(result) {
        print('Sample features:', result);
      });
      
      print('📊 Total sample count:');
      samples.size().evaluate(function(count) {
        print('Number of pixels sampled:', count);
      });
      
    } else {
      print('❌ No MOD09GA data available for this date');
    }
    
  } catch (error) {
    print('❌ Error in single day test:', error);
  }
}

// ============================================================================
// AUTO-RUN
// ============================================================================

print('🔧 Simplified Pixel Analysis Test Loaded');
print('🎯 Starting with single day test...');

// Initialize glacier data
var glacierData = glacierUtils.initializeGlacierData();

// Test single day first
testSingleDayPixels('2023-08-01', glacierData.geometry);

// Uncomment below to run monthly test after single day works
// testMonthlyPixelExport('2023-08-01', glacierData.geometry);