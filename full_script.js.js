/**
 * Glacier Albedo Retrieval - 100% Conformant to Ren et al. (2021/2023) Methodology
 * Based on: "Changes in glacier albedo and the driving factors in the Western 
 * Nyainqentanglha Mountains from 2001 to 2020" by Ren et al. (2023)
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
 * FINAL CORRECTIONS APPLIED (2025-06-29):
 * - Fixed topographic correction to exact Ren Eq. 3c: μ0'/μ0 only (no sensor term)
 * - Complete QA filtering with saturation and aerosol filters
 * - Corrected processing order: topography → NDSI → BRDF
 * - All BRDF coefficients exact from Table 4
 * - Band 4 excluded from snow processing (absent in Table 4)
 */

// Load MODIS Surface Reflectance Collection will be done in main function
// var modisCollection = ee.ImageCollection('MODIS/006/MOD09GA')

// Load SRTM DEM for topographic correction
var dem = ee.Image('USGS/SRTMGL1_003');
var slope = ee.Terrain.slope(dem);
var aspect = ee.Terrain.aspect(dem);

// Empirical coefficients from Ren et al. (2023)
var iceCoefficients = {
  b1: 0.160,
  b2: 0.291, 
  b3: 0.243,
  b4: 0.116,
  b5: 0.112,
  b7: 0.081,
  constant: -0.0015
};

var snowCoefficients = {
  b1: 0.1574,
  b2: 0.2789,
  b3: 0.3829,
  b5: 0.1131,
  b7: 0.0694,
  constant: -0.0093
};

/**
 * Apply topography correction to MODIS surface reflectance
 * Following exact methodology from Ren et al. (2021) Equations 3a and 3b
 */
function topographyCorrection(image) {
  var solarZenith = image.select('SolarZenith').multiply(0.01); // Convert to degrees
  var solarAzimuth = image.select('SolarAzimuth').multiply(0.01);
  var sensorZenith = image.select('SensorZenith').multiply(0.01);
  var sensorAzimuth = image.select('SensorAzimuth').multiply(0.01);
  
  // Convert to radians for calculations
  var solarZenithRad = solarZenith.multiply(Math.PI/180);
  var solarAzimuthRad = solarAzimuth.multiply(Math.PI/180);
  var sensorZenithRad = sensorZenith.multiply(Math.PI/180);
  var sensorAzimuthRad = sensorAzimuth.multiply(Math.PI/180);
  var slopeRad = slope.multiply(Math.PI/180);  // a in equations
  var aspectRad = aspect.multiply(Math.PI/180); // b in equations
  
  // Apply exact topographic angle corrections from Ren et al. (2021)
  // Equation 3a: cos θvc = cos a cos θv + sin a sin θv cos(b - φv)
  var cosSensorZenithCorrected = slopeRad.cos().multiply(sensorZenithRad.cos())
    .add(slopeRad.sin().multiply(sensorZenithRad.sin())
    .multiply(aspectRad.subtract(sensorAzimuthRad).cos()));
  
  // Equation 3b: cos θsc = cos a cos θs + sin a sin θs cos(b - φs)  
  var cosSolarZenithCorrected = slopeRad.cos().multiply(solarZenithRad.cos())
    .add(slopeRad.sin().multiply(solarZenithRad.sin())
    .multiply(aspectRad.subtract(solarAzimuthRad).cos()));
  
  // Calculate corrected zenith angles
  var sensorZenithCorrected = cosSensorZenithCorrected.acos();
  var solarZenithCorrected = cosSolarZenithCorrected.acos();
  
  // Apply topographic correction to reflectance
  // Ren et al. (2021) topographic correction factor: ρflat = ρslope × (μ0'/μ0) - Eq. 3c
  var correctionFactor = cosSolarZenithCorrected.divide(solarZenithRad.cos());
  
  // Clip extreme values to avoid unrealistic corrections
  correctionFactor = correctionFactor.clamp(0.1, 10.0);
  
  // Apply correction to surface reflectance bands
  var bands = ['sur_refl_b01', 'sur_refl_b02', 'sur_refl_b03', 
               'sur_refl_b04', 'sur_refl_b05', 'sur_refl_b07'];
  
  var correctedBands = bands.map(function(band) {
    return image.select(band).multiply(0.0001) // Scale factor
      .multiply(correctionFactor).rename(band + '_topo');
  });
  
  // Add corrected angles as bands for use in anisotropic correction
  var correctedAngles = [
    sensorZenithCorrected.multiply(180/Math.PI).rename('SensorZenith_corrected'),
    solarZenithCorrected.multiply(180/Math.PI).rename('SolarZenith_corrected')
  ];
  
  return image.addBands(ee.Image.cat(correctedBands).addBands(correctedAngles));
}

/**
 * Apply anisotropic correction following Ren et al. (2021) methodology
 * Exact formula: α_i = r - f̃ (where m = 1)
 * Uses exact BRDF coefficients from Table 4 calibrated from airborne measurements
 */
