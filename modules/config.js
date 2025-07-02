var REFL_BANDS = ['sur_refl_b01', 'sur_refl_b02', 'sur_refl_b03', 'sur_refl_b04', 'sur_refl_b05', 'sur_refl_b06', 'sur_refl_b07'];
var TOPO_BANDS_ALL = ['sur_refl_b01_topo', 'sur_refl_b02_topo', 'sur_refl_b03_topo', 'sur_refl_b04_topo', 'sur_refl_b05_topo', 'sur_refl_b07_topo'];
var TOPO_BANDS_SNOW = ['sur_refl_b01_topo', 'sur_refl_b02_topo', 'sur_refl_b03_topo', 'sur_refl_b05_topo', 'sur_refl_b07_topo'];
var NARROWBAND_ALL = ['narrowband_b1', 'narrowband_b2', 'narrowband_b3', 'narrowband_b4', 'narrowband_b5', 'narrowband_b7'];
var NARROWBAND_SNOW = ['narrowband_b1', 'narrowband_b2', 'narrowband_b3', 'narrowband_b5', 'narrowband_b7'];
var BAND_NUMS_ALL = ['b1', 'b2', 'b3', 'b4', 'b5', 'b7'];
var BAND_NUMS_SNOW = ['b1', 'b2', 'b3', 'b5', 'b7'];
var iceCoefficients = {b1: 0.160, b2: 0.291, b3: 0.243, b4: 0.116, b5: 0.112, b7: 0.081, constant: -0.0015};
var snowCoefficients = {b1: 0.1574, b2: 0.2789, b3: 0.3829, b5: 0.1131, b7: 0.0694, constant: -0.0093};
var demCollection = ee.ImageCollection('JAXA/ALOS/AW3D30/V4_1');
var dem = demCollection.select('DSM').mosaic().setDefaultProjection(demCollection.first().select('DSM').projection());
var slope = ee.Terrain.slope(dem);
var aspect = ee.Terrain.aspect(dem);
var MODIS_COLLECTIONS = {MOD09GA: 'MODIS/061/MOD09GA', MYD09GA: 'MODIS/061/MYD09GA', MOD10A1: 'MODIS/061/MOD10A1', MYD10A1: 'MODIS/061/MYD10A1', MCD43A3: 'MODIS/061/MCD43A3'};
var GLACIER_ASSET = 'projects/tofunori/assets/Saskatchewan_glacier_2024_updated';
var GLACIER_CONFIG = {scale: 30, abundance_threshold: 0.50, modis_scale: 500};
var PROCESSING_CONFIG = {melt_season_only: true, apply_cloud_masking: true, debug_mode: false};
var DEBUG_MODE = PROCESSING_CONFIG.debug_mode;
var EXPORT_CONFIG = {scale: 463, scale_simple: 500, maxPixels_ren: 1e9, maxPixels_simple: 1e8, bestEffort: true, tileScale: 2};

// Pixel-level export configuration
var PIXEL_EXPORT_CONFIG = {
  // Sampling parameters
  maxPixelsPerImage: 1e6,  // Maximum pixels to sample per image (memory management)
  tileScale: 4,            // Increased tile scale for pixel sampling
  geometries: true,        // Include lat/lon coordinates
  
  // Quality control
  validateCoordinates: true,    // Validate pixel coordinates
  filterInvalidPixels: true,    // Remove pixels with invalid albedo values
  
  // Export format
  fileFormat: 'CSV',           // Export format
  folder: 'albedo_pixel_analysis',  // Google Drive folder
  
  // Performance settings
  batchSize: 10,               // Number of images to process in batch
  memoryOptimized: true,       // Use memory optimization strategies
  
  // Pixel ID system
  useEnhancedPixelIds: false,  // Use enhanced h/v/row/col system vs simple row/col
  includePixelMetadata: true   // Include elevation, NDSI, solar zenith for MOD09GA
};
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
exports.PIXEL_EXPORT_CONFIG = PIXEL_EXPORT_CONFIG;
exports.ICE_COEFFICIENTS = iceCoefficients;
exports.SNOW_COEFFICIENTS = snowCoefficients;
var SNOW_BRDF_COEFFICIENTS = {
  b1: { c1: 0.00083, c2: 0.00384, c3: 0.00452, theta_c: 0.34527 },
  b2: { c1: 0.00123, c2: 0.00459, c3: 0.00521, theta_c: 0.34834 },
  b3: { c1: 0.00000, c2: 0.00001, c3: 0.00002, theta_c: 0.12131 },
  b5: { c1: 0.00663, c2: 0.01081, c3: 0.01076, theta_c: 0.46132 },
  b7: { c1: 0.00622, c2: 0.01410, c3: 0.01314, theta_c: 0.55261 }
};
var ICE_BRDF_COEFFICIENTS = {
  b1: { c1: -0.00054, c2:  0.00002, c3:  0.00001, theta_c: 0.17600 },
  b2: { c1: -0.00924, c2:  0.00033, c3: -0.00005, theta_c: 0.31750 },
  b3: { c1: -0.00369, c2:  0.00000, c3:  0.00007, theta_c: 0.27632 },
  b4: { c1: -0.02920, c2: -0.00810, c3:  0.00462, theta_c: 0.52360 },
  b5: { c1: -0.02388, c2:  0.00656, c3:  0.00227, theta_c: 0.58473 },
  b7: { c1: -0.02081, c2:  0.00683, c3:  0.00390, theta_c: 0.57500 }
};
exports.SNOW_BRDF_COEFFICIENTS = SNOW_BRDF_COEFFICIENTS;
exports.ICE_BRDF_COEFFICIENTS  = ICE_BRDF_COEFFICIENTS;