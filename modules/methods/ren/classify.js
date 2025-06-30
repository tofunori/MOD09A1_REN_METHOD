/*
 * Snow/Ice classification helper for Ren method.
 * Provides classifySnowIce(image) adding NDSI and snow_mask bands.
 */

var config = require('users/tofunori/MOD09A1_REN_METHOD:modules/config.js');

/**
 * Classify glacier surface as snow (NDSI>0.4) or ice.
 * Uses topographically–corrected green band if available.
 * @param {ee.Image} image Image with reflectance bands (topo-corrected optional).
 * @return {ee.Image} Image with NDSI and binary snow_mask bands appended.
 */
function classifySnowIce(image) {
  var GREEN_TOPO = 'sur_refl_b04_topo';
  var SWIR6_TOPO = 'sur_refl_b06_topo';

  // Prefer topo-corrected reflectance where present
  var green = image.bandNames().contains(GREEN_TOPO) ?
                image.select(GREEN_TOPO) :
                image.select('sur_refl_b04').multiply(0.0001);

  var swir = image.bandNames().contains(SWIR6_TOPO) ?
                image.select(SWIR6_TOPO) :
                image.select('sur_refl_b06').multiply(0.0001);

  var ndsi = green.subtract(swir).divide(green.add(swir)).rename('NDSI');
  var snowMask = ndsi.gt(config.QA_CONFIG.ndsi_threshold).rename('snow_mask');

  return image.addBands([ndsi, snowMask]);
}

exports.classifySnowIce = classifySnowIce; 