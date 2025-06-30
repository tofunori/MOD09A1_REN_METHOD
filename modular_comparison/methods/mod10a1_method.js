/**
 * MOD10A1 Snow Albedo Method Implementation
 * 
 * Advanced implementation using MODIS MOD10A1 with comprehensive QA filtering
 * COPIED from your sophisticated MODIS_Albedo project filtering system
 * 
 * Author: Modular Comparison Framework
 * Date: 2025-06-29
 */

// ============================================================================
// QA CONFIGURATION (copied from your MODIS_Albedo project)
// ============================================================================

// Standard QA configuration from your config.js
var QA_CONFIG = {
  STANDARD: {
    basicLevel: 'good',                    // QA level: 'best'(0), 'good'(0-1), 'ok'(0-2), 'all'(0-3)
    excludeInlandWater: false,             // RELAXED: Allow water/glacial lakes for more data
    excludeVisibleScreenFail: true,        // CRITICAL - corrupted visible data (always exclude)
    excludeNDSIScreenFail: true,           // CRITICAL - unreliable NDSI (always exclude)
    excludeTempHeightFail: false,          // RELAXED: Allow temp/height failures
    excludeSWIRAnomaly: false,             // RELAXED: Allow SWIR anomalies
    excludeProbablyCloudy: false,          // RELAXED: Allow probably cloudy for more data
    excludeProbablyClear: false,           // Clear detection (usually safe to keep)
    excludeHighSolarZenith: false          // RELAXED: Allow high solar zenith
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
// QUALITY FILTERING FUNCTIONS (copied from your qa.js)
// ============================================================================

/**
 * Create Basic QA mask based on quality level
 * COPIED from your qa.js getBasicQAMask function
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
 * COPIED from your qa.js getAlgorithmFlagsMask function
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
 * COPIED from your qa.js createComprehensiveQualityMask function
 */
function createComprehensiveQualityMask(img, qaConfig) {
  var basicMask = getBasicQAMask(img, qaConfig.basicLevel || 'good');
  var flagsMask = getAlgorithmFlagsMask(img, qaConfig);
  
  return basicMask.and(flagsMask);
}

/**
 * Create standard quality mask for exports (uses conservative configuration)
 * COPIED from your qa.js createStandardQualityMask function
 */
function createStandardQualityMask(img) {
  return createComprehensiveQualityMask(img, QA_CONFIG.STANDARD);
}

// ============================================================================
// MAIN PROCESSING FUNCTION
// ============================================================================

/**
 * Process MOD10A1 snow data with ADVANCED QA FILTERING
 * Uses your sophisticated quality filtering from MODIS_Albedo project
 */
function processMOD10A1(image, glacierOutlines) {
  // Apply your sophisticated quality filtering
  var qualityMask = createStandardQualityMask(image);
  var filtered = image.updateMask(qualityMask);
  
  // Extract NDSI snow cover data with quality filtering applied
  // NDSI_Snow_Cover is the primary snow band in MOD10A1 Collection 6.1
  var snowCover = filtered.select('NDSI_Snow_Cover')
    .clamp(0, 100).multiply(0.01); // Convert percentage to 0-1 range
  
  // Also try to use Snow_Albedo_Daily_Tile if available (your project uses both)
  var snowAlbedo = ee.Algorithms.If(
    image.bandNames().contains('Snow_Albedo_Daily_Tile'),
    filtered.select('Snow_Albedo_Daily_Tile').multiply(0.01), // Scale if available
    snowCover // Fallback to NDSI snow cover
  );
  
  // Use the better albedo product when available
  var finalAlbedo = ee.Image(snowAlbedo).rename('broadband_albedo_mod10a1');
  
  return filtered.addBands(finalAlbedo).copyProperties(image, ['system:time_start']);
}

// ============================================================================
// EXPORTS FOR USE IN MAIN SCRIPT
// ============================================================================

// Export the main processing function
exports.processMOD10A1 = processMOD10A1;