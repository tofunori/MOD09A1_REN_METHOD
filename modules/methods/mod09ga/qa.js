/*
 * QA filtering helper for MOD09A1 method (MOD09GA Collection 6.1).
 * Copied from modules/methods/ren/qa.js.
 */

function qualityFilter(image) {
  var qa = image.select('state_1km');
  // Bits 0-1 (cloud state): 00 = clear.  Keep only fully clear pixels.
  var clearSky = qa.bitwiseAnd(0x3).eq(0);
  var shadowFree = qa.bitwiseAnd(1 << 2).eq(0);
  // Bits 8-9 (cirrus detected): 00 = none.  Reject any cirrus contamination.
  var noCirrus = qa.bitwiseAnd(3 << 8).eq(0);
  var snowIceConf = qa.bitwiseAnd(0x3000).rightShift(12);
  var validSnowIce = snowIceConf.gt(0);
  var solarZenith = image.select('SolarZenith').multiply(0.01);
  var lowSZA = solarZenith.lt(80);
  var mask = clearSky.and(shadowFree).and(noCirrus).and(validSnowIce).and(lowSZA);
  return image.updateMask(mask);
}

exports.qualityFilter = qualityFilter; 