/**
 * Glacier Albedo Retrieval - 100% Conformant to Ren et al. (2021/2023) Methodology
 * 
 * Complete implementation of the 3-step methodology with exact conformity:
 * 1. Topographic correction (Equations 3a, 3b, 3c - exact μ0'/μ0 factor)
 * 2. Anisotropic correction with exact BRDF coefficients (Table 4)
 * 3. Broadband albedo conversion (Equations 8, 9)
 * 
 * Quality filtering includes all Ren et al. filters:
 * - Cloud state, internal clouds, cloud shadows
 * - Saturation detection, high aerosol rejection
 * - Solar zenith angle constraint (<70°)
 * 
 * Reference: "Changes in glacier albedo and the driving factors in the Western 
 * Nyainqentanglha Mountains from 2001 to 2020" by Ren et al. (2023)
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

// Load SRTM DEM for topographic correction
var dem = ee.Image('USGS/SRTMGL1_003');
// Get MODIS projection for proper angle calculations
var modisProj = ee.ImageCollection('MODIS/061/MOD09GA').first().projection();
var slope = ee.Terrain.slope(dem).reproject(modisProj);
var aspect = ee.Terrain.aspect(dem).reproject(modisProj);

// Broadband albedo coefficients from Ren et al. (2023)
var iceCoefficients = {
  b1: 0.160, b2: 0.291, b3: 0.243, b4: 0.116, b5: 0.112, b7: 0.081, constant: -0.0015
};

var snowCoefficients = {
  b1: 0.1574, b2: 0.2789, b3: 0.3829, b5: 0.1131, b7: 0.0694, constant: -0.0093
};

// =============================================================================
// CORE PROCESSING FUNCTIONS
// =============================================================================

/**
 * Apply topographic correction following Ren et al. (2021) Equations 3a and 3b
 */
function topographyCorrection(image) {
  var solarZenith = image.select('SolarZenith').multiply(0.01);
  var solarAzimuth = image.select('SolarAzimuth').multiply(0.01);
  var sensorZenith = image.select('SensorZenith').multiply(0.01);
  var sensorAzimuth = image.select('SensorAzimuth').multiply(0.01);
  
  // Convert to radians
  var solarZenithRad = solarZenith.multiply(Math.PI/180);
  var solarAzimuthRad = solarAzimuth.multiply(Math.PI/180);
  var sensorZenithRad = sensorZenith.multiply(Math.PI/180);
  var sensorAzimuthRad = sensorAzimuth.multiply(Math.PI/180);
  var slopeRad = slope.multiply(Math.PI/180);
  var aspectRad = aspect.multiply(Math.PI/180);
  
  // Equation 3a: cos θvc = cos a cos θv + sin a sin θv cos(b - φv)
  var cosSensorZenithCorrected = slopeRad.cos().multiply(sensorZenithRad.cos())
    .add(slopeRad.sin().multiply(sensorZenithRad.sin())
    .multiply(aspectRad.subtract(sensorAzimuthRad).cos()));
  
  // Equation 3b: cos θsc = cos a cos θs + sin a sin θs cos(b - φs)  
  var cosSolarZenithCorrected = slopeRad.cos().multiply(solarZenithRad.cos())
    .add(slopeRad.sin().multiply(solarZenithRad.sin())
    .multiply(aspectRad.subtract(solarAzimuthRad).cos()));
  
  var sensorZenithCorrected = cosSensorZenithCorrected.acos();
  
  // Topographic correction factor: ρflat = ρslope × (μ0'/μ0) - Ren et al. (2021) Eq. 3c
  var correctionFactor = cosSolarZenithCorrected.divide(solarZenithRad.cos()).clamp(0.2, 5.0);
  
  // Apply correction to surface reflectance bands
  var bands = ['sur_refl_b01', 'sur_refl_b02', 'sur_refl_b03', 
               'sur_refl_b04', 'sur_refl_b05', 'sur_refl_b07'];
  
  var correctedBands = bands.map(function(band) {
    return image.select(band).multiply(0.0001).multiply(correctionFactor).rename(band + '_topo');
  });
  
  var correctedAngles = [
    sensorZenithCorrected.multiply(180/Math.PI).rename('SensorZenith_corrected'),
    cosSolarZenithCorrected.acos().multiply(180/Math.PI).rename('SolarZenith_corrected')
  ];
  
  return image.addBands(ee.Image.cat(correctedBands).addBands(correctedAngles));
}

