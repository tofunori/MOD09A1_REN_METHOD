/**
 * Quick driver script: export glacier broadband albedo maps for a single date
 * using all three methods (Ren/MOD09A1, MOD10A1, MCD43A3).
 *
 * This combines the logic of the existing single-date Ren export with direct
 * calls to the processing pipelines for MOD10A1 and MCD43A3, producing three
 * separate GeoTIFF files in Google Drive:
 *   • <driveFolder>/AlbedoRen_<date>.tif
 *   • <driveFolder>/AlbedoMOD10A1_<date>.tif
 *   • <driveFolder>/AlbedoMCD43A3_<date>.tif
 *
 * Usage in the Earth Engine Code Editor:
 *   1. Adjust `targetDate` and `driveFolder` if necessary.
 *   2. Click Run and start the three tasks that appear in the Tasks tab.
 */

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
var cmp      = require('users/tofunori/MOD09A1_REN_METHOD:modules/workflows/comparison.js');
var utils    = require('users/tofunori/MOD09A1_REN_METHOD:modules/utils/glacier.js');
var cfg      = require('users/tofunori/MOD09A1_REN_METHOD:modules/config.js');
var mod10    = require('users/tofunori/MOD09A1_REN_METHOD:modules/methods/mod10a1.js');
var mcd43    = require('users/tofunori/MOD09A1_REN_METHOD:modules/methods/mcd43a3.js');

// ---------------------------------------------------------------------------
// User parameters (edit these)
// ---------------------------------------------------------------------------
var targetDate  = '2023-08-07'; // ISO yyyy-mm-dd
var driveFolder = 'GEE_Exports';

// ---------------------------------------------------------------------------
// Initialise glacier dataset (update path in modules/config.js if needed)
// ---------------------------------------------------------------------------
var g = utils.initializeGlacierData();
var glacierOutlines = g.outlines;
var region          = g.bounds;
var createGlacierMask = utils.createGlacierMask;

// ---------------------------------------------------------------------------
// 1) Export Ren (MOD09A1) – reuse existing helper
// ---------------------------------------------------------------------------
cmp.exportRenAlbedoSingleDate(targetDate, glacierOutlines, region, {
  description: 'AlbedoRen_' + targetDate.replace(/-/g, ''),
  folder:      driveFolder,
  scale:       500
});
print('Task queued: AlbedoRen_' + targetDate);

// ---------------------------------------------------------------------------
// 2) Helper – fetch first image for a collection on the target date
// ---------------------------------------------------------------------------
function firstImage(colId) {
  var start = ee.Date(targetDate);
  var end   = start.advance(1, 'day');
  return ee.ImageCollection(colId)
           .filterDate(start, end)
           .filterBounds(region)
           .first();
}

// ---------------------------------------------------------------------------
// 3) MOD10A1 processing & export
// ---------------------------------------------------------------------------
var mod10Collection = ee.ImageCollection(cfg.MODIS_COLLECTIONS.MOD10A1)
                       .filterDate(targetDate, ee.Date(targetDate).advance(1, 'day'))
                       .filterBounds(region);

if (mod10Collection.size().gt(0).getInfo()) {
  var mod10Img = mod10Collection.first();
  var mod10Processed = mod10.processMOD10A1(mod10Img, glacierOutlines, createGlacierMask)
                            .select('broadband_albedo_mod10a1_masked');

  Export.image.toDrive({
    image: mod10Processed,
    description: 'AlbedoMOD10A1_' + targetDate.replace(/-/g, ''),
    folder: driveFolder,
    region: region,
    scale: cfg.EXPORT_CONFIG.scale_simple, // 500 m
    crs: 'EPSG:4326',
    maxPixels: cfg.EXPORT_CONFIG.maxPixels_simple,
    fileFormat: 'GeoTIFF'
  });
  print('Task queued: AlbedoMOD10A1_' + targetDate);
} else {
  print('⚠️ No MOD10A1 data available on ' + targetDate);
}

// ---------------------------------------------------------------------------
// 4) MCD43A3 processing & export
// ---------------------------------------------------------------------------
var mcd43Collection = ee.ImageCollection(cfg.MODIS_COLLECTIONS.MCD43A3)
                        .filterDate(targetDate, ee.Date(targetDate).advance(1, 'day'))
                        .filterBounds(region);

if (mcd43Collection.size().gt(0).getInfo()) {
  var mcd43Img = mcd43Collection.first();
  var mcd43Processed = mcd43.processMCD43A3(mcd43Img, glacierOutlines, createGlacierMask)
                             .select('broadband_albedo_mcd43a3_masked');

  Export.image.toDrive({
    image: mcd43Processed,
    description: 'AlbedoMCD43A3_' + targetDate.replace(/-/g, ''),
    folder: driveFolder,
    region: region,
    scale: cfg.EXPORT_CONFIG.scale_simple, // 500 m
    crs: 'EPSG:4326',
    maxPixels: cfg.EXPORT_CONFIG.maxPixels_simple,
    fileFormat: 'GeoTIFF'
  });
  print('Task queued: AlbedoMCD43A3_' + targetDate);
} else {
  print('⚠️ No MCD43A3 data available on ' + targetDate);
}

print('🚀 Three export tasks have been queued (check the Tasks tab).'); 