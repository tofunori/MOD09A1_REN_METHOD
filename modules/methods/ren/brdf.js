/*
 * BRDF anisotropic‐correction helper for Ren method.
 * Provides applyBRDFAnisotropicCorrection(surfaceType) that returns an ee.Image
 * with narrowband albedo bands `narrowband_b*` added.
 *
 * Extracted from modules/methods/ren.js to keep each concern in its own file.
 */

var ee = require('users/google/earthengine:legacy'); // ensure ee is available in nested modules
var config = require('users/tofunori/MOD09A1_REN_METHOD:modules/config.js');

/**
 * Apply BRDF anisotropic correction (P1 for snow, P2 for ice).
 * @param {ee.Image} image Input image with topographically-corrected bands and angle bands from topo helper.
 * @param {string}   surfaceType "snow" | "ice" – selects coefficient table.
 * @return {ee.Image}           Image with narrowband albedo bands appended.
 */
function applyBRDFAnisotropicCorrection(image, surfaceType) {
  var sensorZenithCorrected = image.select('SensorZenith_corrected').multiply(Math.PI / 180);
  var sensorAzimuth = image.select('SensorAzimuth').multiply(0.01).multiply(Math.PI / 180);
  var solarAzimuth  = image.select('SolarAzimuth') .multiply(0.01).multiply(Math.PI / 180);
  var relativeAzimuth = sensorAzimuth.subtract(solarAzimuth);

  // Choose coefficient table
  var coeffTable = surfaceType === 'snow' ? config.SNOW_BRDF_COEFFICIENTS : config.ICE_BRDF_COEFFICIENTS;
  var bandsList  = surfaceType === 'snow' ? config.TOPO_BANDS_SNOW : config.TOPO_BANDS_ALL;
  var bandNums   = surfaceType === 'snow' ? config.BAND_NUMS_SNOW   : config.BAND_NUMS_ALL;

  var narrowbands = bandsList.map(function (band, idx) {
    var bandId = bandNums[idx];
    var coeff  = coeffTable[bandId];
    if (!coeff) { // Band missing for snow (e.g., b4)
      return null;
    }

    var g1, g2, g3, anisotropy;
    if (surfaceType === 'snow') {
      var theta2 = sensorZenithCorrected.multiply(sensorZenithCorrected);
      g1 = theta2;
      g2 = theta2.multiply(relativeAzimuth.cos());
      g3 = g2.multiply(relativeAzimuth.cos());
      anisotropy = theta2.add(0.5).subtract(Math.PI * Math.PI / 8).multiply(coeff.c1)
        .add(g2.multiply(coeff.c2))
        .add(g3.add(0.25).subtract(Math.PI * Math.PI / 16).multiply(coeff.c3))
        .multiply(sensorZenithCorrected.divide(coeff.theta_c).multiply(-1).exp());
    } else { // ice P2
      var cosTheta = sensorZenithCorrected.cos();
      var theta2i  = sensorZenithCorrected.multiply(sensorZenithCorrected);
      g1 = cosTheta;
      g2 = theta2i.multiply(relativeAzimuth.cos());
      g3 = g2.multiply(relativeAzimuth.cos());
      anisotropy = cosTheta.subtract(2 / 3).multiply(coeff.c1)
        .add(g2.multiply(coeff.c2))
        .add(g3.add(0.25).subtract(Math.PI * Math.PI / 16).multiply(coeff.c3))
        .multiply(sensorZenithCorrected.divide(coeff.theta_c).multiply(-1).exp());
    }

    var nb = image.select(band).subtract(anisotropy).rename('narrowband_' + bandId);
    return nb;
  }).filter(function (img) { return img !== null; });

  return image.addBands(ee.Image.cat(narrowbands));
}

exports.applyBRDFAnisotropicCorrection = applyBRDFAnisotropicCorrection; 