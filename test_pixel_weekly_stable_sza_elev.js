// ============================================================================
// Weekly Pixel Analysis – Stable IDs + Solar Zenith & Elevation
// ----------------------------------------------------------------------------
// Ajoute :
//   • solar_zenith (°) pour MOD09GA uniquement (bande SolarZenith * 0.01)
//   • elevation (m, DEM AW3D30) pour tous les pixels
// ============================================================================

// MODULE IMPORTS --------------------------------------------------------------
var glacierUtils = require('users/tofunori/MOD09A1_REN_METHOD:modules/utils/glacier.js');
var originalComparison = require('users/tofunori/MOD09A1_REN_METHOD:modules/workflows/comparison.js');
var config = require('users/tofunori/MOD09A1_REN_METHOD:modules/config.js');

// CONSTANTES ------------------------------------------------------------------
var SCALE_METERS = 500;
var MODIS_PROJ = ee.ImageCollection('MODIS/006/MOD09GA')
                   .first()
                   .select('sur_refl_b01')
                   .projection()
                   .atScale(SCALE_METERS);
var DEM = config.dem.reproject({crs: MODIS_PROJ, scale: SCALE_METERS}).rename('elevation');

// UTILITÉS --------------------------------------------------------------------
function addStablePixelCoords(image) {
  var coords   = ee.Image.pixelCoordinates(MODIS_PROJ);
  var pixelRow = coords.select('y').toInt().rename('pixel_row');
  var pixelCol = coords.select('x').toInt().rename('pixel_col');
  var pixelId  = pixelRow.multiply(1e6).add(pixelCol).toInt64().rename('pixel_id');

  var lonLat = ee.Image.pixelLonLat();
  var tileH  = lonLat.select('longitude').multiply(100).round().toInt().rename('tile_h');
  var tileV  = lonLat.select('latitude').multiply(100).round().toInt().rename('tile_v');

  return image.addBands([tileH, tileV, pixelRow, pixelCol, pixelId]);
}

function sampleCollection(col, band, methodName, region) {
  return col.map(function(img){
      img = ee.Image(img);
      var date = ee.Date(img.get('system:time_start'));

      // ----------------------------------------------------------------
      // Masque QA relaxé (MOD09GA uniquement)
      // ----------------------------------------------------------------
      if (methodName === 'MOD09GA') {
        var qa = img.select('state_1km');
        var clearSky   = qa.bitwiseAnd(0x3).lt(2);             // bits 0-1 : 00 ou 01
        var shadowFree = qa.bitwiseAnd(1 << 2).eq(0);          // bit 2     : pas d'ombre
        var cirrusState   = qa.rightShift(8).bitwiseAnd(3);    // bits 8-9
        var noHeavyCirrus = cirrusState.neq(3);                // on rejette seulement 11
        var lowSZA = img.select('SolarZenith').multiply(0.01).lt(85);
        var relaxedMask = clearSky.and(shadowFree).and(noHeavyCirrus).and(lowSZA);
        img = img.updateMask(relaxedMask);
      }

      var base = addStablePixelCoords(img.select(band).rename('albedo'));

      // Ajout elevation (DEM mosaïque) – toujours
      base = base.addBands(DEM);

      // Ajout solar zenith (MOD09GA uniquement)
      if (methodName === 'MOD09GA') {
        var sza = img.select('SolarZenith').multiply(0.01).rename('solar_zenith');
        base = base.addBands(sza);
      }

      // Préparer liste de bandes à échantillonner
      var bandList = ['albedo','elevation','tile_h','tile_v','pixel_row','pixel_col','pixel_id'];
      if (methodName === 'MOD09GA') bandList.push('solar_zenith');

      return base.select(bandList)
                 .sample({
                   region: region,
                   scale: SCALE_METERS,
                   projection: MODIS_PROJ,
                   geometries: true
                 })
                 .map(function(feat){
                   var coords = feat.geometry().coordinates();
                   return feat.set({
                     'albedo_value': feat.get('albedo'),
                     'longitude': ee.List(coords).get(0),
                     'latitude' : ee.List(coords).get(1),
                     'date'     : date.format('YYYY-MM-dd'),
                     'method'   : methodName
                   });
                 });
    }).flatten();
}

// ----------------------------- MAIN FUNCTION --------------------------------
function exportPixelSeason(startDateStr, endDateStr, region){
  var startDate = ee.Date(startDateStr);
  var endDate   = ee.Date(endDateStr).advance(1,'day'); // inclusive
  region = region || glacierUtils.initializeGlacierData().geometry;

  print('🔧 Stable pixel export (SZA+DEM) :', startDate.format('YYYY-MM-dd').getInfo(),'→', endDate.advance(-1,'day').format('YYYY-MM-dd').getInfo());

  var flags = {ren:true, mod10a1:true, mcd43a3:true};
  var res = originalComparison.runModularComparison(startDate,endDate,flags,glacierUtils.initializeGlacierData().outlines,region);

  var samples = ee.FeatureCollection([]);
  if (res.ren && res.ren.size().gt(0))   samples = samples.merge(sampleCollection(res.ren,'broadband_albedo_ren_masked','MOD09GA',region));
  if (res.mod10a1 && res.mod10a1.size().gt(0)) samples = samples.merge(sampleCollection(res.mod10a1,'broadband_albedo_mod10a1','MOD10A1',region));
  if (res.mcd43a3 && res.mcd43a3.size().gt(0)) samples = samples.merge(sampleCollection(res.mcd43a3,'broadband_albedo_mcd43a3','MCD43A3',region));

  samples = samples.distinct(['pixel_id','date','method']);

  var desc = 'PIXELS_three_methods_SZA_DEM_'+startDateStr.replace(/-/g,'')+'_to_'+endDateStr.replace(/-/g,'');
  Export.table.toDrive({collection:samples, description:desc, folder:'pixel_test_season', fileFormat:'CSV'});

  samples.size().evaluate(function(n){ print('📊 Pixels exportés :', n, '→', desc); });
}

// AUTO-RUN -------------------------------------------------------------------
var glacierData = glacierUtils.initializeGlacierData();
exportPixelSeason('2023-06-01','2023-09-30',glacierData.geometry);
// ---------------------------------------------------------------------------- 