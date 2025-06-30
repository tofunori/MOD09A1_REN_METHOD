/*
 * QA filtering helper for Ren method (MOD09GA Collection 6.1).
 * Extracted from modules/methods/ren.js so each concern lives in its own file.
 * Implements relaxed glacier-optimised QA as documented in Ren et al. (2021).
 */

/**
 * Apply relaxed QA mask to a MOD09GA image.
 * Clear sky or cloudy (bits 0-1 ≤1), no shadow (bit 2 =0),
 * cirrus ≤ small (bit 8 ≤1), any snow/ice confidence (>0), solar zenith < 80°.
 * @param {ee.Image} image MOD09GA image with state_1km QA & angle bands.
 * @return {ee.Image} QA-masked image.
 */
function qualityFilter(image) {
  var qa = image.select('state_1km');

  // Cloud state (bits 0-1): 0=clear,1=cloudy (accept 0 or 1)
  var clearSky = qa.bitwiseAnd(0x3).lte(1);

  // Cloud shadow (bit 2): 0=no shadow required
  var shadowFree = qa.bitwiseAnd(1 << 2).eq(0);

  // Cirrus detection (bit 8) accept ≤1 (none or small)
  var noCirrus = qa.bitwiseAnd(1 << 8).lte(1);

  // Snow/ice confidence (bits 12-13) >0
  var snowIceConf = qa.bitwiseAnd(0x3000).rightShift(12);
  var validSnowIce = snowIceConf.gt(0);

  // Solar zenith <80° (stored in centideg)
  var solarZenith = image.select('SolarZenith').multiply(0.01);
  var lowSZA = solarZenith.lt(80);

  var mask = clearSky.and(shadowFree).and(noCirrus).and(validSnowIce).and(lowSZA);
  return image.updateMask(mask);
}

exports.qualityFilter = qualityFilter; 