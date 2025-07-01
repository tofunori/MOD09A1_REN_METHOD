/*
 * Topography‐correction helper for MOD09GA method
 * Copied from modules/methods/ren/topography.js.
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

  // Clip DEM-derived layers to the same footprint as the MODIS tile so that
  // subsequent per-pixel maths do not run over the entire global DEM.  This
  // dramatically reduces the number of pixels touched when the region of
  // interest is small.
  var imgGeom = image.geometry();

  var slopeRad  = config.slope.clip(imgGeom).multiply(deg2rad);
  var aspectRad = config.aspect.clip(imgGeom).multiply(deg2rad);

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

  // ---------------------------------------------------------------------------
  // QA / provenance bands
  // 1) Topographic cast shadow.
  //    A pixel is considered in shadow when incidence angle is negative
  //    (i.e. cos(theta_slope) <= 0).
  // 2) Visible-band saturation.  MODIS DN 32767 flags radiometric overflow.
  // ---------------------------------------------------------------------------

  var shadowMask = cosS.lte(0).rename('shadow_mask');
  var satVisMask = image.select('sur_refl_b01').eq(32767).rename('sat_vis');

  return image
    .addBands(ee.Image.cat(correctedBands))
    .addBands(vzCorr.multiply(180/Math.PI).rename('SensorZenith_corrected'))
    .addBands(szCorr.multiply(180/Math.PI).rename('SolarZenith_corrected'))
    .addBands([shadowMask, satVisMask]);
}

exports.topographyCorrection = topographyCorrection; 