/**
 * Visualization and Map Display Module
 * 
 * Enhanced map visualization functions for glacier albedo data display,
 * including custom legends, color schemes, and interactive map controls
 * 
 * Author: Calendar Visualization Framework
 * Date: 2025-07-01
 * Version: 1.0 - Enhanced Map Visualization
 */

// ============================================================================
// MODULE IMPORTS
// ============================================================================

var config = require('users/tofunori/MOD09A1_REN_METHOD:modules/config.js');

// ============================================================================
// VISUALIZATION CONSTANTS
// ============================================================================

var VISUALIZATION_PALETTES = {
  albedo_blue_white_red: ['#000080', '#4169E1', '#87CEEB', '#FFFFFF', '#FFB6C1', '#FF69B4', '#FF0000'],
  albedo_spectral: ['#8c2d04', 'cc4c02', 'ec7014', 'fe9929', 'fed98e', 'ffffbf', 
                    'c7e9b4', '7fcdbb', '41b6c4', '2c7fb8', '253494'],
  snow_cover: ['#8B0000', '#FF0000', '#FF4500', '#FFA500', '#FFFF00', '#ADFF2F', 
               '#00FF00', '#00FFFF', '#0000FF', '#FFFFFF'],
  terrain: ['#543005', '#8c510a', '#bf812d', '#dfc27d', '#f6e8c3', '#f5f5f5',
            '#c7eae5', '#80cdc1', '#35978f', '#01665e', '#003c30']
};

var METHOD_CONFIGS = {
  ren: {
    displayName: 'Ren Method (MOD09A1)',
    band: 'broadband_albedo_ren_masked',
    palette: VISUALIZATION_PALETTES.albedo_spectral,
    min: 0,
    max: 1,
    units: 'Albedo (0-1)'
  },
  mod10a1: {
    displayName: 'MOD10A1 Snow Cover',
    band: 'NDSI_Snow_Cover',
    palette: VISUALIZATION_PALETTES.snow_cover,
    min: 0,
    max: 100,
    units: 'Snow Cover (%)'
  },
  mcd43a3: {
    displayName: 'MCD43A3 BRDF Albedo',
    band: 'Albedo_BSA_vis',
    palette: VISUALIZATION_PALETTES.albedo_blue_white_red,
    min: 0,
    max: 0.4,
    units: 'Visible Albedo'
  }
};

// ============================================================================
// LEGEND CREATION FUNCTIONS
// ============================================================================

/**
 * Create a color legend panel for albedo visualization
 */
function createLegendPanel(method) {
  var methodConfig = METHOD_CONFIGS[method];
  
  var legendPanel = ui.Panel({
    style: {
      position: 'bottom-left',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      border: '1px solid black',
      padding: '8px'
    }
  });
  
  // Title
  var titleLabel = ui.Label({
    value: methodConfig.displayName,
    style: {fontWeight: 'bold', fontSize: '14px'}
  });
  legendPanel.add(titleLabel);
  
  // Create color bar
  var colorBar = createColorBar(methodConfig.palette, methodConfig.min, methodConfig.max);
  legendPanel.add(colorBar);
  
  // Units label
  var unitsLabel = ui.Label({
    value: methodConfig.units,
    style: {fontSize: '11px', textAlign: 'center'}
  });
  legendPanel.add(unitsLabel);
  
  return legendPanel;
}

/**
 * Create horizontal color bar with labels
 */
function createColorBar(palette, min, max) {
  var colorBarPanel = ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {margin: '4px 0px'}
  });
  
  // Create color segments
  var numSegments = palette.length;
  var segmentWidth = '20px';
  
  for (var i = 0; i < numSegments; i++) {
    var colorBox = ui.Label({
      value: ' ',
      style: {
        backgroundColor: palette[i],
        width: segmentWidth,
        height: '20px',
        border: '1px solid #000',
        margin: '0px'
      }
    });
    colorBarPanel.add(colorBox);
  }
  
  // Add value labels
  var labelsPanel = ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {margin: '2px 0px'}
  });
  
  var minLabel = ui.Label({
    value: min.toFixed(2),
    style: {fontSize: '10px', width: '30px', textAlign: 'left'}
  });
  
  var maxLabel = ui.Label({
    value: max.toFixed(2), 
    style: {fontSize: '10px', width: '30px', textAlign: 'right', margin: '0px 0px 0px 120px'}
  });
  
  labelsPanel.add(minLabel);
  labelsPanel.add(maxLabel);
  
  var legendContainer = ui.Panel([colorBarPanel, labelsPanel]);
  return legendContainer;
}

