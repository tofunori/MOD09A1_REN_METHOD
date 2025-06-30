/*
 * QA helper for MCD43A3 method (Collection 6.1).
 * Provides createMCD43A3QualityMask and createAdvancedQualityMask helpers.
 */

var ee = require('users/google/earthengine:legacy');

var QA_CONFIG = {
  ACCEPT_QA_0_AND_1: true,
  MANDATORY_QA_BANDS: [
    'BRDF_Albedo_Band_Mandatory_Quality_shortwave',
    'BRDF_Albedo_Band_Mandatory_Quality_vis',
    'BRDF_Albedo_Band_Mandatory_Quality_nir'
  ],
  QUALITY_FLAGS: {
    FULL_INVERSION: 0,
    MAGNITUDE_INVERSION: 1
  }
};

/**
 * Mandatory QA mask accepting both full and magnitude inversions (QA 0 or 1).
 */
function createMCD43A3QualityMask(image) {
  var goodQualityMask = ee.Image(1);

  // Shortwave band (primary)
  var shortQA = image.select('BRDF_Albedo_Band_Mandatory_Quality_shortwave');
  var shortGood = shortQA.bitwiseAnd(1).lte(1);
  goodQualityMask = goodQualityMask.and(shortGood);

  // Visible & NIR bands (optional but improve robustness)
  var visQA = image.select('BRDF_Albedo_Band_Mandatory_Quality_vis');
  var nirQA = image.select('BRDF_Albedo_Band_Mandatory_Quality_nir');
  var visGood = visQA.bitwiseAnd(1).lte(1);
  var nirGood = nirQA.bitwiseAnd(1).lte(1);

  // Require at least 2 of 3 bands good
  var goodCount = shortGood.add(visGood).add(nirGood);
  var spectralQuality = goodCount.gte(2);

  return goodQualityMask.and(spectralQuality);
}

/**
 * Placeholder for advanced QA combining MCD43A2 (future work).
 * Currently identical to createMCD43A3QualityMask.
 */
function createAdvancedQualityMask(image) {
  return createMCD43A3QualityMask(image);
}

exports.QA_CONFIG = QA_CONFIG;
exports.createMCD43A3QualityMask = createMCD43A3QualityMask;
exports.createAdvancedQualityMask = createAdvancedQualityMask; 