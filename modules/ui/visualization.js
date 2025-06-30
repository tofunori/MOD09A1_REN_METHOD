/**
 * Map Visualization Module
 * 
 * Functions for map display, layer management, and visual styling
 * 
 * Author: Modular Comparison Framework
 * Date: 2025-06-30
 */

// ============================================================================
// MODULE IMPORTS
// ============================================================================

var config = require('users/tofunori/MOD09A1_REN_METHOD:modules/config.js');

// ============================================================================
// VISUALIZATION PARAMETERS
// ============================================================================

/**
 * Albedo visualization parameters for consistent display
 */
var VIS_PARAMS = {
  albedo: {
    min: 0.0,
    max: 1.0,
    palette: ['black', 'blue', 'purple', 'cyan', 'green', 'yellow', 'red']
  },
  
  albedo_difference: {
    min: -0.5,
    max: 0.5,
    palette: ['red', 'orange', 'yellow', 'white', 'cyan', 'blue', 'purple']
  },
  
  glacier_fraction: {
    min: 0,
    max: 1,
    palette: ['white', 'lightblue', 'blue', 'darkblue']
  },
  
  qa_mask: {
    min: 0,
    max: 1,
    palette: ['red', 'green']
  }
};

// ============================================================================
// MAP SETUP FUNCTIONS
// ============================================================================

/**
 * Initialize map with glacier region
 */
function initializeMap(glacierGeometry) {
  // Clear existing layers
  Map.layers().reset();
  
  // Center map on glacier region with error margin
  var center = glacierGeometry.centroid(1); // 1 meter error margin
  Map.centerObject(center, 12);
  
  // Set base map style
  Map.setOptions('HYBRID'); // Shows both satellite and terrain
  
  print('🗺️ Map initialized and centered on glacier region');
}

/**
 * Set map view to optimal glacier viewing parameters
 */
function setOptimalGlacierView(glacierGeometry) {
  var bounds = glacierGeometry.bounds(1); // 1 meter error margin
  Map.centerObject(bounds, 11);
  
  // Add glacier outline for reference
  Map.addLayer(
    ee.Image().paint(glacierGeometry, 1, 2),
    {palette: ['yellow'], opacity: 0.7},
    'Glacier Outline'
  );
}

// ============================================================================
// LAYER MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Add albedo comparison layers to map
 */
function addComparisonLayers(results, layerConfig, glacierMask, glacierOutlines) {
  print('🎨 Adding comparison layers to map...');
  
  // Add individual method layers with glacier mask
  if (results.ren && layerConfig.showRen) {
    addMethodLayer(results.ren, 'broadband_albedo_ren', 'Ren Method', VIS_PARAMS.albedo, glacierMask, glacierOutlines);
  }
  
  if (results.mod10a1 && layerConfig.showMOD10A1) {
    addMethodLayer(results.mod10a1, 'broadband_albedo_mod10a1', 'MOD10A1', VIS_PARAMS.albedo, glacierMask, glacierOutlines);
  }
  
  if (results.mcd43a3 && layerConfig.showMCD43A3) {
    addMethodLayer(results.mcd43a3, 'broadband_albedo_mcd43a3', 'MCD43A3', VIS_PARAMS.albedo, glacierMask, glacierOutlines);
  }
  
  // Add difference layers if requested
  if (layerConfig.showDifferences) {
    addDifferenceLayers(results, glacierMask, glacierOutlines);
  }
  
  print('✅ Comparison layers added to map');
}

/**
 * Add individual method layer to map with proper glacier masking
 */
function addMethodLayer(collection, bandName, methodName, visParams, glacierMask, glacierOutlines) {
  if (collection && collection.size().getInfo() > 0) {
    // Create median composite
    var image = collection.median().select(bandName);
    
    // Optionally reproject glacier mask to the image projection to ensure alignment
    var projectedMask = glacierMask ? glacierMask.reproject(image.projection()) : null;
    
    // Apply glacier mask if provided, otherwise try to preserve existing mask
    var maskedImage;
    if (projectedMask) {
      maskedImage = image.updateMask(projectedMask);
    } else {
      // Try to preserve mask from the collection
      var sampleMask = collection.first().mask();
      maskedImage = image.updateMask(sampleMask);
    }
    
    // Strictly clip to glacier outlines if provided (removes any residual outside pixels)
    if (glacierOutlines) {
      maskedImage = maskedImage.clip(glacierOutlines);
    }
    
    Map.addLayer(
      maskedImage,
      visParams,
      methodName + ' (Median)',
      true, // visible
      0.8   // opacity
    );
    
    print('📍 Added layer: ' + methodName);
  }
}