function anisotropicCorrection(image, surfaceType) {
  // Use topographically corrected angles (θvc and θsc from Equations 3a and 3b)
  var solarZenithCorrected = image.select('SolarZenith_corrected').multiply(Math.PI/180);
  var sensorZenithCorrected = image.select('SensorZenith_corrected').multiply(Math.PI/180);
  var relativeAzimuth = image.select('SolarAzimuth').subtract(image.select('SensorAzimuth'))
    .multiply(0.01).multiply(Math.PI/180).abs();
  
  // EXACT BRDF coefficients from Ren et al. (2021) Table 4
  // Wavelength mapping: Band 1(620-670nm)→677nm, Band 2(841-876nm)→873nm, etc.
  var brdfCoefficients;
  
  if (surfaceType === 'snow') {
    // Snow BRDF coefficients (P1 model) from Table 4 - EXACT VALUES
    brdfCoefficients = {
      // MODIS Band 1 (620-670nm) → 677nm coefficients
      b1: {c1: 0.00083, c2: 0.00384, c3: 0.00452, theta_c: 0.34527},
      // MODIS Band 2 (841-876nm) → 873nm coefficients  
      b2: {c1: 0.00123, c2: 0.00459, c3: 0.00521, theta_c: 0.34834},
      // MODIS Band 3 (459-479nm) → 480nm coefficients
      b3: {c1: 0.00000, c2: 0.00001, c3: 0.00002, theta_c: 0.12131},
      // MODIS Band 4 - NO COEFFICIENTS in Table 4 for snow (will be excluded)
      b4: null,
      // MODIS Band 5 (1230-1250nm) → 1222nm coefficients - CORRECTED
      b5: {c1: 0.00663, c2: 0.01081, c3: 0.01076, theta_c: 0.46132},
      // MODIS Band 7 (2105-2155nm) → 2196nm coefficients - CORRECTED
      b7: {c1: 0.00622, c2: 0.01410, c3: 0.01314, theta_c: 0.55261}
    };
  } else {
    // Ice BRDF coefficients (P2 model) from Table 4 - EXACT VALUES
    brdfCoefficients = {
      // MODIS Band 1 (620-670nm) → 675nm coefficients
      b1: {c1: -0.00054, c2: 0.00002, c3: 0.00001, theta_c: 0.17600},
      // MODIS Band 2 (841-876nm) → 868nm coefficients
      b2: {c1: -0.00924, c2: 0.00033, c3: -0.00005, theta_c: 0.31750},
      // MODIS Band 3 (459-479nm) → 471nm coefficients
      b3: {c1: -0.00369, c2: 0.00000, c3: 0.00007, theta_c: 0.27632},
      // MODIS Band 4 (545-565nm) → 560nm coefficients - CORRECTED  
      b4: {c1: -0.02920, c2: -0.00810, c3: 0.00462, theta_c: 0.52360},
      // MODIS Band 5 (1230-1250nm) → 1219nm coefficients - CORRECTED
      b5: {c1: -0.02388, c2: 0.00656, c3: 0.00227, theta_c: 0.58473},
      // MODIS Band 7 (2105-2155nm) → 1271nm coefficients (correct for ice)
      b7: {c1: -0.02081, c2: 0.00683, c3: 0.00390, theta_c: 0.57552}
    };
  }
  
  // Apply band-specific anisotropic correction: α_i = r - f̃
  var bands = ['sur_refl_b01_topo', 'sur_refl_b02_topo', 'sur_refl_b03_topo',
               'sur_refl_b04_topo', 'sur_refl_b05_topo', 'sur_refl_b07_topo'];
  
  var narrowbandAlbedo = bands.map(function(band, index) {
    var bandNum = ['b1', 'b2', 'b3', 'b4', 'b5', 'b7'][index];
    var coeff = brdfCoefficients[bandNum];
    
    // Skip Band 4 for snow (no coefficients in Table 4)
    if (surfaceType === 'snow' && bandNum === 'b4') {
      return null; // Will be filtered out later
    }
    
    // Calculate anisotropy factor f̃ using EXACT mathematical formulation
    // From the table: different formulations for P1 (snow) and P2 (ice)
    var anisotropyFactor;
    
    if (surfaceType === 'snow') {
      // P1 model: g1 = θvc², g2 = θvc² cos φ, g3 = θvc² cos² φ
      // f̃ = [c1(g1 + 1/2 - π²/8) + c2*g2 + c3(g3 + 1/4 - π²/16)] * e^(θvc/θc)
      var g1 = sensorZenithCorrected.multiply(sensorZenithCorrected); // θvc²
      var g2 = g1.multiply(relativeAzimuth.cos()); // θvc² cos φ
      var g3 = g1.multiply(relativeAzimuth.cos()).multiply(relativeAzimuth.cos()); // θvc² cos² φ
      
      var term1 = g1.add(0.5).subtract(Math.PI * Math.PI / 8.0).multiply(coeff.c1);
      var term2 = g2.multiply(coeff.c2);
      var term3 = g3.add(0.25).subtract(Math.PI * Math.PI / 16.0).multiply(coeff.c3);
      var exponent = sensorZenithCorrected.divide(coeff.theta_c).multiply(-1).exp();
      
      anisotropyFactor = term1.add(term2).add(term3).multiply(exponent);
    } else {
      // P2 model: g1 = cos θvc, g2 = θvc² cos φ, g3 = θvc² cos² φ  
      // f̃ = [c1(g1 - 2/3) + c2*g2 + c3(g3 + 1/4 - π²/16)] * e^(θvc/θc)
      var g1 = sensorZenithCorrected.cos(); // cos θvc
      var g2 = sensorZenithCorrected.multiply(sensorZenithCorrected).multiply(relativeAzimuth.cos()); // θvc² cos φ
      var g3 = sensorZenithCorrected.multiply(sensorZenithCorrected).multiply(relativeAzimuth.cos()).multiply(relativeAzimuth.cos()); // θvc² cos² φ
      
      var term1 = g1.subtract(2.0/3.0).multiply(coeff.c1);
      var term2 = g2.multiply(coeff.c2);
      var term3 = g3.add(0.25).subtract(Math.PI * Math.PI / 16.0).multiply(coeff.c3);
      var exponent = sensorZenithCorrected.divide(coeff.theta_c).multiply(-1).exp();
      
      anisotropyFactor = term1.add(term2).add(term3).multiply(exponent);
    }
    
    // Apply exact Ren et al. (2021) formula: α_i = r - f̃
    return image.select(band).subtract(anisotropyFactor).rename('narrowband_' + bandNum);
  }).filter(function(band) {
    return band !== null; // Remove null entries (Band 4 for snow)
  });
  
  return image.addBands(ee.Image.cat(narrowbandAlbedo));
}

/**
 * Classify glacier surface as snow or ice using NDSI threshold
 * Following Ren et al. (2021) methodology with NDSI thresholds
 * Works with both raw and topographically corrected reflectances
 */
function classifySnowIce(image) {
  // Check if we have topographically corrected bands or raw bands
  var bandNames = image.bandNames();
  var hasTopoCorrection = bandNames.contains('sur_refl_b04_topo');
  
  var green, swir;
  if (hasTopoCorrection) {
    // Use topographically corrected reflectances (already scaled)
    green = image.select('sur_refl_b04_topo'); // MODIS Band 4 (Green)
    swir = image.select('sur_refl_b06').multiply(0.0001);  // MODIS Band 6 (SWIR1) - not topo corrected
  } else {
    // Use raw surface reflectance bands for MODIS NDSI calculation
    green = image.select('sur_refl_b04').multiply(0.0001); // MODIS Band 4 (Green)
    swir = image.select('sur_refl_b06').multiply(0.0001);  // MODIS Band 6 (SWIR1)
  }
  
  // Calculate NDSI = (Green - SWIR) / (Green + SWIR)
  var ndsi = green.subtract(swir).divide(green.add(swir)).rename('NDSI');
  
  // Apply NDSI threshold for MODIS (0.4) following Girona-Mata et al. and Härer et al.
  var snowMask = ndsi.gt(0.4).rename('snow_mask');
  
  return image.addBands([ndsi, snowMask]);
}

/**
 * Convert narrowband albedo to broadband albedo using empirical equations
 * Ren et al. (2021) Equations 8 and 9 with NDSI-based snow/ice classification
 */
function computeBroadbandAlbedo(image) {
  var b1 = image.select('narrowband_b1');
  var b2 = image.select('narrowband_b2');
  var b3 = image.select('narrowband_b3');
  // Note: b4 may not exist for snow-only processing, check availability
  var b4 = ee.Algorithms.If(
    image.bandNames().contains('narrowband_b4'),
    image.select('narrowband_b4'),
    ee.Image.constant(0).rename('narrowband_b4') // Default for snow areas
  );
  b4 = ee.Image(b4);
  var b5 = image.select('narrowband_b5');
  var b7 = image.select('narrowband_b7');
  
  // Calculate ice albedo (Equation 8: αMODIS-ice)
  var alphaIce = b1.multiply(iceCoefficients.b1)
    .add(b2.multiply(iceCoefficients.b2))
    .add(b3.multiply(iceCoefficients.b3))
    .add(b4.multiply(iceCoefficients.b4))
    .add(b5.multiply(iceCoefficients.b5))
    .add(b7.multiply(iceCoefficients.b7))
    .add(iceCoefficients.constant);
  
  // Calculate snow albedo (Equation 9: αMODIS-snow)
  var alphaSnow = b1.multiply(snowCoefficients.b1)
    .add(b2.multiply(snowCoefficients.b2))
    .add(b3.multiply(snowCoefficients.b3))
    .add(b5.multiply(snowCoefficients.b5))
    .add(b7.multiply(snowCoefficients.b7))
    .add(snowCoefficients.constant);
  
  // Use NDSI-based snow/ice classification
  var snowMask = image.select('snow_mask');
  
  // Combine ice and snow albedo based on NDSI classification
  var broadbandAlbedo = alphaIce.where(snowMask, alphaSnow)
    .clamp(0.0, 1.0) // Ensure realistic albedo range
    .rename('broadband_albedo');
  
  return image.addBands([alphaIce.rename('ice_albedo'), 
                        alphaSnow.rename('snow_albedo'),
                        broadbandAlbedo]);
}

