/*
 * QA filtering helper for MOD09A1 method (MOD09GA Collection 6.1).
 * Copied from modules/methods/ren/qa.js.
 */

// -----------------------------------------------------------------------------
// MOD09GA QA FILTERS
// -----------------------------------------------------------------------------
// Cette version conserve deux fonctions :
//   • qualityFilterStrict  – filtrage original très conservateur (Ren et al.)
//   • qualityFilterRelaxed – garde 00/01, rejette seulement cirrus=11, SZA<85°
// La variable `qualityFilter` pointe par défaut sur la version RELAXÉE pour
// assurer la compatibilité avec processMOD09GAMethod.
// -----------------------------------------------------------------------------

/** Strict filter (Ren et al. 2021) */
function qualityFilterStrict(image) {
  var qa = image.select('state_1km');
  var clearSky   = qa.bitwiseAnd(0x3).eq(0);          // 00 seulement
  var shadowFree = qa.bitwiseAnd(1 << 2).eq(0);      // pas d'ombre
  var noCirrus   = qa.bitwiseAnd(3 << 8).eq(0);      // 00 seulement
  var lowSZA     = image.select('SolarZenith').multiply(0.01).lt(80);
  var mask = clearSky.and(shadowFree).and(noCirrus).and(lowSZA);
  return image.updateMask(mask);
}

/** Relaxed filter – recommandé pour glaciers (cloud 00/01, cirrus≠11, SZA<85°) */
function qualityFilterRelaxed(image) {
  var qa = image.select('state_1km');
  var clearSky   = qa.bitwiseAnd(0x3).lt(2);          // 00 ou 01
  var shadowFree = qa.bitwiseAnd(1 << 2).eq(0);
  var cirrusState   = qa.rightShift(8).bitwiseAnd(3); // 00-11
  var noHeavyCirrus = cirrusState.neq(3);             // rejette 11
  var lowSZA = image.select('SolarZenith').multiply(0.01).lt(85);
  var mask = clearSky.and(shadowFree).and(noHeavyCirrus).and(lowSZA);
  return image.updateMask(mask);
}

// Alias par défaut → version relaxée
var qualityFilter = qualityFilterRelaxed;

exports.qualityFilter        = qualityFilter;
exports.qualityFilterRelaxed = qualityFilterRelaxed;
exports.qualityFilterStrict  = qualityFilterStrict; 