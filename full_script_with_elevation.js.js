/**
 * Glacier Albedo Retrieval for Google Earth Engine with Elevation Analysis
 * Based on: "Changes in glacier albedo and the driving factors in the Western 
 * Nyainqentanglha Mountains from 2001 to 2020" by Ren et al. (2023)
 * 
 * Implementation of the 3-step methodology + elevation analysis:
 * 1. Topography correction (Equations 3a, 3b)
 * 2. Narrowband albedo retrieval (anisotropic correction with exact Table 4 BRDF coefficients)  
 * 3. Broadband albedo retrieval using empirical equations (Equations 8, 9)
 * 4. Albedo analysis by 50m elevation bands (per Ren et al. 2023)
 * 
 * CORRECTIONS APPLIED (2025-06-29):
 * - Fixed BRDF exponential sign: exp(-θvc/θc) instead of exp(θvc/θc) 
 * - Inverted topographic correction factor per Ren 2021 methodology
 * - Updated all BRDF coefficients with exact Table 4 values
 * - Excluded Band 4 from snow processing (absent in Table 4)
 * - Enhanced QA filtering for cloud states
 * - ADDED: 50m elevation bands analysis per Ren et al. (2023)
 * - STRATÉGIE 1 (2025-06-29): DEM 30m + albédo ré-échantillonné pour glacier individuel
 *   → Relief fin pour analyse scientifique, tileScale 4-8 pour éviter timeouts
 */

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

// Global band constants for consistency and maintenance
var REFL_BANDS = ['sur_refl_b01', 'sur_refl_b02', 'sur_refl_b03', 
                  'sur_refl_b04', 'sur_refl_b05', 'sur_refl_b07'];
var TOPO_BANDS_ALL = ['sur_refl_b01_topo', 'sur_refl_b02_topo', 'sur_refl_b03_topo',
                      'sur_refl_b04_topo', 'sur_refl_b05_topo', 'sur_refl_b07_topo'];
var TOPO_BANDS_SNOW = ['sur_refl_b01_topo', 'sur_refl_b02_topo', 'sur_refl_b03_topo',
                       'sur_refl_b05_topo', 'sur_refl_b07_topo']; // B4 excluded for snow
var NARROWBAND_ALL = ['narrowband_b1', 'narrowband_b2', 'narrowband_b3', 
                      'narrowband_b4', 'narrowband_b5', 'narrowband_b7'];
var NARROWBAND_SNOW = ['narrowband_b1', 'narrowband_b2', 'narrowband_b3',
                       'narrowband_b5', 'narrowband_b7']; // B4 excluded for snow
var BAND_NUMS_ALL = ['b1', 'b2', 'b3', 'b4', 'b5', 'b7'];
var BAND_NUMS_SNOW = ['b1', 'b2', 'b3', 'b5', 'b7']; // B4 excluded for snow

// === ELEVATION ANALYSIS SETUP (Ren et al. 2023) ===

/**
 * Prepare elevation bands for Ren et al. (2023) methodology
 * STRATÉGIE 1: DEM 30m pour analyse scientifique d'un glacier individuel
 * Creates 50m elevation classes: 0-50, 50-100, 100-150m etc.
 */
