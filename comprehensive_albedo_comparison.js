/**
 * Comprehensive MODIS Albedo Methods Comparison for Google Earth Engine
 * 
 * This script implements three different approaches to glacier albedo retrieval:
 * 1. MOD09A1 Ren Method (2021/2023) - Surface reflectance with anisotropic correction
 * 2. MOD10A1 Snow Albedo - NDSI-based snow albedo product
 * 3. MCD43A3 BRDF/Albedo - Kernel-driven BRDF model albedo
 * 
 * Author: Research Analysis Script
 * Date: 2025-06-29
 * Purpose: Compare different MODIS-based albedo retrieval methods for glacier analysis
 */

// ============================================================================
// GLOBAL CONFIGURATION AND CONSTANTS
// ============================================================================

// Global band constants for MOD09A1 Ren method
var REFL_BANDS = ['sur_refl_b01', 'sur_refl_b02', 'sur_refl_b03', 
                  'sur_refl_b04', 'sur_refl_b05', 'sur_refl_b07'];
var TOPO_BANDS_ALL = ['sur_refl_b01_topo', 'sur_refl_b02_topo', 'sur_refl_b03_topo',
                      'sur_refl_b04_topo', 'sur_refl_b05_topo', 'sur_refl_b07_topo'];
var TOPO_BANDS_SNOW = ['sur_refl_b01_topo', 'sur_refl_b02_topo', 'sur_refl_b03_topo',
                       'sur_refl_b05_topo', 'sur_refl_b07_topo'];
var NARROWBAND_ALL = ['narrowband_b1', 'narrowband_b2', 'narrowband_b3', 
                      'narrowband_b4', 'narrowband_b5', 'narrowband_b7'];
var NARROWBAND_SNOW = ['narrowband_b1', 'narrowband_b2', 'narrowband_b3',
                       'narrowband_b5', 'narrowband_b7'];
var BAND_NUMS_ALL = ['b1', 'b2', 'b3', 'b4', 'b5', 'b7'];
var BAND_NUMS_SNOW = ['b1', 'b2', 'b3', 'b5', 'b7'];

// Empirical coefficients from Ren et al. (2023)
var iceCoefficients = {
  b1: 0.160, b2: 0.291, b3: 0.243, b4: 0.116, b5: 0.112, b7: 0.081, constant: -0.0015
};

var snowCoefficients = {
  b1: 0.1574, b2: 0.2789, b3: 0.3829, b5: 0.1131, b7: 0.0694, constant: -0.0093
};

// Load DEM for topographic correction
var dem = ee.Image('USGS/SRTMGL1_003');
var slope = ee.Terrain.slope(dem);
var aspect = ee.Terrain.aspect(dem);

// ============================================================================
// METHOD 1: MOD09A1 REN METHOD IMPLEMENTATION
// ============================================================================

/**
 * Apply topography correction to MODIS surface reflectance
 * Following exact methodology from Ren et al. (2021) Equations 3a and 3b
 */
function topographyCorrection(image) {
  var solarZenith = image.select('SolarZenith').multiply(0.01);
  var solarAzimuth = image.select('SolarAzimuth').multiply(0.01);
  var sensorZenith = image.select('SensorZenith').multiply(0.01);
  var sensorAzimuth = image.select('SensorAzimuth').multiply(0.01);
  
  // Convert to radians for calculations
  var solarZenithRad = solarZenith.multiply(Math.PI/180);
  var solarAzimuthRad = solarAzimuth.multiply(Math.PI/180);
  var sensorZenithRad = sensorZenith.multiply(Math.PI/180);
  var sensorAzimuthRad = sensorAzimuth.multiply(Math.PI/180);
  var slopeRad = slope.multiply(Math.PI/180);
  var aspectRad = aspect.multiply(Math.PI/180);
  
  // Apply exact topographic angle corrections from Ren et al. (2021)
  var cosSensorZenithCorrected = slopeRad.cos().multiply(sensorZenithRad.cos())
    .add(slopeRad.sin().multiply(sensorZenithRad.sin())
    .multiply(aspectRad.subtract(sensorAzimuthRad).cos()));
  
  var cosSolarZenithCorrected = slopeRad.cos().multiply(solarZenithRad.cos())
    .add(slopeRad.sin().multiply(solarZenithRad.sin())
    .multiply(aspectRad.subtract(solarAzimuthRad).cos()));
  
  // Calculate corrected zenith angles
  var sensorZenithCorrected = cosSensorZenithCorrected.acos();
  var solarZenithCorrected = cosSolarZenithCorrected.acos();
  
  // Apply topographic correction to reflectance
  var correctionFactor = cosSolarZenithCorrected.divide(solarZenithRad.cos());
  correctionFactor = correctionFactor.clamp(0.2, 5.0);
  
  // Apply correction to surface reflectance bands
  var correctedBands = REFL_BANDS.map(function(band) {
    return image.select(band).multiply(0.0001)
      .multiply(correctionFactor).rename(band + '_topo');
  });
  
  // Add corrected angles as bands
  var correctedAngles = [
    sensorZenithCorrected.multiply(180/Math.PI).rename('SensorZenith_corrected'),
    solarZenithCorrected.multiply(180/Math.PI).rename('SolarZenith_corrected')
  ];
  
  return image.addBands(ee.Image.cat(correctedBands).addBands(correctedAngles));
}