// ============================================================================
// MAP LAYER MANAGEMENT
// ============================================================================

/**
 * Add glacier albedo layer with enhanced visualization
 */
function addGlacierAlbedoLayer(image, method, dateString, glacierMask, visible) {
  visible = visible !== undefined ? visible : true;
  
  var methodConfig = METHOD_CONFIGS[method];
  if (!methodConfig) {
    print('Unknown method: ' + method);
    return null;
  }
  
  try {
    // Apply glacier mask
    var maskedImage = image.updateMask(glacierMask);
    var bandImage = maskedImage.select(methodConfig.band);
    
    // Create visualization parameters
    var visParams = {
      min: methodConfig.min,
      max: methodConfig.max,
      palette: methodConfig.palette
    };
    
    // Add layer to map
    var layerName = methodConfig.displayName + ' - ' + dateString;
    Map.addLayer(bandImage, visParams, layerName, visible, 0.8);
    
    // Add legend if this is the visible layer
    if (visible) {
      var legend = createLegendPanel(method);
      Map.add(legend);
    }
    
    return {
      image: bandImage,
      params: visParams,
      name: layerName
    };
    
  } catch (error) {
    print('Error adding layer for ' + method + ': ' + error);
    return null;
  }
}

/**
 * Create comparison panel showing multiple methods side by side
 */
function createMethodComparisonPanel(dateString, methodData) {
  var comparisonPanel = ui.Panel({
    style: {
      position: 'top-right',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      border: '2px solid #333',
      padding: '10px',
      width: '300px'
    }
  });
  
  var titleLabel = ui.Label({
    value: 'Method Comparison - ' + dateString,
    style: {fontWeight: 'bold', fontSize: '14px', textAlign: 'center'}
  });
  comparisonPanel.add(titleLabel);
  
  // Add method statistics
  Object.keys(methodData).forEach(function(method) {
    var data = methodData[method];
    
    if (data.available && data.count > 0) {
      var methodPanel = createMethodStatsPanel(method, data);
      comparisonPanel.add(methodPanel);
    }
  });
  
  return comparisonPanel;
}

/**
 * Create individual method statistics panel
 */
function createMethodStatsPanel(method, stats) {
  var methodConfig = METHOD_CONFIGS[method];
  
  var methodPanel = ui.Panel({
    style: {
      backgroundColor: '#f0f0f0',
      border: '1px solid #ccc',
      padding: '5px',
      margin: '3px 0px'
    }
  });
  
  var methodLabel = ui.Label({
    value: methodConfig.displayName,
    style: {fontWeight: 'bold', fontSize: '12px'}
  });
  methodPanel.add(methodLabel);
  
  var statsText = 'Pixels: ' + stats.count + '\n' +
                  'Mean: ' + (stats.mean ? stats.mean.getInfo().toFixed(3) : 'N/A') + '\n' +
                  'Std: ' + (stats.stdDev ? stats.stdDev.getInfo().toFixed(3) : 'N/A');
  
  var statsLabel = ui.Label({
    value: statsText,
    style: {fontSize: '10px', fontFamily: 'monospace'}
  });
  methodPanel.add(statsLabel);
  
  // Add visibility toggle
  var toggleButton = ui.Button({
    label: 'Show/Hide',
    style: {width: '80px', fontSize: '10px'},
    onClick: function() {
      toggleLayerVisibility(methodConfig.displayName);
    }
  });
  methodPanel.add(toggleButton);
  
  return methodPanel;
}

/**
 * Toggle layer visibility by name
 */
