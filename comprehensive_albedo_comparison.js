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
    swir = image.select('sur_refl_b06').multiply(0.0001);
  } else {
    green = image.select('sur_refl_b04').multiply(0.0001);
    swir = image.select('sur_refl_b06').multiply(0.0001);
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
 * Quality filtering for MOD09GA following Ren et al. methodology
 */
function qualityFilterRen(image) {
  var qa = image.select('state_1km');
  
  var clearSky = qa.bitwiseAnd(0x3).eq(0);
  var clearInternal = qa.bitwiseAnd(1<<10).eq(0);
  var shadowFree = qa.bitwiseAnd(1<<2).eq(0);
  var noCirrus = qa.bitwiseAnd(1<<8).eq(0);
  var snowIceConf = qa.bitwiseAnd(0x3000).rightShift(12);
  var validSnowIce = snowIceConf.eq(0).or(snowIceConf.eq(3));
  var solarZenith = image.select('SolarZenith').multiply(0.01);
  var lowSolarZenith = solarZenith.lt(70);
  
  var qualityMask = clearSky.and(clearInternal).and(shadowFree)
    .and(noCirrus).and(validSnowIce).and(lowSolarZenith);
  
  return image.updateMask(qualityMask);
}

/**
 * Process single MODIS image using Ren method
 */
function processRenMethod(image, glacierOutlines) {
  var filtered = qualityFilterRen(image);
  var glacierMask = createGlacierMask(filtered, glacierOutlines);
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
 * Quality filtering for MOD10A1 snow albedo product
 */
function qualityFilterMOD10A1(image) {
  var qa = image.select('NDSI_Snow_Cover_Basic_QA');
  
  // Best quality pixels (QA = 0)
  var bestQuality = qa.eq(0);
  
  // Good quality pixels (QA = 1)
  var goodQuality = qa.eq(1);
  
  // Accept best and good quality
  var qualityMask = bestQuality.or(goodQuality);
  
  // Additional solar zenith constraint
  var solarZenith = image.select('orbit_pnt');
  var validSolar = solarZenith.gte(0).and(solarZenith.lte(85));
  
  return image.updateMask(qualityMask.and(validSolar));
}

/**
 * Process MOD10A1 snow albedo
 */
function processMOD10A1(image, glacierOutlines) {
  var filtered = qualityFilterMOD10A1(image);
  var glacierMask = createGlacierMask(filtered, glacierOutlines);
  
  // Extract snow albedo (scale factor already applied in MOD10A1)
  var snowAlbedo = filtered.select('Snow_Albedo_Daily_Tile').multiply(0.01);
  
  // Extract NDSI and snow cover
  var ndsi = filtered.select('NDSI');
  var snowCover = filtered.select('NDSI_Snow_Cover');
  
  // Mask for valid snow pixels (snow cover > 0)
  var validSnow = snowCover.gt(0);
  
  var maskedAlbedo = snowAlbedo.updateMask(glacierMask.and(validSnow))
    .rename('broadband_albedo_mod10a1');
  
  return filtered.addBands([maskedAlbedo, ndsi.rename('NDSI_mod10a1'), 
                           snowCover.rename('snow_cover_mod10a1')])
    .copyProperties(image, ['system:time_start']);
}

// ============================================================================
// METHOD 3: MCD43A3 BRDF/ALBEDO IMPLEMENTATION
// ============================================================================

/**
 * Quality filtering for MCD43A3 BRDF/Albedo product
 */
function qualityFilterMCD43A3(image) {
  // Use the mandatory QA bands for quality assessment
  var qa = image.select('BRDF_Albedo_Band_Mandatory_Quality_Band1');
  
  // Accept good quality full inversions (QA = 0) and good quality magnitude inversions (QA = 1)
  var goodQuality = qa.lte(1);
  
  return image.updateMask(goodQuality);
}

/**
 * Process MCD43A3 BRDF/Albedo
 */
function processMCD43A3(image, glacierOutlines) {
  var filtered = qualityFilterMCD43A3(image);
  var glacierMask = createGlacierMask(filtered, glacierOutlines);
  
  // Extract black-sky albedo (directional hemispherical reflectance)
  var blackSkyVis = filtered.select('Albedo_BSA_vis').multiply(0.001);
  var blackSkyNIR = filtered.select('Albedo_BSA_nir').multiply(0.001);
  var blackSkySW = filtered.select('Albedo_BSA_shortwave').multiply(0.001);
  
  // Extract white-sky albedo (bihemispherical reflectance)
  var whiteSkyVis = filtered.select('Albedo_WSA_vis').multiply(0.001);
  var whiteSkyNIR = filtered.select('Albedo_WSA_nir').multiply(0.001);
  var whiteSkySW = filtered.select('Albedo_WSA_shortwave').multiply(0.001);
  
  // Use shortwave broadband albedo as primary comparison metric
  var broadbandAlbedo = blackSkySW.updateMask(glacierMask)
    .rename('broadband_albedo_mcd43a3');
  
  return filtered.addBands([
    broadbandAlbedo,
    blackSkyVis.rename('black_sky_vis_mcd43a3'),
    blackSkyNIR.rename('black_sky_nir_mcd43a3'),
    whiteSkyVis.rename('white_sky_vis_mcd43a3'),
    whiteSkyNIR.rename('white_sky_nir_mcd43a3'),
    whiteSkySW.rename('white_sky_sw_mcd43a3')
  ]).copyProperties(image, ['system:time_start']);
}

// ============================================================================
// COMMON FUNCTIONS
// ============================================================================

/**
 * Create glacier mask using 50% glacier abundance criterion
 */
function createGlacierMask(image, glacierOutlines) {
  if (glacierOutlines) {
    var glacierBounds = glacierOutlines.geometry().bounds();
    var glacierMap = ee.Image(0).paint(glacierOutlines, 1).unmask(0)
      .clip(glacierBounds)
      .setDefaultProjection({
        crs: 'EPSG:4326',
        scale: 30
      });
    
    var glacierFraction = glacierMap
      .reduceResolution({
        reducer: ee.Reducer.mean(),
        maxPixels: 1000
      })
      .reproject({
        crs: image.select(0).projection(),
        scale: 500
      });
    
    var mask50 = glacierFraction.gt(0.50);
    var glacierBoundsMask = ee.Image().paint(glacierOutlines, 1).gt(0);
    
    return mask50.and(glacierBoundsMask);
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

/**
 * Create monthly average chart comparing all methods
 * Shows average albedo by month (June-September) across all years
 */
function createComparisonChart(results, region) {
  print('Creating monthly comparison chart (June-September averages)...');
  
  // Process each method separately to avoid memory issues
  var renMonthlyStats = createSeasonalAverage(results.ren, 'broadband_albedo_ren', region, 'Ren Method');
  var mod10MonthlyStats = createSeasonalAverage(results.mod10a1, 'broadband_albedo_mod10a1', region, 'MOD10A1');
  var mcd43MonthlyStats = createSeasonalAverage(results.mcd43a3, 'broadband_albedo_mcd43a3', region, 'MCD43A3');
  
  print('Monthly statistics calculated for all methods');
  
  // Combine all monthly statistics
  var combinedMonthlyStats = renMonthlyStats.merge(mod10MonthlyStats).merge(mcd43MonthlyStats);
  
  var chart = ui.Chart.feature.groups({
    features: combinedMonthlyStats,
    xProperty: 'month',
    yProperty: 'albedo_mean',
    seriesProperty: 'method'
  })
  .setChartType('LineChart')
  .setOptions({
    title: 'Tendance Mensuelle de l\'Albédo (Moyennes Multi-Annuelles): Trois Méthodes MODIS',
    titleTextStyle: {fontSize: 16, bold: true},
    hAxis: {
      title: 'Mois de la Saison de Fonte',
      titleTextStyle: {fontSize: 14},
      format: '#',
      ticks: [6, 7, 8, 9],
      ticksFormat: ['Juin', 'Juillet', 'Août', 'Septembre'],
      gridlines: {count: 4}
    },
    vAxis: {
      title: 'Albédo Large Bande Moyen',
      titleTextStyle: {fontSize: 14},
      format: '0.00'
    },
    series: {
      0: {color: '#2E7D32', pointSize: 8, lineWidth: 4}, // Ren Method - Green
      1: {color: '#1976D2', pointSize: 8, lineWidth: 4}, // MOD10A1 - Blue  
      2: {color: '#D32F2F', pointSize: 8, lineWidth: 4}  // MCD43A3 - Red
    },
    legend: {
      position: 'bottom',
      textStyle: {fontSize: 12}
    },
    backgroundColor: '#f8f9fa',
    chartArea: {
      backgroundColor: 'white',
      left: 80,
      top: 60,
      width: '75%',
      height: '70%'
    },
    pointShape: 'circle',
    curveType: 'function'
  });
  
  return chart;
}

/**
 * Create monthly average statistics for each method (ULTRA MEMORY OPTIMIZED)
 * Groups by month across all years to show seasonal trends
 */
function createSeasonalAverage(collection, bandName, region, methodName) {
  // Ultra-aggressive memory optimization
  var monthlyStats = collection.select(bandName).limit(50).map(function(image) {
    var stats = image.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: region,
      scale: 2000, // Increased scale significantly to reduce memory
      maxPixels: 1e5, // Very reduced maxPixels
      bestEffort: true,
      tileScale: 16 // Add tile scale for memory optimization
    });
    
    var date = ee.Date(image.get('system:time_start'));
    var month = date.get('month');
    
    return ee.Feature(null, {
      'albedo': stats.get(bandName),
      'month': month,
      'year': date.get('year'),
      'date': date.format('YYYY-MM-dd')
    });
  }).filter(ee.Filter.notNull(['albedo']));
  
  // Group by month (6=June, 7=July, 8=August, 9=September)
  var meltSeasonMonths = ee.List([6, 7, 8, 9]);
  
  var monthlyAverages = meltSeasonMonths.map(function(monthNum) {
    var monthData = monthlyStats.filter(ee.Filter.eq('month', monthNum));
    
    var meanAlbedo = monthData.aggregate_mean('albedo');
    var stdAlbedo = monthData.aggregate_total_sd('albedo');
    var count = monthData.size();
    
    // Create month names for display
    var monthNames = ee.Dictionary({
      6: 'Juin',
      7: 'Juillet', 
      8: 'Août',
      9: 'Septembre'
    });
    
    var monthName = monthNames.get(monthNum);
    
    return ee.Feature(null, {
      'month': monthNum,
      'month_name': monthName,
      'albedo_mean': meanAlbedo,
      'albedo_std': stdAlbedo,
      'count': count,
      'method': methodName
    });
  });
  
  return ee.FeatureCollection(monthlyAverages).filter(ee.Filter.notNull(['albedo_mean']));
}

/**
 * Export comparison statistics to CSV (ULTRA MEMORY OPTIMIZED)
 */
function exportComparisonStats(results, region, description) {
  // Calculate daily statistics for each method with aggressive memory optimization
  var renStats = results.ren.select('broadband_albedo_ren').limit(100).map(function(image) {
    var stats = image.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: region,
      scale: 2000, // Increased scale to reduce memory
      maxPixels: 1e5, // Drastically reduced maxPixels
      bestEffort: true,
      tileScale: 16
    });
    
    return ee.Feature(null, stats.set('date', ee.Date(image.get('system:time_start')).format('YYYY-MM-dd'))
      .set('method', 'Ren')
      .set('system:time_start', image.get('system:time_start')));
  });
  
  var mod10Stats = results.mod10a1.select('broadband_albedo_mod10a1').limit(100).map(function(image) {
    var stats = image.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: region,
      scale: 2000, // Increased scale to reduce memory
      maxPixels: 1e5, // Drastically reduced maxPixels
      bestEffort: true,
      tileScale: 16
    });
    
    return ee.Feature(null, stats.set('date', ee.Date(image.get('system:time_start')).format('YYYY-MM-dd'))
      .set('method', 'MOD10A1')
      .set('system:time_start', image.get('system:time_start')));
  });
  
  var mcd43Stats = results.mcd43a3.select('broadband_albedo_mcd43a3').limit(100).map(function(image) {
    var stats = image.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: region,
      scale: 2000, // Increased scale to reduce memory
      maxPixels: 1e5, // Drastically reduced maxPixels
      bestEffort: true,
      tileScale: 16
    });
    
    return ee.Feature(null, stats.set('date', ee.Date(image.get('system:time_start')).format('YYYY-MM-dd'))
      .set('method', 'MCD43A3')
      .set('system:time_start', image.get('system:time_start')));
  });
  
  // Combine all statistics using ee.FeatureCollection.merge
  var allStats = renStats.merge(mod10Stats).merge(mcd43Stats);
  
  // Filter for valid data - check for any non-null albedo values
  allStats = allStats.filter(ee.Filter.or(
    ee.Filter.notNull(['broadband_albedo_ren']),
    ee.Filter.notNull(['broadband_albedo_mod10a1']),
    ee.Filter.notNull(['broadband_albedo_mcd43a3'])
  ));
  
  Export.table.toDrive({
    collection: allStats,
    description: description,
    folder: 'albedo_method_comparison',
    fileFormat: 'CSV'
  });
  
  print('CSV export task initiated: ' + description);
  print('Check Google Drive folder: albedo_method_comparison');
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
  value: 'Compare three MODIS albedo retrieval methods:\n1. MOD09A1 Ren Method\n2. MOD10A1 Snow Albedo\n3. MCD43A3 BRDF/Albedo\n\n🔥 MELT SEASON: Jun-Sep (Monthly averages)\n⚡ ULTRA MEMORY OPTIMIZED: 2km scale, limit 100 images\n📊 AUTO CSV EXPORT: Data exported to Google Drive automatically',
  style: {
    fontSize: '12px',
    margin: '0px 0px 10px 0px'
  }
});
panel.add(description);