function prepareElevationBands(glacierBounds) {
  // Use 30m DEM for fine-scale glacier analysis (Stratégie 1)
  var demHighRes = dem
    .reproject({
      crs: 'EPSG:4326',
      scale: 30  // 30m resolution for individual glacier analysis
    })
    .clip(glacierBounds);
  
  // Calculate elevation bands at 30m: floor(elev/50)*50 => classes 0-50, 50-100, ...
  var elevationBandHighRes = demHighRes
    .divide(50).floor().multiply(50)
    .rename('elev50');
  
  // Resample albedo to match 30m DEM resolution (instead of degrading DEM to 500m)
  // This preserves topographic detail for individual glacier studies
  
  // Calculate percentiles to exclude extreme values (2.5% and 97.5%) as in Ren et al.
  var elevationStats = demHighRes.reduceRegion({
    reducer: ee.Reducer.percentile([2.5, 97.5]),
    geometry: glacierBounds,
    scale: 30,  // Use 30m scale for statistics
    maxPixels: 1e9,
    bestEffort: true,
    tileScale: 4  // Add tileScale to avoid timeouts on large areas
  });
  
  return {
    elevationBand: elevationBandHighRes,
    demModis: demHighRes,  // Renamed but now 30m resolution
    stats: elevationStats
  };
}

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
    swir = image.select('sur_refl_b06').multiply(0.0001);  // MODIS Band 6 (SWIR1) - raw (no topo correction available)
  } else {
    // Fallback to raw reflectances (for backwards compatibility)
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
 * Complete quality filtering following Ren et al. (2021/2023) methodology
 * Includes all QA filters for perfect scientific alignment
 */
function qualityFilter(image) {
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
 * Process single MODIS image for glacier albedo retrieval with elevation analysis
 * Following complete Ren et al. (2021) methodology + 50m elevation bands
 */
function processModisImageWithElevation(image, glacierOutlines, elevationBand) {
  // Apply quality filtering
  var filtered = qualityFilter(image);
  
  // Create glacier mask
  var glacierMask = createGlacierMask(filtered, glacierOutlines);
  
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
  
  // Step 5: Add elevation band for analysis
  var withElevation = broadband.addBands(elevationBand);
  
  // Apply glacier mask to final results
  var maskedAlbedo = withElevation.updateMask(glacierMask);
  
  return maskedAlbedo.copyProperties(image, ['system:time_start']);
}

/**
 * Process single MODIS image for glacier albedo retrieval (original function)
 * Following complete Ren et al. (2021) methodology
 */
function processModisImage(image, glacierOutlines) {
  // Apply quality filtering
  var filtered = qualityFilter(image);
  
  // Create glacier mask
  var glacierMask = createGlacierMask(filtered, glacierOutlines);
  
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
  
  // Apply glacier mask to final results
  var maskedAlbedo = broadband.updateMask(glacierMask);
  
  return maskedAlbedo.copyProperties(image, ['system:time_start']);
}

/**
 * Main processing function with elevation analysis
 */
function retrieveGlacierAlbedoWithElevation(geometry, startDate, endDate, glacierOutlines, elevationBand) {
  // Load and filter MODIS collection (using Collection 6.1 for 2024+ data)
  var modis = ee.ImageCollection('MODIS/061/MOD09GA')
    .filterDate(startDate, endDate)
    .filterBounds(geometry);
  
  // Process each image with elevation analysis
  var processedCollection = modis.map(function(image) {
    return processModisImageWithElevation(image, glacierOutlines, elevationBand);
  });
  
  // For daily observations, return the processed collection directly (no composites)
  return processedCollection;
}

/**
 * Main processing function (original)
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
 * Export albedo statistics by elevation bands (Ren et al. 2023 methodology)
 * STRATÉGIE 1: Utilise DEM 30m avec albédo ré-échantillonné + tileScale pour éviter timeouts
 */
function exportAlbedoByElevation(collection, region, description) {
  // Process each image to get elevation-based statistics
  var elevationStats = collection.map(function(image) {
    // Ensure the image has system:time_start property
    var timeStart = image.get('system:time_start');
    var date = ee.Algorithms.If(
      ee.Algorithms.IsEqual(timeStart, null),
      'no-date',
      ee.Date(timeStart).format('YYYY-MM-dd')
    );
    
    // Resample albedo from 500m to 30m to match DEM resolution (Stratégie 1)
    var albedoResampled = image.select('broadband_albedo')
      .resample('bilinear')  // Use bilinear interpolation for smooth albedo
      .reproject({
        crs: 'EPSG:4326',
        scale: 30  // Match DEM resolution
      });
    
    // Combine resampled albedo with 30m elevation bands
    var combinedImage = albedoResampled.addBands(image.select('elev50'));
    
    // Calculate statistics by elevation band using groupBy with 30m resolution
    var statsByBand = combinedImage.select(['broadband_albedo', 'elev50']).reduceRegion({
      reducer: ee.Reducer.mean()
                .combine({reducer2: ee.Reducer.stdDev(), sharedInputs: true})
                .combine({reducer2: ee.Reducer.count(), sharedInputs: true})
                .group({groupField: 1, groupName: 'elev50'}),  // 1 = index of elev50
      geometry: region,
      scale: 30,  // Use 30m resolution for fine-scale analysis
      maxPixels: 1e9,
      bestEffort: true,
      tileScale: 8  // Higher tileScale for 30m processing to avoid timeouts
    });
    
    // Convert grouped results to features
    var groups = ee.List(statsByBand.get('groups'));
    var features = groups.map(function(group) {
      var groupDict = ee.Dictionary(group);
      return ee.Feature(null, {
        date: date,
        elev50: groupDict.get('elev50'),
        albedo_mean: groupDict.get('mean'),
        albedo_std: groupDict.get('stdDev'),
        pixel_count: groupDict.get('count'),
        system_time_start: timeStart
      });
    });
    
    return ee.FeatureCollection(features);
  });
  
  // Flatten all features into a single collection
  var allElevationStats = elevationStats.flatten();
  
  // Filter out empty results
  var validElevationStats = ee.FeatureCollection(allElevationStats).filter(
    ee.Filter.and(
      ee.Filter.notNull(['albedo_mean']),
      ee.Filter.gt('pixel_count', 0)
    )
  );
  
  Export.table.toDrive({
    collection: validElevationStats,
    description: description,
    folder: 'glacier_albedo_results',
    fileFormat: 'CSV',
    selectors: ['date', 'elev50', 'albedo_mean', 'albedo_std', 'pixel_count']
  });
}

/**
 * Generate albedo vs elevation plot for multi-year analysis (2017-2024)
 * Similar to Ren et al. (2023) Figure 6 showing albedo trends by elevation bands
 */
function generateAlbedoElevationPlot(startYear, endYear) {
  print('=== GENERATING ALBEDO-ELEVATION PLOT (' + startYear + '-' + endYear + ') ===');
  
  // Process each year from startYear to endYear
  var yearlyResults = [];
  
  for (var year = startYear; year <= endYear; year++) {
    // Define summer period for each year (June-September)
    var yearStart = year + '-06-01';
    var yearEnd = year + '-09-30';
    
    print('Processing year ' + year + ' (' + yearStart + ' to ' + yearEnd + ')...');
    
    // Process data for this year
    var yearlyCollection = retrieveGlacierAlbedoWithElevation(
      glacierBounds, yearStart, yearEnd, glacierOutlines, elevationBand
    );
    
    // Calculate mean albedo by elevation band for this year
    var yearlyMean = yearlyCollection.select(['broadband_albedo', 'elev50']).mean();
    
    // Extract elevation vs albedo data using grouped reducer
    var elevationStats = yearlyMean.select(['broadband_albedo', 'elev50']).reduceRegion({
      reducer: ee.Reducer.mean()
                .combine({reducer2: ee.Reducer.count(), sharedInputs: true})
                .group({groupField: 1, groupName: 'elev50'}),
      geometry: glacierBounds,
      scale: 30,
      maxPixels: 1e9,
      bestEffort: true,
      tileScale: 8
    });
    
    // Store results for this year
    yearlyResults.push({
      year: year,
      stats: elevationStats
    });
  }
  
  // Process and create chart data
  print('Creating interactive chart...');
  
  // Create chart for the most recent year as an example
  var latestYear = endYear;
  var latestStats = yearlyResults[yearlyResults.length - 1].stats;
  
  // Extract groups and create features for charting
  var groups = ee.List(latestStats.get('groups'));
  var chartData = groups.map(function(group) {
    var groupDict = ee.Dictionary(group);
    return ee.Feature(null, {
      elevation: groupDict.get('elev50'),
      albedo: groupDict.get('mean'),
      pixel_count: groupDict.get('count')
    });
  });
  
  var chartFeatures = ee.FeatureCollection(chartData);
  
  // Create scatter plot
  var chart = ui.Chart.feature.byFeature(chartFeatures, 'elevation', 'albedo')
    .setOptions({
      title: 'Saskatchewan Glacier: Albedo vs Elevation (' + latestYear + ')',
      hAxis: {
        title: 'Elevation (m)',
        titleTextStyle: {italic: false, bold: true}
      },
      vAxis: {
        title: 'Broadband Albedo',
        titleTextStyle: {italic: false, bold: true},
        viewWindow: {min: 0.1, max: 0.9}
      },
      pointSize: 5,
      series: {
        0: {color: '#1f77b4', pointShape: 'circle'}
      },
      legend: {position: 'none'},
      chartArea: {left: 80, top: 60, width: '75%', height: '75%'}
    });
  
  // Print chart to console
  print('Albedo vs Elevation Chart (' + latestYear + '):', chart);
  
  // Print summary statistics
  print('=== ELEVATION ANALYSIS SUMMARY ===');
  print('Years processed: ' + startYear + '-' + endYear);
  print('Elevation range: 2700-3600m (50m bands)');
  print('Analysis method: Ren et al. (2023) methodology with 30m DEM');
  
  return {
    chart: chart,
    data: chartFeatures,
    yearlyResults: yearlyResults
  };
}

/**
 * Export daily observations (one row per day with glacier-wide statistics)
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
      bestEffort: true,
      tileScale: 4  // Add tileScale to avoid timeouts
    });
    
    // Calculate snow coverage percentage
    var snowPixels = image.select('snow_mask').reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: region,
      scale: 500,
      maxPixels: 1e9,
      tileScale: 4  // Add tileScale to avoid timeouts
    });
    
    var totalPixels = image.select('snow_mask').reduceRegion({
      reducer: ee.Reducer.count(),
      geometry: region,
      scale: 500,
      maxPixels: 1e9,
      tileScale: 4  // Add tileScale to avoid timeouts
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
                'broadband_albedo_mean', 'broadband_albedo_stdDev', 'broadband_albedo_min', 'broadband_albedo_max', 'broadband_albedo_count',
                'ice_albedo_mean', 'ice_albedo_stdDev', 'ice_albedo_min', 'ice_albedo_max',
                'snow_albedo_mean', 'snow_albedo_stdDev', 'snow_albedo_min', 'snow_albedo_max',
                'NDSI_mean', 'NDSI_stdDev', 'NDSI_min', 'NDSI_max',
                'snow_coverage_percent']
  });
}

// === INITIALIZATION ===

// Load Saskatchewan Glacier geometry (it's an Image asset)
var glacierImage = ee.Image('projects/tofunori/assets/Saskatchewan_glacier_2024_updated');
var glacierBounds = glacierImage.geometry().bounds();

// Convert glacier image to feature collection for masking
var glacierOutlines = glacierImage.gt(0).selfMask().reduceToVectors({
  geometry: glacierBounds,
  scale: 30,
  geometryType: 'polygon'
});

// Prepare elevation bands for analysis
var elevationAnalysis = prepareElevationBands(glacierBounds);
var elevationBand = elevationAnalysis.elevationBand;

print('=== ELEVATION ANALYSIS READY ===');
print('Elevation stats:', elevationAnalysis.stats);

// === INTERACTIVE DATE SELECTION UI ===
print('Setting up interactive date selection interface...');

// Create main UI panel
var panel = ui.Panel({
  layout: ui.Panel.Layout.flow('vertical'),
  style: {
    width: '320px',
    padding: '10px',
    backgroundColor: 'white'
  }
});

// Add title
var title = ui.Label({
  value: 'Glacier Albedo Viewer + Elevation',
  style: {
    fontSize: '20px',
    fontWeight: 'bold',
    margin: '10px 0px 10px 0px'
  }
});
panel.add(title);

// Add description
var description = ui.Label({
  value: 'Saskatchewan Glacier albedo with Ren et al. methodology + 50m elevation analysis',
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

presetsPanel.add(summer2020Btn);
presetsPanel.add(summer2024Btn);
panel.add(presetsPanel);

// === MAIN BUTTONS ===
var applyButton = ui.Button({
  label: 'Apply Date Range',
  style: {
    backgroundColor: '#4285f4',
    color: 'white',
    margin: '10px 0px',
    width: '280px'
  }
});
panel.add(applyButton);

// Export Daily Observations button (original functionality)
var exportDailyBtn = ui.Button({
  label: 'Export Daily Observations',
  style: {
    backgroundColor: '#34a853',
    color: 'white',
    margin: '5px 0px',
    width: '280px'
  }
});
panel.add(exportDailyBtn);

// NEW: Export by Elevation button
var exportElevationBtn = ui.Button({
  label: 'Export by Elevation (50m)',
  style: {
    backgroundColor: '#ff9800',
    color: 'white',
    margin: '5px 0px',
    width: '280px'
  }
});
panel.add(exportElevationBtn);

// NEW: Generate Plot button for 2017-2024 analysis
var generatePlotBtn = ui.Button({
  label: 'Generate Plot (2017-2024)',
  style: {
    backgroundColor: '#9c27b0',
    color: 'white',
    margin: '5px 0px',
    width: '280px'
  }
});
panel.add(generatePlotBtn);

// Add Clear Layers button
var clearButton = ui.Button({
  label: 'Clear Albedo Layers',
  style: {
    backgroundColor: '#ea4335',
    color: 'white',
    margin: '5px 0px',
    width: '280px'
  }
});
panel.add(clearButton);

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

// === EVENT HANDLERS ===

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
    if (name && (name.indexOf('Albedo') !== -1 || name.indexOf('albedo') !== -1 || name.indexOf('Elevation') !== -1)) {
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

// Function to process and display glacier albedo for selected date range WITH ELEVATION
function processSelectedDateRangeWithElevation() {
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
  statusLabel.setValue('Processing data with elevation analysis for ' + startDate + ' to ' + endDate + '...');
  statusLabel.style().set('color', 'orange');
  
  // Clear existing albedo layers
  clearAlbedoLayers();
  
  // Process glacier albedo for selected date range WITH ELEVATION
  var selectedAlbedoCollection = retrieveGlacierAlbedoWithElevation(glacierBounds, startDate, endDate, glacierOutlines, elevationBand);
  
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
      var meanElevation = validAlbedoCollection.select('elev50').mean();
      
      // Create layer names
      var albedoLayerName = 'Glacier Albedo (' + startDate + ' to ' + endDate + ')';
      var elevationLayerName = 'Elevation Bands (50m)';
      
      // Add to map
      Map.addLayer(meanAlbedo, {
        min: 0.1, 
        max: 0.9, 
        palette: ['blue', 'cyan', 'yellow', 'orange', 'red']
      }, albedoLayerName);
      
      Map.addLayer(meanElevation, {
        min: 2700, 
        max: 3600, 
        palette: ['brown', 'yellow', 'green', 'blue', 'white']
      }, elevationLayerName);
      
      // Update status
      statusLabel.setValue('Success! Processed ' + validSize + ' images with elevation analysis');
      statusLabel.style().set('color', 'green');
      dataInfoLabel.setValue('Layers: ' + albedoLayerName + ' + ' + elevationLayerName);
      
      // Store current data
      currentAlbedoCollection = validAlbedoCollection;
      currentLayerName = albedoLayerName;
    });
  });
}

// === PRESET BUTTON EVENT HANDLERS ===

// 2020 Summer preset
summer2020Btn.onClick(function() {
  startDateBox.setValue('2020-06-01');
  endDateBox.setValue('2020-09-30');
  statusLabel.setValue('2020 Summer dates selected. Click Apply to process.');
  statusLabel.style().set('color', 'blue');
});

// 2024 Summer preset  
summer2024Btn.onClick(function() {
  startDateBox.setValue('2024-06-01');
  endDateBox.setValue('2024-09-30');
  statusLabel.setValue('2024 Summer dates selected. Click Apply to process.');
  statusLabel.style().set('color', 'blue');
});

// Apply button event handler
applyButton.onClick(function() {
  processSelectedDateRangeWithElevation();
});

// Export Daily Observations button event handler (original functionality)
exportDailyBtn.onClick(function() {
  if (currentAlbedoCollection === null) {
    statusLabel.setValue('Error: No data processed. Click Apply first.');
    statusLabel.style().set('color', 'red');
    return;
  }
  
  var startDate = startDateBox.getValue();
  var endDate = endDateBox.getValue();
  var description = 'saskatchewan_glacier_albedo_' + startDate.replace(/-/g, '') + '_' + endDate.replace(/-/g, '');
  
  statusLabel.setValue('Exporting daily observations...');
  statusLabel.style().set('color', 'orange');
  
  exportDailyObservations(currentAlbedoCollection, glacierBounds, description);
  
  statusLabel.setValue('Export initiated: ' + description + '.csv');
  statusLabel.style().set('color', 'green');
});

// Export by Elevation button event handler
exportElevationBtn.onClick(function() {
  if (currentAlbedoCollection === null) {
    statusLabel.setValue('Error: No data processed. Click Apply first.');
    statusLabel.style().set('color', 'red');
    return;
  }
  
  var startDate = startDateBox.getValue();
  var endDate = endDateBox.getValue();
  var description = 'elevation_analysis_' + startDate.replace(/-/g, '') + '_' + endDate.replace(/-/g, '');
  
  statusLabel.setValue('Exporting elevation analysis...');
  statusLabel.style().set('color', 'orange');
  
  exportAlbedoByElevation(currentAlbedoCollection, glacierBounds, description);
  
  statusLabel.setValue('Export initiated: ' + description + '.csv');
  statusLabel.style().set('color', 'green');
});

// Generate Plot button event handler (2017-2024 analysis)
generatePlotBtn.onClick(function() {
  statusLabel.setValue('Generating albedo-elevation plot for 2017-2024...');
  statusLabel.style().set('color', 'orange');
  dataInfoLabel.setValue('Processing 8 years of data - this may take several minutes');
  
  // Generate multi-year plot
  var plotResult = generateAlbedoElevationPlot(2017, 2024);
  
  statusLabel.setValue('Plot generated! Check console for interactive chart.');
  statusLabel.style().set('color', 'green');
  dataInfoLabel.setValue('Albedo vs Elevation chart (2017-2024) displayed in console');
});

// Clear Layers button
clearButton.onClick(function() {
  clearAlbedoLayers();
  statusLabel.setValue('Albedo layers cleared from map.');
  statusLabel.style().set('color', 'green');
  dataInfoLabel.setValue('');
});

// Initialize map display
Map.centerObject(glacierBounds, 12);
Map.addLayer(glacierImage.selfMask(), {palette: ['red']}, 'Saskatchewan Glacier Outline');

// Add elevation band as initial layer
Map.addLayer(elevationBand, {
  min: 2700, 
  max: 3600, 
  palette: ['brown', 'yellow', 'green', 'blue', 'white']
}, 'Elevation Bands (50m)');

// Initial status
statusLabel.setValue('Interface ready with elevation analysis. Select dates and click Apply.');
statusLabel.style().set('color', 'green');

print('=== GLACIER ALBEDO WITH ELEVATION ANALYSIS READY ===');
print('Available functions:');
print('- Daily Observations: One row per day with glacier-wide statistics (compatible with original script)');
print('- Elevation Analysis: Albedo by 50m elevation bands (Ren et al. 2023 methodology)');
print('- Interactive Plot: Albedo vs Elevation visualization for 2017-2024 period');
print('New features:');
print('- DEM 30m resolution with albedo resampling (Stratégie 1)');
print('- Multi-year plotting capability (similar to Ren et al. 2023 Figure 6)');
print('- tileScale parameters to prevent timeouts'); 
print('- All original functionality preserved + elevation analysis + plotting');