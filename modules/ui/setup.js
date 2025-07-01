/**
 * Calendar UI Setup and Initialization Module
 * 
 * Orchestrates the calendar visualization setup, glacier data initialization,
 * and integrates all UI components for the MODIS albedo calendar view
 * 
 * Author: Calendar Visualization Framework  
 * Date: 2025-07-01
 * Version: 1.0 - Calendar UI Integration
 */

// ============================================================================
// MODULE IMPORTS
// ============================================================================

var config = require('users/tofunori/MOD09A1_REN_METHOD:modules/config.js');
var glacierUtils = require('users/tofunori/MOD09A1_REN_METHOD:modules/utils/glacier.js');
var calendar = require('users/tofunori/MOD09A1_REN_METHOD:modules/ui/calendar.js');
var glacierStats = require('users/tofunori/MOD09A1_REN_METHOD:modules/ui/glacier-stats.js');

// ============================================================================
// GLOBAL UI VARIABLES
// ============================================================================

var calendarSystem = null;
var glacierData = null;
var chartPanel = null;
var selectedDayData = null;

// ============================================================================
// CALENDAR INITIALIZATION FUNCTIONS
// ============================================================================

/**
 * Initialize the complete calendar visualization system
 */
function initializeCalendarUI() {
  try {
    print('🏗️ MODIS ALBEDO CALENDAR VISUALIZATION SYSTEM');
    print('📅 Initializing calendar interface...');
    
    // Initialize glacier data
    glacierData = initializeGlacierData();
    print('✅ Glacier data initialized');
    
    // Create glacier mask for pixel extraction
    var glacierMask = glacierUtils.createGlacierMask(
      glacierData.outlines, 
      glacierData.image
    );
    glacierData.mask = glacierMask;
    
    // Initialize calendar with day selection callback
    var calendarPanel = calendar.initializeCalendar(glacierData, onDaySelected);
    print('✅ Calendar panel created');
    
    // Create chart panel for time series
    chartPanel = createChartPanel();
    
    // Create main UI layout
    var mainPanel = createMainLayout(calendarPanel, chartPanel);
    
    // Add to map
    Map.add(mainPanel);
    
    // Center map on glacier region
    Map.centerObject(glacierData.geometry, 12);
    Map.setOptions('HYBRID');
    
    calendarSystem = {
      calendarPanel: calendarPanel,
      chartPanel: chartPanel,
      glacierData: glacierData
    };
    
    print('✅ Calendar visualization system ready');
    return calendarSystem;
    
  } catch (error) {
    print('❌ Error initializing calendar UI: ' + error);
    throw error;
  }
}

/**
 * Initialize glacier data and geometry
 */
function initializeGlacierData() {
  return glacierUtils.initializeGlacierData();
}

/**
 * Create chart panel for time series visualization
 */
function createChartPanel() {
  var panel = ui.Panel({
    style: {
      width: '600px',
      height: '400px',
      position: 'bottom-right',
      backgroundColor: 'white',
      border: '2px solid #666',
      padding: '10px'
    },
    layout: ui.Panel.Layout.flow('vertical')
  });
  
  var titleLabel = ui.Label({
    value: 'Daily Glacier Analysis',
    style: {
      fontSize: '16px',
      fontWeight: 'bold',
      textAlign: 'center'
    }
  });
  
  var instructionLabel = ui.Label({
    value: 'Click on a calendar day to view glacier albedo data',
    style: {
      fontSize: '12px',
      textAlign: 'center',
      color: '#666'
    }
  });
  
  panel.add(titleLabel);
  panel.add(instructionLabel);
  
  return panel;
}

/**
 * Create main UI layout combining calendar and charts
 */
function createMainLayout(calendarPanel, chartPanel) {
  var mainPanel = ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {padding: '10px'}
  });
  
  mainPanel.add(calendarPanel);
  mainPanel.add(chartPanel);
  
  return mainPanel;
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Handle day selection from calendar
 */
function onDaySelected(dateString, dayStats) {
  try {
    print('📅 Selected date: ' + dateString);
    selectedDayData = {date: dateString, stats: dayStats};
    
    // Clear previous map layers
    clearMapLayers();
    
    // Add glacier albedo layers for available methods
    addGlacierAlbedoLayers(dateString, dayStats);
    
    // Update chart panel with day analysis
    updateChartPanel(dateString, dayStats);
    
    // Create time series chart around selected date
    createTimeSeriesChart(dateString);
    
  } catch (error) {
    print('❌ Error handling day selection: ' + error);
  }
}

/**
 * Clear existing map layers
 */
function clearMapLayers() {
  Map.layers().reset();
  
  // Add glacier outlines back
  Map.addLayer(glacierData.outlines, {color: 'yellow'}, 'Glacier Outlines', true, 0.7);
}

/**
 * Add glacier albedo layers for the selected day
 */
function addGlacierAlbedoLayers(dateString, dayStats) {
  var layerCount = 0;
  
  Object.keys(dayStats).forEach(function(method) {
    var stats = dayStats[method];
    
    if (stats.available && stats.count > 0) {
      try {
        var startDate = ee.Date(dateString);
        var endDate = startDate.advance(1, 'day');
        
        var image = glacierStats.getImageForDateAndMethod(
          startDate, endDate, method, glacierData.outlines
        );
        
        if (image) {
          var maskedImage = image.updateMask(glacierData.mask);
          var albedoBand = glacierStats.getAlbedoBandForMethod(method);
          
          var visParams = getVisualizationParams(method);
          
          Map.addLayer(
            maskedImage.select(albedoBand),
            visParams,
            method.toUpperCase() + ' - ' + dateString,
            layerCount === 0, // Show first layer by default
            0.8
          );
          
          layerCount++;
        }
      } catch (error) {
        print('Warning: Could not load ' + method + ' for ' + dateString + ': ' + error);
      }
    }
  });
  
  if (layerCount === 0) {
    print('No albedo data available for ' + dateString);
  }
}

