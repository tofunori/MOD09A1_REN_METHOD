/**
 * Enhanced MODIS Pixel ID Utilities
 * 
 * Adapted from MODIS_Albedo project for robust pixel tracking
 * Implements hierarchical tile-based pixel identification system
 * 
 * Key Features:
 * - MODIS sinusoidal projection native coordinates
 * - Hierarchical h/v tile structure with within-tile row/col
 * - Multiple pixel ID formats for different use cases
 * - Validation and error handling
 * - Backwards compatibility with existing systems
 * 
 * Pixel ID Formats:
 * - Simple: SIN_row_col (e.g., SIN_-1234567_890123)
 * - Enhanced: MODIS_h12v04_r1234_c5678
 * - Numeric: 12040512003456 (h*1e9 + v*1e8 + row*1e4 + col)
 * 
 * Author: Enhanced Pixel Analysis System
 * Date: 2025-07-02
 */

// ============================================================================
// MODULE IMPORTS
// ============================================================================

var config = require('users/tofunori/MOD09A1_REN_METHOD:modules/config.js');

// ============================================================================
// MODIS GRID CONSTANTS
// ============================================================================

var MODIS_GRID = {
  // Official MODIS sinusoidal projection parameters
  TILE_SIZE_METERS: 1111950.51966,  // Official MODIS tile size
  MAX_H_TILES: 36,  // Horizontal tiles (h0 to h35)
  MAX_V_TILES: 18,  // Vertical tiles (v0 to v17)
  
  // Global coordinate offsets for handling negative coordinates
  X_OFFSET: 20015109.354,  // Offset for global X coverage
  Y_OFFSET: 10007554.677,  // Offset for global Y coverage
  
  // Pixels per tile for different MODIS resolutions
  PIXELS_PER_TILE: {
    250: 4800,   // 250m products
    500: 2400,   // 500m products  
    1000: 1200   // 1km products
  }
};

// ============================================================================
// BASIC PIXEL COORDINATE FUNCTIONS
// ============================================================================

/**
 * Generate simple pixel coordinate bands using MODIS sinusoidal projection
 * Creates row/col coordinates in native sinusoidal space
 */
function generateSimplePixelCoordinates(referenceImage) {
  var projection = referenceImage.projection();
  
  var coords = ee.Image.pixelCoordinates(projection);
  var pixelRow = coords.select('y').int().rename('pixel_row');
  var pixelCol = coords.select('x').int().rename('pixel_col');
  
  // Simple pixel ID: row * 1000000 + col (original format)
  var pixelId = pixelRow.multiply(1000000).add(pixelCol).int().rename('pixel_id_numeric');
  
  return ee.Image.cat([pixelRow, pixelCol, pixelId]);
}

/**
 * Generate enhanced pixel coordinate bands with hierarchical tile information
 * Creates h/v tile indices and within-tile row/col coordinates
 */
function generateEnhancedPixelCoordinates(referenceImage) {
  var projection = referenceImage.projection();
  var nominalScale = projection.nominalScale();
  
  // Generate pixel coordinates in MODIS sinusoidal space
  var coords = ee.Image.pixelCoordinates(projection);
  var x = coords.select('x');
  var y = coords.select('y');
  
  // Apply offsets to handle negative coordinates
  var xShifted = x.add(MODIS_GRID.X_OFFSET);
  var yShifted = y.add(MODIS_GRID.Y_OFFSET);
  
  // Calculate MODIS tile indices (h = horizontal, v = vertical)
  var h = xShifted.divide(MODIS_GRID.TILE_SIZE_METERS).floor().int().rename('tile_h');
  var v = yShifted.divide(MODIS_GRID.TILE_SIZE_METERS).floor().int().rename('tile_v');
  
  // Calculate within-tile pixel coordinates
  var xInTile = xShifted.mod(MODIS_GRID.TILE_SIZE_METERS);
  var yInTile = yShifted.mod(MODIS_GRID.TILE_SIZE_METERS);
  
  var rowInTile = yInTile.divide(nominalScale).floor().int().rename('pixel_row');
  var colInTile = xInTile.divide(nominalScale).floor().int().rename('pixel_col');
  
  // Create enhanced 64-bit pixel ID using decimal concatenation
  // Format: h*1e9 + v*1e8 + row*1e4 + col
  var pixelIdEnhanced = h.multiply(1e9)
    .add(v.multiply(1e8))
    .add(rowInTile.multiply(1e4))
    .add(colInTile)
    .double()
    .rename('pixel_id_enhanced');
  
  // Simple legacy ID for backwards compatibility
  var pixelIdSimple = coords.select('y').multiply(1000000)
    .add(coords.select('x')).int().rename('pixel_id_numeric');
  
  return ee.Image.cat([
    h, v, rowInTile, colInTile, 
    pixelIdEnhanced, pixelIdSimple
  ]);
}

