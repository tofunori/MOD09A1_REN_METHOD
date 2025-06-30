/**
 * Common Utility Functions for MODIS Albedo Comparison
 * 
 * This module contains shared utility functions used across all
 * MODIS albedo retrieval methods.
 * 
 * Author: Modular Comparison Framework
 * Date: 2025-06-29
 */

// Import constants (Note: In GEE, this would be done differently)
// For now, we'll reference them directly

/**
 * Create glacier mask using 50% glacier abundance criterion
 * COPIED EXACTLY from full_script.js - the working version
 */
function createGlacierMask(glacierOutlines, glacierImage) {
  if (glacierOutlines) {
    // Create high-resolution glacier map with proper bounds
    var glacierBounds = glacierOutlines.geometry().bounds();
    var glacierMap = ee.Image(0).paint(glacierOutlines, 1).unmask(0)
      .clip(glacierBounds)
      .setDefaultProjection({
        crs: 'EPSG:4326',
        scale: 30
      });
    
    // Calculate glacier fractional abundance in each MODIS pixel (500m)
    var glacierFraction = glacierMap
      .reduceResolution({
        reducer: ee.Reducer.mean(),
        maxPixels: 1000
      })
      .reproject({
        crs: 'EPSG:4326',
        scale: 500
      });
    
    // Apply 50% glacier abundance threshold and ensure within glacier bounds
    var mask50 = glacierFraction.gt(0.50);
    
    // Additional safety: mask to glacier bounds
    var glacierBoundsMask = ee.Image().paint(glacierOutlines, 1).gt(0);
    
    return mask50.and(glacierBoundsMask);
  } else {
    // Simple fallback - use the glacier image directly
    return glacierImage.gt(0.50);
  }
}

/**
 * Filter collection to melt season only (June 1 - September 30)
 */
function filterMeltSeason(collection) {
  return collection.filter(ee.Filter.calendarRange(6, 9, 'month'));
}

/**
 * Calculate correlation between two image collections
 */
function calculateCorrelation(collection1, band1, collection2, band2, region) {
  // Join collections by time
  var filter = ee.Filter.equals({
    leftField: 'system:time_start',
    rightField: 'system:time_start'
  });
  
  var joined = ee.Join.inner().apply({
    primary: collection1.select(band1),
    secondary: collection2.select(band2),
    condition: filter
  });
  
  var correlationData = ee.FeatureCollection(joined.map(function(feature) {
    var primary = ee.Image(feature.get('primary'));
    var secondary = ee.Image(feature.get('secondary'));
    
    var combined = primary.addBands(secondary);
    
    var stats = combined.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: region,
      scale: 500,
      maxPixels: 1e9
    });
    
    return ee.Feature(null, {
      'method1': stats.get(band1),
      'method2': stats.get(band2),
      'date': ee.Date(feature.get('system:time_start')).format('YYYY-MM-dd')
    });
  }));
  
  return correlationData.filter(ee.Filter.and(
    ee.Filter.notNull(['method1']),
    ee.Filter.notNull(['method2'])
  ));
}

/**
 * Load and prepare glacier data
 */
function loadGlacierData() {
  var glacierImage = ee.Image('projects/tofunori/assets/Saskatchewan_glacier_2024_updated');
  var glacierBounds = glacierImage.geometry().bounds();
  
  var glacierOutlines = glacierImage.gt(0).selfMask().reduceToVectors({
    geometry: glacierBounds,
    scale: 30,
    geometryType: 'polygon'
  });
  
  return {
    image: glacierImage,
    bounds: glacierBounds,
    outlines: glacierOutlines
  };
}

/**
 * Load MODIS collection with standard filtering
 */
function loadModisCollection(collectionId, startDate, endDate, geometry) {
  var collection = ee.ImageCollection(collectionId)
    .filterDate(startDate, endDate)
    .filterBounds(geometry);
  
  // Filter to melt season only
  return filterMeltSeason(collection);
}

/**
 * Print collection size for debugging
 */
function printCollectionSize(collection, name) {
  collection.size().evaluate(function(size) {
    print(name + ' collection size before processing: ' + size);
  });
}

// ============================================================================
// EXPORTS FOR USE IN OTHER MODULES
// ============================================================================

// Export functions for use in other modules
exports.createGlacierMask = createGlacierMask;
exports.filterMeltSeason = filterMeltSeason;
exports.calculateCorrelation = calculateCorrelation;
exports.loadGlacierData = loadGlacierData;
exports.loadModisCollection = loadModisCollection;
exports.printCollectionSize = printCollectionSize;