/**
 * MOD09A1 Method – façade module.
 *
 * For backward compatibility this file simply re-exports the exact Ren-method
 * implementation from modules/methods/ren.js but lets callers import it via
 * modules/methods/mod09a1.js.  This fulfils the folder-rename request without
 * duplicating 400 + lines of logic.
 */

var ren = require('users/tofunori/MOD09A1_REN_METHOD:modules/methods/ren.js');

exports.processMOD09A1Method        = ren.processRenMethod;
exports.qualityFilter               = ren.qualityFilter;
exports.topographyCorrection        = ren.topographyCorrection;
exports.applyBRDFAnisotropicCorrection = ren.applyBRDFAnisotropicCorrection;
exports.classifySnowIce             = ren.classifySnowIce;
exports.computeBroadbandAlbedo      = ren.computeBroadbandAlbedo; 