/**
 * Add difference layers between methods
 */
function addDifferenceLayers(results, glacierMask, glacierOutlines) {
  // Ren vs MOD10A1 difference
  if (results.ren && results.mod10a1) {
    var renMOD10Diff = createDifferenceImage(
      results.ren, 'broadband_albedo_ren',
      results.mod10a1, 'broadband_albedo_mod10a1',
      glacierMask,
      glacierOutlines
    );
    
    Map.addLayer(
      renMOD10Diff,
      VIS_PARAMS.albedo_difference,
      'Ren - MOD10A1 Difference',
      false, // initially hidden
      0.7
    );
  }
  
  // Ren vs MCD43A3 difference
  if (results.ren && results.mcd43a3) {
    var renMCD43Diff = createDifferenceImage(
      results.ren, 'broadband_albedo_ren',
      results.mcd43a3, 'broadband_albedo_mcd43a3',
      glacierMask,
      glacierOutlines
    );
    
    Map.addLayer(
      renMCD43Diff,
      VIS_PARAMS.albedo_difference,
      'Ren - MCD43A3 Difference',
      false, // initially hidden
      0.7
    );
  }
  
  // MOD10A1 vs MCD43A3 difference
  if (results.mod10a1 && results.mcd43a3) {
    var mod10MCD43Diff = createDifferenceImage(
      results.mod10a1, 'broadband_albedo_mod10a1',
      results.mcd43a3, 'broadband_albedo_mcd43a3',
      glacierMask,
      glacierOutlines
    );
    
    Map.addLayer(
      mod10MCD43Diff,
      VIS_PARAMS.albedo_difference,
      'MOD10A1 - MCD43A3 Difference',
      false, // initially hidden
      0.7
    );
  }
}

/**
 * Create difference image between two collections
 */
function createDifferenceImage(collection1, band1, collection2, band2, glacierMask, glacierOutlines) {
  // Create median composites for comparison
  var median1 = collection1.median().select(band1);
  var median2 = collection2.median().select(band2);
  
  // Calculate difference
  var difference = median1.subtract(median2).rename('albedo_difference');
  
  // Apply glacier mask if provided
  if (glacierMask) {
    var projectedMask = glacierMask.reproject(difference.projection());
    difference = difference.updateMask(projectedMask);
  }
  
  if (glacierOutlines) {
    difference = difference.clip(glacierOutlines);
  }
  
  return difference;
}

// ============================================================================
// LAYER CONTROL FUNCTIONS
// ============================================================================

/**
 * Toggle layer visibility
 */
function toggleLayer(layerName, visible) {
  var layers = Map.layers();
  
  for (var i = 0; i < layers.length(); i++) {
    var layer = layers.get(i);
    if (layer.getName() === layerName) {
      layer.setShown(visible);
      break;
    }
  }
}

/**
 * Set layer opacity
 */
function setLayerOpacity(layerName, opacity) {
  var layers = Map.layers();
  
  for (var i = 0; i < layers.length(); i++) {
    var layer = layers.get(i);
    if (layer.getName() === layerName) {
      layer.setOpacity(opacity);
      break;
    }
  }
}

/**
 * Remove all comparison layers
 */
function clearComparisonLayers() {
  var layers = Map.layers();
  var layersToRemove = [];
  
  // Identify comparison layers
  for (var i = 0; i < layers.length(); i++) {
    var layer = layers.get(i);
    var name = layer.getName();
    
    if (name.indexOf('Ren') !== -1 || 
        name.indexOf('MOD10A1') !== -1 || 
        name.indexOf('MCD43A3') !== -1 ||
        name.indexOf('Difference') !== -1) {
      layersToRemove.push(i);
    }
  }
  
  // Remove layers (in reverse order to maintain indices)
  for (var i = layersToRemove.length - 1; i >= 0; i--) {
    layers.remove(layers.get(layersToRemove[i]));
  }
  
  print('🧹 Cleared existing comparison layers');
}

