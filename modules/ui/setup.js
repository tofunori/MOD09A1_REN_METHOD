/**
 * UI Setup Module
 * 
 * Main UI orchestrator that coordinates controls and visualization
 * 
 * Author: Modular Comparison Framework
 * Date: 2025-06-30
 */

// ============================================================================
// MODULE IMPORTS
// ============================================================================

var controls = require('users/tofunori/MOD09A1_REN_METHOD:modules/ui/controls.js');
var visualization = require('users/tofunori/MOD09A1_REN_METHOD:modules/ui/visualization.js');
var glacierUtils = require('users/tofunori/MOD09A1_REN_METHOD:modules/utils/glacier.js');
var config = require('users/tofunori/MOD09A1_REN_METHOD:modules/config.js');

// ============================================================================
// MAIN UI INITIALIZATION
// ============================================================================

/**
 * Initialize complete UI system
 */
function initializeUI(processCallback, exportCallback) {
  print('🚀 Initializing modular UI system...');
  
  // Initialize glacier data for map setup
  var glacierData = glacierUtils.initializeGlacierData();
  
  // Setup map visualization
  visualization.initializeMap(glacierData.geometry);
  visualization.setOptimalGlacierView(glacierData.geometry);
  
  // Create main UI interface
  var uiComponents = controls.createMainInterface();
  
  // Setup event handlers with callbacks
  controls.setupEventHandlers(uiComponents, processCallback, exportCallback);
  
  // Add legend
  var legend = visualization.createAlbedoLegend();
  
  // Add glacier fraction layer for context
  var glacierFraction = glacierUtils.createGlacierFractionMap(glacierData.outlines);
  if (glacierFraction) {
    visualization.addGlacierFractionLayer(glacierFraction);
  }
  
  print('✅ UI system initialized successfully');
  print('📍 Map centered on glacier region');
  print('🎛️ Control panel ready for user input');
  
  return {
    components: uiComponents,
    glacierData: glacierData,
    legend: legend
  };
}

// ============================================================================
// UI UPDATE FUNCTIONS
// ============================================================================

/**
 * Update UI after processing completion
 */
function updateUIAfterProcessing(uiComponents, results, glacierData) {
  // Update status
  controls.updateStatus(uiComponents.statusLabel, '✅ Processing complete! Check map layers.', 'green');
  
  // Clear existing layers
  visualization.clearComparisonLayers();
  
  // Get current configuration
  var currentConfig = controls.getCurrentConfig(uiComponents);
  
  // Create layer configuration based on UI selections
  var layerConfig = {
    showRen: currentConfig.methods.ren,
    showMOD10A1: currentConfig.methods.mod10a1,
    showMCD43A3: currentConfig.methods.mcd43a3,
    showDifferences: true // Always show differences for comparison
  };
  
  // Create glacier mask for visualization
  var glacierMask = glacierUtils.createGlacierMask(glacierData.outlines, glacierData.image);
  
  // Add new layers with glacier mask
  visualization.addComparisonLayers(results, layerConfig, glacierMask, glacierData.outlines);
  
  // Optionally add QA layers for debugging
  if (config.DEBUG_MODE) {
    visualization.addQALayers(results);
  }
  
  print('🎨 Map updated with new results');
}

/**
 * Update UI after export completion
 */
function updateUIAfterExport(uiComponents, exportDescription) {
  controls.updateStatus(
    uiComponents.statusLabel, 
    '✅ CSV export complete: ' + exportDescription, 
    'green'
  );
  
  print('📤 Export completed: ' + exportDescription);
}

/**
 * Update UI with error message
 */
function updateUIWithError(uiComponents, errorMessage) {
  controls.updateStatus(
    uiComponents.statusLabel, 
    '❌ Error: ' + errorMessage, 
    'red'
  );
  
  print('❌ Error occurred: ' + errorMessage);
}

// ============================================================================
// UI HELPER FUNCTIONS
// ============================================================================

/**
 * Validate UI inputs before processing
 */
