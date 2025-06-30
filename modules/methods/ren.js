/**
 * MOD09GA Ren Method Implementation - EXACT from full_script.js
 * 
 * Complete implementation of Ren et al. (2021/2023) methodology for glacier albedo retrieval
 * Includes P1/P2 BRDF models, complete QA filtering, and exact mathematical formulations
 * 
 * Author: Modular Comparison Framework  
 * Date: 2025-06-30
 * Source: Ren et al. (2021/2023) methodology - EXACT implementation
 */

// ============================================================================
// MODULE IMPORTS
// ============================================================================

var config = require('users/tofunori/MOD09A1_REN_METHOD:modules/config.js');

// ============================================================================
// QUALITY FILTERING FUNCTIONS (EXACT from full_script.js)
// ============================================================================

/**
 * Complete quality filtering following Ren et al. (2021/2023) methodology
 * Includes all QA filters for perfect scientific alignment
 */
function qualityFilter(image) {
  // Use state_1km QA band for Ren et al. complete filtering
  var qa = image.select('state_1km');
  
  // Cloud state (bits 0-1): only accept clear sky (00) per Ren et al.
  var clearSky = qa.bitwiseAnd(3).eq(0); // Clear sky = 00
  
  // Internal cloud mask (bit 10): reject internal cloudy pixels per Ren et al.
  var clearInternal = qa.bitwiseAnd(1<<10).eq(0);
  
  // Cloud shadow (bit 2): reject cloud shadow pixels per Ren et al.
  var shadowFree = qa.bitwiseAnd(1<<2).eq(0);
  
  // Cirrus detection (bit 8): reject cirrus contaminated pixels per Ren et al.
  var cirrusFree = qa.bitwiseAnd(1<<8).eq(0);
  
  // Land/water flag (bits 3-5): only accept land pixels (001) for glacier studies
  var landOnly = qa.bitwiseAnd(56).rightShift(3).eq(1); // Extract bits 3-5, check if == 1 (land)
  
  // Snow/ice flag (bits 12-13): accept all conditions (Ren processes both snow and ice)
  // Snow confidence: 00=no, 01=maybe, 10=yes, 11=detector saturated
  // We'll classify snow/ice using NDSI instead per Ren methodology
  
  // Solar zenith constraint per Ren et al. (θs < 70°)
  var solarZenith = image.select('SolarZenith').multiply(0.01); // Convert to degrees
  var solarAngleOK = solarZenith.lt(70);
  
  // Combine all QA filters per Ren et al. methodology
  var qualityMask = clearSky
    .and(clearInternal)
    .and(shadowFree)
    .and(cirrusFree)
    .and(landOnly)
    .and(solarAngleOK);
  
  return image.updateMask(qualityMask);
}

// ============================================================================
// TOPOGRAPHIC CORRECTION FUNCTIONS (EXACT from full_script.js)
// ============================================================================

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
  var slopeRad = config.slope.multiply(Math.PI/180);  // a in equations
  var aspectRad = config.aspect.multiply(Math.PI/180); // b in equations
  
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
  // Ren et al. (2021) topographic correction factor: ρflat = ρslope × (μ0'/μ0)
  var correctionFactor = cosSolarZenithCorrected.divide(solarZenithRad.cos());
  
  // Clip extreme values to avoid unrealistic corrections per Ren et al.
  correctionFactor = correctionFactor.clamp(0.2, 5.0);
  
  // Apply topographic correction to each reflectance band with scaling
  var correctedBands = config.REFL_BANDS.map(function(bandName, index) {
    var band = image.select(bandName).multiply(0.0001); // Scale to reflectance
    var corrected = band.multiply(correctionFactor);
    return corrected.rename(config.TOPO_BANDS_ALL[index]);
  });
  
  // Store corrected angles for BRDF correction
  var topoImage = image.addBands(ee.Image.cat(correctedBands))
    .addBands(sensorZenithCorrected.rename('sensor_zenith_corrected'))
    .addBands(solarZenithCorrected.rename('solar_zenith_corrected'));
  
  return topoImage;
}

// ============================================================================
// BRDF ANISOTROPIC CORRECTION (EXACT P1/P2 from full_script.js)
// ============================================================================

/**
 * Apply BRDF anisotropic correction using P1 (snow) and P2 (ice) models
 * EXACT implementation from Ren et al. (2021/2023) Table 4 coefficients
 */
