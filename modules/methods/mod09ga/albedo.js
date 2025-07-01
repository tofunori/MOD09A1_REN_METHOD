/*
 * Broadband albedo computation helper for MOD09GA method.
 * Copied from modules/methods/ren/albedo.js.
 */

var config = require('users/tofunori/MOD09GA_REN_METHOD:modules/config.js');

function computeBroadbandAlbedo(image) {
  var b1 = image.select('narrowband_b1');
  var b2 = image.select('narrowband_b2');
  var b3 = image.select('narrowband_b3');
  var b4 = image.bandNames().contains('narrowband_b4') ? image.select('narrowband_b4') : ee.Image.constant(0);
  var b5 = image.select('narrowband_b5');
  var b7 = image.select('narrowband_b7');

  var ICE_COEFF = config.iceCoefficients || config.ICE_COEFFICIENTS;

  var ice = b1.multiply(ICE_COEFF.b1)
    .add(b2.multiply(ICE_COEFF.b2))
    .add(b3.multiply(ICE_COEFF.b3))
    .add(b4.multiply(ICE_COEFF.b4))
    .add(b5.multiply(ICE_COEFF.b5))
    .add(b7.multiply(ICE_COEFF.b7))
    .add(ICE_COEFF.constant)
    .rename('ice_albedo');

  var SNOW_COEFF = config.snowCoefficients || config.SNOW_COEFFICIENTS;

  var snow = b1.multiply(SNOW_COEFF.b1)
    .add(b2.multiply(SNOW_COEFF.b2))
    .add(b3.multiply(SNOW_COEFF.b3))
    .add(b5.multiply(SNOW_COEFF.b5))
    .add(b7.multiply(SNOW_COEFF.b7))
    .add(SNOW_COEFF.constant)
    .rename('snow_albedo');

  var snowMask = image.select('snow_mask');
  var broadband = ice.where(snowMask, snow).rename('broadband_albedo_ren');
  return image.addBands([ice, snow, broadband]);
}

exports.computeBroadbandAlbedo = computeBroadbandAlbedo; 