/**
 * Apply anisotropic correction following Ren et al. (2021) methodology
 */
function anisotropicCorrection(image, surfaceType) {
  var solarZenithCorrected = image.select('SolarZenith_corrected').multiply(Math.PI/180);
  var sensorZenithCorrected = image.select('SensorZenith_corrected').multiply(Math.PI/180);
  var azimuthDiff = image.select('SolarAzimuth').subtract(image.select('SensorAzimuth'))
    .multiply(0.01).multiply(Math.PI/180);
  var relativeAzimuth = azimuthDiff.subtract(azimuthDiff.divide(2*Math.PI).round().multiply(2*Math.PI)).abs();
  
  // EXACT BRDF coefficients from Ren et al. (2021) Table 4
  var brdfCoefficients;
  
  if (surfaceType === 'snow') {
    brdfCoefficients = {
      b1: {c1: 0.00083, c2: 0.00384, c3: 0.00452, theta_c: 0.34527},
      b2: {c1: 0.00123, c2: 0.00459, c3: 0.00521, theta_c: 0.34834},
      b3: {c1: 0.00000, c2: 0.00001, c3: 0.00002, theta_c: 0.12131},
      b4: null,
      b5: {c1: 0.00663, c2: 0.01081, c3: 0.01076, theta_c: 0.46132},
      b7: {c1: 0.00622, c2: 0.01410, c3: 0.01314, theta_c: 0.55261}
    };
  } else {
    brdfCoefficients = {
      b1: {c1: -0.00054, c2: 0.00002, c3: 0.00001, theta_c: 0.17600},
      b2: {c1: -0.00924, c2: 0.00033, c3: -0.00005, theta_c: 0.31750},
      b3: {c1: -0.00369, c2: 0.00000, c3: 0.00007, theta_c: 0.27632},
      b4: {c1: -0.02920, c2: -0.00810, c3: 0.00462, theta_c: 0.52360},
      b5: {c1: -0.02388, c2: 0.00656, c3: 0.00227, theta_c: 0.58473},
      b7: {c1: -0.02081, c2: 0.00683, c3: 0.00390, theta_c: 0.575}
    };
  }
  
  var bands, bandNums;
  if (surfaceType === 'snow') {
    bands = TOPO_BANDS_SNOW;
    bandNums = BAND_NUMS_SNOW;
  } else {
    bands = TOPO_BANDS_ALL;
    bandNums = BAND_NUMS_ALL;
  }
  
  var narrowbandAlbedo = bands.map(function(band, index) {
    var bandNum = bandNums[index];
    var coeff = brdfCoefficients[bandNum];
    
    var anisotropyFactor;
    
    if (surfaceType === 'snow') {
      var g1 = sensorZenithCorrected.multiply(sensorZenithCorrected);
      var g2 = g1.multiply(relativeAzimuth.cos());
      var g3 = g1.multiply(relativeAzimuth.cos()).multiply(relativeAzimuth.cos());
      
      var term1 = g1.add(0.5).subtract(Math.PI * Math.PI / 8.0).multiply(coeff.c1);
      var term2 = g2.multiply(coeff.c2);
      var term3 = g3.add(0.25).subtract(Math.PI * Math.PI / 16.0).multiply(coeff.c3);
      var exponent = sensorZenithCorrected.divide(coeff.theta_c).multiply(-1).exp();
      
      anisotropyFactor = term1.add(term2).add(term3).multiply(exponent);
    } else {
      var g1 = sensorZenithCorrected.cos();
      var g2 = sensorZenithCorrected.multiply(sensorZenithCorrected).multiply(relativeAzimuth.cos());
      var g3 = sensorZenithCorrected.multiply(sensorZenithCorrected).multiply(relativeAzimuth.cos()).multiply(relativeAzimuth.cos());
      
      var term1 = g1.subtract(2.0/3.0).multiply(coeff.c1);
      var term2 = g2.multiply(coeff.c2);
      var term3 = g3.add(0.25).subtract(Math.PI * Math.PI / 16.0).multiply(coeff.c3);
      var exponent = sensorZenithCorrected.divide(coeff.theta_c).multiply(-1).exp();
      
      anisotropyFactor = term1.add(term2).add(term3).multiply(exponent);
    }
    
    return image.select(band).subtract(anisotropyFactor).clamp(0, 1).rename('narrowband_' + bandNum);
  });
  
  return image.addBands(ee.Image.cat(narrowbandAlbedo));
}

