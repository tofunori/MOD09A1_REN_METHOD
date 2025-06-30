/*
 * QA helper for MOD10A1 method.
 * Contains QA_CONFIG plus createStandardQualityMask / createRelaxedQualityMask helpers
 * previously defined inline in modules/methods/mod10a1.js.
 */

// Standard QA configuration (from MODIS_Albedo project)
var QA_CONFIG = {
  STANDARD: {
    basicLevel: 'good',                    // QA level: 'best'(0), 'good'(0-1), 'ok'(0-2), 'all'(0-3)
    excludeInlandWater: true,
    excludeVisibleScreenFail: true,
    excludeNDSIScreenFail: true,
    excludeTempHeightFail: true,
    excludeSWIRAnomaly: true,
    excludeProbablyCloudy: true,
    excludeProbablyClear: false,
    excludeHighSolarZenith: true
  },
  // Bit mapping table reused by both standard & relaxed configs
  BIT_MAPPING: [
    {flag: 'excludeInlandWater',     bit: 0, mask: 1},
    {flag: 'excludeVisibleScreenFail',bit: 1, mask: 2},
    {flag: 'excludeNDSIScreenFail',  bit: 2, mask: 4},
    {flag: 'excludeTempHeightFail',  bit: 3, mask: 8},
    {flag: 'excludeSWIRAnomaly',     bit: 4, mask: 16},
    {flag: 'excludeProbablyCloudy',  bit: 5, mask: 32},
    {flag: 'excludeProbablyClear',   bit: 6, mask: 64},
    {flag: 'excludeHighSolarZenith', bit: 7, mask: 128}
  ]
};

// ES5-compatible deep copy & override (Object.assign is not supported in GEE)
var relaxedStandard = (function() {
  var copy = {};
  for (var key in QA_CONFIG.STANDARD) {
    if (QA_CONFIG.STANDARD.hasOwnProperty(key)) {
      copy[key] = QA_CONFIG.STANDARD[key];
    }
  }
  // Override with relaxed options
  copy.basicLevel = 'ok';
  copy.excludeInlandWater = false;
  copy.excludeTempHeightFail = false;
  copy.excludeSWIRAnomaly = false;
  copy.excludeProbablyCloudy = false;
  copy.excludeHighSolarZenith = false;
  return copy;
})();

var QA_CONFIG_RELAXED = {
  STANDARD: relaxedStandard,
  BIT_MAPPING: QA_CONFIG.BIT_MAPPING
};

/** Basic QA mask based on quality level */
function getBasicQAMask(img, level) {
  var basic = img.select('NDSI_Snow_Cover_Basic_QA');
  var mask;
  switch(level){
    case 'best': mask = basic.eq(0); break;
    case 'good': mask = basic.lte(1); break;
    case 'ok':   mask = basic.lte(2); break;
    case 'all':  mask = basic.lte(3); break;
    default:     mask = basic.lte(1);
  }
  return mask.and(basic.neq(211)).and(basic.neq(239)); // exclude night & ocean
}

/** Algorithm flags QA mask */
function getAlgorithmFlagsMask(img, flags){
  var alg = img.select('NDSI_Snow_Cover_Algorithm_Flags_QA').uint8();
  var mask = ee.Image(1);
  QA_CONFIG.BIT_MAPPING.forEach(function(m){
    if(flags[m.flag]){
      mask = mask.and(alg.bitwiseAnd(m.mask).eq(0));
    }
  });
  return mask;
}

function createComprehensiveMask(img, preset){
  var basicMask = getBasicQAMask(img, preset.basicLevel||'good');
  var flagsMask = getAlgorithmFlagsMask(img, preset);
  return basicMask.and(flagsMask);
}

function createStandardQualityMask(img){
  return createComprehensiveMask(img, QA_CONFIG.STANDARD);
}

function createRelaxedQualityMask(img){
  return createComprehensiveMask(img, QA_CONFIG_RELAXED.STANDARD);
}

// Exports
exports.QA_CONFIG = QA_CONFIG;
exports.QA_CONFIG_RELAXED = QA_CONFIG_RELAXED;
exports.getBasicQAMask = getBasicQAMask;
exports.getAlgorithmFlagsMask = getAlgorithmFlagsMask;
exports.createStandardQualityMask = createStandardQualityMask;
exports.createRelaxedQualityMask = createRelaxedQualityMask; 