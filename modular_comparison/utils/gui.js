/**
 * GUI Components for Modular MODIS Albedo Comparison
 * 
 * This module contains all user interface components, event handlers,
 * and user interaction logic for the albedo comparison tool.
 * 
 * Author: Modular Comparison Framework
 * Date: 2025-06-30
 */

// ============================================================================
// UI COMPONENT CREATION FUNCTIONS
// ============================================================================

/**
 * Create the main UI panel with all controls
 * @returns {Object} Object containing panel and all UI controls
 */
function createMainInterface() {
  // Create main UI Panel
  var panel = ui.Panel({
    layout: ui.Panel.Layout.flow('vertical'),
    style: {
      width: '350px',
      padding: '10px',
      backgroundColor: 'white'
    }
  });

  // Title
  var title = ui.Label({
    value: 'Modular MODIS Albedo Comparison',
    style: {
      fontSize: '20px',
      fontWeight: 'bold',
      margin: '10px 0px'
    }
  });
  panel.add(title);

  // Description
  var description = ui.Label({
    value: '🏗️ MODULAR ARCHITECTURE\n\nCompare three MODIS albedo methods:\n1. MOD09A1 Ren Method (Complete)\n2. MOD10A1 Snow Albedo (Advanced QA)\n3. MCD43A3 BRDF/Albedo (Collection 6.1)\n\n📁 Structure: /methods/, /utils/, /config/\n💾 CSV EXPORT: Comprehensive statistics\n🔥 MELT SEASON: Jun-Sep only',
    style: {
      fontSize: '12px',
      margin: '0px 0px 10px 0px'
    }
  });
  panel.add(description);

  // Date selection controls
  var dateControls = createDateControls();
  panel.add(dateControls.startLabel);
  panel.add(dateControls.startBox);
  panel.add(dateControls.endLabel);
  panel.add(dateControls.endBox);

  // Method selection controls
  var methodControls = createMethodControls();
  panel.add(methodControls.label);
  panel.add(methodControls.renCheckbox);
  panel.add(methodControls.mod10Checkbox);
  panel.add(methodControls.mcd43Checkbox);

  // Action buttons
  var buttons = createActionButtons();
  panel.add(buttons.processButton);
  panel.add(buttons.exportButton);

  // Status label
  var statusLabel = ui.Label({
    value: '🏗️ MODULAR READY: Clean separation of GUI, Map, and Processing!',
    style: {
      fontSize: '11px',
      color: 'blue',
      fontStyle: 'italic'
    }
  });
  panel.add(statusLabel);

  // Add panel to map
  ui.root.insert(0, panel);

  return {
    panel: panel,
    dateControls: dateControls,
    methodControls: methodControls,
    buttons: buttons,
    statusLabel: statusLabel
  };
}

/**
 * Create date input controls
 * @returns {Object} Date control elements
 */
function createDateControls() {
  var startDateLabel = ui.Label('Start Date (YYYY-MM-DD):');
  var startDateBox = ui.Textbox({
    placeholder: '2017-06-01',
    value: '2017-06-01',
    style: {width: '150px'}
  });

  var endDateLabel = ui.Label('End Date (YYYY-MM-DD):');
  var endDateBox = ui.Textbox({
    placeholder: '2024-09-30',
    value: '2024-09-30',
    style: {width: '150px'}
  });

  return {
    startLabel: startDateLabel,
    startBox: startDateBox,
    endLabel: endDateLabel,
    endBox: endDateBox
  };
}

/**
 * Create method selection checkboxes
 * @returns {Object} Method selection controls
 */
function createMethodControls() {
  var methodsLabel = ui.Label('Methods to Compare:');

  var renCheckbox = ui.Checkbox({
    label: 'MOD09A1 Ren Method',
    value: true,
    style: {margin: '2px'}
  });

  var mod10Checkbox = ui.Checkbox({
    label: 'MOD10A1 Snow Albedo',
    value: true,
    style: {margin: '2px'}
  });

  var mcd43Checkbox = ui.Checkbox({
    label: 'MCD43A3 BRDF/Albedo',
    value: true,
    style: {margin: '2px'}
  });

  return {
    label: methodsLabel,
    renCheckbox: renCheckbox,
    mod10Checkbox: mod10Checkbox,
    mcd43Checkbox: mcd43Checkbox
  };
}