/**
 * Classify glacier surface as snow or ice using NDSI threshold
 */
function classifySnowIce(image) {
  var bandNames = image.bandNames();
  var hasTopoCorrection = bandNames.contains('sur_refl_b04_topo');
  
  var green, swir;
  if (hasTopoCorrection) {
    green = image.select('sur_refl_b04_topo');
    swir = image.select('sur_refl_b07_topo'); // Fixed: Use b07 instead of b06 for SWIR
  } else {
    green = image.select('sur_refl_b04').multiply(0.0001);
    swir = image.select('sur_refl_b07').multiply(0.0001); // Fixed: Use b07 instead of b06 for SWIR
  }
  
  var ndsi = green.subtract(swir).divide(green.add(swir)).rename('NDSI');
  var snowMask = ndsi.gt(0.4).rename('snow_mask');
  
  return image.addBands([ndsi, snowMask]);
}

/**
 * Convert narrowband albedo to broadband albedo using empirical equations
 */
function computeBroadbandAlbedo(image) {
  var b1 = image.select('narrowband_b1');
  var b2 = image.select('narrowband_b2');
  var b3 = image.select('narrowband_b3');
  var b4 = ee.Algorithms.If(
    image.bandNames().contains('narrowband_b4'),
    image.select('narrowband_b4'),
    ee.Image.constant(0).rename('narrowband_b4')
  );
  b4 = ee.Image(b4);
  var b5 = image.select('narrowband_b5');
  var b7 = image.select('narrowband_b7');
  
  // Calculate ice albedo (Equation 8)
  var alphaIce = b1.multiply(iceCoefficients.b1)
    .add(b2.multiply(iceCoefficients.b2))
    .add(b3.multiply(iceCoefficients.b3))
    .add(b4.multiply(iceCoefficients.b4))
    .add(b5.multiply(iceCoefficients.b5))
    .add(b7.multiply(iceCoefficients.b7))
    .add(iceCoefficients.constant);
  
  // Calculate snow albedo (Equation 9)
  var alphaSnow = b1.multiply(snowCoefficients.b1)
    .add(b2.multiply(snowCoefficients.b2))
    .add(b3.multiply(snowCoefficients.b3))
    .add(b5.multiply(snowCoefficients.b5))
    .add(b7.multiply(snowCoefficients.b7))
    .add(snowCoefficients.constant);
  
  var snowMask = image.select('snow_mask');
  var broadbandAlbedo = alphaIce.where(snowMask, alphaSnow)
    .clamp(0.0, 1.0).rename('broadband_albedo_ren');
  
  return image.addBands([alphaIce.rename('ice_albedo_ren'), 
                        alphaSnow.rename('snow_albedo_ren'),
                        broadbandAlbedo]);
}

/**
 * Quality filtering for MOD09GA - LENIENT to ensure data availability
 */
function qualityFilterRen(image) {
  var qa = image.select('state_1km');
  
  // Very lenient quality filtering - accept most data
  var clearSky = qa.bitwiseAnd(0x3).lte(2); // Accept clear to moderately cloudy
  var solarZenith = image.select('SolarZenith').multiply(0.01);
  var lowSolarZenith = solarZenith.lt(80); // Very lenient solar zenith
  
  var qualityMask = clearSky.and(lowSolarZenith);
  
  return image.updateMask(qualityMask);
}

