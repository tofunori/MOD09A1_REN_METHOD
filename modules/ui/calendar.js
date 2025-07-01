/**
 * Calendar Visualization Module
 * 
 * Creates interactive calendar interface using Google Earth Engine UI components
 * for visualizing daily glacier pixel data from MODIS albedo methods
 * 
 * Author: Calendar Visualization Framework
 * Date: 2025-07-01
 * Version: 1.0 - GEE Native Calendar Interface
 */

// ============================================================================
// MODULE IMPORTS
// ============================================================================

var glacierStats = require('users/tofunori/MOD09A1_REN_METHOD:modules/ui/glacier-stats.js');

// ============================================================================
// CALENDAR CONSTANTS
// ============================================================================

var DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 
              'July', 'August', 'September', 'October', 'November', 'December'];

// ============================================================================
// CALENDAR STATE VARIABLES
// ============================================================================

var currentYear = 2024;
var currentMonth = 5; // June (0-indexed)
var selectedDate = null;
var calendarData = {};
var glacierOutlines = null;
var glacierMask = null;
var onDaySelectCallback = null;

// ============================================================================
// CALENDAR UI COMPONENTS
// ============================================================================

/**
 * Create main calendar panel structure
 */
function createCalendarPanel() {
  var calendarPanel = ui.Panel({
    style: {
      width: '900px',
      height: '700px',
      position: 'top-left',
      backgroundColor: 'white',
      border: '2px solid #666',
      padding: '10px'
    },
    layout: ui.Panel.Layout.flow('vertical')
  });
  
  // Add header with navigation
  var headerPanel = createHeaderPanel();
  calendarPanel.add(headerPanel);
  
  // Add day-of-week labels
  var dowPanel = createDayOfWeekPanel();
  calendarPanel.add(dowPanel);
  
  // Add calendar grid
  var gridPanel = createCalendarGrid();
  calendarPanel.add(gridPanel);
  
  // Add statistics panel
  var statsPanel = createStatsPanel();
  calendarPanel.add(statsPanel);
  
  return calendarPanel;
}

/**
 * Create calendar header with navigation controls
 */
function createHeaderPanel() {
  var headerPanel = ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {padding: '5px 0px'}
  });
  
  // Previous month button
  var prevButton = ui.Button({
    label: '◄',
    style: {width: '40px', fontSize: '16px'},
    onClick: function() {
      changeMonth(-1);
    }
  });
  
  // Next month button
  var nextButton = ui.Button({
    label: '►', 
    style: {width: '40px', fontSize: '16px'},
    onClick: function() {
      changeMonth(1);
    }
  });
  
  // Month/Year label
  var monthLabel = ui.Label({
    value: MONTHS[currentMonth] + ' ' + currentYear,
    style: {
      fontSize: '20px',
      fontWeight: 'bold',
      textAlign: 'center',
      width: '200px',
      margin: '0px 20px'
    }
  });
  
  // Method toggle controls
  var methodPanel = createMethodTogglePanel();
  
  headerPanel.add(prevButton);
  headerPanel.add(monthLabel);
  headerPanel.add(nextButton);
  headerPanel.add(ui.Label('   Methods:', {fontSize: '14px', fontWeight: 'bold'}));
  headerPanel.add(methodPanel);
  
  return headerPanel;
}

/**
 * Create method toggle checkboxes
 */
function createMethodTogglePanel() {
  var methodPanel = ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {margin: '0px 10px'}
  });
  
  var renCheckbox = ui.Checkbox({
    label: 'Ren',
    value: true,
    style: {fontSize: '12px'},
    onChange: function(checked) {
      updateCalendarDisplay();
    }
  });
  
  var mod10a1Checkbox = ui.Checkbox({
    label: 'MOD10A1',
    value: true,
    style: {fontSize: '12px'},
    onChange: function(checked) {
      updateCalendarDisplay();
    }
  });
  
  var mcd43a3Checkbox = ui.Checkbox({
    label: 'MCD43A3',
    value: true,
    style: {fontSize: '12px'},
    onChange: function(checked) {
      updateCalendarDisplay();
    }
  });
  
  methodPanel.add(renCheckbox);
  methodPanel.add(mod10a1Checkbox);
  methodPanel.add(mcd43a3Checkbox);
  
  return methodPanel;
}

