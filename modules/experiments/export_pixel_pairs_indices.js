// ============================================================================
// Experimental pixel-pair exporter WITH MODIS column/row indices
// ----------------------------------------------------------------------------
// This module is independent of the production utilities. It replicates the
// logic of utils/export.js::exportPixelPairs but adds two integer attributes:
//   * col – MODIS column index (pixels increase west → east)
//   * row – MODIS row index   (pixels increase north → south)
//
// Place:   modules/experiments/export_pixel_pairs_indices.js
// Author:  Experimental branch – safe to modify/remove
// ============================================================================

var config = require('users/tofunori/MOD09A1_REN_METHOD:modules/config.js');

/**
 * Export per-pixel pairs (daily product vs MCD43A3) with MODIS col/row indices.
 * A CSV is written to Drive; each row corresponds to one valid glacier pixel.
 *
 * Columns:
 *   alb_daily , alb_ref , col , row , family , date , is_terra ,
 *   solar_zenith , ndsi_mean , mean_elev   (predictors only for MOD09GA)
 *
 * @param {Object} results   Object as returned by runModularComparison()
 * @param {ee.Geometry} region  Region to sample (usually glacier outline)
 * @param {string} description  Base description for the export task
 */
exports.exportPixelPairsIndices = function(results, region, description) {

  // ---------------------------------------------------------------------------
  // Helper – find reference image (MCD43A3) with identical timestamp
  // ---------------------------------------------------------------------------
  function findReference(img, mcd43Col) {
    var ts = ee.Number(img.get('system:time_start'));
    return mcd43Col.filter(ee.Filter.eq('system:time_start', ts)).first();
  }

  // ---------------------------------------------------------------------------
  // Build pixel pairs for one collection (MOD09GA or MOD10A1)
  // ---------------------------------------------------------------------------
  function buildPairs(collection, family, refCol) {
    return collection.map(function(img) {
      var ref = findReference(img, refCol);
      return ee.FeatureCollection(ee.Algorithms.If(ref,
        // --------------------------------------------------
        // Construct stacked image (daily, reference, col/row)
        // --------------------------------------------------
        (function(){
          // Pick the appropriate daily albedo band (single band)
          var band;
          if (family === 'MOD09GA') {
            band = ee.Image(ee.Algorithms.If(
              img.bandNames().contains('broadband_albedo_ren_masked'),
              img.select('broadband_albedo_ren_masked'),
              img.select('broadband_albedo_ren')
            ));
          } else { // MOD10A1 family
            band = img.select('broadband_albedo_mod10a1');
          }
          return band.rename('alb_daily');
        })()
           .addBands(ref.select('broadband_albedo_mcd43a3').rename('alb_ref'))
           .addBands(ee.Image.pixelCoordinates(img.projection())
                       .rename(['col','row']))
           .sample({
             region: region,
             scale:  config.EXPORT_CONFIG.scale,       // 500 m for MOD09GA
             tileScale: config.EXPORT_CONFIG.tileScale,
             geometries: false                         // no geometry → lighter CSV
           })
           .map(function(ft){
             // -----------------------------
             // Attach metadata / predictors
             // -----------------------------
             var meta = {
               'family':   family,                                 // MOD09GA / MOD10A1
               'date':     ee.Date(img.get('system:time_start')).format('YYYY-MM-dd'),
               'is_terra': img.get('is_terra')
             };
             // Predictors only available for MOD09GA family
             if (family === 'MOD09GA') {
               meta = ee.Dictionary(meta).set({
                 'solar_zenith': img.get('solar_zenith'),
                 'ndsi_mean':    img.get('ndsi_mean'),
                 'mean_elev':    img.get('mean_elev')
               });
             }
             // Order of properties: alb_daily, alb_ref, col, row, then meta
             return ft.rename(['alb_daily','alb_ref','col','row']).set(meta);
           }),
        // If no reference image, return empty FeatureCollection → skipped
        ee.FeatureCollection([])
      ));
    }).flatten();
  }

  // ---------------------------------------------------------------------------
  // Build pairs for each daily family present in `results`
  // ---------------------------------------------------------------------------
  var refCol = results.mcd43a3;
  if (!refCol) {
    throw new Error('MCD43A3 collection is required as reference.');
  }

  var pairs = ee.FeatureCollection([]);
  if (results.ren)     pairs = pairs.merge(buildPairs(results.ren,     'MOD09GA', refCol));
  if (results.mod10a1) pairs = pairs.merge(buildPairs(results.mod10a1, 'MOD10A1', refCol));

  // ---------------------------------------------------------------------------
  // Launch Drive export task
  // ---------------------------------------------------------------------------
  Export.table.toDrive({
    collection:  pairs,
    description: description + '_pixel_pairs_idx',
    folder:      'albedo_pixel_pairs',
    fileFormat:  'CSV'
  });
}; 