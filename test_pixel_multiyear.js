/**
 * Multi-Year Pixel Analysis Test - Representative Day 2017-2024
 * 
 * This script extends the proven test_pixel_simple.js logic to process
 * one representative day (August 7th) per year from 2017-2024 for all
 * three albedo methods without modifying the existing codebase.
 * 
 * Uses identical: Terra/Aqua handling, pixel coordinate system, and sampling logic
 * from the single-day test to ensure consistency and reliability.
 * 
 * Processing: 8 years × 1 day per year = 8 processing days
 * Output: CSV file with representative pixels from all years and methods
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
  START_YEAR: 2017,
  END_YEAR: 2024,
  MELT_SEASON_START_MONTH: 6,  // June
  MELT_SEASON_END_MONTH: 9,    // September
  EXPORT_FOLDER: 'pixel_multiyear_complete',
  SCALE: 500,                  // Same as test_pixel_simple.js
  MAX_PIXELS: 1e9,             // Memory optimization
  TILE_SCALE: 4,               // Higher tile scale for very large dataset
  BEST_EFFORT: true            // Allow Earth Engine to optimize
};

// ============================================================================
// MAIN PROCESSING FUNCTION FOR ALL DATA
// ============================================================================

/**
 * Process single representative day per year to avoid resource exhaustion
 */