// Date selection
var startDateLabel = ui.Label('Start Date (YYYY-MM-DD):');
var startDateBox = ui.Textbox({
  placeholder: '2020-06-01',
  value: '2020-06-01',
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
  value: 'Ready! ULTRA OPTIMIZED: 2km scale, 100 image limit, auto CSV export',
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
  
  // Automatically start CSV export first (less memory intensive)
  print('=== STARTING AUTOMATIC CSV EXPORT ===');
  exportComparisonStats(results, glacierBounds, 'auto_albedo_comparison_' + startDate + '_' + endDate);
  
  // Create comparison chart (may fail due to memory, but CSV export will work)
  try {
    var chart = createComparisonChart(results, glacierBounds);
    print('=== ALBEDO METHOD COMPARISON TIME SERIES ===');
    print(chart);
  } catch (error) {
    print('Chart generation failed due to memory limits, but CSV export is running.');
    print('Error: ' + error);
  }
  
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
  statusLabel.setValue('Recent 5-year melt seasons 2020-2024 selected (RECOMMENDED - ULTRA OPTIMIZED). Click Run Analysis.');
  statusLabel.style().set('color', 'blue');
});

fullMeltBtn.onClick(function() {
  startDateBox.setValue('2017-06-01');
  endDateBox.setValue('2024-09-30');
  statusLabel.setValue('Full 8-year period selected (ULTRA OPTIMIZED - 100 images max per method). Click Run Analysis.');
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