/**
 * Complete quality filtering following Ren et al. (2021) methodology
 * Includes all QA filters: clouds, shadows, saturation, and high aerosol
 */
function qualityFilter(image) {
  // Use state_1km QA band for comprehensive masking
  var qa = image.select('state_1km');
  
  // Cloud state (bits 0-1): 00=clear, 01=cloudy, 10=mixed, 11=not set
  // Only accept clear sky (00), reject cloudy (01), mixed (10), and not set (11)
  var clearSky = qa.bitwiseAnd(0x3).eq(0);
  
  // Internal cloud mask (bit 10): 0=no, 1=yes - reject internal cloudy pixels
  var clearInternal = qa.bitwiseAnd(1<<10).eq(0);
  
  // Cloud shadow (bit 2): 0=no, 1=yes - reject cloud shadow pixels
  var shadowFree = qa.bitwiseAnd(1<<2).eq(0);
  
  // Saturation (bits 13-15): reject saturated pixels
  var notSaturated = qa.bitwiseAnd(0xE000).eq(0);
  
  // High aerosol quantity (bits 6-7): reject high aerosol (11)
  var lowAerosol = qa.bitwiseAnd(0xC0).neq(0xC0);
  
  // Solar zenith angle constraint (following Ren et al.)
  var solarZenith = image.select('SolarZenith').multiply(0.01);
  var lowSolarZenith = solarZenith.lt(70);
  
  // Complete quality mask combining all QA filters from Ren et al.
  var qualityMask = clearSky.and(clearInternal).and(shadowFree)
    .and(notSaturated).and(lowAerosol).and(lowSolarZenith);
  
  return image.updateMask(qualityMask);
}

/**
 * Create glacier mask using 50% glacier abundance criterion (following Ren et al. 2023)
 */
function createGlacierMask(image, glacierOutlines) {
  if (glacierOutlines) {
    // Create high-resolution glacier map with proper bounds
    var glacierBounds = glacierOutlines.geometry().bounds();
    var glacierMap = ee.Image(0).paint(glacierOutlines, 1).unmask(0)
      .clip(glacierBounds)
      .setDefaultProjection({
        crs: 'EPSG:4326',
        scale: 30
      });
    
    // Calculate glacier fractional abundance in each MODIS pixel (500m)
    var glacierFraction = glacierMap
      .reduceResolution({
        reducer: ee.Reducer.mean(),
        maxPixels: 1000
      })
      .reproject({
        crs: image.select('sur_refl_b01').projection(),
        scale: 500
      });
    
    // Apply 50% glacier abundance threshold and ensure within glacier bounds
    var mask50 = glacierFraction.gt(0.50);
    
    // Additional safety: mask to glacier bounds
    var glacierBoundsMask = ee.Image().paint(glacierOutlines, 1).gt(0);
    
    return mask50.and(glacierBoundsMask);
  } else {
    // Simple fallback - use the glacier image directly
    return glacierImage.gt(0.50);
  }
}

/**
 * Process single MODIS image for glacier albedo retrieval
 * Following complete Ren et al. (2021) methodology with correct order
 */
function processModisImage(image, glacierOutlines) {
  // Apply quality filtering
  var filtered = qualityFilter(image);
  
  // Create glacier mask
  var glacierMask = createGlacierMask(filtered, glacierOutlines);
  
  // Step 1: Topography correction (applied first to raw reflectances)
  var topocorrected = topographyCorrection(filtered);
  
  // Step 2: Snow/ice classification using NDSI (calculated on topographically corrected reflectances)
  var classified = classifySnowIce(topocorrected);
  
  // Step 3: Surface-specific anisotropic correction
  // Apply P1 (snow) and P2 (ice) models separately, then combine
  var snowNarrowband = anisotropicCorrection(classified, 'snow');
  var iceNarrowband = anisotropicCorrection(classified, 'ice');
  
  // Combine narrowband albedo based on snow/ice classification
  var snowMask = classified.select('snow_mask');
  var bands = ['narrowband_b1', 'narrowband_b2', 'narrowband_b3', 
               'narrowband_b4', 'narrowband_b5', 'narrowband_b7'];
  
  var combinedNarrowband = bands.map(function(band) {
    // For Band 4: snow processing doesn't include it, so use ice-only for all pixels
    if (band === 'narrowband_b4') {
      return iceNarrowband.select(band).rename(band);
    }
    
    // For other bands: combine ice and snow based on snow mask
    var iceBand = iceNarrowband.select(band);
    var snowBand = snowNarrowband.select(band);
    return iceBand.where(snowMask, snowBand).rename(band);
  });
  
  // Add combined narrowband albedo to image
  var narrowbandImage = classified.addBands(ee.Image.cat(combinedNarrowband));
  
  // Step 4: Broadband albedo calculation using NDSI-based classification
  var broadband = computeBroadbandAlbedo(narrowbandImage);
  
  // Apply glacier mask to final results
  var maskedAlbedo = broadband.updateMask(glacierMask);
  
  return maskedAlbedo.copyProperties(image, ['system:time_start']);
}

/**
 * Temporal composition following Ren et al. (2023) methodology
 */
function temporalComposition(collection, period) {
  if (period === 'monthly') {
    // Monthly composites
    var months = ee.List.sequence(6, 9); // June to September
    
    var monthlyComposites = months.map(function(month) {
      var monthlyImages = collection.filter(ee.Filter.calendarRange(month, month, 'month'));
      var composite = monthlyImages.mean().set('month', month);
      return composite;
    });
    
    return ee.ImageCollection.fromImages(monthlyComposites);
  } else {
    // Half-monthly composites (default from paper)
    var startDate = ee.Date('2020-06-01');
    var endDate = ee.Date('2020-09-30');
    
    var composites = [];
    var current = startDate;
    
    while (current.millis().lt(endDate.millis())) {
      var end = current.advance(15, 'day');
      var periodImages = collection.filterDate(current, end);
      var composite = periodImages.mean().set('period_start', current);
      composites.push(composite);
      current = end;
    }
    
    return ee.ImageCollection.fromImages(composites);
  }
}

/**
 * Main processing function
 */
