/**
 * Map Visualization Functions for Modular MODIS Albedo Comparison
 * 
 * This module contains all map-related functionality including initialization,
 * layer management, visualization parameters, and styling.
 * 
 * Author: Modular Comparison Framework
 * Date: 2025-06-30
 */

// ============================================================================
// VISUALIZATION CONFIGURATION
// ============================================================================

var VIZ_CONFIG = {
  // Albedo visualization parameters
  ALBEDO_VIZ: {
    min: 0,
    max: 1,
    palette: ['blue', 'cyan', 'yellow', 'orange', 'red', 'white']
  },
  
  // Snow cover visualization
  SNOW_VIZ: {
    min: 0,
    max: 100,
    palette: ['blue', 'white']
  },
  
  // Glacier outline visualization
  GLACIER_VIZ: {
    palette: ['red'],
    opacity: 0.8
  },
  
  // Map settings
  MAP_SETTINGS: {
    center_zoom: 12,
    max_zoom: 16
  }
};

// ============================================================================
// MAP INITIALIZATION FUNCTIONS
// ============================================================================

/**
 * Initialize the map with glacier data and default settings
 * @param {ee.Image} glacierImage - Glacier mask image
 * @param {ee.Geometry} glacierBounds - Glacier bounds geometry
 */
function initializeMap(glacierImage, glacierBounds) {
  // Clear existing layers
  Map.layers().reset();
  
  // Center map on glacier area
  Map.centerObject(glacierBounds, VIZ_CONFIG.MAP_SETTINGS.center_zoom);
  
  // Add base glacier outline layer
  Map.addLayer(
    glacierImage.selfMask(), 
    VIZ_CONFIG.GLACIER_VIZ, 
    'Saskatchewan Glacier Outline'
  );
  
  print('🗺️ Map initialized with glacier bounds and base layers');
}

/**
 * Clear all map layers except the base glacier outline
 */
function clearLayers() {
  // Get current layers
  var layers = Map.layers();
  
  // Remove all layers except glacier outline (keep first layer)
  while (layers.length() > 1) {
    layers.remove(layers.get(1));
  }
  
  print('🧹 Map layers cleared (keeping glacier outline)');
}

// ============================================================================
// ALBEDO LAYER FUNCTIONS
// ============================================================================

/**
 * Add albedo visualization layers for all three methods
 * @param {Object} results - Results object with ren, mod10a1, mcd43a3 collections
 * @param {boolean} showLayers - Whether to make layers visible by default
 */
function addAlbedoLayers(results, showLayers) {
  showLayers = showLayers || false;
  
  try {
    // Add Ren method layer
    if (results.ren && results.ren.size().getInfo() > 0) {
      var renSample = results.ren.first();
      Map.addLayer(
        renSample.select('broadband_albedo_ren'),
        VIZ_CONFIG.ALBEDO_VIZ,
        'Ren Albedo (Sample)',
        showLayers
      );
      print('✅ Added Ren albedo visualization layer');
    }
    
    // Add MOD10A1 method layer
    if (results.mod10a1 && results.mod10a1.size().getInfo() > 0) {
      var mod10Sample = results.mod10a1.first();
      Map.addLayer(
        mod10Sample.select('broadband_albedo_mod10a1'),
        VIZ_CONFIG.ALBEDO_VIZ,
        'MOD10A1 Albedo (Sample)',
        showLayers
      );
      print('✅ Added MOD10A1 albedo visualization layer');
    }
    
    // Add MCD43A3 method layer
    if (results.mcd43a3 && results.mcd43a3.size().getInfo() > 0) {
      var mcd43Sample = results.mcd43a3.first();
      Map.addLayer(
        mcd43Sample.select('broadband_albedo_mcd43a3'),
        VIZ_CONFIG.ALBEDO_VIZ,
        'MCD43A3 Albedo (Sample)',
        showLayers
      );
      print('✅ Added MCD43A3 albedo visualization layer');
    }
    
    print('🎨 All available albedo layers added to map');
    
  } catch (error) {
    print('⚠️ Error adding albedo layers: ' + error.message);
    throw error;
  }
}

/**
 * Add temporal composite layers for trend analysis
 * @param {Object} results - Results object with collections
 * @param {string} reducer - Reducer type ('mean', 'median', 'max')
 */
function addTemporalComposites(results, reducer) {
  reducer = reducer || 'mean';
  
  try {
    var reducerFunction;
    switch(reducer) {
      case 'mean': reducerFunction = ee.Reducer.mean(); break;
      case 'median': reducerFunction = ee.Reducer.median(); break;
      case 'max': reducerFunction = ee.Reducer.max(); break;
      default: reducerFunction = ee.Reducer.mean();
    }
    
    // Create temporal composites
    if (results.ren) {
      var renComposite = results.ren.select('broadband_albedo_ren').reduce(reducerFunction);
      Map.addLayer(
        renComposite,
        VIZ_CONFIG.ALBEDO_VIZ,
        'Ren Albedo (' + reducer + ')',
        false
      );
    }
    
    if (results.mod10a1) {
      var mod10Composite = results.mod10a1.select('broadband_albedo_mod10a1').reduce(reducerFunction);
      Map.addLayer(
        mod10Composite,
        VIZ_CONFIG.ALBEDO_VIZ,
        'MOD10A1 Albedo (' + reducer + ')',
        false
      );
    }
    
    if (results.mcd43a3) {
      var mcd43Composite = results.mcd43a3.select('broadband_albedo_mcd43a3').reduce(reducerFunction);
      Map.addLayer(
        mcd43Composite,
        VIZ_CONFIG.ALBEDO_VIZ,
        'MCD43A3 Albedo (' + reducer + ')',
        false
      );
    }
    
    print('📊 Temporal composite layers (' + reducer + ') added to map');
    
  } catch (error) {
    print('⚠️ Error creating temporal composites: ' + error.message);
  }
}