// ============================================================================
// PIXEL ID FORMATTING AND VALIDATION
// ============================================================================

/**
 * Format simple pixel ID for CSV export (SIN_row_col format)
 */
function formatSimplePixelId(pixelRow, pixelCol) {
  if (pixelRow === null || pixelCol === null || 
      pixelRow === undefined || pixelCol === undefined ||
      isNaN(pixelRow) || isNaN(pixelCol)) {
    return 'invalid_coords';
  }
  
  return 'SIN_' + pixelRow + '_' + pixelCol;
}

/**
 * Format enhanced pixel ID (MODIS_h##v##_r####_c#### format)
 */
function formatEnhancedPixelId(h, v, row, col) {
  if (h === null || v === null || row === null || col === null ||
      h === undefined || v === undefined || row === undefined || col === undefined ||
      isNaN(h) || isNaN(v) || isNaN(row) || isNaN(col)) {
    return 'invalid_coords';
  }
  
  var hPadded = h < 10 ? '0' + h : h.toString();
  var vPadded = v < 10 ? '0' + v : v.toString();
  var rowPadded = ('0000' + row).slice(-4);
  var colPadded = ('0000' + col).slice(-4);
  
  return 'MODIS_h' + hPadded + 'v' + vPadded + '_r' + rowPadded + '_c' + colPadded;
}

/**
 * Validate pixel coordinates
 */
function validatePixelCoords(pixelRow, pixelCol) {
  return pixelRow !== null && pixelCol !== null && 
         pixelRow !== undefined && pixelCol !== undefined &&
         !isNaN(pixelRow) && !isNaN(pixelCol) &&
         isFinite(pixelRow) && isFinite(pixelCol);
}

/**
 * Validate enhanced pixel coordinates
 */
function validateEnhancedPixelCoords(h, v, row, col) {
  var isValid = true;
  var errors = [];
  
  if (h === null || h === undefined || isNaN(h) || h < 0 || h >= MODIS_GRID.MAX_H_TILES) {
    isValid = false;
    errors.push('Invalid h tile index');
  }
  
  if (v === null || v === undefined || isNaN(v) || v < 0 || v >= MODIS_GRID.MAX_V_TILES) {
    isValid = false;
    errors.push('Invalid v tile index');
  }
  
  if (row === null || row === undefined || isNaN(row) || row < 0) {
    isValid = false;
    errors.push('Invalid row coordinate');
  }
  
  if (col === null || col === undefined || isNaN(col) || col < 0) {
    isValid = false;
    errors.push('Invalid col coordinate');
  }
  
  return {
    valid: isValid,
    errors: errors
  };
}

// ============================================================================
// PIXEL ID CONVERSION FUNCTIONS
// ============================================================================

/**
 * Unpack enhanced pixel ID back to components
 */
function unpackEnhancedPixelId(pixelId) {
  if (pixelId === null || pixelId === undefined || isNaN(pixelId) || !isFinite(pixelId)) {
    return { h: null, v: null, row: null, col: null, valid: false };
  }
  
  var h = Math.floor(pixelId / 1e9);
  var remainder = pixelId % 1e9;
  
  var v = Math.floor(remainder / 1e8);
  remainder = remainder % 1e8;
  
  var row = Math.floor(remainder / 1e4);
  var col = remainder % 1e4;
  
  return {
    h: h,
    v: v,
    row: row,
    col: col,
    valid: true
  };
}

/**
 * Convert simple pixel ID to enhanced format
 */
function convertSimpleToEnhanced(pixelRow, pixelCol, referenceImage) {
  // This requires coordinate transformation which is complex
  // For now, return the simple format
  return formatSimplePixelId(pixelRow, pixelCol);
}