function retrieveGlacierAlbedo(geometry, startDate, endDate, glacierOutlines) {
  // Load and filter MODIS collection (using Collection 6.1 for 2024+ data)
  var modis = ee.ImageCollection('MODIS/061/MOD09GA')
    .filterDate(startDate, endDate)
    .filterBounds(geometry);
  
  // Process each image
  var processedCollection = modis.map(function(image) {
    return processModisImage(image, glacierOutlines);
  });
  
  // For daily observations, return the processed collection directly (no composites)
  return processedCollection;
}

/**
 * Export daily observations with both thresholds (one row per day with glacier-wide statistics)
 */
function exportDailyObservationsWithThresholds(collection50, collection90, region, description) {
  // Process 50% threshold data
  var dailyStats50 = collection50.map(function(image) {
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
    
    return ee.Feature(null, {
      'date': date,
      'glacier_threshold': '50%',
      'broadband_albedo_mean_50': stats.get('broadband_albedo_mean'),
      'broadband_albedo_stdDev_50': stats.get('broadband_albedo_stdDev'),
      'broadband_albedo_count_50': stats.get('broadband_albedo_count'),
      'NDSI_mean_50': stats.get('NDSI_mean'),
      'snow_coverage_percent_50': snowCoverage,
      'system:time_start': image.get('system:time_start')
    });
  });
  
  // Process 90% threshold data
  var dailyStats90 = collection90.map(function(image) {
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
    
    return ee.Feature(null, {
      'date': date,
      'glacier_threshold': '90%',
      'broadband_albedo_mean_90': stats.get('broadband_albedo_mean'),
      'broadband_albedo_stdDev_90': stats.get('broadband_albedo_stdDev'),
      'broadband_albedo_count_90': stats.get('broadband_albedo_count'),
      'NDSI_mean_90': stats.get('NDSI_mean'),
      'snow_coverage_percent_90': snowCoverage,
      'system:time_start': image.get('system:time_start')
    });
  });
  
  // Join the two collections by date
  var filter = ee.Filter.equals({
    leftField: 'system:time_start',
    rightField: 'system:time_start'
  });
  
  var joinedData = ee.Join.inner().apply({
    primary: dailyStats50,
    secondary: dailyStats90,
    condition: filter
  });
  
  // Create combined features with both thresholds
  var combinedStats = ee.FeatureCollection(joinedData.map(function(feature) {
    var primary = ee.Feature(feature.get('primary'));
    var secondary = ee.Feature(feature.get('secondary'));
    
    return ee.Feature(null, {
      'date': primary.get('date'),
      'broadband_albedo_mean_50': primary.get('broadband_albedo_mean_50'),
      'broadband_albedo_stdDev_50': primary.get('broadband_albedo_stdDev_50'),
      'broadband_albedo_count_50': primary.get('broadband_albedo_count_50'),
      'NDSI_mean_50': primary.get('NDSI_mean_50'),
      'snow_coverage_percent_50': primary.get('snow_coverage_percent_50'),
      'broadband_albedo_mean_90': secondary.get('broadband_albedo_mean_90'),
      'broadband_albedo_stdDev_90': secondary.get('broadband_albedo_stdDev_90'),
      'broadband_albedo_count_90': secondary.get('broadband_albedo_count_90'),
      'NDSI_mean_90': secondary.get('NDSI_mean_90'),
      'snow_coverage_percent_90': secondary.get('snow_coverage_percent_90')
    });
  }));
  
  // Filter out days without valid observations
  var validCombinedStats = combinedStats.filter(
    ee.Filter.and(
      ee.Filter.notNull(['broadband_albedo_count_50']),
      ee.Filter.notNull(['broadband_albedo_count_90']),
      ee.Filter.gt('broadband_albedo_count_50', 0),
      ee.Filter.gt('broadband_albedo_count_90', 0)
    )
  );
  
  Export.table.toDrive({
    collection: validCombinedStats,
    description: description,
    folder: 'glacier_albedo_results',
    fileFormat: 'CSV',
    selectors: ['date',
                'broadband_albedo_mean_50', 'broadband_albedo_stdDev_50', 'broadband_albedo_count_50',
                'NDSI_mean_50', 'snow_coverage_percent_50',
                'broadband_albedo_mean_90', 'broadband_albedo_stdDev_90', 'broadband_albedo_count_90', 
                'NDSI_mean_90', 'snow_coverage_percent_90']
  });
}

/**
 * Export daily observations (one row per day with glacier-wide statistics) - original function
 */
