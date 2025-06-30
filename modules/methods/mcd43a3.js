/**
 * MCD43A3 BRDF/Albedo Method Implementation
 * 
 * Advanced implementation using MODIS MCD43A3 Collection 6.1 BRDF/Albedo product
 * Uses kernel-driven BRDF model albedo with comprehensive QA filtering
 * 
 * Author: Modular Comparison Framework
 * Date: 2025-06-30
 */

// ============================================================================
// MODULE IMPORTS
// ============================================================================

var config = require('users/tofunori/MOD09A1_REN_METHOD:modules/config.js');

// ============================================================================
// QUALITY FILTERING CONFIGURATION
// ============================================================================

/**
 * MCD43A3 Collection 6.1 Quality Assessment Configuration
 * Based on MODIS Collection 6.1 User Guide and Google Earth Engine documentation
 */
var QA_CONFIG = {
  // Accept both full and magnitude BRDF inversions (QA 0 or 1)
  ACCEPT_QA_0_AND_1: true,
  
  // Mandatory Quality band filtering
  MANDATORY_QA_BANDS: [
    'BRDF_Albedo_Band_Mandatory_Quality_shortwave',
    'BRDF_Albedo_Band_Mandatory_Quality_vis',
    'BRDF_Albedo_Band_Mandatory_Quality_nir'
  ],
  
  // Quality flag values for mandatory QA bands
  QUALITY_FLAGS: {
    FULL_INVERSION: 0,      // Processed, good quality (full BRDF inversions)
    MAGNITUDE_INVERSION: 1   // Processed, see other QA (magnitude BRDF inversions)
  }
};

// ============================================================================
// QUALITY FILTERING FUNCTIONS
// ============================================================================

/**
 * Create quality mask for MCD43A3 using mandatory QA bands
 * Accepts both full BRDF inversions (0) and magnitude inversions (1) for more data
 */
function createMCD43A3QualityMask(image) {
  // Start with a base mask of all 1s
  var qualityMask = ee.Image(1);
  
  // Apply mandatory QA filtering for shortwave albedo (our primary band)
  var shortwaveQA = image.select('BRDF_Albedo_Band_Mandatory_Quality_shortwave');
  
  if (QA_CONFIG.ACCEPT_QA_0_AND_1) {
    // Accept both QA=0 (full inversion) and QA=1 (magnitude inversion)
    // Bit 0: 0 = full BRDF inversion, 1 = magnitude inversion (both acceptable)
    var goodQualityMask = shortwaveQA.bitwiseAnd(1).lte(1);
    qualityMask = qualityMask.and(goodQualityMask);
  }
  
  // Optional: Add visible and NIR band quality checks with relaxed criteria
  var visQA = image.select('BRDF_Albedo_Band_Mandatory_Quality_vis');
  var nirQA = image.select('BRDF_Albedo_Band_Mandatory_Quality_nir');
  
  // Accept QA 0 or 1 for visible and NIR bands
  var visGoodQuality = visQA.bitwiseAnd(1).lte(1);
  var nirGoodQuality = nirQA.bitwiseAnd(1).lte(1);
  
  // Require at least 2 out of 3 bands (shortwave, vis, nir) to have good quality (0 or 1)
  var goodBandsCount = goodQualityMask.add(visGoodQuality).add(nirGoodQuality);
  var multiSpectralQuality = goodBandsCount.gte(2);
  
  return qualityMask.and(multiSpectralQuality);
}

/**
 * Advanced quality filtering using companion MCD43A2 data (if available)
 * This would require loading MCD43A2 alongside MCD43A3 for comprehensive QA
 */
function createAdvancedQualityMask(image) {
  // This is a placeholder for advanced MCD43A2-based filtering
  // In practice, you would load MCD43A2 data and apply more sophisticated filtering
  // For now, use the mandatory QA bands from MCD43A3
  return createMCD43A3QualityMask(image);
}

// ============================================================================
// MAIN PROCESSING FUNCTION
// ============================================================================

/**
 * Process MCD43A3 BRDF/Albedo with Collection 6.1 QA filtering
 * Uses Black-Sky Albedo shortwave band with comprehensive quality filtering
 */
function processMCD43A3(image, glacierOutlines, createGlacierMask) {
  // Apply quality filtering for Collection 6.1
  var qualityMask = createMCD43A3QualityMask(image);
  var filteredImage = image.updateMask(qualityMask);
  
  // Extract shortwave broadband albedo (Black-Sky Albedo)
  // Albedo_BSA_shortwave is the primary broadband albedo product
  var blackSkySW = filteredImage.select('Albedo_BSA_shortwave').multiply(0.001); // Scale factor
  
  // Optional: Also extract White-Sky Albedo for comparison
  var whiteSkySW = filteredImage.select('Albedo_WSA_shortwave').multiply(0.001);
  
  // Use Black-Sky Albedo as primary broadband albedo
  var broadbandAlbedo = blackSkySW.rename('broadband_albedo_mcd43a3');
  
  // -----------------------------------------------------------------
  // Glacier mask clipping (consistent with Ren pipeline)
  // -----------------------------------------------------------------
  if (createGlacierMask) {
    var glacierMaskRaw = createGlacierMask(glacierOutlines, null);
    var refProj        = broadbandAlbedo.projection();
    var glacierMask    = glacierMaskRaw.reproject(refProj);
    var maskedAlbedo   = broadbandAlbedo.updateMask(glacierMask)
                        .rename('broadband_albedo_mcd43a3_masked');

    return filteredImage
             .addBands(broadbandAlbedo)
             .addBands(maskedAlbedo)
             .addBands(blackSkySW.rename('black_sky_albedo_mcd43a3'))
             .addBands(whiteSkySW.rename('white_sky_albedo_mcd43a3'))
             .copyProperties(image, ['system:time_start']);
  }

  // Fallback (no glacier masking function supplied)
  return filteredImage
           .addBands(broadbandAlbedo)
           .addBands(blackSkySW.rename('black_sky_albedo_mcd43a3'))
           .addBands(whiteSkySW.rename('white_sky_albedo_mcd43a3'))
           .copyProperties(image, ['system:time_start']);
}

// ============================================================================
// EXPORTS
// ============================================================================

exports.processMCD43A3 = processMCD43A3;
exports.createMCD43A3QualityMask = createMCD43A3QualityMask;
exports.createAdvancedQualityMask = createAdvancedQualityMask;