function toggleLayerVisibility(layerName) {
  var layers = Map.layers();
  
  for (var i = 0; i < layers.length().getInfo(); i++) {
    var layer = layers.get(i);
    var name = layer.getName();
    
    if (name && name.indexOf(layerName) !== -1) {
      layer.setShown(!layer.getShown());
      break;
    }
  }
}

// ============================================================================
// ENHANCED VISUALIZATION FUNCTIONS
// ============================================================================

/**
 * Create glacier outline enhancement
 */
function addGlacierOutlineLayer(glacierOutlines, style) {
  style = style || {
    color: '#FFFF00',
    width: 2,
    fillColor: '00000000'  // Transparent fill
  };
  
  Map.addLayer(glacierOutlines, style, 'Glacier Boundaries', true, 0.9);
}

/**
 * Create elevation hillshade background
 */
function addElevationHillshade(region) {
  try {
    var elevation = ee.Image('USGS/SRTMGL1_003').clip(region);
    var hillshade = ee.Terrain.hillshade(elevation);
    
    Map.addLayer(hillshade, {
      min: 150,
      max: 255,
      palette: ['000000', 'ffffff']
    }, 'Elevation Hillshade', false, 0.3);
    
  } catch (error) {
    print('Could not add hillshade: ' + error);
  }
}

/**
 * Create interactive pixel inspector
 */
function createPixelInspector() {
  var inspectorPanel = ui.Panel({
    style: {
      position: 'bottom-right',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      border: '1px solid black',
      padding: '8px',
      width: '200px'
    }
  });
  
  var titleLabel = ui.Label({
    value: 'Pixel Inspector',
    style: {fontWeight: 'bold', fontSize: '12px'}
  });
  inspectorPanel.add(titleLabel);
  
  var valueLabel = ui.Label({
    value: 'Click on map to inspect pixel values',
    style: {fontSize: '10px'}
  });
  inspectorPanel.add(valueLabel);
  
  // Add click listener to map
  Map.onClick(function(coords) {
    var point = ee.Geometry.Point([coords.lon, coords.lat]);
    valueLabel.setValue('Lat: ' + coords.lat.toFixed(4) + '\nLon: ' + coords.lon.toFixed(4));
  });
  
  return inspectorPanel;
}

/**
 * Create custom map controls panel
 */
function createMapControlsPanel() {
  var controlsPanel = ui.Panel({
    style: {
      position: 'top-left',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      border: '1px solid black',
      padding: '8px'
    }
  });
  
  var titleLabel = ui.Label({
    value: 'Map Controls',
    style: {fontWeight: 'bold', fontSize: '12px'}
  });
  controlsPanel.add(titleLabel);
  
  // Zoom to glacier button
  var zoomButton = ui.Button({
    label: 'Zoom to Glacier',
    style: {width: '120px', fontSize: '10px'},
    onClick: function() {
      // This would be connected to glacier data
      print('Zooming to glacier...');
    }
  });
  controlsPanel.add(zoomButton);
  
  // Clear layers button
  var clearButton = ui.Button({
    label: 'Clear Layers',
    style: {width: '120px', fontSize: '10px'},
    onClick: function() {
      Map.layers().reset();
    }
  });
  controlsPanel.add(clearButton);
  
  return controlsPanel;
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

/**
 * Export visualization as image
 */
function exportVisualization(image, region, description) {
  var visParams = {
    dimensions: 1024,
    region: region,
    crs: 'EPSG:4326',
    format: 'png'
  };
  
  var url = image.getThumbURL(visParams);
  
  print('Visualization URL: ' + url);
  
  return url;
}

// ============================================================================
// EXPORTS
// ============================================================================

exports.createLegendPanel = createLegendPanel;
exports.addGlacierAlbedoLayer = addGlacierAlbedoLayer;
exports.createMethodComparisonPanel = createMethodComparisonPanel;
exports.addGlacierOutlineLayer = addGlacierOutlineLayer;
exports.addElevationHillshade = addElevationHillshade;
exports.createPixelInspector = createPixelInspector;
exports.createMapControlsPanel = createMapControlsPanel;
exports.exportVisualization = exportVisualization;
exports.toggleLayerVisibility = toggleLayerVisibility;
exports.METHOD_CONFIGS = METHOD_CONFIGS;