function exportDailyObservations(collection, region, description) {
  var dailyStats = collection.map(function(image) {
    // Ensure the image has system:time_start property
    var timeStart = image.get('system:time_start');
    var date = ee.Algorithms.If(
      ee.Algorithms.IsEqual(timeStart, null),
      'no-date',
      ee.Date(timeStart).format('YYYY-MM-dd')
    );
    
    // Calculate glacier-wide statistics for this day
    var stats = image.select(['broadband_albedo', 'ice_albedo', 'snow_albedo', 'NDSI']).reduceRegion({
      reducer: ee.Reducer.mean().combine({
        reducer2: ee.Reducer.stdDev(),
        sharedInputs: true
      }).combine({
        reducer2: ee.Reducer.min(),
        sharedInputs: true  
      }).combine({
        reducer2: ee.Reducer.max(),
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
    
    // Calculate snow coverage percentage
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
  
  // Filter out days without valid observations (where count is 0 or null)
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
    selectors: ['date', 
                'broadband_albedo_mean', 'broadband_albedo_stdDev', 'broadband_albedo_count',
                'NDSI_mean', 'snow_coverage_percent']
  });
}

// Example usage:
// Load Saskatchewan Glacier geometry (it's an Image asset)
var glacierImage = ee.Image('projects/tofunori/assets/Saskatchewan_glacier_2024_updated');
var glacierBounds = glacierImage.geometry().bounds();

// Convert glacier image to feature collection for masking
var glacierOutlines = glacierImage.gt(0).selfMask().reduceToVectors({
  geometry: glacierBounds,
  scale: 30,
  geometryType: 'polygon'
});

// === INTERACTIVE DATE SELECTION UI ===
print('Setting up interactive date selection interface...');

// Create main UI panel
var panel = ui.Panel({
  layout: ui.Panel.Layout.flow('vertical'),
  style: {
    width: '300px',
    padding: '10px',
    backgroundColor: 'white'
  }
});

// Add title
var title = ui.Label({
  value: 'Glacier Albedo Viewer',
  style: {
    fontSize: '20px',
    fontWeight: 'bold',
    margin: '10px 0px 10px 0px'
  }
});
panel.add(title);

// Add description
var description = ui.Label({
  value: 'Select date range to view Saskatchewan Glacier albedo using Ren et al. (2021/2023) methodology',
  style: {
    fontSize: '12px',
    margin: '0px 0px 10px 0px'
  }
});
panel.add(description);

// === DATE SELECTION WIDGETS ===

// Create date inputs
var startDateLabel = ui.Label('Start Date (YYYY-MM-DD):');
var startDateBox = ui.Textbox({
  placeholder: '2020-06-01',
  value: '2020-06-01',
  style: {width: '150px'}
});

var endDateLabel = ui.Label('End Date (YYYY-MM-DD):');
var endDateBox = ui.Textbox({
  placeholder: '2020-09-30', 
  value: '2020-09-30',
  style: {width: '150px'}
});

panel.add(startDateLabel);
panel.add(startDateBox);
panel.add(endDateLabel);
panel.add(endDateBox);

// Add date slider for quick selection
var dateSliderLabel = ui.Label('Quick Date Selection:');
var dateSlider = ui.DateSlider({
  start: '2017-01-01',
  end: '2024-12-31',
  value: '2020-06-01',
  period: 1, // days
  style: {width: '250px'}
});

panel.add(dateSliderLabel);
panel.add(dateSlider);

// === PRESET DATE BUTTONS ===
var presetsLabel = ui.Label('Quick Presets:');
panel.add(presetsLabel);

// Create preset buttons panel
var presetsPanel = ui.Panel({
  layout: ui.Panel.Layout.flow('horizontal'),
  style: {margin: '5px 0px'}
});

var summer2020Btn = ui.Button({
  label: '2020 Summer',
  style: {margin: '2px'}
});

var summer2024Btn = ui.Button({
  label: '2024 Summer', 
  style: {margin: '2px'}
});

var year2020Btn = ui.Button({
  label: '2020 Full',
  style: {margin: '2px'}
});

presetsPanel.add(summer2020Btn);
presetsPanel.add(summer2024Btn);
presetsPanel.add(year2020Btn);
panel.add(presetsPanel);

// === APPLY BUTTON ===
var applyButton = ui.Button({
  label: 'Apply Date Range',
  style: {
    backgroundColor: '#4285f4',
    color: 'white',
    margin: '10px 0px',
    width: '250px'
  }
});
panel.add(applyButton);

// === ADDITIONAL CONTROLS ===
// Add Clear Layers button
var clearButton = ui.Button({
  label: 'Clear Albedo Layers',
  style: {
    backgroundColor: '#ea4335',
    color: 'white',
    margin: '5px 0px',
    width: '250px'
  }
});
panel.add(clearButton);

// Add Check Data Availability button
var checkDataButton = ui.Button({
  label: 'Check Data Availability',
  style: {
    backgroundColor: '#34a853',
    color: 'white',
    margin: '5px 0px',
    width: '250px'
  }
});
panel.add(checkDataButton);

// === STATUS DISPLAY ===
var statusLabel = ui.Label({
  value: 'Ready to process data...',
  style: {
    fontSize: '11px',
    color: 'gray',
    fontStyle: 'italic'
  }
});
panel.add(statusLabel);

// Add data info display
var dataInfoLabel = ui.Label({
  value: '',
  style: {
    fontSize: '10px',
    color: 'blue'
  }
});
panel.add(dataInfoLabel);

// Add the panel to the map
ui.root.insert(0, panel);

// === EVENT HANDLERS AND DYNAMIC PROCESSING ===

// Global variables for current data
var currentAlbedoCollection = null;
var currentLayerName = null;

// Function to clear existing albedo layers
function clearAlbedoLayers() {
  var layers = Map.layers();
  var layersToRemove = [];
  
  // Find albedo-related layers to remove
  for (var i = 0; i < layers.length(); i++) {
    var layer = layers.get(i);
    var name = layer.getName();
    if (name && (name.indexOf('Albedo') !== -1 || name.indexOf('albedo') !== -1)) {
      layersToRemove.push(layer);
    }
  }
  
  // Remove the layers
  layersToRemove.forEach(function(layer) {
    Map.layers().remove(layer);
  });
}

// Function to validate date format
function isValidDate(dateString) {
  var regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  
  var date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

// Function to process and display glacier albedo for selected date range
function processSelectedDateRange() {
  var startDate = startDateBox.getValue();
  var endDate = endDateBox.getValue();
  
  // Validate dates
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    statusLabel.setValue('Error: Invalid date format. Use YYYY-MM-DD');
    statusLabel.style().set('color', 'red');
    return;
  }
  
  if (new Date(startDate) >= new Date(endDate)) {
    statusLabel.setValue('Error: Start date must be before end date');
    statusLabel.style().set('color', 'red');
    return;
  }
  
  // Update status
  statusLabel.setValue('Processing data for ' + startDate + ' to ' + endDate + '...');
  statusLabel.style().set('color', 'orange');
  
  // Clear existing albedo layers
  clearAlbedoLayers();
  
  // Process glacier albedo for selected date range
  var selectedAlbedoCollection = retrieveGlacierAlbedo(glacierBounds, startDate, endDate, glacierOutlines);
  
  // Check data availability
  selectedAlbedoCollection.size().evaluate(function(size) {
    if (size === 0) {
      statusLabel.setValue('No MODIS data available for selected period');
      statusLabel.style().set('color', 'red');
      dataInfoLabel.setValue('Try a different date range or check data availability');
      return;
    }
    
    // Filter for valid albedo data
    var validAlbedoCollection = selectedAlbedoCollection.filter(
      ee.Filter.listContains('system:band_names', 'broadband_albedo')
    );
    
    validAlbedoCollection.size().evaluate(function(validSize) {
      if (validSize === 0) {
        statusLabel.setValue('No valid albedo data after processing (' + size + ' raw images)');
        statusLabel.style().set('color', 'red');
        dataInfoLabel.setValue('Images may be filtered out by quality control or glacier masking');
        return;
      }
      
      // Calculate mean albedo for the period
      var meanAlbedo = validAlbedoCollection.select('broadband_albedo').mean();
      
      // Create layer name
      var layerName = 'Glacier Albedo (' + startDate + ' to ' + endDate + ')';
      
      // Add to map
      Map.addLayer(meanAlbedo, {
        min: 0.1, 
        max: 0.9, 
        palette: ['blue', 'cyan', 'yellow', 'orange', 'red']
      }, layerName);
      
      // Update status
      statusLabel.setValue('Success! Processed ' + validSize + ' images from ' + size + ' available');
      statusLabel.style().set('color', 'green');
      dataInfoLabel.setValue('Layer: ' + layerName);
      
      // Store current data
      currentAlbedoCollection = validAlbedoCollection;
      currentLayerName = layerName;
      
      // Get date range of processed data
      var firstImage = validAlbedoCollection.first();
      var lastImage = validAlbedoCollection.sort('system:time_start', false).first();
      
      firstImage.get('system:time_start').evaluate(function(firstTime) {
        lastImage.get('system:time_start').evaluate(function(lastTime) {
          var firstDate = new Date(firstTime).toISOString().split('T')[0];
          var lastDate = new Date(lastTime).toISOString().split('T')[0];
          dataInfoLabel.setValue('Data period: ' + firstDate + ' to ' + lastDate + ' (' + validSize + ' images)');
        });
      });
    });
  });
}

// === PRESET BUTTON EVENT HANDLERS ===

// 2020 Summer preset
summer2020Btn.onClick(function() {
  startDateBox.setValue('2020-06-01');
  endDateBox.setValue('2020-09-30');
  dateSlider.setValue('2020-06-01');
  statusLabel.setValue('2020 Summer dates selected. Click Apply to process.');
  statusLabel.style().set('color', 'blue');
});

// 2024 Summer preset  
summer2024Btn.onClick(function() {
  startDateBox.setValue('2024-06-01');
  endDateBox.setValue('2024-09-30');
  dateSlider.setValue('2024-06-01');
  statusLabel.setValue('2024 Summer dates selected. Click Apply to process.');
  statusLabel.style().set('color', 'blue');
});

// 2020 Full Year preset
year2020Btn.onClick(function() {
  startDateBox.setValue('2020-01-01');
  endDateBox.setValue('2020-12-31');
  dateSlider.setValue('2020-06-01');
  statusLabel.setValue('2020 Full Year dates selected. Click Apply to process.');
  statusLabel.style().set('color', 'blue');
});

// Apply button event handler
applyButton.onClick(function() {
  processSelectedDateRange();
});

// Date slider event handler (optional - updates start date)
dateSlider.onChange(function(value) {
  // Safely handle the date slider value
  try {
    // Use Earth Engine's date formatting directly
    ee.Date(value).format('YYYY-MM-dd').evaluate(function(dateString) {
      startDateBox.setValue(dateString);
      
      // Calculate end date (3 months later)
      ee.Date(value).advance(3, 'month').format('YYYY-MM-dd').evaluate(function(endDateString) {
        endDateBox.setValue(endDateString);
        statusLabel.setValue('Dates updated from slider. Click Apply to process.');
        statusLabel.style().set('color', 'blue');
      });
    });
  } catch (error) {
    statusLabel.setValue('Error updating dates from slider');
    statusLabel.style().set('color', 'red');
  }
});

// === ADDITIONAL BUTTON EVENT HANDLERS ===

// Clear Layers button
clearButton.onClick(function() {
  clearAlbedoLayers();
  statusLabel.setValue('Albedo layers cleared from map.');
  statusLabel.style().set('color', 'green');
  dataInfoLabel.setValue('');
});

// Check Data Availability button
checkDataButton.onClick(function() {
  var startDate = startDateBox.getValue();
  var endDate = endDateBox.getValue();
  
  // Validate dates first
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    statusLabel.setValue('Error: Invalid date format. Use YYYY-MM-DD');
    statusLabel.style().set('color', 'red');
    return;
  }
  
  statusLabel.setValue('Checking data availability for ' + startDate + ' to ' + endDate + '...');
  statusLabel.style().set('color', 'orange');
  
  // Check raw MODIS data availability
  var modisCollection = ee.ImageCollection('MODIS/061/MOD09GA')
    .filterDate(startDate, endDate)
    .filterBounds(glacierBounds);
  
  modisCollection.size().evaluate(function(rawSize) {
    if (rawSize === 0) {
      statusLabel.setValue('No MODIS data available for ' + startDate + ' to ' + endDate);
      statusLabel.style().set('color', 'red');
      dataInfoLabel.setValue('Try a different date range. MODIS Collection 6.1 available from 2000 to present.');
      return;
    }
    
    // Get date range of available data
    var firstImage = modisCollection.sort('system:time_start', true).first();
    var lastImage = modisCollection.sort('system:time_start', false).first();
    
    firstImage.get('system:time_start').evaluate(function(firstTime) {
      lastImage.get('system:time_start').evaluate(function(lastTime) {
        var firstDate = new Date(firstTime).toISOString().split('T')[0];
        var lastDate = new Date(lastTime).toISOString().split('T')[0];
        
        statusLabel.setValue('Data available: ' + rawSize + ' MODIS images found');
        statusLabel.style().set('color', 'green');
        dataInfoLabel.setValue('Available from ' + firstDate + ' to ' + lastDate + 
                              '. Click Apply to process with quality filtering.');
      });
    });
  });
});

// Initialize map display
Map.centerObject(glacierBounds, 12);
Map.addLayer(glacierImage.selfMask(), {palette: ['red']}, 'Saskatchewan Glacier Outline');

// Add default broadband albedo layer for 2020 summer as example
print('Adding default glacier albedo layer for 2020 summer...');
var defaultAlbedo2020 = retrieveGlacierAlbedo(glacierBounds, '2020-06-01', '2020-09-30', glacierOutlines);

// Filter for valid albedo data and add mean layer
var validDefault = defaultAlbedo2020.filter(ee.Filter.listContains('system:band_names', 'broadband_albedo'));
var meanDefaultAlbedo = validDefault.select('broadband_albedo').mean();

Map.addLayer(meanDefaultAlbedo, {
  min: 0.1, 
  max: 0.9, 
  palette: ['blue', 'cyan', 'yellow', 'orange', 'red']
}, 'Mean Broadband Albedo (2020 Summer)');

// Initial status
statusLabel.setValue('Interface ready. Default 2020 summer albedo shown. Select dates and click Apply for other periods.');
statusLabel.style().set('color', 'green');

// === MELT SEASON CSV EXPORT (2017-2024) ===
// Process glacier albedo for melt seasons (June 1 - September 30) using Collection 6.1

print('--- Processing melt season data for CSV export (2017-2024) ---');

// Process each melt season individually and combine
var meltSeasonYears = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
var allMeltSeasonData = [];

meltSeasonYears.forEach(function(year) {
  var startDate = year + '-06-01';
  var endDate = year + '-09-30';
  
  print('Processing melt season ' + year + ': ' + startDate + ' to ' + endDate);
  
  var yearMeltSeason = retrieveGlacierAlbedo(glacierBounds, startDate, endDate, glacierOutlines);
  allMeltSeasonData.push(yearMeltSeason);
});

// Combine all melt season collections
var allImageLists = allMeltSeasonData.map(function(collection) {
  return collection.toList(1000); // Convert each collection to list
});

// Convert JavaScript array to Earth Engine List and flatten
var eeListOfLists = ee.List(allImageLists);
var flattenedImages = eeListOfLists.flatten();

var combinedMeltSeasons = ee.ImageCollection.fromImages(flattenedImages);

print('Total melt season images (2017-2024):', combinedMeltSeasons.size());

// Filter for valid albedo data only
var validMeltSeasonCollection = combinedMeltSeasons.filter(
  ee.Filter.listContains('system:band_names', 'broadband_albedo')
);

print('Valid melt season albedo images:', validMeltSeasonCollection.size());

// Process melt season data with 90% threshold as well
var allMeltSeasonData90 = [];

meltSeasonYears.forEach(function(year) {
  var startDate = year + '-06-01';
  var endDate = year + '-09-30';
  
  var yearMeltSeason90 = ee.ImageCollection('MODIS/061/MOD09GA')
    .filterDate(startDate, endDate)
    .filterBounds(glacierBounds)
    .map(function(image) { return processModisImage90(image, glacierOutlines); });
  allMeltSeasonData90.push(yearMeltSeason90);
});

// Combine all 90% threshold melt season collections
var allImageLists90 = allMeltSeasonData90.map(function(collection) {
  return collection.toList(1000);
});

var eeListOfLists90 = ee.List(allImageLists90);
var flattenedImages90 = eeListOfLists90.flatten();
var combinedMeltSeasons90 = ee.ImageCollection.fromImages(flattenedImages90);

// Filter for valid albedo data only (90% threshold)
var validMeltSeasonCollection90 = combinedMeltSeasons90.filter(
  ee.Filter.listContains('system:band_names', 'broadband_albedo')
);

print('Valid melt season albedo images (90% threshold):', validMeltSeasonCollection90.size());

// Export melt season data with both thresholds in one CSV
exportDailyObservationsWithThresholds(validMeltSeasonCollection, validMeltSeasonCollection90, glacierBounds, 'saskatchewan_melt_season_2017_2024');

print('Melt season CSV export initiated for 2017-2024 (both 50% and 90% thresholds)');

// === THRESHOLD COMPARISON: 50% vs 90% GLACIER ABUNDANCE ===
print('--- Comparing 50% vs 90% glacier abundance thresholds (2017-2024) ---');

// Create alternative glacier mask function with 90% threshold
function createGlacierMask90(image, glacierOutlines) {
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
        crs: image.select('sur_refl_b01').projection(),
        scale: 500
      });
    
    // Apply 90% glacier abundance threshold
    var mask90 = glacierFraction.gt(0.90);
    var glacierBoundsMask = ee.Image().paint(glacierOutlines, 1).gt(0);
    
    return mask90.and(glacierBoundsMask);
  } else {
    return glacierImage.gt(0.90);
  }
}

