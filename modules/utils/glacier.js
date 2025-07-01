/**
 * Glacier Utility Functions
 * 
 * Common functions for glacier masking, filtering, and geometry processing
 * 
 * Author: Modular Comparison Framework
 * Date: 2025-06-30
 */

// ============================================================================
// MODULE IMPORTS
// ============================================================================

var config = require('users/tofunori/MOD09GA_REN_METHOD:modules/config.js');

// ============================================================================
// GLACIER INITIALIZATION FUNCTIONS
// ============================================================================

/**
 * Initialize glacier data and geometry
 */
function initializeGlacierData() {
  // Load glacier image
  var glacierImage = ee.Image(config.GLACIER_ASSET);
  var glacierBounds = glacierImage.geometry().bounds(1); // 1 meter error margin
  
  // Create glacier outlines
  var glacierOutlines = glacierImage.gt(0).selfMask().reduceToVectors({
    geometry: glacierBounds,
    scale: config.GLACIER_CONFIG.scale,
    geometryType: 'polygon'
  });
  
  return {
    image: glacierImage,
    bounds: glacierBounds,
    outlines: glacierOutlines,
    geometry: glacierOutlines.geometry()
  };
}

// ============================================================================
// GLACIER MASKING FUNCTIONS
// ============================================================================

/**
 * Create glacier mask for processing with 50% abundance threshold
 */
function createGlacierMask(glacierOutlines, glacierImage) {
  if (glacierOutlines) {
    // Create high-resolution glacier map with proper bounds
    var glacierBounds = glacierOutlines.geometry().bounds(1); // 1 meter error margin
    var glacierMap = ee.Image(0).paint(glacierOutlines, 1).unmask(0)
      .clip(glacierBounds)
      .setDefaultProjection({
        crs: 'EPSG:4326',
        scale: config.GLACIER_CONFIG.scale
      });
    
    // Calculate glacier fractional abundance in each MODIS pixel
    var glacierFraction = glacierMap
      .reduceResolution({
        reducer: ee.Reducer.mean(),
        maxPixels: 1000
      })
      .reproject({
        crs: 'EPSG:4326',
        scale: config.GLACIER_CONFIG.modis_scale
      });
    
    // Apply 50% glacier abundance threshold and ensure within glacier bounds
    var mask50 = glacierFraction.gt(config.GLACIER_CONFIG.abundance_threshold);
    
    // Additional safety: mask to glacier bounds
    var glacierBoundsMask = ee.Image().paint(glacierOutlines, 1).gt(0);
    
    return mask50.and(glacierBoundsMask);
  } else {
    // Simple fallback - use the glacier image directly
    return glacierImage.gt(config.GLACIER_CONFIG.abundance_threshold);
  }
}

/**
 * Create glacier fraction map for analysis
 */
function createGlacierFractionMap(glacierOutlines) {
  if (glacierOutlines) {
    var glacierBounds = glacierOutlines.geometry().bounds(1); // 1 meter error margin
    var glacierMap = ee.Image(0).paint(glacierOutlines, 1).unmask(0)
      .clip(glacierBounds)
      .setDefaultProjection({
        crs: 'EPSG:4326',
        scale: config.GLACIER_CONFIG.scale
      });
    
    // Calculate glacier fractional abundance in each MODIS pixel
    var glacierFraction = glacierMap
      .reduceResolution({
        reducer: ee.Reducer.mean(),
        maxPixels: 1000
      })
      .reproject({
        crs: 'EPSG:4326',
        scale: config.GLACIER_CONFIG.modis_scale
      })
      .rename('glacier_fraction');
    
    return glacierFraction;
  } else {
    return null;
  }
}

// ============================================================================
// FILTERING FUNCTIONS
// ============================================================================

/**
 * Filter collection to melt season (June-September)
 */
function filterMeltSeason(collection) {
  return collection.filter(ee.Filter.calendarRange(6, 9, 'month'));
}

/**
 * Filter collection by date range
 */
function filterDateRange(collection, startDate, endDate) {
  return collection.filterDate(startDate, endDate);
}

/**
 * Filter collection by bounds
 */
function filterBounds(collection, geometry) {
  return collection.filterBounds(geometry);
}

/**
 * Apply complete temporal and spatial filtering
 */
function applyStandardFiltering(collection, startDate, endDate, geometry, meltSeasonOnly) {
  var filtered = collection
    .filterDate(startDate, endDate)
    .filterBounds(geometry);
  
  if (meltSeasonOnly) {
    filtered = filterMeltSeason(filtered);
  }
  
  return filtered;
}

// ============================================================================
// GEOMETRY UTILITIES
// ============================================================================

/**
 * Get glacier center point for map centering
 */
function getGlacierCenter(glacierGeometry) {
  return glacierGeometry.centroid(1); // 1 meter error margin
}

/**
 * Get appropriate zoom level for glacier viewing
 */
function getGlacierZoom(glacierGeometry) {
  var area = glacierGeometry.area(1); // 1 meter error margin
  // Estimate zoom based on area (simplified)
  return ee.Algorithms.If(area.gt(1e8), 10, 12); // Larger glaciers get lower zoom
}

// ============================================================================
// CORRELATION AND STATISTICS
// ============================================================================

/**
 * Calculate correlation between two image collections
 */
function calculateCollectionCorrelation(collection1, collection2, band1, band2, region) {
  var joined = ee.Join.inner().apply({
    primary: collection1.select(band1),
    secondary: collection2.select(band2),
    condition: ee.Filter.equals({
      leftField: 'system:time_start',
      rightField: 'system:time_start'
    })
  });
  
  var correlationFeatures = joined.map(function(feature) {
    var primary = ee.Image(feature.get('primary'));
    var secondary = ee.Image(feature.get('secondary'));
    
    var correlation = primary.select(band1).addBands(secondary.select(band2))
      .reduceRegion({
        reducer: ee.Reducer.pearsonsCorrelation(),
        geometry: region,
        scale: config.GLACIER_CONFIG.modis_scale,
        maxPixels: 1e6
      });
    
    return ee.Feature(null, correlation);
  });
  
  return ee.FeatureCollection(correlationFeatures);
}

// ============================================================================
// EXPORTS
// ============================================================================

exports.initializeGlacierData = initializeGlacierData;
exports.createGlacierMask = createGlacierMask;
exports.createGlacierFractionMap = createGlacierFractionMap;
exports.filterMeltSeason = filterMeltSeason;
exports.filterDateRange = filterDateRange;
exports.filterBounds = filterBounds;
exports.applyStandardFiltering = applyStandardFiltering;
exports.getGlacierCenter = getGlacierCenter;
exports.getGlacierZoom = getGlacierZoom;
exports.calculateCollectionCorrelation = calculateCollectionCorrelation;