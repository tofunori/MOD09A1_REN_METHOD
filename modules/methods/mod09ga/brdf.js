/*
 * BRDF anisotropic‐correction helper for MOD09GA method.
 * Copied from modules/methods/ren/brdf.js.
 */

var config = require('users/tofunori/MOD09A1_REN_METHOD:modules/config.js');

function applyBRDFAnisotropicCorrection(image, surfaceType) {
  var sensorZenithCorrected = image.select('SensorZenith_corrected').multiply(Math.PI / 180);
  var sensorAzimuth = image.select('SensorAzimuth').multiply(0.01).multiply(Math.PI / 180);
  var solarAzimuth  = image.select('SolarAzimuth') .multiply(0.01).multiply(Math.PI / 180);
  var relativeAzimuth = sensorAzimuth.subtract(solarAzimuth);

  var coeffTable = surfaceType === 'snow' ? config.SNOW_BRDF_COEFFICIENTS : config.ICE_BRDF_COEFFICIENTS;
  var bandsList  = surfaceType === 'snow' ? config.TOPO_BANDS_SNOW : config.TOPO_BANDS_ALL;
  var bandNums   = surfaceType === 'snow' ? config.BAND_NUMS_SNOW   : config.BAND_NUMS_ALL;

  var narrowbands = bandsList.map(function (band, idx) {
    var bandId = bandNums[idx];
    var coeff  = coeffTable[bandId];
    if (!coeff) {
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
    } else {
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

    return image.select(band).subtract(anisotropy).rename('narrowband_' + bandId);
  }).filter(function (img) { return img !== null; });

  return image.addBands(ee.Image.cat(narrowbands));
}

exports.applyBRDFAnisotropicCorrection = applyBRDFAnisotropicCorrection; 