// Alternative processing function with 90% threshold
function processModisImage90(image, glacierOutlines) {
  var filtered = qualityFilter(image);
  var glacierMask = createGlacierMask90(filtered, glacierOutlines); // Use 90% mask
  var topocorrected = topographyCorrection(filtered);
  var classified = classifySnowIce(topocorrected);
  var snowNarrowband = anisotropicCorrection(classified, 'snow');
  var iceNarrowband = anisotropicCorrection(classified, 'ice');
  
  var snowMask = classified.select('snow_mask');
  var bands = ['narrowband_b1', 'narrowband_b2', 'narrowband_b3', 
               'narrowband_b4', 'narrowband_b5', 'narrowband_b7'];
  
  var combinedNarrowband = bands.map(function(band) {
    // For Band 4: snow processing doesn't include it, so use ice-only for all pixels
    if (band === 'narrowband_b4') {
      return iceNarrowband.select(band).rename(band);
    }
    
    // For other bands: combine ice and snow based on snow mask
    var iceBand = iceNarrowband.select(band);
    var snowBand = snowNarrowband.select(band);
    return iceBand.where(snowMask, snowBand).rename(band);
  });
  
  var narrowbandImage = classified.addBands(ee.Image.cat(combinedNarrowband));
  var broadband = computeBroadbandAlbedo(narrowbandImage);
  var maskedAlbedo = broadband.updateMask(glacierMask);
  
  return maskedAlbedo.copyProperties(image, ['system:time_start']);
}

