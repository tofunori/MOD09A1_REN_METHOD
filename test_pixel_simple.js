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
  var methods = {ren: true, mod10a1: false, mcd43a3: false}; // Start with just MOD09GA
  
  try {
    // Use the original comparison workflow to get processed results
    var results = originalComparison.runModularComparison(
      startDate, endDate, methods, 
      glacierUtils.initializeGlacierData().outlines, 
      region || glacierUtils.initializeGlacierData().geometry
    );
    
    print('✅ Got results from original workflow');
    
    // Now try to sample pixels from the MOD09GA results
    if (results.ren && results.ren.size().gt(0)) {
      var firstImage = ee.Image(results.ren.first());
      
      print('📊 Sampling pixels from first MOD09GA image...');
      
      // Check what bands are available
      firstImage.bandNames().evaluate(function(bands) {
        print('Available bands:', bands);
        
        // Try to sample just the albedo band and basic coordinates
        var albedoBand = bands.indexOf('broadband_albedo_ren_masked') >= 0 ? 
          'broadband_albedo_ren_masked' : 'broadband_albedo_ren';
        
        print('Using albedo band:', albedoBand);
        
        // Sample pixels with minimal metadata
        var samples = firstImage.select(albedoBand).sample({
          region: region || glacierUtils.initializeGlacierData().geometry,
          scale: 500,
          maxPixels: 1000, // Start small
          geometries: true
        }).map(function(feature) {
          var coords = feature.geometry().coordinates();
          var date = ee.Date(firstImage.get('system:time_start'));
          
          return feature.set({
            'albedo_value': feature.get(albedoBand),
            'longitude': ee.List(coords).get(0),
            'latitude': ee.List(coords).get(1),
            'date': date.format('YYYY-MM-dd'),
            'method': 'MOD09GA'
          });
        });
        
        // Try to export
        Export.table.toDrive({
          collection: samples,
          description: 'simple_pixel_test_' + date.replace(/-/g, ''),
          folder: 'pixel_test_simple',
          fileFormat: 'CSV'
        });
        
        print('✅ Simple pixel export initiated');
        print('📁 Check Tasks tab and Google Drive folder "pixel_test_simple"');
        
        // Print sample count
        samples.size().evaluate(function(count) {
          print('📊 Number of pixels sampled:', count);
        });
        
      });
      
    } else {
      print('❌ No MOD09GA results found for', date);
    }
    
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