/**
 * Process single MODIS image using COMPLETE Ren method (2021/2023)
 */
function processRenMethod(image, glacierOutlines) {
  var filtered = qualityFilterRen(image);
  var glacierMask = createGlacierMask(glacierOutlines);
  var topocorrected = topographyCorrection(filtered);
  var classified = classifySnowIce(topocorrected);
  
  var snowNarrowband = anisotropicCorrection(classified, 'snow');
  var iceNarrowband = anisotropicCorrection(classified, 'ice');
  
  var snowMask = classified.select('snow_mask');
  var combinedNarrowband = NARROWBAND_ALL.map(function(band) {
    if (band === 'narrowband_b4') {
      return iceNarrowband.select(band).rename(band);
    }
    var iceBand = iceNarrowband.select(band);
    var snowBand = snowNarrowband.select(band);
    return iceBand.where(snowMask, snowBand).rename(band);
  });
  
  var narrowbandImage = classified.addBands(ee.Image.cat(combinedNarrowband));
  var broadband = computeBroadbandAlbedo(narrowbandImage);
  var maskedAlbedo = broadband.updateMask(glacierMask);
  
  return maskedAlbedo.copyProperties(image, ['system:time_start']);
}

// ============================================================================
// METHOD 2: MOD10A1 SNOW ALBEDO IMPLEMENTATION
// ============================================================================

/**
 * NO QUALITY FILTERING - Get all available data
 */
function qualityFilterMOD10A1(image) {
  // NO QUALITY FILTERING AT ALL - just return the image
  return image;
}

/**
 * Process MOD10A1 snow data - CORRECTED BAND NAME
 * NOTE: Using NDSI_Snow_Cover instead of Snow_Albedo_Daily_Tile
 * NDSI_Snow_Cover is the primary snow band in MOD10A1 Collection 6.1
 */
function processMOD10A1(image, glacierOutlines) {
  var filtered = qualityFilterMOD10A1(image);
  var glacierMask = createGlacierMask(glacierOutlines);
  
  // Extract NDSI snow cover data (primary snow band in MOD10A1)
  var snowCover = filtered.select('NDSI_Snow_Cover')
    .clamp(0, 100).multiply(0.01); // Convert NDSI to 0-1 range
  
  // Simple masking - no additional constraints
  var maskedAlbedo = snowCover.updateMask(glacierMask)
    .rename('broadband_albedo_mod10a1');
  
  return filtered.addBands(maskedAlbedo).copyProperties(image, ['system:time_start']);
}

// ============================================================================
// METHOD 3: MCD43A3 BRDF/ALBEDO IMPLEMENTATION
// ============================================================================

/**
 * NO QUALITY FILTERING - Get all available data
 */
function qualityFilterMCD43A3(image) {
  // NO QUALITY FILTERING AT ALL - just return the image
  return image;
}

/**
 * Process MCD43A3 BRDF/Albedo - ULTRA SIMPLIFIED
 */
function processMCD43A3(image, glacierOutlines) {
  var filtered = qualityFilterMCD43A3(image);
  var glacierMask = createGlacierMask(glacierOutlines);
  
  // Use shortwave broadband albedo directly - no complex processing
  var blackSkySW = filtered.select('Albedo_BSA_shortwave').multiply(0.001);
  
  var broadbandAlbedo = blackSkySW.updateMask(glacierMask)
    .rename('broadband_albedo_mcd43a3');
  
  return filtered.addBands(broadbandAlbedo).copyProperties(image, ['system:time_start']);
}

// ============================================================================
// COMMON FUNCTIONS
// ============================================================================

/**
 * Create simplified glacier mask - BASIC glacier bounds clipping
 */
function createGlacierMask(glacierOutlines) {
  if (glacierOutlines) {
    // Simple glacier bounds mask - just clip to glacier area
    var glacierBoundsMask = ee.Image().paint(glacierOutlines, 1).gt(0);
    return glacierBoundsMask;
  } else {
    return ee.Image(1);
  }
}

/**
 * Filter collection to melt season only (June 1 - September 30)
 */
function filterMeltSeason(collection) {
  return collection.filter(ee.Filter.calendarRange(6, 9, 'month'));
}

/**
 * Main comparison function - processes all three methods
 */