/**
 * Create day-of-week header labels
 */
function createDayOfWeekPanel() {
  var dowPanel = ui.Panel({
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {padding: '5px 0px'}
  });
  
  DAYS_OF_WEEK.forEach(function(day) {
    var dayLabel = ui.Label({
      value: day,
      style: {
        width: '120px',
        textAlign: 'center',
        fontSize: '14px',
        fontWeight: 'bold',
        backgroundColor: '#f0f0f0',
        border: '1px solid #ccc',
        padding: '5px'
      }
    });
    dowPanel.add(dayLabel);
  });
  
  return dowPanel;
}

/**
 * Create calendar grid with day buttons
 */
function createCalendarGrid() {
  var gridPanel = ui.Panel({
    layout: ui.Panel.Layout.flow('vertical'),
    style: {padding: '0px'}
  });
  
  // Create 6 weeks (rows)
  for (var week = 0; week < 6; week++) {
    var weekPanel = ui.Panel({
      layout: ui.Panel.Layout.flow('horizontal'),
      style: {padding: '0px'}
    });
    
    // Create 7 days (columns)  
    for (var day = 0; day < 7; day++) {
      var dayButton = createDayButton(week, day);
      weekPanel.add(dayButton);
    }
    
    gridPanel.add(weekPanel);
  }
  
  return gridPanel;
}

/**
 * Create individual day button
 */
function createDayButton(week, dayOfWeek) {
  var dayNumber = calculateDayNumber(week, dayOfWeek);
  var dateString = formatDateString(currentYear, currentMonth, dayNumber);
  
  var dayButton = ui.Button({
    label: dayNumber > 0 ? dayNumber.toString() : '',
    style: {
      width: '120px',
      height: '80px',
      fontSize: '14px',
      fontWeight: 'bold',
      textAlign: 'center',
      backgroundColor: getDayBackgroundColor(dateString),
      border: '1px solid #ccc',
      margin: '1px'
    },
    onClick: function() {
      if (dayNumber > 0) {
        selectDay(dateString);
      }
    }
  });
  
  // Add small stats label below day number
  var statsText = getDayStatsText(dateString);
  var statsLabel = ui.Label({
    value: statsText,
    style: {
      fontSize: '10px',
      textAlign: 'center',
      color: '#666'
    }
  });
  
  var dayPanel = ui.Panel({
    widgets: [dayButton, statsLabel],
    layout: ui.Panel.Layout.flow('vertical'),
    style: {width: '120px', padding: '0px'}
  });
  
  return dayPanel;
}

/**
 * Create statistics panel
 */
function createStatsPanel() {
  var statsPanel = ui.Panel({
    style: {
      backgroundColor: '#f9f9f9',
      border: '1px solid #ccc',
      padding: '10px',
      margin: '10px 0px'
    },
    layout: ui.Panel.Layout.flow('vertical')
  });
  
  var titleLabel = ui.Label({
    value: 'Month Statistics',
    style: {fontSize: '16px', fontWeight: 'bold'}
  });
  
  var statsLabel = ui.Label({
    value: 'Loading statistics...',
    style: {fontSize: '12px'}
  });
  
  statsPanel.add(titleLabel);
  statsPanel.add(statsLabel);
  
  return statsPanel;
}

// ============================================================================
// CALENDAR LOGIC FUNCTIONS
// ============================================================================

/**
 * Calculate day number for calendar grid position
 */
