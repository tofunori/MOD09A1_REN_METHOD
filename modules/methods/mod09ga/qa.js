/*
 * QA filtering helper for MOD09A1 method (MOD09GA Collection 6.1).
 * Copied from modules/methods/ren/qa.js.
 */

function qualityFilter(image) {
  var qa = image.select('state_1km');
  var clearSky = qa.bitwiseAnd(0x3).lte(1);
  var shadowFree = qa.bitwiseAnd(1 << 2).eq(0);
  var noCirrus = qa.bitwiseAnd(1 << 8).lte(1);
  var snowIceConf = qa.bitwiseAnd(0x3000).rightShift(12);
  var validSnowIce = snowIceConf.gt(0);
  var solarZenith = image.select('SolarZenith').multiply(0.01);
  var lowSZA = solarZenith.lt(80);
  var mask = clearSky.and(shadowFree).and(noCirrus).and(validSnowIce).and(lowSZA);
  return image.updateMask(mask);
}

exports.qualityFilter = qualityFilter; 