/**
 * Quick driver script: export glacier broadband albedo map for a single date
 * using the Ren et al. (2021) MOD09A1 method (Terra + Aqua merged).
 *
 * Usage in the Earth Engine Code Editor:
 *   1. Change `targetDate` and `driveFolder` if needed.
 *   2. Click Run – a task named `Albedo_<date>` appears in Tasks tab.
 *   3. Start the task; the GeoTIFF appears in the specified Drive folder.
 */

// ---------------------------------------------------------------------------
// Load helper modules
// ---------------------------------------------------------------------------
var cmp   = require('users/tofunori/MOD09A1_REN_METHOD:modules/workflows/comparison.js');
var utils = require('users/tofunori/MOD09A1_REN_METHOD:modules/utils/glacier.js');

// ---------------------------------------------------------------------------
// User parameters
// ---------------------------------------------------------------------------
var targetDate  = '2023-08-07';         // ISO yyyy-mm-dd
var driveFolder = 'GEE_Exports';        // Google Drive folder name

// Initialise glacier dataset (update path in modules/config.js if needed)
var g = utils.initializeGlacierData();

// Launch export
cmp.exportRenAlbedoSingleDate(targetDate, g.outlines, g.bounds, {
  description: 'Albedo_' + targetDate.replace(/-/g, ''),
  folder: driveFolder,
  scale: 500                      // 500 m → ~0.0045° in EPSG:4326
});