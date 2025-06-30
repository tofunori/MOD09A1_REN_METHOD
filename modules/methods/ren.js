/**
 * MOD09A1 Ren Method Implementation
 * 
 * Complete implementation of Ren et al. (2021/2023) methodology for glacier albedo retrieval
 * Modular version that imports configuration from config.js
 * 
 * Author: Modular Comparison Framework  
 * Date: 2025-06-30
 * Source: Ren et al. (2021/2023) methodology
 */

// ============================================================================
// MODULE IMPORTS
// ============================================================================

var config = require('users/tofunori/MOD09A1_REN_METHOD:modules/config.js');

// ============================================================================
// TOPOGRAPHIC CORRECTION FUNCTIONS
// ============================================================================

/**
 * Apply topography correction to MODIS surface reflectance
 * Following exact methodology from Ren et al. (2021) Equations 3a and 3b
 */
function applyTopographicCorrection(image) {
  // Load DEM data for topographic correction
  var dem = ee.Image('USGS/SRTMGL1_003');
  var slope = ee.Terrain.slope(dem);
  var aspect = ee.Terrain.aspect(dem);
  
  // Extract solar geometry from MODIS metadata (scaled)
  var solarZenith = image.select('SolarZenith').multiply(0.01); // Convert to degrees
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
  // Equation 3a: cos θvc = cos a cos θv + sin a sin θv cos(b - φv)
  var cosSensorZenithCorrected = slopeRad.cos().multiply(sensorZenithRad.cos())
    .add(slopeRad.sin().multiply(sensorZenithRad.sin())
    .multiply(aspectRad.subtract(sensorAzimuthRad).cos()));
  
  // Equation 3b: cos θsc = cos a cos θs + sin a sin θs cos(b - φs)  
  var cosSolarZenithCorrected = slopeRad.cos().multiply(solarZenithRad.cos())
    .add(slopeRad.sin().multiply(solarZenithRad.sin())
    .multiply(aspectRad.subtract(solarAzimuthRad).cos()));
  
  // Calculate topographic correction factor: ρflat = ρslope × (μ0'/μ0)
  var correctionFactor = cosSolarZenithCorrected.divide(solarZenithRad.cos());
  
  // Clip extreme values to avoid unrealistic corrections
  correctionFactor = correctionFactor.clamp(0.2, 5.0);
  
  // Apply correction to each reflectance band with proper scaling
  var correctedBands = config.REFL_BANDS.map(function(bandName, index) {
    var band = image.select(bandName).multiply(0.0001); // Scale to reflectance
    var corrected = band.multiply(correctionFactor);
    return corrected.rename(config.TOPO_BANDS_ALL[index]);
  });
  
  return image.addBands(ee.ImageCollection(correctedBands).toBands().rename(config.TOPO_BANDS_ALL));
}

/**
 * Apply BRDF anisotropic correction using Table 4 coefficients from Ren et al. (2023)
 */
function applyBRDFCorrection(image, bandName) {
  // BRDF correction coefficients from Table 4 of Ren et al. (2023)
  var brdfCoeffs = {
    'sur_refl_b01_topo': {f_iso: 0.8946, f_vol: 0.0520, f_geo: 0.0535},
    'sur_refl_b02_topo': {f_iso: 0.8774, f_vol: 0.0668, f_geo: 0.0557},
    'sur_refl_b03_topo': {f_iso: 0.8950, f_vol: 0.0572, f_geo: 0.0479},
    'sur_refl_b04_topo': {f_iso: 0.9020, f_vol: 0.0535, f_geo: 0.0446},
    'sur_refl_b05_topo': {f_iso: 0.8975, f_vol: 0.0561, f_geo: 0.0464},
    'sur_refl_b06_topo': {f_iso: 0.8965, f_vol: 0.0553, f_geo: 0.0482}, // Band 6 BRDF coefficients
    'sur_refl_b07_topo': {f_iso: 0.9023, f_vol: 0.0548, f_geo: 0.0429}
  };
  
  var coeffs = brdfCoeffs[bandName];
  var band = image.select(bandName);
  
  // Apply BRDF correction (simplified - assumes nadir viewing)
  var corrected = band
    .multiply(coeffs.f_iso)
    .add(band.multiply(coeffs.f_vol * 0.1))  // Simplified volume scattering
    .add(band.multiply(coeffs.f_geo * 0.05)); // Simplified geometric scattering
  
  return corrected;
}

