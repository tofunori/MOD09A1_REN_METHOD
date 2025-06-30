/*
 * Topography‐correction helper for Ren method
 * Extracted from original ren.js to keep each concern in its own file.
 * Follows Equations 3a and 3b of Ren et al. (2021).
 */

var config = require('users/tofunori/MOD09A1_REN_METHOD:modules/config.js');

/**
 * Apply topographic correction to MODIS surface reflectance.
 * @param {ee.Image} image – MOD09GA image with Solar/Sensor angle bands.
 * @returns {ee.Image} input image with topo-corrected bands + corrected angles.
 */
function topographyCorrection(image) {
  // Extract angle bands and convert to degrees → radians
  var solarZen  = image.select('SolarZenith').multiply(0.01);
  var solarAzi  = image.select('SolarAzimuth').multiply(0.01);
  var sensorZen = image.select('SensorZenith').multiply(0.01);
  var sensorAzi = image.select('SensorAzimuth').multiply(0.01);

  var deg2rad = Math.PI / 180;
  var szRad  = solarZen.multiply(deg2rad);
  var saRad  = solarAzi.multiply(deg2rad);
  var vzRad  = sensorZen.multiply(deg2rad);
  var vaRad  = sensorAzi.multiply(deg2rad);

  // Terrain information
  var slopeRad  = config.slope.multiply(deg2rad);
  var aspectRad = config.aspect.multiply(deg2rad);

  // Equation 3a: cos θvc
  var cosV = slopeRad.cos().multiply(vzRad.cos())
      .add(slopeRad.sin().multiply(vzRad.sin())
      .multiply(aspectRad.subtract(vaRad).cos()));

  // Equation 3b: cos θsc
  var cosS = slopeRad.cos().multiply(szRad.cos())
      .add(slopeRad.sin().multiply(szRad.sin())
      .multiply(aspectRad.subtract(saRad).cos()));

  var vzCorr = cosV.acos();
  var szCorr = cosS.acos();

  // Topographic correction factor ρ_flat = ρ_slope × (μ0' / μ0)
  var correction = cosS.divide(szRad.cos()).clamp(0.2, 5);

  // Apply to reflectance bands (scale 0.0001 → reflectance)
  var correctedBands = config.REFL_BANDS.map(function(b) {
    return image.select(b).multiply(0.0001).multiply(correction).rename(b + '_topo');
  });

  return image
    .addBands(ee.Image.cat(correctedBands))
    .addBands(vzCorr.multiply(180/Math.PI).rename('SensorZenith_corrected'))
    .addBands(szCorr.multiply(180/Math.PI).rename('SolarZenith_corrected'));
}

exports.topographyCorrection = topographyCorrection; 