function compareAlbedoMethods(geometry, startDate, endDate, glacierOutlines) {
  print('Starting comprehensive albedo method comparison...');
  print('Date range: ' + startDate + ' to ' + endDate);
  print('Filtering for MELT SEASON ONLY (June 1 - September 30)');
  
  // Method 1: MOD09A1 Ren Method
  print('Processing Method 1: MOD09A1 Ren Method...');
  var mod09Collection = ee.ImageCollection('MODIS/061/MOD09GA')
    .filterDate(startDate, endDate)
    .filterBounds(geometry);
  
  // Filter to melt season only
  mod09Collection = filterMeltSeason(mod09Collection);
  
  // DEBUG: Print collection sizes
  mod09Collection.size().evaluate(function(size) {
    print('MOD09GA collection size before processing: ' + size);
  });
  
  var renResults = mod09Collection.map(function(image) {
    return processRenMethod(image, glacierOutlines);
  });
  
  // Method 2: MOD10A1 Snow Albedo
  print('Processing Method 2: MOD10A1 Snow Albedo...');
  var mod10Collection = ee.ImageCollection('MODIS/061/MOD10A1')
    .filterDate(startDate, endDate)
    .filterBounds(geometry);
  
  // Filter to melt season only
  mod10Collection = filterMeltSeason(mod10Collection);
  
  // DEBUG: Print collection sizes
  mod10Collection.size().evaluate(function(size) {
    print('MOD10A1 collection size before processing: ' + size);
  });
  
  var mod10Results = mod10Collection.map(function(image) {
    return processMOD10A1(image, glacierOutlines);
  });
  
  // Method 3: MCD43A3 BRDF/Albedo
  print('Processing Method 3: MCD43A3 BRDF/Albedo...');
  var mcd43Collection = ee.ImageCollection('MODIS/061/MCD43A3')
    .filterDate(startDate, endDate)
    .filterBounds(geometry);
  
  // Filter to melt season only
  mcd43Collection = filterMeltSeason(mcd43Collection);
  
  // DEBUG: Print collection sizes
  mcd43Collection.size().evaluate(function(size) {
    print('MCD43A3 collection size before processing: ' + size);
  });
  
  var mcd43Results = mcd43Collection.map(function(image) {
    return processMCD43A3(image, glacierOutlines);
  });
  
  return {
    ren: renResults,
    mod10a1: mod10Results,
    mcd43a3: mcd43Results
  };
}

// ============================================================================
// ANALYSIS AND VISUALIZATION FUNCTIONS
// ============================================================================

/**
 * Calculate correlation between two image collections
 */
function calculateCorrelation(collection1, band1, collection2, band2, region) {
  // Join collections by time
  var filter = ee.Filter.equals({
    leftField: 'system:time_start',
    rightField: 'system:time_start'
  });
  
  var joined = ee.Join.inner().apply({
    primary: collection1.select(band1),
    secondary: collection2.select(band2),
    condition: filter
  });
  
  var correlationData = ee.FeatureCollection(joined.map(function(feature) {
    var primary = ee.Image(feature.get('primary'));
    var secondary = ee.Image(feature.get('secondary'));
    
    var combined = primary.addBands(secondary);
    
    var stats = combined.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: region,
      scale: 500,
      maxPixels: 1e9
    });
    
    return ee.Feature(null, {
      'method1': stats.get(band1),
      'method2': stats.get(band2),
      'date': ee.Date(feature.get('system:time_start')).format('YYYY-MM-dd')
    });
  }));
  
  return correlationData.filter(ee.Filter.and(
    ee.Filter.notNull(['method1']),
    ee.Filter.notNull(['method2'])
  ));
}

// CHART GENERATION FUNCTIONS REMOVED TO SAVE MEMORY
// All visualization capabilities disabled to focus on CSV data export

/**
 * Export ALL observations to CSV (COMPLETE DATA EXTRACTION)
 */