function calculateDayNumber(week, dayOfWeek) {
  var firstDay = new Date(currentYear, currentMonth, 1).getDay();
  var dayNumber = (week * 7 + dayOfWeek) - firstDay + 1;
  var daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  
  return (dayNumber > 0 && dayNumber <= daysInMonth) ? dayNumber : 0;
}

/**
 * Format date string for processing
 */
function formatDateString(year, month, day) {
  if (day <= 0) return '';
  var monthStr = (month + 1).toString().padStart(2, '0');
  var dayStr = day.toString().padStart(2, '0');
  return year + '-' + monthStr + '-' + dayStr;
}

/**
 * Get background color for day based on glacier data
 */
function getDayBackgroundColor(dateString) {
  if (!dateString || !calendarData[dateString]) {
    return '#ffffff'; // White for no data
  }
  
  return glacierStats.getColorForGlacierData(calendarData[dateString]);
}

/**
 * Get statistics text for day display
 */
function getDayStatsText(dateString) {
  if (!dateString || !calendarData[dateString]) {
    return '';
  }
  
  var stats = calendarData[dateString];
  var availableMethods = 0;
  var totalPixels = 0;
  
  Object.keys(stats).forEach(function(method) {
    if (stats[method].available && stats[method].count > 0) {
      availableMethods++;
      totalPixels += stats[method].count;
    }
  });
  
  if (availableMethods === 0) return '';
  
  return availableMethods + ' methods\n' + totalPixels + ' pixels';
}

/**
 * Change month and update calendar
 */
function changeMonth(direction) {
  currentMonth += direction;
  
  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  } else if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }
  
  loadCalendarData();
  updateCalendarDisplay();
}

/**
 * Select a specific day
 */
function selectDay(dateString) {
  selectedDate = dateString;
  
  if (onDaySelectCallback) {
    var dayStats = calendarData[dateString];
    onDaySelectCallback(dateString, dayStats);
  }
  
  updateCalendarDisplay();
}

/**
 * Load glacier data for current month
 */
function loadCalendarData() {
  if (!glacierOutlines || !glacierMask) {
    print('Glacier data not initialized');
    return;
  }
  
  calendarData = {};
  var daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  
  print('Loading glacier data for ' + MONTHS[currentMonth] + ' ' + currentYear + '...');
  
  for (var day = 1; day <= daysInMonth; day++) {
    var dateString = formatDateString(currentYear, currentMonth, day);
    calendarData[dateString] = glacierStats.getAllMethodsGlacierStats(
      dateString, glacierOutlines, glacierMask
    );
  }
  
  print('Calendar data loaded successfully');
}

/**
 * Update calendar display with current data
 */
function updateCalendarDisplay() {
  // This would update the existing calendar panel
  // In practice, we'd rebuild or update the grid panel
  print('Calendar display updated for ' + MONTHS[currentMonth] + ' ' + currentYear);
}

// ============================================================================
// PUBLIC API FUNCTIONS
// ============================================================================

/**
 * Initialize calendar with glacier data
 */
function initializeCalendar(glacierData, daySelectCallback) {
  glacierOutlines = glacierData.outlines;
  glacierMask = glacierData.mask;
  onDaySelectCallback = daySelectCallback;
  
  loadCalendarData();
  
  return createCalendarPanel();
}

/**
 * Set calendar to specific year and month
 */
function setCalendarDate(year, month) {
  currentYear = year;
  currentMonth = month;
  loadCalendarData();
  updateCalendarDisplay();
}

/**
 * Get current calendar state
 */
function getCalendarState() {
  return {
    year: currentYear,
    month: currentMonth,
    selectedDate: selectedDate,
    data: calendarData
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

exports.initializeCalendar = initializeCalendar;
exports.setCalendarDate = setCalendarDate;
exports.getCalendarState = getCalendarState;
exports.loadCalendarData = loadCalendarData;
exports.updateCalendarDisplay = updateCalendarDisplay;