function validateUIInputs(uiComponents) {
  var currentConfig = controls.getCurrentConfig(uiComponents);
  
  // Validate dates
  var dateValidation = controls.validateInputs(
    currentConfig.startDate, 
    currentConfig.endDate
  );
  
  if (!dateValidation.isValid) {
    var errorMsg = 'Input validation failed: ' + dateValidation.errors.join(', ');
    updateUIWithError(uiComponents, errorMsg);
    return false;
  }
  
  // Validate that at least one method is selected
  var methodsSelected = currentConfig.methods.ren || 
                       currentConfig.methods.mod10a1 || 
                       currentConfig.methods.mcd43a3;
  
  if (!methodsSelected) {
    updateUIWithError(uiComponents, 'Please select at least one method to compare');
    return false;
  }
  
  return true;
}

/**
 * Get processing parameters from UI
 */
function getProcessingParameters(uiComponents, glacierData) {
  var currentConfig = controls.getCurrentConfig(uiComponents);
  
  return {
    startDate: currentConfig.startDate,
    endDate: currentConfig.endDate,
    methods: currentConfig.methods,
    glacierOutlines: glacierData.outlines,
    glacierGeometry: glacierData.geometry,
    region: glacierData.geometry
  };
}

/**
 * Reset UI to initial state
 */
function resetUI(uiComponents) {
  // Clear map layers
  visualization.clearComparisonLayers();
  
  // Reset status
  controls.updateStatus(
    uiComponents.statusLabel, 
    '🏗️ MODULAR READY: Clean modules/ architecture with .js paths!', 
    'blue'
  );
  
  print('🔄 UI reset to initial state');
}


// ============================================================================
// LAYER MANAGEMENT INTERFACE
// ============================================================================

/**
 * Create layer control panel
 */
function createLayerControlPanel() {
  var layerPanel = ui.Panel({
    layout: ui.Panel.Layout.flow('vertical'),
    style: {
      width: '200px',
      position: 'top-right',
      padding: '8px',
      backgroundColor: 'rgba(255, 255, 255, 0.9)'
    }
  });
  
  // Title
  var title = ui.Label({
    value: 'Layer Control',
    style: {
      fontSize: '14px',
      fontWeight: 'bold',
      margin: '0 0 8px 0'
    }
  });
  layerPanel.add(title);
  
  // Add layer toggle controls
  var toggles = createLayerToggles();
  toggles.forEach(function(toggle) {
    layerPanel.add(toggle);
  });
  
  // Add to map
  Map.add(layerPanel);
  
  return layerPanel;
}

/**
 * Create individual layer toggle controls
 */
function createLayerToggles() {
  var methodLayers = ['MOD09A1 Method', 'MOD10A1', 'MCD43A3'];
  var differenceLayers = ['MOD09A1 - MOD10A1 Difference', 'MOD09A1 - MCD43A3 Difference'];
  
  var toggles = [];
  
  // Method layer toggles
  methodLayers.forEach(function(layerName) {
    var checkbox = ui.Checkbox({
      label: layerName,
      value: true,
      onChange: function(checked) {
        visualization.toggleLayer(layerName + ' (Median)', checked);
      },
      style: {margin: '2px 0'}
    });
    toggles.push(checkbox);
  });
  
  // Difference layer toggles (initially off)
  differenceLayers.forEach(function(layerName) {
    var checkbox = ui.Checkbox({
      label: layerName.replace(' Difference', ''),
      value: false,
      onChange: function(checked) {
        visualization.toggleLayer(layerName, checked);
      },
      style: {margin: '2px 0', fontSize: '11px'}
    });
    toggles.push(checkbox);
  });
  
  return toggles;
}

// ============================================================================
// EXPORTS
// ============================================================================

exports.initializeUI = initializeUI;
exports.updateUIAfterProcessing = updateUIAfterProcessing;
exports.updateUIAfterExport = updateUIAfterExport;
exports.updateUIWithError = updateUIWithError;
exports.validateUIInputs = validateUIInputs;
exports.getProcessingParameters = getProcessingParameters;
exports.resetUI = resetUI;
exports.createLayerControlPanel = createLayerControlPanel;