/**
 * Create action buttons (Process and Export)
 * @returns {Object} Button elements
 */
function createActionButtons() {
  var processButton = ui.Button({
    label: 'Run Modular Comparison',
    style: {
      backgroundColor: '#4285f4',
      color: 'white',
      margin: '10px 0px',
      width: '300px'
    }
  });

  var exportButton = ui.Button({
    label: 'Export CSV Results',
    style: {
      backgroundColor: '#34a853',
      color: 'white',
      margin: '5px 0px',
      width: '300px'
    }
  });

  return {
    processButton: processButton,
    exportButton: exportButton
  };
}

// ============================================================================
// EVENT HANDLER SETUP FUNCTIONS
// ============================================================================

/**
 * Setup event handlers for the UI components
 * @param {Object} uiComponents - Object containing all UI components
 * @param {Function} processCallback - Function to call when processing
 * @param {Function} exportCallback - Function to call when exporting
 */
function setupEventHandlers(uiComponents, processCallback, exportCallback) {
  // Process button event handler
  uiComponents.buttons.processButton.onClick(function() {
    var startDate = uiComponents.dateControls.startBox.getValue();
    var endDate = uiComponents.dateControls.endBox.getValue();

    // Update status
    updateStatus(uiComponents.statusLabel, 'Processing modular comparison...', 'orange');

    // Call the processing callback
    processCallback(startDate, endDate, function(results) {
      // Success callback
      updateStatus(uiComponents.statusLabel, '✅ Comparison complete! Check map layers and export CSV.', 'green');
    }, function(error) {
      // Error callback
      updateStatus(uiComponents.statusLabel, '❌ Processing failed: ' + error, 'red');
    });
  });

  // Export button event handler
  uiComponents.buttons.exportButton.onClick(function() {
    var startDate = uiComponents.dateControls.startBox.getValue();
    var endDate = uiComponents.dateControls.endBox.getValue();

    // Update status
    updateStatus(uiComponents.statusLabel, '🚀 Exporting CSV data...', 'blue');

    // Call the export callback
    exportCallback(startDate, endDate, function() {
      // Success callback
      updateStatus(uiComponents.statusLabel, '✅ CSV export initiated! Check Google Drive.', 'green');
    }, function(error) {
      // Error callback
      updateStatus(uiComponents.statusLabel, '❌ Export failed: ' + error, 'red');
    });
  });
}

/**
 * Update status label with message and color
 * @param {ui.Label} statusLabel - Status label element
 * @param {string} message - Status message
 * @param {string} color - Color for the message
 */
function updateStatus(statusLabel, message, color) {
  statusLabel.setValue(message);
  statusLabel.style().set('color', color);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the current configuration from UI controls
 * @param {Object} uiComponents - Object containing all UI components
 * @returns {Object} Current configuration
 */
function getCurrentConfig(uiComponents) {
  return {
    startDate: uiComponents.dateControls.startBox.getValue(),
    endDate: uiComponents.dateControls.endBox.getValue(),
    methods: {
      ren: uiComponents.methodControls.renCheckbox.getValue(),
      mod10a1: uiComponents.methodControls.mod10Checkbox.getValue(),
      mcd43a3: uiComponents.methodControls.mcd43Checkbox.getValue()
    }
  };
}

/**
 * Validate user inputs
 * @param {string} startDate - Start date string
 * @param {string} endDate - End date string
 * @returns {Object} Validation result
 */
function validateInputs(startDate, endDate) {
  var errors = [];

  // Check date format (basic validation)
  var datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(startDate)) {
    errors.push('Invalid start date format. Use YYYY-MM-DD.');
  }
  if (!datePattern.test(endDate)) {
    errors.push('Invalid end date format. Use YYYY-MM-DD.');
  }

  // Check date logic
  if (startDate >= endDate) {
    errors.push('Start date must be before end date.');
  }

  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

// ============================================================================
// EXPORTS FOR USE IN MAIN SCRIPT
// ============================================================================

// Export functions for use in main script
exports.createMainInterface = createMainInterface;
exports.setupEventHandlers = setupEventHandlers;
exports.updateStatus = updateStatus;
exports.getCurrentConfig = getCurrentConfig;
exports.validateInputs = validateInputs;