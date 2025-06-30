/*
 * Broadband albedo computation helper for MOD09A1 method.
 * Copied from modules/methods/ren/albedo.js.
 */

var config = require('users/tofunori/MOD09A1_REN_METHOD:modules/config.js');

function computeBroadbandAlbedo(image) {
  var b1 = image.select('narrowband_b1');
  var b2 = image.select('narrowband_b2');
  var b3 = image.select('narrowband_b3');
  var b4 = image.bandNames().contains('narrowband_b4') ? image.select('narrowband_b4') : ee.Image.constant(0);
  var b5 = image.select('narrowband_b5');
  var b7 = image.select('narrowband_b7');

  var ice = b1.multiply(config.iceCoefficients.b1)
    .add(b2.multiply(config.iceCoefficients.b2))
    .add(b3.multiply(config.iceCoefficients.b3))
    .add(b4.multiply(config.iceCoefficients.b4))
    .add(b5.multiply(config.iceCoefficients.b5))
    .add(b7.multiply(config.iceCoefficients.b7))
    .add(config.iceCoefficients.constant)
    .rename('ice_albedo');

  var snow = b1.multiply(config.snowCoefficients.b1)
    .add(b2.multiply(config.snowCoefficients.b2))
    .add(b3.multiply(config.snowCoefficients.b3))
    .add(b5.multiply(config.snowCoefficients.b5))
    .add(b7.multiply(config.snowCoefficients.b7))
    .add(config.snowCoefficients.constant)
    .rename('snow_albedo');

  var snowMask = image.select('snow_mask');
  var broadband = ice.where(snowMask, snow).rename('broadband_albedo_ren');
  return image.addBands([ice, snow, broadband]);
}

exports.computeBroadbandAlbedo = computeBroadbandAlbedo; 