// ============================================================================
// GEOGRAPHIC COORDINATE FUNCTIONS
// ============================================================================

/**
 * Calculate pixel coordinates from geographic coordinates
 * Uses MODIS sinusoidal projection transformation
 */
function calculatePixelFromGeoCoords(lon, lat, referenceImage, callback) {
  try {
    if (lon === null || lon === undefined || lat === null || lat === undefined ||
        isNaN(lon) || isNaN(lat) || !isFinite(lon) || !isFinite(lat)) {
      callback({ error: 'Invalid coordinates provided' });
      return;
    }
    
    if (!referenceImage) {
      callback({ error: 'Reference image required for projection' });
      return;
    }
    
    // Get MODIS projection and sample pixel coordinates
    var projection = referenceImage.projection();
    var coords = ee.Image.pixelCoordinates(projection);
    
    var pixelRow = coords.select('y').rename('pixel_row');
    var pixelCol = coords.select('x').rename('pixel_col');
    var pixelId = pixelRow.multiply(1000000).add(pixelCol).rename('pixel_id');
    
    var point = ee.Geometry.Point([lon, lat]);
    var coordsImage = ee.Image.cat([pixelRow, pixelCol, pixelId]);
    
    var sample = coordsImage.sample(point, projection.nominalScale()).first();
    
    sample.getInfo(function(result) {
      if (!result || !result.properties) {
        callback({ error: 'No MODIS pixel found at location' });
        return;
      }
      
      var row = result.properties.pixel_row;
      var col = result.properties.pixel_col;
      var id = result.properties.pixel_id;
      
      if (row === null || col === null) {
        callback({ error: 'Unable to determine pixel coordinates' });
        return;
      }
      
      callback({
        row: row,
        col: col,
        pixelId: id,
        pixelIdFormatted: formatSimplePixelId(row, col),
        error: null
      });
    });
    
  } catch(e) {
    callback({ error: 'Coordinate calculation error: ' + e.message });
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Add pixel coordinate bands to an image
 */
function addPixelCoordinates(image, useEnhanced) {
  useEnhanced = useEnhanced || false;
  
  if (useEnhanced) {
    return image.addBands(generateEnhancedPixelCoordinates(image));
  } else {
    return image.addBands(generateSimplePixelCoordinates(image));
  }
}

/**
 * Get pixel scale from image for coordinate calculation
 */
function getPixelScale(image) {
  return image.projection().nominalScale();
}

/**
 * Create pixel sampling parameters for export
 */
function createSamplingParams(region, scale, maxPixels) {
  return {
    region: region,
    scale: scale || 500,
    tileScale: config.EXPORT_CONFIG ? config.EXPORT_CONFIG.tileScale : 4,
    geometries: true,
    maxPixels: maxPixels || 1e6
  };
}

// ============================================================================
// BACKWARDS COMPATIBILITY
// ============================================================================

/**
 * Legacy function for existing code compatibility
 */
function generatePixelCoordinates(referenceImage) {
  return generateSimplePixelCoordinates(referenceImage);
}

/**
 * Legacy function for existing code compatibility
 */
function formatPixelId(pixelRow, pixelCol) {
  return formatSimplePixelId(pixelRow, pixelCol);
}

// ============================================================================
// EXPORTS
// ============================================================================

exports.generateSimplePixelCoordinates = generateSimplePixelCoordinates;
exports.generateEnhancedPixelCoordinates = generateEnhancedPixelCoordinates;
exports.formatSimplePixelId = formatSimplePixelId;
exports.formatEnhancedPixelId = formatEnhancedPixelId;
exports.validatePixelCoords = validatePixelCoords;
exports.validateEnhancedPixelCoords = validateEnhancedPixelCoords;
exports.unpackEnhancedPixelId = unpackEnhancedPixelId;
exports.convertSimpleToEnhanced = convertSimpleToEnhanced;
exports.calculatePixelFromGeoCoords = calculatePixelFromGeoCoords;
exports.addPixelCoordinates = addPixelCoordinates;
exports.getPixelScale = getPixelScale;
exports.createSamplingParams = createSamplingParams;

// Backwards compatibility
exports.generatePixelCoordinates = generatePixelCoordinates;
exports.formatPixelId = formatPixelId;

// Constants
exports.MODIS_GRID = MODIS_GRID;