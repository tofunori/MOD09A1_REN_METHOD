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

// ============================================================================
// EMPIRICAL COEFFICIENTS (Ren et al. 2023)
// ============================================================================

// Ice albedo coefficients (Equation 8)
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
  MOD09GA: 'MODIS/061/MOD09GA',    // Surface Reflectance Daily Global 1km and 500m
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

// Export parameters for memory optimization
var EXPORT_CONFIG = {
  scale: 5000,                   // Export scale for Ren method
  scale_simple: 10000,           // Export scale for simplified methods  
  maxPixels_ren: 1e4,           // Max pixels for Ren method
  maxPixels_simple: 1e3,        // Max pixels for simplified methods
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
exports.EXPORT_CONFIG = EXPORT_CONFIG;