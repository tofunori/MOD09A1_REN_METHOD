/**
 * MOD09A1 Method – canonical implementation of the Ren et al. glacier-albedo
 * workflow.
 *
 * This file replaces the previous façade.  It wires together the dedicated
 * helper modules under modules/methods/mod09a1/ and exposes the same public
 * API that downstream code expects.
 *
 * Legacy code that still imports modules/methods/ren.js will continue to work
 * because that module is now only a tiny shim re-exporting everything from
 * here.
 */

// ---------------------------------------------------------------------------
// Module imports
// ---------------------------------------------------------------------------

var config          = require('users/tofunori/MOD09A1_REN_METHOD:modules/config.js');
var topoHelper      = require('users/tofunori/MOD09A1_REN_METHOD:modules/methods/mod09a1/topography.js');
var brdfHelper      = require('users/tofunori/MOD09A1_REN_METHOD:modules/methods/mod09a1/brdf.js');
var albedoHelper    = require('users/tofunori/MOD09A1_REN_METHOD:modules/methods/mod09a1/albedo.js');
var qaHelper        = require('users/tofunori/MOD09A1_REN_METHOD:modules/methods/mod09a1/qa.js');
var classifyHelper  = require('users/tofunori/MOD09A1_REN_METHOD:modules/methods/mod09a1/classify.js');

// ---------------------------------------------------------------------------
// Lightweight wrappers around helper functions (public API)
// ---------------------------------------------------------------------------

function qualityFilter(image) {
  return qaHelper.qualityFilter(image);
}

function topographyCorrection(image) {
  return topoHelper.topographyCorrection(image);
}

function applyBRDFAnisotropicCorrection(image, surfaceType) {
  return brdfHelper.applyBRDFAnisotropicCorrection(image, surfaceType);
}

function classifySnowIce(image) {
  return classifyHelper.classifySnowIce(image);
}

function computeBroadbandAlbedo(image) {
  return albedoHelper.computeBroadbandAlbedo(image);
}

// ---------------------------------------------------------------------------
// High-level processing pipeline (adapted from original processRenMethod)
// ---------------------------------------------------------------------------

/**
 * Run the complete MOD09A1 processing chain for a single MODIS image.
 *
 * 1.  Apply QA mask.
 * 2.  Topographic correction.
 * 3.  Snow/ice classification (NDSI).
 * 4.  BRDF anisotropic correction for snow and ice separately.
 * 5.  Merge narrow-band albedos and compute broadband albedo.
 * 6.  Apply glacier mask provided by caller.
 *
 * @param {ee.Image}               image            MOD09GA image.
 * @param {ee.FeatureCollection}   glacierOutlines  Glacier polygons.
 * @param {Function}               createGlacierMask Helper that returns a
 *                      raster glacier mask (expects signature
 *                      `(glacierOutlines, referenceImage)`).
 * @return {ee.Image} Processed image with broadband_albedo_ren and ancillary
 *                   bands.  The band name is kept for backwards compatibility.
 */
function processMOD09A1Method(image, glacierOutlines, createGlacierMask) {
  // 1) QA filtering
  var filtered = qualityFilter(image);

  // 2) Topographic correction of reflectance and angles
  var topoImg = topographyCorrection(filtered);

  // 3) Snow-/ice-mask via NDSI
  var classified = classifySnowIce(topoImg);

  // 4) BRDF anisotropic correction (separate snow & ice stacks)
  var nbSnow = applyBRDFAnisotropicCorrection(classified, 'snow');
  var nbIce  = applyBRDFAnisotropicCorrection(classified, 'ice');

  // 5) Merge snow/ice stacks, keeping band4 from ice (as in original code)
  var snowMask = classified.select('snow_mask');
  var mergedNB = config.NARROWBAND_ALL.map(function (band) {
    if (band === 'narrowband_b4') {
      return nbIce.select(band);
    }
    var merged = nbIce.select(band).where(snowMask, nbSnow.select(band));
    return merged.rename(band);
  });
  var withNB = classified.addBands(ee.Image.cat(mergedNB));

  // 6) Broadband albedo
  var withBB = computeBroadbandAlbedo(withNB);

  // 7) Glacier mask and final masked product
  var glacierMaskRaw = createGlacierMask(glacierOutlines, null);
  var refProj        = withBB.select('broadband_albedo_ren').projection();
  var glacierMask    = glacierMaskRaw.reproject(refProj);

  var maskedAlbedo = withBB.select('broadband_albedo_ren')
                           .updateMask(glacierMask)
                           .rename('broadband_albedo_ren_masked');

  return filtered
    .addBands(withBB)
    .addBands(maskedAlbedo)
    .copyProperties(image, [
      'system:time_start',
      'system:time_end'
    ]);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

exports.processMOD09A1Method           = processMOD09A1Method;
exports.qualityFilter                  = qualityFilter;
exports.topographyCorrection           = topographyCorrection;
exports.applyBRDFAnisotropicCorrection = applyBRDFAnisotropicCorrection;
exports.classifySnowIce                = classifySnowIce;
exports.computeBroadbandAlbedo         = computeBroadbandAlbedo; 