function applyBRDFAnisotropicCorrection(image, surfaceType) {
  // Extract corrected angles from topographic correction
  var sensorZenithCorrected = image.select('sensor_zenith_corrected');
  var sensorAzimuth = image.select('SensorAzimuth').multiply(0.01).multiply(Math.PI/180);
  var solarAzimuth = image.select('SolarAzimuth').multiply(0.01).multiply(Math.PI/180);
  
  // Calculate relative azimuth angle for BRDF correction
  var relativeAzimuth = sensorAzimuth.subtract(solarAzimuth);
  
  // Select BRDF coefficients based on surface type (snow P1 or ice P2)
  var brdfCoefficients;
  if (surfaceType === 'snow') {
    // Snow BRDF coefficients (P1 model) from Table 4 - EXACT VALUES
    brdfCoefficients = {
      b1: {c1: 0.01134, c2: 0.00386, c3: 0.00133, theta_c: 0.22689},
      b2: {c1: 0.01016, c2: 0.00386, c3: 0.00110, theta_c: 0.26632},
      b3: {c1: 0.01097, c2: 0.00421, c3: 0.00125, theta_c: 0.23561},
      b5: {c1: 0.00877, c2: 0.00474, c3: 0.00124, theta_c: 0.40143},
      b7: {c1: 0.00622, c2: 0.01410, c3: 0.01314, theta_c: 0.55261}
    };
  } else {
    // Ice BRDF coefficients (P2 model) from Table 4 - EXACT VALUES
    brdfCoefficients = {
      b1: {c1: -0.00054, c2: 0.00002, c3: 0.00001, theta_c: 0.17600},
      b2: {c1: -0.00924, c2: 0.00033, c3: -0.00005, theta_c: 0.31750},
      b3: {c1: -0.00369, c2: 0.00000, c3: 0.00007, theta_c: 0.27632},
      b4: {c1: -0.02920, c2: -0.00810, c3: 0.00462, theta_c: 0.52360},
      b5: {c1: -0.02388, c2: 0.00656, c3: 0.00227, theta_c: 0.58473},
      b7: {c1: -0.02081, c2: 0.00683, c3: 0.00390, theta_c: 0.575}
    };
  }
  
  // Apply band-specific anisotropic correction: α_i = r - f̃
  // Create band list excluding B4 for snow processing per Ren et al. Table 4
  var bands, bandNums;
  if (surfaceType === 'snow') {
    bands = config.TOPO_BANDS_SNOW;
    bandNums = config.BAND_NUMS_SNOW;
  } else {
    bands = config.TOPO_BANDS_ALL;
    bandNums = config.BAND_NUMS_ALL;
  }
  
  var narrowbandAlbedo = bands.map(function(band, index) {
    var bandNum = bandNums[index];
    var coeff = brdfCoefficients[bandNum];
    
    // Calculate anisotropy factor f̃ using EXACT mathematical formulation
    // From the table: different formulations for P1 (snow) and P2 (ice)
    var anisotropyFactor;
    
    if (surfaceType === 'snow') {
      // P1 model: g1 = θvc², g2 = θvc² cos φ, g3 = θvc² cos² φ
      // f̃ = [c1(g1 + 1/2 - π²/8) + c2*g2 + c3(g3 + 1/4 - π²/16)] * e^(-θvc/θc)
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
      // f̃ = [c1(g1 - 2/3) + c2*g2 + c3(g3 + 1/4 - π²/16)] * e^(-θvc/θc)
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
    // Clamp to [0,1] to prevent physically impossible values from rare anisotropy corrections
    return image.select(band).subtract(anisotropyFactor).clamp(0, 1).rename('narrowband_' + bandNum);
  });
  
  return image.addBands(ee.Image.cat(narrowbandAlbedo));
}

// ============================================================================
// SNOW/ICE CLASSIFICATION (EXACT from full_script.js)
// ============================================================================

/**
 * Classify glacier surface as snow or ice using NDSI threshold
 * Following Ren et al. (2021) methodology with NDSI thresholds
 * Uses topographically corrected reflectances when available (per Ren et al.)
 */
function classifySnowIce(image) {
  // Check if topographically corrected bands are available (Ren et al. recommendation)
  var bandNames = image.bandNames();
  var hasTopoCorrection = bandNames.contains('sur_refl_b04_topo');
  
  var green, swir;
  if (hasTopoCorrection) {
    // Use topographically corrected reflectances (already scaled by 0.0001)
    green = image.select('sur_refl_b04_topo'); // MODIS Band 4 (Green) - topo corrected
    // Fix: Use band 7 instead of non-existent band 6 in MOD09GA
    swir = image.select('sur_refl_b07_topo');  // MODIS Band 7 (SWIR2) - topo corrected
  } else {
    // Fallback to raw reflectances (for backwards compatibility)
    green = image.select('sur_refl_b04').multiply(0.0001); // MODIS Band 4 (Green)
    swir = image.select('sur_refl_b07').multiply(0.0001);  // MODIS Band 7 (SWIR2)
  }
  
  // Calculate NDSI = (Green - SWIR) / (Green + SWIR)
  var ndsi = green.subtract(swir).divide(green.add(swir)).rename('NDSI');
  
  // Apply NDSI threshold for MODIS (0.4) following Girona-Mata et al. and Härer et al.
  var snowMask = ndsi.gt(0.4).rename('snow_mask');
  
  return image.addBands([ndsi, snowMask]);
}

// ============================================================================
// BROADBAND ALBEDO CALCULATION (EXACT from full_script.js)
// ============================================================================

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
  var alphaIce = b1.multiply(config.iceCoefficients.b1)
    .add(b2.multiply(config.iceCoefficients.b2))
    .add(b3.multiply(config.iceCoefficients.b3))
    .add(b4.multiply(config.iceCoefficients.b4))
    .add(b5.multiply(config.iceCoefficients.b5))
    .add(b7.multiply(config.iceCoefficients.b7))
    .add(config.iceCoefficients.constant);
  
  // Calculate snow albedo (Equation 9: αMODIS-snow)
  var alphaSnow = b1.multiply(config.snowCoefficients.b1)
    .add(b2.multiply(config.snowCoefficients.b2))
    .add(b3.multiply(config.snowCoefficients.b3))
    .add(b5.multiply(config.snowCoefficients.b5))
    .add(b7.multiply(config.snowCoefficients.b7))
    .add(config.snowCoefficients.constant);
  
  // Apply NDSI-based classification for final albedo selection
  var snowMask = image.select('snow_mask');
  var broadbandAlbedo = ee.Image(0)
    .where(snowMask, alphaSnow)
    .where(snowMask.not(), alphaIce)
    .rename('broadband_albedo_ren');
  
  return image.addBands([alphaIce.rename('ice_albedo'), alphaSnow.rename('snow_albedo'), broadbandAlbedo]);
}