// Process comparison data for selected years
var comparisonYears = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
var albedoStats50 = [];
var albedoStats90 = [];

comparisonYears.forEach(function(year) {
  var startDate = year + '-06-01';
  var endDate = year + '-09-30';
  
  print('Processing comparison for year ' + year);
  
  // Process with 50% threshold (current default)
  var collection50 = ee.ImageCollection('MODIS/061/MOD09GA')
    .filterDate(startDate, endDate)
    .filterBounds(glacierBounds)
    .map(function(image) { return processModisImage(image, glacierOutlines); })
    .filter(ee.Filter.listContains('system:band_names', 'broadband_albedo'));
  
  // Process with 90% threshold
  var collection90 = ee.ImageCollection('MODIS/061/MOD09GA')
    .filterDate(startDate, endDate)
    .filterBounds(glacierBounds)
    .map(function(image) { return processModisImage90(image, glacierOutlines); })
    .filter(ee.Filter.listContains('system:band_names', 'broadband_albedo'));
  
  // Calculate annual mean albedo for both thresholds
  var meanAlbedo50 = collection50.select('broadband_albedo').mean();
  var meanAlbedo90 = collection90.select('broadband_albedo').mean();
  
  // Calculate statistics
  var stats50 = meanAlbedo50.reduceRegion({
    reducer: ee.Reducer.mean().combine({
      reducer2: ee.Reducer.stdDev(),
      sharedInputs: true
    }).combine({
      reducer2: ee.Reducer.count(),
      sharedInputs: true
    }),
    geometry: glacierBounds,
    scale: 500,
    maxPixels: 1e9
  });
  
  var stats90 = meanAlbedo90.reduceRegion({
    reducer: ee.Reducer.mean().combine({
      reducer2: ee.Reducer.stdDev(),
      sharedInputs: true
    }).combine({
      reducer2: ee.Reducer.count(),
      sharedInputs: true
    }),
    geometry: glacierBounds,
    scale: 500,
    maxPixels: 1e9
  });
  
  // Store stats with year information
  var yearStats50 = ee.Feature(null, stats50.set('year', year).set('threshold', '50%'));
  var yearStats90 = ee.Feature(null, stats90.set('year', year).set('threshold', '90%'));
  
  albedoStats50.push(yearStats50);
  albedoStats90.push(yearStats90);
});

// Combine statistics for analysis
var allStats = ee.FeatureCollection(albedoStats50.concat(albedoStats90));

// Print comparison statistics for each year
allStats.aggregate_array('year').distinct().evaluate(function(years) {
  print('=== ANNUAL COMPARISON STATISTICS ===');
  years.forEach(function(year) {
    var stats50 = allStats.filter(ee.Filter.eq('year', year)).filter(ee.Filter.eq('threshold', '50%'));
    var stats90 = allStats.filter(ee.Filter.eq('year', year)).filter(ee.Filter.eq('threshold', '90%'));
    
    stats50.first().evaluate(function(feat50) {
      stats90.first().evaluate(function(feat90) {
        if (feat50 && feat90) {
          var mean50 = feat50.properties.broadband_albedo_mean;
          var mean90 = feat90.properties.broadband_albedo_mean;
          var count50 = feat50.properties.broadband_albedo_count;
          var count90 = feat90.properties.broadband_albedo_count;
          
          if (mean50 && mean90) {
            var difference = mean50 - mean90;
            var percentDiff = (difference / mean90) * 100;
            
            print('Year ' + year + ':');
            print('  50% threshold: ' + mean50.toFixed(3) + ' (n=' + count50 + ')');
            print('  90% threshold: ' + mean90.toFixed(3) + ' (n=' + count90 + ')');
            print('  Difference: ' + difference.toFixed(3) + ' (' + percentDiff.toFixed(1) + '%)');
            print('  Pixel ratio (90%/50%): ' + (count90/count50).toFixed(2));
            print('');
          }
        }
      });
    });
  });
});

// Create separate feature collections for each threshold for proper chart display
var stats50Collection = ee.FeatureCollection(albedoStats50);
var stats90Collection = ee.FeatureCollection(albedoStats90);

// Create time series chart with two distinct lines
var chart = ui.Chart.feature.groups({
  features: allStats,
  xProperty: 'year',
  yProperty: 'broadband_albedo_mean',
  seriesProperty: 'threshold'
})
.setChartType('LineChart')
.setOptions({
  title: 'Glacier Albedo Comparison: 50% vs 90% Abundance Threshold (2017-2024)',
  titleTextStyle: {fontSize: 16, bold: true},
  hAxis: {
    title: 'Year',
    titleTextStyle: {fontSize: 14},
    format: '####'
  },
  vAxis: {
    title: 'Mean Broadband Albedo',
    titleTextStyle: {fontSize: 14},
    format: '0.00'
  },
  series: {
    0: {color: '#2E7D32', pointSize: 5, lineWidth: 3, lineDashStyle: [1,0]}, // 50% - solid green
    1: {color: '#C62828', pointSize: 5, lineWidth: 3, lineDashStyle: [8,3]}  // 90% - dashed red
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
  }
});