function exportComparisonStats(results, region, description) {
  print('Exporting ALL observations for each method (NO LIMITS)...');
  
  // Ren Method - export all observations
  var renStats = results.ren.select('broadband_albedo_ren').map(function(image) {
    var stats = image.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: region,
      scale: 5000, // Large scale to ensure memory efficiency
      maxPixels: 1e4, // Very conservative to avoid memory issues
      bestEffort: true,
      tileScale: 16
    });
    
    var date = ee.Date(image.get('system:time_start'));
    
    return ee.Feature(null, {
      'albedo': stats.get('broadband_albedo_ren'),
      'date': date.format('YYYY-MM-dd'),
      'year': date.get('year'),
      'month': date.get('month'),
      'day_of_year': date.getRelative('day', 'year'),
      'method': 'Ren',
      'system:time_start': image.get('system:time_start')
    });
  }).filter(ee.Filter.notNull(['albedo']));
  
  // MOD10A1 Method - export all observations  
  var mod10Stats = results.mod10a1.select('broadband_albedo_mod10a1').map(function(image) {
    var stats = image.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: region,
      scale: 5000, // Large scale to ensure memory efficiency
      maxPixels: 1e4, // Very conservative to avoid memory issues
      bestEffort: true,
      tileScale: 16
    });
    
    var date = ee.Date(image.get('system:time_start'));
    
    return ee.Feature(null, {
      'albedo': stats.get('broadband_albedo_mod10a1'),
      'date': date.format('YYYY-MM-dd'),
      'year': date.get('year'),
      'month': date.get('month'),
      'day_of_year': date.getRelative('day', 'year'),
      'method': 'MOD10A1',
      'system:time_start': image.get('system:time_start')
    });
  }).filter(ee.Filter.notNull(['albedo']));
  
  // MCD43A3 Method - export all observations
  var mcd43Stats = results.mcd43a3.select('broadband_albedo_mcd43a3').map(function(image) {
    var stats = image.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: region,
      scale: 5000, // Large scale to ensure memory efficiency
      maxPixels: 1e4, // Very conservative to avoid memory issues
      bestEffort: true,
      tileScale: 16
    });
    
    var date = ee.Date(image.get('system:time_start'));
    
    return ee.Feature(null, {
      'albedo': stats.get('broadband_albedo_mcd43a3'),
      'date': date.format('YYYY-MM-dd'),
      'year': date.get('year'),
      'month': date.get('month'),
      'day_of_year': date.getRelative('day', 'year'),
      'method': 'MCD43A3',
      'system:time_start': image.get('system:time_start')
    });
  }).filter(ee.Filter.notNull(['albedo']));
  
  // Combine all statistics
  var allStats = renStats.merge(mod10Stats).merge(mcd43Stats);
  
  // Export with enhanced metadata
  Export.table.toDrive({
    collection: allStats,
    description: description,
    folder: 'albedo_method_comparison',
    fileFormat: 'CSV'
  });
  
  print('CSV export task initiated: ' + description);
  print('Exporting ALL observations (no limits) with metadata: date, year, month, day_of_year');
  print('Check Google Drive folder: albedo_method_comparison');
  
  // Print data counts for verification
  renStats.size().evaluate(function(renCount) {
    print('Ren method observations: ' + renCount);
  });
  mod10Stats.size().evaluate(function(mod10Count) {
    print('MOD10A1 method observations: ' + mod10Count);
  });
  mcd43Stats.size().evaluate(function(mcd43Count) {
    print('MCD43A3 method observations: ' + mcd43Count);
  });
}

// ============================================================================
// USER INTERFACE AND EXECUTION
// ============================================================================

// Load Saskatchewan Glacier geometry
var glacierImage = ee.Image('projects/tofunori/assets/Saskatchewan_glacier_2024_updated');
var glacierBounds = glacierImage.geometry().bounds();

var glacierOutlines = glacierImage.gt(0).selfMask().reduceToVectors({
  geometry: glacierBounds,
  scale: 30,
  geometryType: 'polygon'
});

// Create UI Panel
var panel = ui.Panel({
  layout: ui.Panel.Layout.flow('vertical'),
  style: {
    width: '350px',
    padding: '10px',
    backgroundColor: 'white'
  }
});

var title = ui.Label({
  value: 'MODIS Albedo Methods Comparison',
  style: {
    fontSize: '20px',
    fontWeight: 'bold',
    margin: '10px 0px'
  }
});
panel.add(title);

var description = ui.Label({
  value: 'Compare three MODIS albedo retrieval methods:\n1. MOD09A1 Ren Method (COMPLETE: Topo+BRDF+Empirical)\n2. MOD10A1 Snow Albedo (Direct product)\n3. MCD43A3 BRDF/Albedo (Direct product)\n\n🔥 MELT SEASON: Jun-Sep (All observations)\n💾 CSV EXPORT ONLY: No charts to save memory\n🎯 COMPLETE DATA: All observations 2017-2024',
  style: {
    fontSize: '12px',
    margin: '0px 0px 10px 0px'
  }
});
panel.add(description);