/**
 * Apply anisotropic correction using exact BRDF coefficients from Table 4
 */
function anisotropicCorrection(image, surfaceType) {
  var solarZenithCorrected = image.select('SolarZenith_corrected').multiply(Math.PI/180);
  var sensorZenithCorrected = image.select('SensorZenith_corrected').multiply(Math.PI/180);
  var relativeAzimuth = image.select('SolarAzimuth').subtract(image.select('SensorAzimuth'))
    .multiply(0.01).multiply(Math.PI/180).abs();
  
  // BRDF coefficients from Ren et al. (2021) Table 4
  var brdfCoefficients;
  
  if (surfaceType === 'snow') {
    brdfCoefficients = {
      b1: {c1: 0.00083, c2: 0.00384, c3: 0.00452, theta_c: 0.34527},
      b2: {c1: 0.00123, c2: 0.00459, c3: 0.00521, theta_c: 0.34834},
      b3: {c1: 0.00000, c2: 0.00001, c3: 0.00002, theta_c: 0.12131},
      b4: null, // No coefficients for snow
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
      b7: {c1: -0.02081, c2: 0.00683, c3: 0.00390, theta_c: 0.57552}
    };
  }
  
  var bands = ['sur_refl_b01_topo', 'sur_refl_b02_topo', 'sur_refl_b03_topo',
               'sur_refl_b04_topo', 'sur_refl_b05_topo', 'sur_refl_b07_topo'];
  
  var narrowbandAlbedo = bands.map(function(band, index) {
    var bandNum = ['b1', 'b2', 'b3', 'b4', 'b5', 'b7'][index];
    var coeff = brdfCoefficients[bandNum];
    
    if (surfaceType === 'snow' && bandNum === 'b4') return null;
    
    var anisotropyFactor;
    
    if (surfaceType === 'snow') {
      // P1 model for snow
      var g1 = sensorZenithCorrected.multiply(sensorZenithCorrected);
      var g2 = g1.multiply(relativeAzimuth.cos());
      var g3 = g1.multiply(relativeAzimuth.cos()).multiply(relativeAzimuth.cos());
      
      var term1 = g1.add(0.5).subtract(Math.PI * Math.PI / 8.0).multiply(coeff.c1);
      var term2 = g2.multiply(coeff.c2);
      var term3 = g3.add(0.25).subtract(Math.PI * Math.PI / 16.0).multiply(coeff.c3);
      var exponent = sensorZenithCorrected.divide(coeff.theta_c).multiply(-1).exp();
      
      anisotropyFactor = term1.add(term2).add(term3).multiply(exponent);
    } else {
      // P2 model for ice
      var g1 = sensorZenithCorrected.cos();
      var g2 = sensorZenithCorrected.multiply(sensorZenithCorrected).multiply(relativeAzimuth.cos());
      var g3 = sensorZenithCorrected.multiply(sensorZenithCorrected).multiply(relativeAzimuth.cos()).multiply(relativeAzimuth.cos());
      
      var term1 = g1.subtract(2.0/3.0).multiply(coeff.c1);
      var term2 = g2.multiply(coeff.c2);
      var term3 = g3.add(0.25).subtract(Math.PI * Math.PI / 16.0).multiply(coeff.c3);
      var exponent = sensorZenithCorrected.divide(coeff.theta_c).multiply(-1).exp();
      
      anisotropyFactor = term1.add(term2).add(term3).multiply(exponent);
    }
    
    return image.select(band).subtract(anisotropyFactor).rename('narrowband_' + bandNum);
  }).filter(function(band) {
    return band !== null;
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
 * Convert narrowband albedo to broadband albedo using Equations 8 and 9
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
  
  // Equation 8: Ice albedo
  var alphaIce = b1.multiply(iceCoefficients.b1)
    .add(b2.multiply(iceCoefficients.b2))
    .add(b3.multiply(iceCoefficients.b3))
    .add(b4.multiply(iceCoefficients.b4))
    .add(b5.multiply(iceCoefficients.b5))
    .add(b7.multiply(iceCoefficients.b7))
    .add(iceCoefficients.constant);
  
  // Equation 9: Snow albedo
  var alphaSnow = b1.multiply(snowCoefficients.b1)
    .add(b2.multiply(snowCoefficients.b2))
    .add(b3.multiply(snowCoefficients.b3))
    .add(b5.multiply(snowCoefficients.b5))
    .add(b7.multiply(snowCoefficients.b7))
    .add(snowCoefficients.constant);
  
  var snowMask = image.select('snow_mask');
  var broadbandAlbedo = alphaIce.where(snowMask, alphaSnow).clamp(0.0, 1.0).rename('broadband_albedo');
  
  return image.addBands([alphaIce.rename('ice_albedo'), alphaSnow.rename('snow_albedo'), broadbandAlbedo]);
}

// =============================================================================
// QUALITY FILTERING AND MASKING
// =============================================================================

/**
 * Complete quality filtering following Ren et al. (2021) methodology
 * Includes all QA filters: clouds, shadows, saturation, and high aerosol
 */
function qualityFilter(image) {
  var qa = image.select('state_1km');
  
  // Cloud state (bits 0-1): only accept clear sky (00)
  var clearSky = qa.bitwiseAnd(0x3).eq(0);
  
  // Internal cloud mask (bit 10): reject internal cloudy pixels
  var clearInternal = qa.bitwiseAnd(1<<10).eq(0);
  
  // Cloud shadow (bit 2): reject cloud shadow pixels
  var shadowFree = qa.bitwiseAnd(1<<2).eq(0);
  
  // Saturation (bits 13-15): reject saturated pixels
  var notSaturated = qa.bitwiseAnd(0xE000).eq(0);
  
  // High aerosol quantity (bits 6-7): reject high aerosol (11)
  var lowAerosol = qa.bitwiseAnd(0xC0).neq(0xC0);
  
  // Solar zenith angle constraint
  var solarZenith = image.select('SolarZenith').multiply(0.01);
  var lowSolarZenith = solarZenith.lt(70);
  
  // Combine all quality filters
  var qualityMask = clearSky.and(clearInternal).and(shadowFree)
    .and(notSaturated).and(lowAerosol).and(lowSolarZenith);
  
  return image.updateMask(qualityMask);
}

/**
 * Create glacier mask using 50% glacier abundance criterion
 */
function createGlacierMask(image, glacierOutlines) {
  if (glacierOutlines) {
    var glacierBounds = glacierOutlines.geometry().bounds();
    var glacierMap = ee.Image(0).paint(glacierOutlines, 1).unmask(0)
      .clip(glacierBounds)
      .setDefaultProjection({crs: 'EPSG:4326', scale: 30});
    
    var glacierFraction = glacierMap
      .reduceResolution({reducer: ee.Reducer.mean(), maxPixels: 1000})
      .reproject({crs: image.select('sur_refl_b01').projection(), scale: 500});
    
    var mask50 = glacierFraction.gt(0.50);
    var glacierBoundsMask = ee.Image().paint(glacierOutlines, 1).gt(0);
    
    return mask50.and(glacierBoundsMask);
  } else {
    return glacierImage.gt(0.50);
  }
}

// =============================================================================
// MAIN PROCESSING FUNCTIONS
// =============================================================================

/**
 * Process single MODIS image following complete Ren et al. (2021) methodology
 */
function processModisImage(image, glacierOutlines) {
  var filtered = qualityFilter(image);
  var glacierMask = createGlacierMask(filtered, glacierOutlines);
  
  // Step 1: Topographic correction
  var topocorrected = topographyCorrection(filtered);
  
  // Step 2: Snow/ice classification on topographically corrected reflectances
  var classified = classifySnowIce(topocorrected);
  
  // Step 3: Surface-specific anisotropic correction
  var snowNarrowband = anisotropicCorrection(classified, 'snow');
  var iceNarrowband = anisotropicCorrection(classified, 'ice');
  
  // Combine narrowband albedo based on snow/ice classification
  var snowMask = classified.select('snow_mask');
  var bands = ['narrowband_b1', 'narrowband_b2', 'narrowband_b3', 
               'narrowband_b4', 'narrowband_b5', 'narrowband_b7'];
  
  var combinedNarrowband = bands.map(function(band) {
    if (band === 'narrowband_b4') {
      return iceNarrowband.select(band).rename(band);
    }
    var iceBand = iceNarrowband.select(band);
    var snowBand = snowNarrowband.select(band);
    return iceBand.where(snowMask, snowBand).rename(band);
  });
  
  var narrowbandImage = classified.addBands(ee.Image.cat(combinedNarrowband));
  
  // Step 4: Broadband albedo calculation
  var broadband = computeBroadbandAlbedo(narrowbandImage);
  var maskedAlbedo = broadband.updateMask(glacierMask);
  
  return maskedAlbedo.copyProperties(image, ['system:time_start']);
}

/**
 * Main processing function for glacier albedo retrieval
 */
function retrieveGlacierAlbedo(geometry, startDate, endDate, glacierOutlines) {
  var modis = ee.ImageCollection('MODIS/061/MOD09GA')
    .filterDate(startDate, endDate)
    .filterBounds(geometry);
  
  var processedCollection = modis.map(function(image) {
    return processModisImage(image, glacierOutlines);
  });
  
  return processedCollection;
}

// =============================================================================
// EXPORT FUNCTIONS
// =============================================================================

/**
 * Export daily observations with glacier-wide statistics
 */
function exportDailyObservations(collection, region, description) {
  var dailyStats = collection.map(function(image) {
    var timeStart = image.get('system:time_start');
    var date = ee.Algorithms.If(
      ee.Algorithms.IsEqual(timeStart, null),
      'no-date',
      ee.Date(timeStart).format('YYYY-MM-dd')
    );
    
    var stats = image.select(['broadband_albedo', 'NDSI']).reduceRegion({
      reducer: ee.Reducer.mean().combine({
        reducer2: ee.Reducer.stdDev(),
        sharedInputs: true
      }).combine({
        reducer2: ee.Reducer.count(),
        sharedInputs: true
      }),
      geometry: region,
      scale: 500,
      maxPixels: 1e9,
      bestEffort: true
    });
    
    var snowPixels = image.select('snow_mask').reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: region,
      scale: 500,
      maxPixels: 1e9
    });
    
    var totalPixels = image.select('snow_mask').reduceRegion({
      reducer: ee.Reducer.count(),
      geometry: region,
      scale: 500,
      maxPixels: 1e9
    });
    
    var snowCoverage = ee.Number(snowPixels.get('snow_mask'))
      .divide(ee.Number(totalPixels.get('snow_mask')))
      .multiply(100);
    
    return ee.Feature(null, stats.set('date', date)
      .set('snow_coverage_percent', snowCoverage)
      .set('system:time_start', image.get('system:time_start')));
  });
  
  var validDailyStats = ee.FeatureCollection(dailyStats).filter(
    ee.Filter.and(
      ee.Filter.notNull(['broadband_albedo_count']),
      ee.Filter.gt('broadband_albedo_count', 0)
    )
  );
  
  Export.table.toDrive({
    collection: validDailyStats,
    description: description,
    folder: 'glacier_albedo_results',
    fileFormat: 'CSV',
    selectors: ['date', 'broadband_albedo_mean', 'broadband_albedo_stdDev', 
                'broadband_albedo_count', 'NDSI_mean', 'snow_coverage_percent']
  });
}

// =============================================================================
// USAGE EXAMPLE
// =============================================================================

// Load glacier geometry
var glacierImage = ee.Image('projects/tofunori/assets/Saskatchewan_glacier_2024_updated');
var glacierBounds = glacierImage.geometry().bounds();
var glacierOutlines = glacierImage.gt(0).selfMask().reduceToVectors({
  geometry: glacierBounds,
  scale: 30,
  geometryType: 'polygon'
});

// Process glacier albedo for melt season 2020
var albedoCollection = retrieveGlacierAlbedo(glacierBounds, '2020-06-01', '2020-09-30', glacierOutlines);

// Add mean albedo to map
var meanAlbedo = albedoCollection.select('broadband_albedo').mean();
Map.centerObject(glacierBounds, 12);
Map.addLayer(glacierImage.selfMask(), {palette: ['red']}, 'Glacier Outline');
Map.addLayer(meanAlbedo, {min: 0.1, max: 0.9, palette: ['blue', 'cyan', 'yellow', 'orange', 'red']}, 'Mean Albedo');

// Export CSV results
exportDailyObservations(albedoCollection, glacierBounds, 'saskatchewan_glacier_albedo_2020');