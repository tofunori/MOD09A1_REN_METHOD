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

// Global band constants for MOD09GA (used by the MOD09A1 method) – bands 1-7
var REFL_BANDS = ['sur_refl_b01', 'sur_refl_b02', 'sur_refl_b03', 
                  'sur_refl_b04', 'sur_refl_b05', 'sur_refl_b06', 'sur_refl_b07'];
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
  abundance_threshold: 0.90,      // 90% glacier abundance criterion (for stricter glacier-only masking)
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

// ============================================================================
// EXPORT CONFIGURATION
// ============================================================================

// Export processing parameters
var EXPORT_CONFIG = {
  scale: 463,                    // Processing scale for MOD09A1 method
  scale_simple: 500,             // Processing scale for simpler methods
  maxPixels_ren: 1e9,           // Max pixels for MOD09A1 method exports
  maxPixels_simple: 1e8,        // Max pixels for simpler method exports
  bestEffort: true,             // Use best effort for processing
  tileScale: 2                  // Tile scale for memory management
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
exports.EXPORT_CONFIG = EXPORT_CONFIG;

// Legacy uppercase aliases for backward-compatibility
exports.ICE_COEFFICIENTS = iceCoefficients;
exports.SNOW_COEFFICIENTS = snowCoefficients;

// ============================================================================
// BRDF COEFFICIENT TABLES (Ren et al. 2021 – Table 4)
// ============================================================================

// Coefficients for the anisotropic correction helper.  Keys correspond to
// MODIS band identifiers used throughout the codebase (b1, b2, …).

var SNOW_BRDF_COEFFICIENTS = {
  // b1 → 677 nm
  b1: { c1: 0.00083, c2: 0.00384, c3: 0.00452, theta_c: 0.34527 },
  // b2 → 873 nm
  b2: { c1: 0.00123, c2: 0.00459, c3: 0.00521, theta_c: 0.34834 },
  // b3 → 480 nm
  b3: { c1: 0.00000, c2: 0.00001, c3: 0.00002, theta_c: 0.12131 },
  // b4 has no snow coefficients – left undefined on purpose
  b5: { c1: 0.00663, c2: 0.01081, c3: 0.01076, theta_c: 0.46132 },
  b7: { c1: 0.00622, c2: 0.01410, c3: 0.01314, theta_c: 0.55261 }
};

var ICE_BRDF_COEFFICIENTS = {
  // b1 → 675 nm
  b1: { c1: -0.00054, c2:  0.00002, c3:  0.00001, theta_c: 0.17600 },
  // b2 → 868 nm
  b2: { c1: -0.00924, c2:  0.00033, c3: -0.00005, theta_c: 0.31750 },
  // b3 → 471 nm
  b3: { c1: -0.00369, c2:  0.00000, c3:  0.00007, theta_c: 0.27632 },
  // b4 → 560 nm
  b4: { c1: -0.02920, c2: -0.00810, c3:  0.00462, theta_c: 0.52360 },
  // b5 → 1219 nm
  b5: { c1: -0.02388, c2:  0.00656, c3:  0.00227, theta_c: 0.58473 },
  // b7 → 1271 nm (≈ 2130 nm in original table)
  b7: { c1: -0.02081, c2:  0.00683, c3:  0.00390, theta_c: 0.57500 }
};

// Export BRDF tables
exports.SNOW_BRDF_COEFFICIENTS = SNOW_BRDF_COEFFICIENTS;
exports.ICE_BRDF_COEFFICIENTS  = ICE_BRDF_COEFFICIENTS;