// ============================================================================
// COMPARISON VISUALIZATION FUNCTIONS
// ============================================================================

/**
 * Add difference layers showing method comparisons
 * @param {Object} results - Results object with collections
 */
function addComparisonLayers(results) {
  try {
    // Create temporal means for comparison
    var renMean = results.ren ? results.ren.select('broadband_albedo_ren').mean() : null;
    var mod10Mean = results.mod10a1 ? results.mod10a1.select('broadband_albedo_mod10a1').mean() : null;
    var mcd43Mean = results.mcd43a3 ? results.mcd43a3.select('broadband_albedo_mcd43a3').mean() : null;
    
    // Difference visualization parameters
    var diffViz = {
      min: -0.3,
      max: 0.3,
      palette: ['red', 'white', 'blue']
    };
    
    // Ren vs MOD10A1
    if (renMean && mod10Mean) {
      var diffRenMod10 = renMean.subtract(mod10Mean);
      Map.addLayer(
        diffRenMod10,
        diffViz,
        'Difference: Ren - MOD10A1',
        false
      );
    }
    
    // Ren vs MCD43A3
    if (renMean && mcd43Mean) {
      var diffRenMcd43 = renMean.subtract(mcd43Mean);
      Map.addLayer(
        diffRenMcd43,
        diffViz,
        'Difference: Ren - MCD43A3',
        false
      );
    }
    
    // MOD10A1 vs MCD43A3
    if (mod10Mean && mcd43Mean) {
      var diffMod10Mcd43 = mod10Mean.subtract(mcd43Mean);
      Map.addLayer(
        diffMod10Mcd43,
        diffViz,
        'Difference: MOD10A1 - MCD43A3',
        false
      );
    }
    
    print('📈 Method comparison difference layers added to map');
    
  } catch (error) {
    print('⚠️ Error creating comparison layers: ' + error.message);
  }
}

// ============================================================================
// INTERACTIVE VISUALIZATION FUNCTIONS
// ============================================================================

/**
 * Setup interactive visualization controls
 * @param {Object} results - Results object with collections
 */
function setupInteractiveControls(results) {
  // Create visualization control panel
  var vizPanel = ui.Panel({
    layout: ui.Panel.Layout.flow('vertical'),
    style: {
      width: '250px',
      position: 'top-right',
      backgroundColor: 'rgba(255, 255, 255, 0.9)'
    }
  });
  
  // Add visualization options
  var vizTitle = ui.Label({
    value: 'Visualization Options',
    style: {
      fontSize: '14px',
      fontWeight: 'bold',
      margin: '5px'
    }
  });
  vizPanel.add(vizTitle);
  
  // Layer visibility toggles
  var layerToggles = createLayerToggles();
  vizPanel.widgets().reset([vizTitle].concat(layerToggles));
  
  // Add to map
  Map.add(vizPanel);
  
  print('🎛️ Interactive visualization controls added');
}

/**
 * Create layer toggle controls
 * @returns {Array} Array of toggle widgets
 */
function createLayerToggles() {
  var toggles = [];
  
  // Method layer toggles
  var methods = ['Ren', 'MOD10A1', 'MCD43A3'];
  methods.forEach(function(method) {
    var toggle = ui.Checkbox({
      label: method + ' Albedo',
      value: false,
      onChange: function(checked) {
        toggleLayerVisibility(method + ' Albedo (Sample)', checked);
      }
    });
    toggles.push(toggle);
  });
  
  return toggles;
}

/**
 * Toggle layer visibility by name
 * @param {string} layerName - Name of the layer to toggle
 * @param {boolean} visible - Whether to show the layer
 */
function toggleLayerVisibility(layerName, visible) {
  var layers = Map.layers();
  for (var i = 0; i < layers.length(); i++) {
    var layer = layers.get(i);
    if (layer.getName() === layerName) {
      layer.setShown(visible);
      break;
    }
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get current map bounds
 * @returns {ee.Geometry} Current map viewport bounds
 */
function getCurrentMapBounds() {
  return ee.Geometry.Rectangle(Map.getBounds());
}

/**
 * Update visualization parameters for all albedo layers
 * @param {Object} newVizParams - New visualization parameters
 */
function updateAlbedoVisualization(newVizParams) {
  VIZ_CONFIG.ALBEDO_VIZ = Object.assign(VIZ_CONFIG.ALBEDO_VIZ, newVizParams);
  print('🎨 Albedo visualization parameters updated');
}

// ============================================================================
// EXPORTS FOR USE IN MAIN SCRIPT
// ============================================================================

// Export functions for use in main script
exports.initializeMap = initializeMap;
exports.clearLayers = clearLayers;
exports.addAlbedoLayers = addAlbedoLayers;
exports.addTemporalComposites = addTemporalComposites;
exports.addComparisonLayers = addComparisonLayers;
exports.setupInteractiveControls = setupInteractiveControls;
exports.toggleLayerVisibility = toggleLayerVisibility;
exports.getCurrentMapBounds = getCurrentMapBounds;
exports.updateAlbedoVisualization = updateAlbedoVisualization;
exports.VIZ_CONFIG = VIZ_CONFIG;