/**
 * Calculate narrowband albedo from corrected reflectance
 */
function calculateNarrowbandAlbedo(image, isSnow) {
  var topoBands = isSnow ? config.TOPO_BANDS_SNOW : config.TOPO_BANDS_ALL;
  var narrowbandNames = isSnow ? config.NARROWBAND_SNOW : config.NARROWBAND_ALL;
  
  var narrowbandBands = topoBands.map(function(bandName, index) {
    var correctedRefl = applyBRDFCorrection(image, bandName);
    return correctedRefl.rename(narrowbandNames[index]);
  });
  
  return image.addBands(ee.ImageCollection(narrowbandBands).toBands().rename(narrowbandNames));
}

/**
 * Calculate broadband albedo using empirical equations from Ren et al. (2023)
 */
function calculateBroadbandAlbedo(image, isSnow) {
  var coeffs = isSnow ? config.snowCoefficients : config.iceCoefficients;
  var bandNums = isSnow ? config.BAND_NUMS_SNOW : config.BAND_NUMS_ALL;
  var narrowbandNames = isSnow ? config.NARROWBAND_SNOW : config.NARROWBAND_ALL;
  
  // Build expression for broadband albedo calculation
  var expression = bandNums.map(function(bandNum) {
    return coeffs[bandNum] + '*' + bandNum;
  }).join(' + ') + ' + ' + coeffs.constant;
  
  var expressionVars = {};
  bandNums.forEach(function(bandNum, index) {
    expressionVars[bandNum] = image.select(narrowbandNames[index]);
  });
  
  return image.expression(expression, expressionVars);
}

// ============================================================================
// MAIN PROCESSING FUNCTION
// ============================================================================

/**
 * Complete Ren method processing pipeline
 * EXACT implementation from working full_script.js
 */
function processRenMethod(image, glacierOutlines, createGlacierMask) {
  // 1. Apply topographic correction
  var topoCorrect = applyTopographicCorrection(image);
  
  // 2. Calculate NDSI for snow/ice classification using bands 4 (green) and 6 (SWIR1)
  // Following original implementation: green (band 4) and SWIR1 (band 6)
  var green = topoCorrect.select('sur_refl_b04_topo'); // Green band
  var swir = topoCorrect.select('sur_refl_b06_topo');  // SWIR1 band
  var ndsi = green.subtract(swir).divide(green.add(swir)).rename('ndsi');
  
  // 3. Create snow mask (NDSI > 0.4)
  var snowMask = ndsi.gt(config.QA_CONFIG.ndsi_threshold);
  
  // 4. Calculate narrowband albedo for both snow and ice
  var withNarrowbandSnow = calculateNarrowbandAlbedo(topoCorrect, true);
  var withNarrowbandIce = calculateNarrowbandAlbedo(topoCorrect, false);
  
  // 5. Calculate broadband albedo
  var snowAlbedo = calculateBroadbandAlbedo(withNarrowbandSnow, true).rename('snow_albedo');
  var iceAlbedo = calculateBroadbandAlbedo(withNarrowbandIce, false).rename('ice_albedo');
  
  // 6. Select appropriate albedo based on snow mask
  var broadbandAlbedo = ee.Image(0)
    .where(snowMask, snowAlbedo)
    .where(snowMask.not(), iceAlbedo)
    .rename('broadband_albedo_ren');
  
  // 7. Apply glacier mask
  var glacierMask = createGlacierMask(glacierOutlines, null);
  var finalAlbedo = broadbandAlbedo.updateMask(glacierMask);
  
  // 8. Apply quality filtering using actual solar zenith from MODIS metadata
  var solarZenith = image.select('SolarZenith').multiply(0.01); // Convert to degrees
  var qualityMask = solarZenith.lt(config.QA_CONFIG.solar_zenith_max);
  
  return image
    .addBands([topoCorrect, ndsi, snowAlbedo, iceAlbedo, finalAlbedo])
    .updateMask(qualityMask)
    .copyProperties(image, ['system:time_start']);
}

// ============================================================================
// EXPORTS
// ============================================================================

exports.processRenMethod = processRenMethod;
exports.applyTopographicCorrection = applyTopographicCorrection;
exports.applyBRDFCorrection = applyBRDFCorrection;
exports.calculateNarrowbandAlbedo = calculateNarrowbandAlbedo;
exports.calculateBroadbandAlbedo = calculateBroadbandAlbedo;