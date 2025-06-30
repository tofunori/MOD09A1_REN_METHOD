/**
 * Global Constants and Configuration for MODIS Albedo Comparison
 * 
 * This module contains all shared constants, coefficients, and configuration
 * used across different MODIS albedo retrieval methods.
 * 
 * Author: Modular Comparison Framework
 * Date: 2025-06-30
 */

// ============================================================================
// MODIS BAND CONSTANTS
// ============================================================================

// Global band constants for MOD09GA Ren method (bands 1,2,3,4,5,7 - no band 6)
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

// ============================================================================
// EMPIRICAL COEFFICIENTS (Ren et al. 2023)
// ============================================================================

// Ice albedo coefficients (Equation 8) - MOD09GA bands only
var iceCoefficients = {
  b1: 0.160, 
  b2: 0.291, 
  b3: 0.243, 
  b4: 0.116, 
  b5: 0.112, 
  b7: 0.081, 
  constant: -0.0015
};

// Snow albedo coefficients (Equation 9)
var snowCoefficients = {
  b1: 0.1574, 
  b2: 0.2789, 
  b3: 0.3829, 
  b5: 0.1131, 
  b7: 0.0694, 
  constant: -0.0093
};

// ============================================================================
// TOPOGRAPHIC DATA CONFIGURATION
// ============================================================================

// Load DEM for topographic correction
var dem = ee.Image('USGS/SRTMGL1_003');
var slope = ee.Terrain.slope(dem);
var aspect = ee.Terrain.aspect(dem);

// ============================================================================
// MODIS COLLECTION IDENTIFIERS
// ============================================================================

var MODIS_COLLECTIONS = {
  MOD09GA: 'MODIS/061/MOD09GA',    // Surface Reflectance Daily Global 1km and 500m (bands 1,2,3,4,5,7)
  MOD09A1: 'MODIS/061/MOD09A1',    // Surface Reflectance 8-Day Global 500m (has band 6)
  MOD10A1: 'MODIS/061/MOD10A1',   // Snow Cover Daily Global 500m
  MCD43A3: 'MODIS/061/MCD43A3'    // BRDF/Albedo Daily Global 500m
};

// ============================================================================
// GLACIER CONFIGURATION
// ============================================================================

// Saskatchewan Glacier asset path
var GLACIER_ASSET = 'projects/tofunori/assets/Saskatchewan_glacier_2024_updated';

// Glacier processing parameters
var GLACIER_CONFIG = {
  scale: 30,                      // Glacier outline scale
  abundance_threshold: 0.50,      // 50% glacier abundance criterion
  modis_scale: 500               // MODIS pixel scale
};

// ============================================================================
// PROCESSING PARAMETERS
// ============================================================================

// Processing workflow configuration
var PROCESSING_CONFIG = {
  melt_season_only: true,        // Filter to melt season (June-September)
  apply_cloud_masking: true,     // Apply cloud masking where available
  debug_mode: false             // Enable debug logging
};

// Debug mode flag (also available at top level for convenience)
var DEBUG_MODE = PROCESSING_CONFIG.debug_mode;

// Quality filtering parameters
var QA_CONFIG = {
  solar_zenith_max: 70,          // Maximum solar zenith angle (degrees)
  ndsi_threshold: 0.4            // NDSI threshold for snow/ice classification
};

// ============================================================================
// QA FILTER CONFIGURATION PROFILES
// ============================================================================

/**
 * QA Filter Configuration Profiles for Comparative Analysis
 * Based on incremental relaxation strategy for maximizing valid observations
 * Each level progressively relaxes constraints with expected gain/risk metrics
 */
