// ============================================================================
// Weekly Pixel Analysis Test – Stable Pixel IDs (MODIS sinusoidal 500 m)
// ----------------------------------------------------------------------------
// Génère un export CSV de 7 jours (3 méthodes : MOD09GA, MOD10A1, MCD43A3)
// avec des identifiants de pixel parfaitement stables :
//   pixel_row = y / 500  (index ligne)
//   pixel_col = x / 500  (index colonne)
//   pixel_id  = pixel_row * 1 000 000 + pixel_col  (Int64)
// La projection et l'échelle sont fixées une seule fois pour éviter tout drift.
// ============================================================================

// MODULE IMPORTS --------------------------------------------------------------
var glacierUtils       = require('users/tofunori/MOD09A1_REN_METHOD:modules/utils/glacier.js');
var originalComparison = require('users/tofunori/MOD09A1_REN_METHOD:modules/workflows/comparison.js');

// CONSTANTES ------------------------------------------------------------------
var SCALE_METERS = 500;   // résolution native MODIS
var MODIS_PROJ   = ee.ImageCollection('MODIS/006/MOD09GA')
                     .first()
                     .select('sur_refl_b01')
                     .projection()
                     .atScale(SCALE_METERS);

// UTILITÉS --------------------------------------------------------------------
/**
 * Ajoute bandes pixel_row, pixel_col, pixel_id, tile_h, tile_v à une image.
 */
function addStablePixelCoords(image) {
  var coords    = ee.Image.pixelCoordinates(MODIS_PROJ);
  var pixelRow  = coords.select('y').toInt().rename('pixel_row');
  var pixelCol  = coords.select('x').toInt().rename('pixel_col');
  var pixelId   = pixelRow.multiply(1e6).add(pixelCol).toInt64().rename('pixel_id');

  var lonLat    = ee.Image.pixelLonLat();
  var tileH     = lonLat.select('longitude').multiply(100).round().toInt().rename('tile_h');
  var tileV     = lonLat.select('latitude').multiply(100).round().toInt().rename('tile_v');

  return image.addBands([tileH, tileV, pixelRow, pixelCol, pixelId]);
}

/**
 * Échantillonne chaque image d'une collection selon la bande spécifiée.
 */
function sampleCollection(col, band, methodName, region) {
  return col.map(function(img) {
      img = ee.Image(img);
      var date  = ee.Date(img.get('system:time_start'));
      var withCoords = addStablePixelCoords(img.select(band).rename('albedo'));

      return withCoords.select(['albedo','tile_h','tile_v','pixel_row','pixel_col','pixel_id'])
                       .sample({
                         region: region,
                         scale: SCALE_METERS,
                         projection: MODIS_PROJ,
                         geometries: true
                       })
                       .map(function(feat) {
                         var coords = feat.geometry().coordinates();
                         return feat.set({
                           'albedo_value': feat.get('albedo'),
                           'longitude': ee.List(coords).get(0),
                           'latitude' : ee.List(coords).get(1),
                           'date'     : date.format('YYYY-MM-dd'),
                           'method'   : methodName
                         });
                       });
    }).flatten();
}

// FONCTION PRINCIPALE ---------------------------------------------------------
function testWeeklyPixelExportStable(startDateStr, region, endDateStr) {
  startDateStr = startDateStr || '2023-08-07';
  var startDate = ee.Date(startDateStr);
  var endDate = endDateStr ? ee.Date(endDateStr).advance(1, 'day') : startDate.advance(7, 'day');
  region        = region || glacierUtils.initializeGlacierData().geometry;

  print('🔧 Stable pixel export : ', startDate.format('YYYY-MM-dd').getInfo(), '→', endDate.advance(-1,'day').format('YYYY-MM-dd').getInfo());

  // Exécute le workflow existant pour les 3 méthodes
  var methodsFlags = {ren: true, mod10a1: true, mcd43a3: true};
  var results = originalComparison.runModularComparison(
                  startDate, endDate, methodsFlags,
                  glacierUtils.initializeGlacierData().outlines,
                  region);

  var samples = ee.FeatureCollection([]);

  // MOD09GA (Ren)
  if (results.ren && results.ren.size().gt(0)) {
    samples = samples.merge(sampleCollection(results.ren, 'broadband_albedo_ren_masked', 'MOD09GA', region));
  }

  // MOD10A1
  if (results.mod10a1 && results.mod10a1.size().gt(0)) {
    samples = samples.merge(sampleCollection(results.mod10a1, 'broadband_albedo_mod10a1', 'MOD10A1', region));
  }

  // MCD43A3
  if (results.mcd43a3 && results.mcd43a3.size().gt(0)) {
    samples = samples.merge(sampleCollection(results.mcd43a3, 'broadband_albedo_mcd43a3', 'MCD43A3', region));
  }

  // Supprimer doublons éventuels (pixel_id + date + method)
  samples = samples.distinct(['pixel_id','date','method']);

  // EXPORT -------------------------------------------------------------------
  var exportDesc = 'PIXELS_three_methods_STABLE_' + startDateStr.replace(/-/g, '') + '_to_' + endDate.advance(-1,'day').format('YYYYMMdd').getInfo();
  Export.table.toDrive({
    collection: samples,
    description: exportDesc,
    folder: 'pixel_test_weekly',
    fileFormat: 'CSV'
  });

  samples.size().evaluate(function(n){
    print('📊 Pixels exportés (distincts) :', n);
    print('📁 Tâche Drive :', exportDesc);
  });
}

// AUTO-RUN --------------------------------------------------------------------
print('🔧 Weekly Pixel Analysis – Stable version loaded');
var glacierData = glacierUtils.initializeGlacierData();
// Export unique : saison de fonte complète 2023-06-01 → 2023-09-30
testWeeklyPixelExportStable('2023-06-01', glacierData.geometry, '2023-09-30');
// ---------------------------------------------------------------------------- 