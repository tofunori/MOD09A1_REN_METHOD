/**
 * Export the glacier mask asset (binary raster) to a GeoTIFF for use in ArcGIS.
 *
 * • Reads GLACIER_ASSET from modules/config.js
 * • Exports a single–band GeoTIFF (value 1 = glacier, 0 = no-data)
 * • Default projection: EPSG:4326 (lat/long) @ 30 m (native DEM resolution)
 *
 * How to run in the Earth Engine Code Editor:
 *   1. Adjust `driveFolder` if necessary.
 *   2. Click “Run” → start the task that appears in the Tasks tab.
 */

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
var cfg = require('users/tofunori/MOD09GA_REN_METHOD:modules/config.js');

// ---------------------------------------------------------------------------
// Parameters (edit if needed)
// ---------------------------------------------------------------------------
var driveFolder   = 'GEE_Exports';                            // Destination folder in Drive
var tifName       = 'GlacierMask_Saskatchewan_30m';           // Base filename (no extension)
var exportScale   = cfg.GLACIER_CONFIG.scale;                 // 30 m
var exportCrs     = 'EPSG:4326';                              // Lat/long WGS-84

// ---------------------------------------------------------------------------
// Prepare the image and its region
// ---------------------------------------------------------------------------
var glacierImg = ee.Image(cfg.GLACIER_ASSET);
var region     = glacierImg.geometry().bounds(1);             // 1 m margin

// Ensure the mask is properly binary (1 = glacier, 0 = nodata)
var binMask = glacierImg.gt(0).selfMask().rename('glacier');

// ---------------------------------------------------------------------------
// Launch the export
// ---------------------------------------------------------------------------
Export.image.toDrive({
  image: binMask,
  description: tifName,
  folder: driveFolder,
  fileNamePrefix: tifName,
  region: region,
  scale: exportScale,
  crs: exportCrs,
  maxPixels: 1e9,
  fileFormat: 'GeoTIFF'
});

print('Export task for glacier mask queued → check the Tasks tab.'); 