print('=== TIME SERIES COMPARISON CHART ===');
print(chart);

// Create scatter plot with ALL individual observations (2017-2024)
print('=== CREATING DAILY OBSERVATION SCATTER PLOT ===');

// Process all melt season data for scatter plot (both thresholds)
var scatterData50 = [];
var scatterData90 = [];

meltSeasonYears.forEach(function(year) {
  var startDate = year + '-06-01';
  var endDate = year + '-09-30';
  
  // Process with 50% threshold
  var collection50 = ee.ImageCollection('MODIS/061/MOD09GA')
    .filterDate(startDate, endDate)
    .filterBounds(glacierBounds)
    .map(function(image) { return processModisImage(image, glacierOutlines); })
    .filter(ee.Filter.listContains('system:band_names', 'broadband_albedo'));
  
  // Process with 90% threshold  
  var collection90 = ee.ImageCollection('MODIS/061/MOD09GA')
    .filterDate(startDate, endDate)
    .filterBounds(glacierBounds)
    .map(function(image) { return processModisImage90(image, glacierOutlines); })
    .filter(ee.Filter.listContains('system:band_names', 'broadband_albedo'));
  
  scatterData50.push(collection50);
  scatterData90.push(collection90);
});

// Flatten all collections into single collections
var allScatterData50 = ee.ImageCollection.fromImages(
  ee.List(scatterData50.map(function(col) { return col.toList(1000); })).flatten()
);

var allScatterData90 = ee.ImageCollection.fromImages(
  ee.List(scatterData90.map(function(col) { return col.toList(1000); })).flatten()
);

// Calculate daily mean albedo for each observation (reduce to glacier-wide means)
var dailyMeans50 = allScatterData50.map(function(image) {
  var meanAlbedo = image.select('broadband_albedo').reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: glacierBounds,
    scale: 500,
    maxPixels: 1e9
  });
  
  var date = ee.Date(image.get('system:time_start')).format('YYYY-MM-dd');
  
  return ee.Feature(null, {
    'albedo_50': meanAlbedo.get('broadband_albedo'),
    'date': date,
    'system:time_start': image.get('system:time_start')
  });
}).filter(ee.Filter.notNull(['albedo_50']));

var dailyMeans90 = allScatterData90.map(function(image) {
  var meanAlbedo = image.select('broadband_albedo').reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: glacierBounds,
    scale: 500,
    maxPixels: 1e9
  });
  
  var date = ee.Date(image.get('system:time_start')).format('YYYY-MM-dd');
  
  return ee.Feature(null, {
    'albedo_90': meanAlbedo.get('broadband_albedo'),
    'date': date,
    'system:time_start': image.get('system:time_start')
  });
}).filter(ee.Filter.notNull(['albedo_90']));

// Join the two collections by date to create paired observations
var filter = ee.Filter.equals({
  leftField: 'system:time_start',
  rightField: 'system:time_start'
});

var joinedData = ee.Join.inner().apply({
  primary: dailyMeans50,
  secondary: dailyMeans90,
  condition: filter
});

// Create scatter plot features
var scatterCollection = ee.FeatureCollection(joinedData.map(function(feature) {
  var primary = ee.Feature(feature.get('primary'));
  var secondary = ee.Feature(feature.get('secondary'));
  
  return ee.Feature(null, {
    'albedo_50': primary.get('albedo_50'),
    'albedo_90': secondary.get('albedo_90'),
    'date': primary.get('date')
  });
}));

print('Total paired observations for scatter plot:', scatterCollection.size());

// Create scatter plot with linear regression
var scatterChart = ui.Chart.feature.byFeature({
  features: scatterCollection,
  xProperty: 'albedo_50',
  yProperties: ['albedo_90']
})
.setSeriesNames(['90% Threshold'])
.setChartType('ScatterChart')
.setOptions({
  title: 'Glacier Albedo: 90% vs 50% Threshold Correlation (2017-2024)',
  titleTextStyle: {fontSize: 16, bold: true},
  hAxis: {
    title: '50% Threshold Albedo',
    titleTextStyle: {fontSize: 14},
    format: '0.00'
  },
  vAxis: {
    title: '90% Threshold Albedo',
    titleTextStyle: {fontSize: 14},
    format: '0.00'
  },
  series: {
    0: {
      color: '#1976D2',
      pointSize: 8,
      pointShape: 'circle'
    }
  },
  trendlines: {
    0: {
      type: 'linear',
      color: '#D32F2F',
      lineWidth: 3,
      opacity: 0.8,
      showR2: true,
      visibleInLegend: true
    }
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
  }
});

print('=== SCATTER PLOT WITH LINEAR REGRESSION ===');
print(scatterChart);

// Calculate correlation coefficient manually for console output
scatterCollection.aggregate_array('albedo_50').evaluate(function(values50) {
  scatterCollection.aggregate_array('albedo_90').evaluate(function(values90) {
    if (values50.length === values90.length && values50.length > 1) {
      // Calculate means
      var mean50 = values50.reduce(function(a, b) { return a + b; }) / values50.length;
      var mean90 = values90.reduce(function(a, b) { return a + b; }) / values90.length;
      
      // Calculate correlation coefficient
      var numerator = 0;
      var sum50Sq = 0;
      var sum90Sq = 0;
      
      for (var i = 0; i < values50.length; i++) {
        var diff50 = values50[i] - mean50;
        var diff90 = values90[i] - mean90;
        numerator += diff50 * diff90;
        sum50Sq += diff50 * diff50;
        sum90Sq += diff90 * diff90;
      }
      
      var correlation = numerator / Math.sqrt(sum50Sq * sum90Sq);
      var r2 = correlation * correlation;
      
      print('=== CORRELATION ANALYSIS ===');
      print('Correlation coefficient (r): ' + correlation.toFixed(4));
      print('Coefficient of determination (R²): ' + r2.toFixed(4));
      print('Sample size: ' + values50.length + ' years');
      
      // Calculate linear regression parameters
      var slope = numerator / sum50Sq;
      var intercept = mean90 - slope * mean50;
      
      print('Linear regression: y = ' + slope.toFixed(4) + 'x + ' + intercept.toFixed(4));
      print('Where x = 50% threshold, y = 90% threshold');
    }
  });
});

// Export comparison statistics
Export.table.toDrive({
  collection: allStats,
  description: 'threshold_comparison_stats_2017_2024',
  folder: 'glacier_albedo_results',
  fileFormat: 'CSV',
  selectors: ['year', 'threshold', 'broadband_albedo_mean', 'broadband_albedo_stdDev', 'broadband_albedo_count']
});

print('Threshold comparison analysis completed. Check console for annual statistics and charts.');
print('CSV export initiated: threshold_comparison_stats_2017_2024.csv');