/**
 * Get visualization parameters for each method
 */
function getVisualizationParams(method) {
  switch (method) {
    case 'ren':
      return {
        min: 0, max: 1,
        palette: ['8c2d04', 'cc4c02', 'ec7014', 'fe9929', 'fed98e', 'ffffbf',
                  'c7e9b4', '7fcdbb', '41b6c4', '2c7fb8', '253494']
      };
    case 'mod10a1':
      return {
        min: 0, max: 100,
        palette: ['red', 'yellow', 'white', 'cyan', 'blue']
      };
    case 'mcd43a3':
      return {
        min: 0, max: 0.4,
        palette: ['darkblue', 'blue', 'lightblue', 'white', 'yellow', 'orange', 'red']
      };
    default:
      return {min: 0, max: 1, palette: ['black', 'white']};
  }
}

/**
 * Update chart panel with selected day analysis
 */
function updateChartPanel(dateString, dayStats) {
  // Clear existing widgets except title
  chartPanel.clear();
  
  var titleLabel = ui.Label({
    value: 'Glacier Analysis - ' + dateString,
    style: {
      fontSize: '16px',
      fontWeight: 'bold',
      textAlign: 'center'
    }
  });
  chartPanel.add(titleLabel);
  
  // Add method statistics
  Object.keys(dayStats).forEach(function(method) {
    var stats = dayStats[method];
    
    if (stats.available && stats.count > 0) {
      var statsText = method.toUpperCase() + ':\n' +
        '  Pixels: ' + stats.count + '\n' +
        '  Mean: ' + (stats.mean ? stats.mean.getInfo().toFixed(3) : 'N/A') + '\n' +
        '  Std Dev: ' + (stats.stdDev ? stats.stdDev.getInfo().toFixed(3) : 'N/A');
      
      var methodLabel = ui.Label({
        value: statsText,
        style: {
          fontSize: '12px',
          fontFamily: 'monospace',
          backgroundColor: '#f0f0f0',
          padding: '5px',
          margin: '5px'
        }
      });
      
      chartPanel.add(methodLabel);
    }
  });
  
  // Add export button
  var exportButton = ui.Button({
    label: 'Export Day Data',
    style: {width: '150px'},
    onClick: function() {
      exportDayData(dateString, dayStats);
    }
  });
  chartPanel.add(exportButton);
}

/**
 * Create time series chart around selected date
 */
function createTimeSeriesChart(centerDate) {
  var centerDateObj = ee.Date(centerDate);
  var startDate = centerDateObj.advance(-15, 'day');
  var endDate = centerDateObj.advance(15, 'day');
  
  // Create a simple chart showing glacier pixel counts over time
  var dateList = ee.List.sequence(0, 30).map(function(day) {
    return startDate.advance(day, 'day');
  });
  
  // This would be expanded to create actual time series charts
  // For now, add a placeholder
  var chartLabel = ui.Label({
    value: 'Time Series Chart (' + startDate.format('yyyy-MM-dd').getInfo() + 
           ' to ' + endDate.format('yyyy-MM-dd').getInfo() + ')',
    style: {
      fontSize: '14px',
      fontStyle: 'italic',
      textAlign: 'center',
      margin: '10px'
    }
  });
  
  chartPanel.add(chartLabel);
}

/**
 * Export day data to CSV
 */
function exportDayData(dateString, dayStats) {
  print('Exporting data for ' + dateString + '...');
  
  // Create a feature collection with the day's glacier statistics
  var features = [];
  
  Object.keys(dayStats).forEach(function(method) {
    var stats = dayStats[method];
    if (stats.available) {
      var feature = ee.Feature(null, {
        date: dateString,
        method: method,
        pixel_count: stats.count,
        mean_albedo: stats.mean,
        std_dev: stats.stdDev,
        min_albedo: stats.min,
        max_albedo: stats.max
      });
      features.push(feature);
    }
  });
  
  if (features.length > 0) {
    var exportCollection = ee.FeatureCollection(features);
    
    Export.table.toDrive({
      collection: exportCollection,
      description: 'glacier_albedo_' + dateString.replace(/-/g, ''),
      fileFormat: 'CSV'
    });
    
    print('✅ Export task started for ' + dateString);
  } else {
    print('❌ No data available for export on ' + dateString);
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get current calendar system state
 */
function getCalendarSystem() {
  return calendarSystem;
}

/**
 * Set calendar to specific date
 */
function setCalendarDate(year, month) {
  if (calendarSystem) {
    calendar.setCalendarDate(year, month);
  }
}

/**
 * Get selected day data
 */
function getSelectedDayData() {
  return selectedDayData;
}

// ============================================================================
// EXPORTS
// ============================================================================

exports.initializeCalendarUI = initializeCalendarUI;
exports.getCalendarSystem = getCalendarSystem;
exports.setCalendarDate = setCalendarDate;
exports.getSelectedDayData = getSelectedDayData;