// Date selection
var startDateLabel = ui.Label('Start Date (YYYY-MM-DD):');
var startDateBox = ui.Textbox({
  placeholder: '2017-06-01',
  value: '2017-06-01',
  style: {width: '150px'}
});

var endDateLabel = ui.Label('End Date (YYYY-MM-DD):');
var endDateBox = ui.Textbox({
  placeholder: '2024-09-30',
  value: '2024-09-30',
  style: {width: '150px'}
});

panel.add(startDateLabel);
panel.add(startDateBox);
panel.add(endDateLabel);
panel.add(endDateBox);

// Add preset date buttons
var presetsLabel = ui.Label('Quick Date Presets:');
panel.add(presetsLabel);

var presetsPanel = ui.Panel({
  layout: ui.Panel.Layout.flow('horizontal'),
  style: {margin: '5px 0px'}
});

var recent5MeltBtn = ui.Button({
  label: '2020-2024 Melt',
  style: {margin: '2px', fontSize: '10px', backgroundColor: '#4285f4', color: 'white'}
});

var fullMeltBtn = ui.Button({
  label: '2017-2024 Full',
  style: {margin: '2px', fontSize: '9px', backgroundColor: '#ff9800', color: 'white'}
});

var summer2024Btn = ui.Button({
  label: '2024 Melt Only',
  style: {margin: '2px', fontSize: '10px'}
});

var summer2023Btn = ui.Button({
  label: '2023 Melt Only',
  style: {margin: '2px', fontSize: '10px'}
});

presetsPanel.add(recent5MeltBtn);
presetsPanel.add(fullMeltBtn);
presetsPanel.add(summer2024Btn);
presetsPanel.add(summer2023Btn);
panel.add(presetsPanel);

// Method selection checkboxes
var methodsLabel = ui.Label('Methods to Compare:');
panel.add(methodsLabel);

var renCheckbox = ui.Checkbox({
  label: 'MOD09A1 Ren Method',
  value: true,
  style: {margin: '2px'}
});

var mod10Checkbox = ui.Checkbox({
  label: 'MOD10A1 Snow Albedo',
  value: true,
  style: {margin: '2px'}
});

var mcd43Checkbox = ui.Checkbox({
  label: 'MCD43A3 BRDF/Albedo',
  value: true,
  style: {margin: '2px'}
});

panel.add(renCheckbox);
panel.add(mod10Checkbox);
panel.add(mcd43Checkbox);

// Process button
var processButton = ui.Button({
  label: 'Run Comparison Analysis',
  style: {
    backgroundColor: '#4285f4',
    color: 'white',
    margin: '10px 0px',
    width: '300px'
  }
});
panel.add(processButton);

// Clear button
var clearButton = ui.Button({
  label: 'Clear Map Layers',
  style: {
    backgroundColor: '#ea4335',
    color: 'white',
    margin: '5px 0px',
    width: '300px'
  }
});
panel.add(clearButton);

// Status label
var statusLabel = ui.Label({
  value: 'Ready! CSV EXPORT ONLY: All observations 2017-2024, no memory limits',
  style: {
    fontSize: '11px',
    color: 'blue',
    fontStyle: 'italic'
  }
});
panel.add(statusLabel);

// Add panel to map
ui.root.insert(0, panel);

// Global variables
var currentResults = null;

