/**
 * MOD10A1 Snow Albedo Method Implementation
 * 
 * Advanced implementation using MODIS MOD10A1 with comprehensive QA filtering
 * Enhanced with sophisticated QA filtering from MODIS_Albedo project
 * 
 * Author: Modular Comparison Framework
 * Date: 2025-06-30
 */

// ============================================================================
// MODULE IMPORTS
// ============================================================================

var config = require('users/tofunori/MOD09A1_REN_METHOD:modules/config.js');
var qaHelper = require('users/tofunori/MOD09A1_REN_METHOD:modules/methods/mod10a1/qa.js');

// ============================================================================
// QA CONFIGURATION (from MODIS_Albedo project)
// ============================================================================

// Standard QA configuration
var QA_CONFIG = {
  STANDARD: {
    basicLevel: 'good',                    // QA level: 'best'(0), 'good'(0-1), 'ok'(0-2), 'all'(0-3)
    excludeInlandWater: true,              // Exclude water/glacial lakes
    excludeVisibleScreenFail: true,        // CRITICAL - corrupted visible data (always exclude)
    excludeNDSIScreenFail: true,           // CRITICAL - unreliable NDSI (always exclude)
    excludeTempHeightFail: true,           // Temperature and height screen failure
    excludeSWIRAnomaly: true,              // SWIR optical anomalies  
    excludeProbablyCloudy: true,           // Cloud detection (false positives over snow - consider keeping)
    excludeProbablyClear: false,           // Clear detection (usually safe to keep)
    excludeHighSolarZenith: true           // Solar zenith angle >70° (poor lighting)
  },
  
  // QA bit mapping for metadata-driven processing
  BIT_MAPPING: [
    {flag: 'excludeInlandWater', bit: 0, mask: 1, desc: 'Inland water'},
    {flag: 'excludeVisibleScreenFail', bit: 1, mask: 2, desc: 'Low visible screen failure'},
    {flag: 'excludeNDSIScreenFail', bit: 2, mask: 4, desc: 'Low NDSI screen failure'},
    {flag: 'excludeTempHeightFail', bit: 3, mask: 8, desc: 'Temperature/height screen failure'},
    {flag: 'excludeSWIRAnomaly', bit: 4, mask: 16, desc: 'Shortwave IR reflectance anomaly'},
    {flag: 'excludeProbablyCloudy', bit: 5, mask: 32, desc: 'Probably cloudy (v6.1 cloud detection)'},
    {flag: 'excludeProbablyClear', bit: 6, mask: 64, desc: 'Probably clear (v6.1 cloud detection)'},
    {flag: 'excludeHighSolarZenith', bit: 7, mask: 128, desc: 'Solar zenith >70°'}
  ]
};

// ============================================================================
// QUALITY FILTERING FUNCTIONS
// ============================================================================

/**
 * Create Basic QA mask based on quality level
 */
function getBasicQAMask(img, level) {
  var basicQA = img.select('NDSI_Snow_Cover_Basic_QA');
  
  // Official GEE MOD10A1.061 values:
  // 0: Best quality, 1: Good quality, 2: OK quality, 3: Poor quality
  // 211: Night, 239: Ocean
  
  var qualityMask;
  switch(level) {
    case 'best': qualityMask = basicQA.eq(0); break;
    case 'good': qualityMask = basicQA.lte(1); break;  // DEFAULT
    case 'ok': qualityMask = basicQA.lte(2); break;
    case 'all': qualityMask = basicQA.lte(3); break;
    default: qualityMask = basicQA.lte(1); // Default to good
  }
  
  // Always exclude night and ocean
  var excludeMask = basicQA.neq(211).and(basicQA.neq(239));
  
  return qualityMask.and(excludeMask);
}

/**
 * Create Algorithm Flags QA mask based on flag configuration
 */
function getAlgorithmFlagsMask(img, flags) {
  var algFlags = img.select('NDSI_Snow_Cover_Algorithm_Flags_QA').uint8();
  var mask = ee.Image(1);
  
  // Metadata-driven QA bit processing
  var QA_BIT_MAPPING = QA_CONFIG.BIT_MAPPING;
  
  QA_BIT_MAPPING.forEach(function(mapping) {
    if (flags[mapping.flag]) {
      mask = mask.and(algFlags.bitwiseAnd(mapping.mask).eq(0));
    }
  });
  
  return mask;
}

/**
 * Create comprehensive quality mask combining Basic QA and Algorithm Flags
 */
function createComprehensiveQualityMask(img, qaConfig) {
  var basicMask = getBasicQAMask(img, qaConfig.basicLevel || 'good');
  var flagsMask = getAlgorithmFlagsMask(img, qaConfig);
  
  return basicMask.and(flagsMask);
}

/**
 * Create standard quality mask for exports (uses conservative configuration)
 */
function createStandardQualityMask(img) {
  return createComprehensiveQualityMask(img, QA_CONFIG.STANDARD);
}

// ============================================================================
// MAIN PROCESSING FUNCTION
// ============================================================================

/**
 * Process MOD10A1 snow data with ADVANCED QA FILTERING
 * Uses sophisticated quality filtering from MODIS_Albedo project
 */
function processMOD10A1(image, glacierOutlines, createGlacierMask) {
  // Apply sophisticated quality filtering
  var qualityMask = qaHelper.createStandardQualityMask(image);
  var filtered = image.updateMask(qualityMask);
  
  // MOD10A1 Collection 6.1 provides the direct daily snow albedo product.
  // We require this band for scientific comparability; images missing the
  // band are filtered out upstream (see comparison.js).

  var finalAlbedo = filtered
      .select('Snow_Albedo_Daily_Tile')
      .multiply(0.01)                 // Convert 0-100 to 0-1
      .rename('broadband_albedo_mod10a1');
  
  // -----------------------------------------------------------------
  // Glacier mask clipping (consistent with Ren pipeline)
  // -----------------------------------------------------------------
  if (createGlacierMask) {
    var glacierMaskRaw = createGlacierMask(glacierOutlines, null);
    var refProj        = finalAlbedo.projection();
    var glacierMask    = glacierMaskRaw.reproject(refProj);

    var maskedAlbedo   = finalAlbedo.updateMask(glacierMask)
                       .rename('broadband_albedo_mod10a1_masked');
    return filtered
             .addBands(finalAlbedo)
             .addBands(maskedAlbedo)
             .copyProperties(image, ['system:time_start']);
  }

  // Fallback (no glacier masking function supplied)
  return filtered.addBands(finalAlbedo).copyProperties(image, ['system:time_start']);
}

// ============================================================================
// EXPORTS
// ============================================================================

exports.processMOD10A1 = processMOD10A1;
exports.createStandardQualityMask = qaHelper.createStandardQualityMask;
exports.getBasicQAMask = qaHelper.getBasicQAMask;
exports.getAlgorithmFlagsMask = qaHelper.getAlgorithmFlagsMask;
exports.QA_CONFIG = qaHelper.QA_CONFIG;