function processAllMeltSeasonData(region) {
  print('🔧 Processing one day per year for 2017-2024 (single day approach)');
  
  var methods = {ren: true, mod10a1: true, mcd43a3: true};
  var allSamples = ee.FeatureCollection([]);
  
  // Process multiple candidate days per year to get the best data coverage
  for (var year = CONFIG.START_YEAR; year <= CONFIG.END_YEAR; year++) {
    print('📅 Processing year:', year);
    
    // Try multiple dates in peak melt season to find the best data availability
    var candidateDates = [
      ee.Date.fromYMD(year, 8, 7),   // Aug 7 (original)
      ee.Date.fromYMD(year, 8, 1),   // Aug 1
      ee.Date.fromYMD(year, 8, 15),  // Aug 15
      ee.Date.fromYMD(year, 7, 15),  // Jul 15
      ee.Date.fromYMD(year, 7, 1)    // Jul 1
    ];
    
    var bestSamples = ee.FeatureCollection([]);
    var maxPixels = 0;
    
    // Try each candidate date and pick the one with most pixels
    for (var d = 0; d < candidateDates.length; d++) {
      var testDate = candidateDates[d];
      var startDate = testDate;
      var endDate = testDate.advance(1, 'day');
    
    try {
      var results = originalComparison.runModularComparison(
        startDate, endDate, methods, 
        glacierUtils.initializeGlacierData().outlines, 
        region || glacierUtils.initializeGlacierData().geometry
      );
      
      print('✅ Got results for year', year);
      
      // Check if we have valid results before processing
      if (results && results.ren && results.ren.size().gt(0).getInfo()) {
        // Process using single image approach like the working script
        var yearSamples = processYearData(results, year);
        allSamples = allSamples.merge(yearSamples);
        
        // Check how many pixels we got for this year
        yearSamples.size().evaluate(function(yearCount) {
          print('📊 Year', year, 'pixel count:', yearCount);
        });
        
        print('✅ Year', year, 'processed successfully');
      } else {
        print('⚠️  No data available for year', year);
      }
      
    } catch (yearError) {
      print('❌ Error processing year', year, ':', yearError);
    }
  }
  
  // Export all combined data
  Export.table.toDrive({
    collection: allSamples,
    description: 'ALL_pixels_three_methods_2017_2024_Aug7_sample',
    folder: CONFIG.EXPORT_FOLDER,
    fileFormat: 'CSV',
    selectors: ['albedo_value', 'date', 'latitude', 'longitude', 'method', 'pixel_col', 'pixel_id', 'pixel_row', 'tile_h', 'tile_v', '.geo']
  });
  
  print('🎉 Multi-year CSV export initiated (Aug 7th samples)');
  allSamples.size().evaluate(function(count) {
    print('📊 Total pixels from all years:', count);
  });
  
  return true;
}

/**
 * Process data for a single year using the working single-image approach
 */
function processYearData(results, year) {
  var yearSamples = ee.FeatureCollection([]);
    
  // Process MOD09GA (use single image approach like working script)
  if (results.ren && results.ren.size().gt(0)) {
    print('📊 Processing MOD09GA pixels for year', year);
    var renImage = ee.Image(results.ren.first());
    
    var projection = renImage.select('broadband_albedo_ren_masked').projection();
    var coords = ee.Image.pixelCoordinates(projection);
    var pixelRow = coords.select('y').int().rename('pixel_row');
    var pixelCol = coords.select('x').int().rename('pixel_col');
    var pixelId = pixelRow.multiply(1000000).add(pixelCol).double().rename('pixel_id');
    var lonRounded = ee.Image.pixelLonLat().select('longitude').multiply(100).round().int().rename('tile_h');
    var latRounded = ee.Image.pixelLonLat().select('latitude').multiply(100).round().int().rename('tile_v');
    var imageWithCoords = renImage.addBands([lonRounded, latRounded, pixelRow, pixelCol, pixelId]);
    
    var renSamples = imageWithCoords.select(['broadband_albedo_ren_masked', 'tile_h', 'tile_v', 'pixel_row', 'pixel_col', 'pixel_id']).sample({
      region: glacierUtils.initializeGlacierData().geometry,
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
    yearSamples = yearSamples.merge(renSamples);
  }
    
  // Process MOD10A1 (use single image approach like working script)
  if (results.mod10a1 && results.mod10a1.size().gt(0)) {
    print('📊 Processing MOD10A1 pixels for year', year);
    var mod10Image = ee.Image(results.mod10a1.first());
    
    var projection = mod10Image.select('broadband_albedo_mod10a1').projection();
    var coords = ee.Image.pixelCoordinates(projection);
    var pixelRow = coords.select('y').int().rename('pixel_row');
    var pixelCol = coords.select('x').int().rename('pixel_col');
    var pixelId = pixelRow.multiply(1000000).add(pixelCol).double().rename('pixel_id');
    var lonRounded = ee.Image.pixelLonLat().select('longitude').multiply(100).round().int().rename('tile_h');
    var latRounded = ee.Image.pixelLonLat().select('latitude').multiply(100).round().int().rename('tile_v');
    var imageWithCoords = mod10Image.addBands([lonRounded, latRounded, pixelRow, pixelCol, pixelId]);
    
    var mod10Samples = imageWithCoords.select(['broadband_albedo_mod10a1', 'tile_h', 'tile_v', 'pixel_row', 'pixel_col', 'pixel_id']).sample({
      region: glacierUtils.initializeGlacierData().geometry,
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
    yearSamples = yearSamples.merge(mod10Samples);
  }
    
  // Process MCD43A3 (use single image approach like working script)
  if (results.mcd43a3 && results.mcd43a3.size().gt(0)) {
    print('📊 Processing MCD43A3 pixels for year', year);
    var mcd43Image = ee.Image(results.mcd43a3.first());
    
    var projection = mcd43Image.select('broadband_albedo_mcd43a3').projection();
    var coords = ee.Image.pixelCoordinates(projection);
    var pixelRow = coords.select('y').int().rename('pixel_row');
    var pixelCol = coords.select('x').int().rename('pixel_col');
    var pixelId = pixelRow.multiply(1000000).add(pixelCol).double().rename('pixel_id');
    var lonRounded = ee.Image.pixelLonLat().select('longitude').multiply(100).round().int().rename('tile_h');
    var latRounded = ee.Image.pixelLonLat().select('latitude').multiply(100).round().int().rename('tile_v');
    var imageWithCoords = mcd43Image.addBands([lonRounded, latRounded, pixelRow, pixelCol, pixelId]);
    
    var mcd43Samples = imageWithCoords.select(['broadband_albedo_mcd43a3', 'tile_h', 'tile_v', 'pixel_row', 'pixel_col', 'pixel_id']).sample({
      region: glacierUtils.initializeGlacierData().geometry,
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
    yearSamples = yearSamples.merge(mcd43Samples);
  }
  
  // Debug: Check how many samples we have for this year
  yearSamples.size().evaluate(function(totalYearPixels) {
    print('🎯 Total pixels for year', year, ':', totalYearPixels);
  });
  
  return yearSamples;
}

// ============================================================================
// MAIN EXPORT FUNCTION
// ============================================================================

/**
 * Run the complete multi-year export as ONE BIG CSV
 */
function runMultiYearPixelExport() {
  print('🚀 Starting Multi-Year Pixel Export for 2017-2024 Melt Season');
  print('📅 Processing ALL data into ONE BIG CSV file');
  print('🔧 Using identical logic to test_pixel_simple.js');
  
  // Initialize glacier data
  var glacierData = glacierUtils.initializeGlacierData();
  
  // Process all data in one go
  var success = processAllMeltSeasonData(glacierData.geometry);
  
  if (success) {
    print('✅ Successfully initiated BIG CSV export');
  } else {
    print('❌ Failed to process all data');
  }
}

// ============================================================================
// TEST FUNCTION (Start Small)
// ============================================================================

/**
 * Test with a small date range first (single month)
 */
function testSmallDateRange() {
  print('🧪 Testing with small date range: June 2023');
  
  var testStart = ee.Date('2023-06-01');
  var testEnd = ee.Date('2023-07-01');
  var glacierData = glacierUtils.initializeGlacierData();
  
  // Use the same processing function but with limited date range
  var methods = {ren: true, mod10a1: true, mcd43a3: true};
  
  try {
    var results = originalComparison.runModularComparison(
      testStart, testEnd, methods, 
      glacierData.outlines, 
      glacierData.geometry
    );
    
    var allSamples = ee.FeatureCollection([]);
    var meltSeasonFilter = ee.Filter.calendarRange(6, 9, 'month'); // Still apply melt season filter
    
    // Process each method (same as main function but for test dates)
    if (results.ren && results.ren.size().gt(0)) {
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
    }
    
    // Add MOD10A1 and MCD43A3 processing (same pattern)
    if (results.mod10a1 && results.mod10a1.size().gt(0)) {
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
    }
    
    if (results.mcd43a3 && results.mcd43a3.size().gt(0)) {
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
    print('✅ Check results before running full multi-year export');
    
  } catch (error) {
    print('❌ Error in test:', error);
  }
}

// ============================================================================
// AUTO-RUN WHEN SCRIPT IS EXECUTED
// ============================================================================

print('🚀 Starting Multi-Year Pixel Export for 2017-2024 (Representative Days)');
print('📅 Processing August 7th from each year (single day approach)');
print('🔧 Using identical logic to test_pixel_simple.js');
print('');
print('📊 Expected output: CSV file with representative pixels from all years and methods');
print('📁 Files will be saved to folder: ' + CONFIG.EXPORT_FOLDER);
print('📄 CSV name: ALL_pixels_three_methods_2017_2024_Aug7_sample.csv');
print('');

// AUTO-RUN the full multi-year export
runMultiYearPixelExport();