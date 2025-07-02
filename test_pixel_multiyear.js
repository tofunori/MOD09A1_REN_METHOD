/**
 * Multi-Year Pixel Analysis Test - Full Melt Season 2017-2024
 * 
 * This script extends the proven test_pixel_simple.js logic to process
 * the complete 2017-2024 melt season (June 1 to September 30) for all
 * three albedo methods without modifying the existing codebase.
 * 
 * Uses identical: Terra/Aqua handling, pixel coordinate system, and sampling logic
 * from the single-day test to ensure consistency and reliability.
 * 
 * Processing: ~8 years × ~120 days per melt season = ~960 processing days
 * Output: ONE BIG CSV file with all data from all years and methods
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
 * Process all melt season data in one go
 */
function processAllMeltSeasonData(region) {
  print('🔧 Processing ALL melt season data for 2017-2024');
  
  // Create date range for entire melt season period
  var startDate = ee.Date.fromYMD(CONFIG.START_YEAR, CONFIG.MELT_SEASON_START_MONTH, 1);
  var endDate = ee.Date.fromYMD(CONFIG.END_YEAR, CONFIG.MELT_SEASON_END_MONTH, 30);
  
  print('📅 Date range:', startDate.format('YYYY-MM-dd').getInfo(), 'to', endDate.format('YYYY-MM-dd').getInfo());
  
  var methods = {ren: true, mod10a1: true, mcd43a3: true}; // All three methods
  
  try {
    // Use the EXACT same logic as test_pixel_simple.js but for full date range
    var results = originalComparison.runModularComparison(
      startDate, endDate, methods, 
      glacierUtils.initializeGlacierData().outlines, 
      region || glacierUtils.initializeGlacierData().geometry
    );
    
    print('✅ Got results from original workflow for full period');
    
    var allSamples = ee.FeatureCollection([]);
    
    // Apply melt season filter to all collections
    var meltSeasonFilter = ee.Filter.calendarRange(CONFIG.MELT_SEASON_START_MONTH, CONFIG.MELT_SEASON_END_MONTH, 'month');
    
    // Process MOD09GA (Ren method) - IDENTICAL to test_pixel_simple.js but for all years
    if (results.ren && results.ren.size().gt(0)) {
      print('📊 Processing MOD09GA pixels for all years...');
      
      var renCollection = results.ren.filter(meltSeasonFilter);
      
      print('📊 MOD09GA collection size after melt season filter:', renCollection.size().getInfo());
      
      // Process each image in the collection
      var renSamples = renCollection.map(function(renImage) {
        // Use direct pixel coordinates from MODIS sinusoidal projection (same as test_pixel_simple.js)
        var projection = renImage.select('broadband_albedo_ren_masked').projection();
        
        // Generate direct pixel coordinates in MODIS sinusoidal space
        var coords = ee.Image.pixelCoordinates(projection);
        var pixelRow = coords.select('y').int().rename('pixel_row');
        var pixelCol = coords.select('x').int().rename('pixel_col');
        
        // Create simple coordinate-based pixel ID (same formula as test_pixel_simple.js)
        var pixelId = pixelRow.multiply(1000000).add(pixelCol).double().rename('pixel_id');
        
        // Create simple tile coordinates (rounded lat/lon for spatial matching)
        var lonRounded = ee.Image.pixelLonLat().select('longitude').multiply(100).round().int().rename('tile_h');
        var latRounded = ee.Image.pixelLonLat().select('latitude').multiply(100).round().int().rename('tile_v');
        
        var imageWithCoords = renImage.addBands([lonRounded, latRounded, pixelRow, pixelCol, pixelId]);
        
        var samples = imageWithCoords.select(['broadband_albedo_ren_masked', 'tile_h', 'tile_v', 'pixel_row', 'pixel_col', 'pixel_id']).sample({
          region: region || glacierUtils.initializeGlacierData().geometry,
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
        
        return samples;
      }).flatten();
      
      allSamples = allSamples.merge(renSamples);
      print('✅ MOD09GA pixels processed for all years');
    }
    
    // Process MOD10A1 - IDENTICAL to test_pixel_simple.js but for all years
    if (results.mod10a1 && results.mod10a1.size().gt(0)) {
      print('📊 Processing MOD10A1 pixels for all years...');
      
      var mod10Collection = results.mod10a1.filter(meltSeasonFilter);
      
      print('📊 MOD10A1 collection size after melt season filter:', mod10Collection.size().getInfo());
      
      // Process each image in the collection
      var mod10Samples = mod10Collection.map(function(mod10Image) {
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
        
        var samples = imageWithCoords.select(['broadband_albedo_mod10a1', 'tile_h', 'tile_v', 'pixel_row', 'pixel_col', 'pixel_id']).sample({
          region: region || glacierUtils.initializeGlacierData().geometry,
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
        
        return samples;
      }).flatten();
      
      allSamples = allSamples.merge(mod10Samples);
      print('✅ MOD10A1 pixels processed for all years');
    }
    
    // Process MCD43A3 - IDENTICAL to test_pixel_simple.js but for all years
    if (results.mcd43a3 && results.mcd43a3.size().gt(0)) {
      print('📊 Processing MCD43A3 pixels for all years...');
      
      var mcd43Collection = results.mcd43a3.filter(meltSeasonFilter);
      
      print('📊 MCD43A3 collection size after melt season filter:', mcd43Collection.size().getInfo());
      
      // Process each image in the collection
      var mcd43Samples = mcd43Collection.map(function(mcd43Image) {
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
        
        var samples = imageWithCoords.select(['broadband_albedo_mcd43a3', 'tile_h', 'tile_v', 'pixel_row', 'pixel_col', 'pixel_id']).sample({
          region: region || glacierUtils.initializeGlacierData().geometry,
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
        
        return samples;
      }).flatten();
      
      allSamples = allSamples.merge(mcd43Samples);
      print('✅ MCD43A3 pixels processed for all years');
    }
    
    // Export ONE BIG CSV with all data
    Export.table.toDrive({
      collection: allSamples,
      description: 'ALL_pixels_three_methods_2017_2024_melt_season',
      folder: CONFIG.EXPORT_FOLDER,
      fileFormat: 'CSV',
      selectors: ['albedo_value', 'broadband_albedo_ren_masked', 'date', 'latitude', 'longitude', 'method', 'pixel_col', 'pixel_id', 'pixel_row', 'tile_h', 'tile_v', '.geo']
    });
    
    print('🎉 BIG CSV EXPORT INITIATED');
    print('📁 Check Tasks tab for: ALL_pixels_three_methods_2017_2024_melt_season');
    print('⚠️  This will be a VERY LARGE file - monitor Google Drive space');
    
    // Print sample counts
    allSamples.size().evaluate(function(count) {
      print('📊 Total pixels sampled from all methods and years:', count);
    });
    
    return true;
    
  } catch (error) {
    print('❌ Error processing all data:', error);
    return false;
  }
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
    print('✅ Check results before running full multi-year export');
    
  } catch (error) {
    print('❌ Error in test:', error);
  }
}

// ============================================================================
// AUTO-RUN WHEN SCRIPT IS EXECUTED
// ============================================================================

print('🚀 Starting Multi-Year Pixel Export for 2017-2024 Melt Season');
print('📅 Processing ALL data into ONE BIG CSV file');
print('🔧 Using identical logic to test_pixel_simple.js');
print('');
print('📊 Expected output: ONE MASSIVE CSV file with all pixels from all years and methods');
print('⚠️  The export will be VERY LARGE - ensure sufficient Google Drive space');
print('📁 Files will be saved to folder: ' + CONFIG.EXPORT_FOLDER);
print('📄 Big CSV name: ALL_pixels_three_methods_2017_2024_melt_season.csv');
print('');

// AUTO-RUN the full multi-year export
runMultiYearPixelExport();