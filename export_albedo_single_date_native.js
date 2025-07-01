/**
 * Export albédo glacier (Ren et al. 2021) dans la projection native MODIS
 * sinusoidale – vers un asset EE ou un GeoTIFF Drive.
 */

var cmp   = require('users/tofunori/MOD09A1_REN_METHOD:modules/workflows/comparison.js');
var utils = require('users/tofunori/MOD09A1_REN_METHOD:modules/utils/glacier.js');

// ----------------------- PARAMÈTRES UTILISATEUR ---------------------------
var targetDate = '2023-08-07';                // Date souhaitée
var exportToAsset = true;                     // true = asset, false = Drive

// Utiliser le même répertoire que celui du GLACIER_ASSET mais avec un nom basé sur la date
var cfg = require('users/tofunori/MOD09A1_REN_METHOD:modules/config.js');
var glacierAssetPath = cfg.GLACIER_ASSET;                        // ex. 'projects/tofunori/assets/Saskatchewan_glacier_2024_updated'
var baseFolder = glacierAssetPath.substring(0, glacierAssetPath.lastIndexOf('/') + 1); // garde le dossier
var assetId = baseFolder + 'AlbedoNative_' + targetDate.replace(/-/g, '');
var driveFold = 'GEE_Exports';                // dossier Drive si Drive

// --------------------------------------------------------------------------
var g = utils.initializeGlacierData();

cmp.exportRenAlbedoSingleDateNative(targetDate, g.outlines, g.bounds, {
  toAsset: exportToAsset,
  assetId: assetId,
  folder: driveFold,
  description: 'AlbedoNative_' + targetDate.replace(/-/g,''),
  maxPixels: 1e9
});

print('Native export task queued'); 