// ============================================================================
// AUXILIARY VISUALIZATION FUNCTIONS
// ============================================================================

/**
 * Add glacier fraction layer for context
 */
function addGlacierFractionLayer(glacierFraction) {
  if (glacierFraction) {
    Map.addLayer(
      glacierFraction,
      VIS_PARAMS.glacier_fraction,
      'Glacier Fraction',
      false, // initially hidden
      0.6
    );
    
    print('❄️ Added glacier fraction layer');
  }
}

/**
 * Add quality assessment layers for debugging
 */
function addQALayers(results) {
  print('🔍 Adding QA layers for debugging...');
  
  if (results.ren) {
    var renQA = results.ren.first().select('QA_mask').selfMask();
    Map.addLayer(renQA, VIS_PARAMS.qa_mask, 'Ren QA Mask', false);
  }
  
  if (results.mod10a1) {
    // MOD10A1 has multiple QA bands
    var mod10QA = results.mod10a1.first().select('NDSI_Snow_Cover_Basic_QA');
    Map.addLayer(mod10QA, {min: 0, max: 3, palette: ['green', 'yellow', 'orange', 'red']}, 'MOD10A1 Basic QA', false);
  }
  
  if (results.mcd43a3) {
    var mcd43QA = results.mcd43a3.first().select('BRDF_Albedo_Band_Mandatory_Quality_shortwave');
    Map.addLayer(mcd43QA, {min: 0, max: 1, palette: ['green', 'orange']}, 'MCD43A3 QA', false);
  }
}

/**
 * Create legend for albedo values
 */
function createAlbedoLegend() {
  // Create legend panel
  var legend = ui.Panel({
    style: {
      position: 'bottom-left',
      padding: '8px 15px'
    }
  });
  
  // Legend title
  var legendTitle = ui.Label({
    value: 'Albedo Scale',
    style: {
      fontWeight: 'bold',
      fontSize: '16px',
      margin: '0 0 4px 0'
    }
  });
  legend.add(legendTitle);
  
  // Create color bar
  var palette = VIS_PARAMS.albedo.palette;
  var colorBar = ui.Thumbnail({
    image: ee.Image.pixelLonLat().select(0),
    params: {
      bbox: [0, 0, 1, 0.1],
      dimensions: '200x20',
      format: 'png',
      min: 0,
      max: 1,
      palette: palette
    },
    style: {margin: '0px 8px'}
  });
  legend.add(colorBar);
  
  // Add labels
  var labels = ui.Panel({
    widgets: [
      ui.Label('0.0', {margin: '4px 8px', textAlign: 'left', stretch: 'horizontal'}),
      ui.Label('0.5', {margin: '4px 20px', textAlign: 'center', stretch: 'horizontal'}),
      ui.Label('1.0', {margin: '4px 8px', textAlign: 'right', stretch: 'horizontal'})
    ],
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {stretch: 'horizontal'}
  });
  legend.add(labels);
  
  // Add legend to map
  Map.add(legend);
  
  return legend;
}

// ============================================================================
// EXPORTS
// ============================================================================

exports.initializeMap = initializeMap;
exports.setOptimalGlacierView = setOptimalGlacierView;
exports.addComparisonLayers = addComparisonLayers;
exports.addMethodLayer = addMethodLayer;
exports.addDifferenceLayers = addDifferenceLayers;
exports.toggleLayer = toggleLayer;
exports.setLayerOpacity = setLayerOpacity;
exports.clearComparisonLayers = clearComparisonLayers;
exports.addGlacierFractionLayer = addGlacierFractionLayer;
exports.addQALayers = addQALayers;
exports.createAlbedoLegend = createAlbedoLegend;
exports.VIS_PARAMS = VIS_PARAMS;