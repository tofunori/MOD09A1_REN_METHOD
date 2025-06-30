/**
 * MOD09A1 Ren Method Implementation
 * 
 * Complete implementation of Ren et al. (2021/2023) methodology for glacier albedo retrieval
 * COPIED EXACTLY from working full_script.js
 * 
 * Author: Modular Comparison Framework  
 * Date: 2025-06-29
 * Source: Ren et al. (2021/2023) methodology
 */

// ============================================================================
// GLOBAL CONSTANTS (will be imported from constants.js in main script)
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
// TOPOGRAPHIC CORRECTION FUNCTIONS
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
  // Ren et al. (2021) topographic correction factor: ρflat = ρslope × (μ0'/μ0)
  var correctionFactor = cosSolarZenithCorrected.divide(solarZenithRad.cos());
  
  // Clip extreme values to avoid unrealistic corrections per Ren et al.
  correctionFactor = correctionFactor.clamp(0.2, 5.0);
  
  // Apply correction to surface reflectance bands
  var bands = REFL_BANDS;
  
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

// ============================================================================
// BRDF ANISOTROPIC CORRECTION FUNCTIONS
// ============================================================================

/**
 * Apply anisotropic correction following Ren et al. (2021) methodology
 * Exact formula: α_i = r - f̃ (where m = 1)
 * Uses exact BRDF coefficients from Table 4 calibrated from airborne measurements
 */
function anisotropicCorrection(image, surfaceType) {
  // Use topographically corrected angles (θvc and θsc from Equations 3a and 3b)
  var solarZenithCorrected = image.select('SolarZenith_corrected').multiply(Math.PI/180);
  var sensorZenithCorrected = image.select('SensorZenith_corrected').multiply(Math.PI/180);
  // Calculate relative azimuth with proper modulo 2π for angular continuity
  var azimuthDiff = image.select('SolarAzimuth').subtract(image.select('SensorAzimuth'))
    .multiply(0.01).multiply(Math.PI/180);
  var relativeAzimuth = azimuthDiff.subtract(azimuthDiff.divide(2*Math.PI).round().multiply(2*Math.PI)).abs();
  
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
      // MODIS Band 7 (2105-2155nm) → 2130nm coefficients (correct for ice)
      b7: {c1: -0.02081, c2: 0.00683, c3: 0.00390, theta_c: 0.575}
    };
  }
  
  // Apply band-specific anisotropic correction: α_i = r - f̃
  // Create band list excluding B4 for snow processing per Ren et al. Table 4
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
    // Clamp to [0,1] to prevent physically impossible values from rare anisotropy corrections
    return image.select(band).subtract(anisotropyFactor).clamp(0, 1).rename('narrowband_' + bandNum);
  });
  
  return image.addBands(ee.Image.cat(narrowbandAlbedo));
}

// ============================================================================
// SNOW/ICE CLASSIFICATION FUNCTIONS
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
// BROADBAND ALBEDO CALCULATION FUNCTIONS
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
    .rename('broadband_albedo_ren');
  
  return image.addBands([alphaIce.rename('ice_albedo_ren'), 
                        alphaSnow.rename('snow_albedo_ren'),
                        broadbandAlbedo]);
}

// ============================================================================
// QUALITY FILTERING FUNCTIONS
// ============================================================================

/**
 * Complete quality filtering following Ren et al. (2021/2023) methodology
 * Includes all QA filters for perfect scientific alignment
 */
function qualityFilterRen(image) {
  // Use state_1km QA band for Ren et al. complete filtering
  var qa = image.select('state_1km');
  
  // Cloud state (bits 0-1): only accept clear sky (00) per Ren et al.
  var clearSky = qa.bitwiseAnd(0x3).eq(0);
  
  // Internal cloud mask (bit 10): reject internal cloudy pixels per Ren et al.
  var clearInternal = qa.bitwiseAnd(1<<10).eq(0);
  
  // Cloud shadow (bit 2): reject cloud shadow pixels per Ren et al.
  var shadowFree = qa.bitwiseAnd(1<<2).eq(0);
  
  // Cirrus detection (bit 8): reject cirrus contaminated pixels per Ren et al.
  var noCirrus = qa.bitwiseAnd(1<<8).eq(0);
  
  // Snow/ice confidence (bits 12-13): only accept high confidence (11) or unknown (00)
  // Bits 12-13: 00=unknown, 01=no, 10=maybe, 11=yes
  // Accept 00 (unknown) and 11 (high confidence) - reject 01 (no) and 10 (maybe)
  var snowIceConf = qa.bitwiseAnd(0x3000).rightShift(12); // Extract bits 12-13
  var validSnowIce = snowIceConf.eq(0).or(snowIceConf.eq(3)); // Accept 00 or 11
  
  // Solar zenith angle constraint: < 70° per Ren et al.
  var solarZenith = image.select('SolarZenith').multiply(0.01);
  var lowSolarZenith = solarZenith.lt(70);
  
  // Complete Ren et al. quality mask: all filters combined
  var qualityMask = clearSky.and(clearInternal).and(shadowFree)
    .and(noCirrus).and(validSnowIce).and(lowSolarZenith);
  
  return image.updateMask(qualityMask);
}

// ============================================================================
// MAIN PROCESSING FUNCTION
// ============================================================================

/**
 * Process single MODIS image for glacier albedo retrieval
 * Following complete Ren et al. (2021) methodology
 * EXACTLY as implemented in working full_script.js
 */
function processRenMethod(image, glacierOutlines, createGlacierMask) {
  // Apply quality filtering
  var filtered = qualityFilterRen(image);
  
  // Create glacier mask (passed as parameter from common_functions)
  var glacierImage = ee.Image('projects/tofunori/assets/Saskatchewan_glacier_2024_updated');
  var glacierMask = createGlacierMask(glacierOutlines, glacierImage);
  
  // Step 1: Topography correction (BEFORE NDSI per Ren et al. methodology)
  var topocorrected = topographyCorrection(filtered);
  
  // Step 2: Snow/ice classification using NDSI on topographically corrected reflectances
  var classified = classifySnowIce(topocorrected);
  
  // Step 3: Surface-specific anisotropic correction
  // Apply P1 (snow) and P2 (ice) models separately, then combine
  var snowNarrowband = anisotropicCorrection(classified, 'snow');
  var iceNarrowband = anisotropicCorrection(classified, 'ice');
  
  // Combine narrowband albedo based on snow/ice classification
  var snowMask = classified.select('snow_mask');
  var bands = NARROWBAND_ALL;
  
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
  
  // Step 5: Apply glacier mask and return final result
  var maskedAlbedo = broadband.updateMask(glacierMask);
  
  return maskedAlbedo.copyProperties(image, ['system:time_start']);
}

// ============================================================================
// EXPORTS FOR USE IN MAIN SCRIPT
// ============================================================================

// Export the main processing function
exports.processRenMethod = processRenMethod;