var QA_PROFILES = {
  // Strict configuration (current implementation)
  strict: {
    name: 'Strict',
    description: 'Current implementation - maximum quality, minimum observations',
    cloudState: 1,                    // Accept only 00,01 (clear, probably clear)
    allowShadow: false,               // Reject cloud shadow pixels
    allowCirrus: false,               // Reject cirrus pixels  
    allowInternalCloud: false,        // Reject internal cloud mask
    snowIceConfidence: [0, 3],        // Accept only 00 (unknown) and 11 (high confidence)
    solarZenithMax: 80,               // Maximum solar zenith angle
    expectedGain: '0%',               // Baseline
    risk: 'Minimal'
  },
  
  // Level 1: Keep "maybe snow/ice" confidence
  level1: {
    name: 'Level 1',
    description: 'Add maybe snow/ice confidence (bits 12-13 = 10)',
    cloudState: 1,                    // Accept only 00,01
    allowShadow: false,               // Reject cloud shadow
    allowCirrus: false,               // Reject cirrus
    allowInternalCloud: false,        // Reject internal cloud
    snowIceConfidence: [0, 2, 3],     // Accept 00,10,11 (reject only "no snow/ice")
    solarZenithMax: 80,               // Current threshold
    expectedGain: '10-15%',           // Typical gain in valid observations
    risk: 'Very small - code 10 means algorithm uncertain, not wrong'
  },
  
  // Level 2: Relax solar zenith threshold
  level2: {
    name: 'Level 2', 
    description: 'Relax solar zenith to 85° (adds early morning/late afternoon)',
    cloudState: 1,                    // Accept only 00,01
    allowShadow: false,               // Reject cloud shadow
    allowCirrus: false,               // Reject cirrus
    allowInternalCloud: false,        // Reject internal cloud
    snowIceConfidence: [0, 2, 3],     // Keep Level 1 snow/ice confidence
    solarZenithMax: 85,               // Relaxed threshold
    expectedGain: '5-10%',            // Additional gain from Level 1
    risk: 'Small - anisotropy increases beyond 80°, slight bias growth'
  },
  
  // Level 3: Drop cirrus screen
  level3: {
    name: 'Level 3',
    description: 'Ignore cirrus detection flag (bit 8)',
    cloudState: 1,                    // Accept only 00,01
    allowShadow: false,               // Reject cloud shadow
    allowCirrus: true,                // Allow cirrus pixels
    allowInternalCloud: false,        // Reject internal cloud
    snowIceConfidence: [0, 2, 3],     // Keep Level 1 snow/ice confidence
    solarZenithMax: 85,               // Keep Level 2 solar zenith
    expectedGain: '3-7%',             // Additional gain from Level 2
    risk: 'Low - thin cirrus lowers albedo 2-4%, artifacts in bright snow possible'
  },
  
  // Level 4: Ignore cloud shadow flag
  level4: {
    name: 'Level 4',
    description: 'Ignore cloud shadow flag (bit 2)',
    cloudState: 1,                    // Accept only 00,01
    allowShadow: true,                // Allow shadow pixels
    allowCirrus: true,                // Allow cirrus pixels
    allowInternalCloud: false,        // Reject internal cloud
    snowIceConfidence: [0, 2, 3],     // Keep Level 1 snow/ice confidence
    solarZenithMax: 85,               // Keep Level 2 solar zenith
    expectedGain: '2-4%',             // Additional gain from Level 3
    risk: 'Medium - shadows strongly darken pixels, consider terrain-based filtering'
  },
  
  // Level 5: Accept mixed cloud state
  level5: {
    name: 'Level 5',
    description: 'Accept mixed cloud state (bits 0-1 = 10)',
    cloudState: 2,                    // Accept 00,01,10 (reject only 11)
    allowShadow: true,                // Allow shadow pixels
    allowCirrus: true,                // Allow cirrus pixels
    allowInternalCloud: false,        // Reject internal cloud
    snowIceConfidence: [0, 2, 3],     // Keep Level 1 snow/ice confidence
    solarZenithMax: 85,               // Keep Level 2 solar zenith
    expectedGain: 'Variable',         // High in monsoon seasons
    risk: 'High - cloudy pixels give artificially low albedo, requires post-filtering'
  }
};

// Export parameters for memory optimization
var EXPORT_CONFIG = {
  scale: 500,                    // Export scale for Ren method (match MODIS)
  scale_simple: 500,             // Export scale for simplified methods  
  maxPixels_ren: 1e6,            // Allow more pixels for Ren exports
  maxPixels_simple: 1e6,         // Allow more pixels for others
  tileScale: 16,                // Tile scale for all exports
  bestEffort: true              // Best effort flag
};

// ============================================================================
// EXPORTS FOR USE IN OTHER MODULES
// ============================================================================

// Export all constants for use in other modules
exports.REFL_BANDS = REFL_BANDS;
exports.TOPO_BANDS_ALL = TOPO_BANDS_ALL;
exports.TOPO_BANDS_SNOW = TOPO_BANDS_SNOW;
exports.NARROWBAND_ALL = NARROWBAND_ALL;
exports.NARROWBAND_SNOW = NARROWBAND_SNOW;
exports.BAND_NUMS_ALL = BAND_NUMS_ALL;
exports.BAND_NUMS_SNOW = BAND_NUMS_SNOW;
exports.iceCoefficients = iceCoefficients;
exports.snowCoefficients = snowCoefficients;
exports.dem = dem;
exports.slope = slope;
exports.aspect = aspect;
exports.MODIS_COLLECTIONS = MODIS_COLLECTIONS;
exports.GLACIER_ASSET = GLACIER_ASSET;
exports.GLACIER_CONFIG = GLACIER_CONFIG;
exports.PROCESSING_CONFIG = PROCESSING_CONFIG;
exports.DEBUG_MODE = DEBUG_MODE;
exports.QA_CONFIG = QA_CONFIG;
exports.QA_PROFILES = QA_PROFILES;
exports.EXPORT_CONFIG = EXPORT_CONFIG;