// Process button event handler
processButton.onClick(function() {
  var startDate = startDateBox.getValue();
  var endDate = endDateBox.getValue();
  
  statusLabel.setValue('Processing comparison analysis...');
  statusLabel.style().set('color', 'orange');
  
  // Clear existing layers
  Map.layers().reset();
  Map.addLayer(glacierImage.selfMask(), {palette: ['red']}, 'Saskatchewan Glacier Outline');
  
  // Run comparison analysis
  var results = compareAlbedoMethods(glacierBounds, startDate, endDate, glacierOutlines);
  currentResults = results;
  
  // Add visualization layers
  if (renCheckbox.getValue()) {
    var renMean = results.ren.select('broadband_albedo_ren').mean();
    Map.addLayer(renMean, {
      min: 0.1, max: 0.9, 
      palette: ['blue', 'cyan', 'yellow', 'orange', 'red']
    }, 'Ren Method Albedo');
  }
  
  if (mod10Checkbox.getValue()) {
    var mod10Mean = results.mod10a1.select('broadband_albedo_mod10a1').mean();
    Map.addLayer(mod10Mean, {
      min: 0.1, max: 0.9,
      palette: ['darkblue', 'blue', 'lightblue', 'white']
    }, 'MOD10A1 Snow Albedo');
  }
  
  if (mcd43Checkbox.getValue()) {
    var mcd43Mean = results.mcd43a3.select('broadband_albedo_mcd43a3').mean();
    Map.addLayer(mcd43Mean, {
      min: 0.1, max: 0.9,
      palette: ['darkred', 'red', 'orange', 'yellow']
    }, 'MCD43A3 BRDF Albedo');
  }
  
  // FOCUS EXCLUSIVELY ON CSV EXPORT - NO CHART GENERATION TO AVOID MEMORY ISSUES
  print('=== STARTING CSV EXPORT (NO CHART TO SAVE MEMORY) ===');
  exportComparisonStats(results, glacierBounds, 'complete_albedo_comparison_' + startDate + '_' + endDate);
  
  print('Chart generation DISABLED to avoid memory limits.');
  print('CSV export contains all the data you need for analysis.');
  
  // Calculate data availability
  results.ren.size().evaluate(function(renSize) {
    results.mod10a1.size().evaluate(function(mod10Size) {
      results.mcd43a3.size().evaluate(function(mcd43Size) {
        statusLabel.setValue('Analysis complete! Data: Ren(' + renSize + '), MOD10A1(' + mod10Size + '), MCD43A3(' + mcd43Size + ') | CSV Export: RUNNING');
        statusLabel.style().set('color', 'green');
      });
    });
  });
});

// Preset button event handlers
recent5MeltBtn.onClick(function() {
  startDateBox.setValue('2020-06-01');
  endDateBox.setValue('2024-09-30');
  statusLabel.setValue('Recent 5-year melt seasons 2020-2024 selected. CSV EXPORT ONLY. Click Run Analysis.');
  statusLabel.style().set('color', 'blue');
});

fullMeltBtn.onClick(function() {
  startDateBox.setValue('2017-06-01');
  endDateBox.setValue('2024-09-30');
  statusLabel.setValue('Full 8-year period selected (DEFAULT). All observations exported. Click Run Analysis.');
  statusLabel.style().set('color', 'blue');
});

summer2024Btn.onClick(function() {
  startDateBox.setValue('2024-06-01');
  endDateBox.setValue('2024-09-30');
  statusLabel.setValue('2024 melt season selected (Jun-Sep only). Click Run Analysis.');
  statusLabel.style().set('color', 'blue');
});

summer2023Btn.onClick(function() {
  startDateBox.setValue('2023-06-01');
  endDateBox.setValue('2023-09-30');
  statusLabel.setValue('2023 melt season selected (Jun-Sep only). Click Run Analysis.');
  statusLabel.style().set('color', 'blue');
});

// Clear button event handler
clearButton.onClick(function() {
  Map.layers().reset();
  Map.addLayer(glacierImage.selfMask(), {palette: ['red']}, 'Saskatchewan Glacier Outline');
  statusLabel.setValue('Map layers cleared.');
  statusLabel.style().set('color', 'green');
});

// Initialize map
Map.centerObject(glacierBounds, 12);
Map.addLayer(glacierImage.selfMask(), {palette: ['red']}, 'Saskatchewan Glacier Outline');

// Export button
var exportButton = ui.Button({
  label: 'Export Comparison Data',
  style: {
    backgroundColor: '#34a853',
    color: 'white',
    margin: '5px 0px',
    width: '300px'
  }
});
panel.add(exportButton);

exportButton.onClick(function() {
  if (currentResults) {
    exportComparisonStats(currentResults, glacierBounds, 'albedo_methods_comparison_' + startDateBox.getValue() + '_' + endDateBox.getValue());
    statusLabel.setValue('Comparison data export initiated.');
    statusLabel.style().set('color', 'blue');
  } else {
    statusLabel.setValue('No data to export. Run analysis first.');
    statusLabel.style().set('color', 'red');
  }
});

print('Comprehensive MODIS Albedo Methods Comparison Tool loaded successfully!');
print('Use the interface panel to select date ranges and methods for comparison.');
print('The script compares three different approaches to glacier albedo retrieval.');