// ============================================================================
// MAIN PROCESSING FUNCTION (EXACT workflow from full_script.js)
// ============================================================================

/**
 * Complete Ren method processing pipeline - EXACT from full_script.js
 * Implements the complete 3-step methodology with all QA filters
 */
function processRenMethod(image, glacierOutlines, createGlacierMask) {
  // Step 1: Apply complete quality filtering per Ren et al.
  var qualityFiltered = qualityFilter(image);
  
  // Step 2: Apply topographic correction (Equations 3a, 3b)
  var topoCorrect = topographyCorrection(qualityFiltered);
  
  // Step 3: Classify snow/ice using NDSI
  var classified = classifySnowIce(topoCorrect);
  
  // Step 4: Apply BRDF anisotropic correction for both snow and ice
  var withSnowBRDF = applyBRDFAnisotropicCorrection(classified, 'snow');
  var withIceBRDF = applyBRDFAnisotropicCorrection(withSnowBRDF, 'ice');
  
  // Step 5: Calculate broadband albedo using empirical equations
  var withBroadband = computeBroadbandAlbedo(withIceBRDF);
  
  // Step 6: Apply glacier mask
  var glacierMask = createGlacierMask(glacierOutlines, null);
  var finalAlbedo = withBroadband.select('broadband_albedo_ren').updateMask(glacierMask);
  
  return qualityFiltered
    .addBands(withBroadband)
    .addBands(finalAlbedo.rename('broadband_albedo_ren_masked'))
    .copyProperties(image, ['system:time_start']);
}

// ============================================================================
// EXPORTS
// ============================================================================

exports.processRenMethod = processRenMethod;
exports.qualityFilter = qualityFilter;
exports.topographyCorrection = topographyCorrection;
exports.applyBRDFAnisotropicCorrection = applyBRDFAnisotropicCorrection;
exports.classifySnowIce = classifySnowIce;
exports.computeBroadbandAlbedo = computeBroadbandAlbedo;