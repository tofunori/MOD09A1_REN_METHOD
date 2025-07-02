# Multi-Year Pixel Analysis Script

## Overview

`test_pixel_multiyear.js` extends the proven `test_pixel_simple.js` methodology to process the complete 2017-2024 melt season (June 1 to September 30) for all three albedo methods into **ONE BIG CSV FILE**.

## Key Features

- **Non-invasive**: Standalone script that doesn't modify existing codebase
- **Identical Logic**: Uses exact same Terra/Aqua handling and pixel coordinate system as `test_pixel_simple.js`
- **Memory Optimized**: Enhanced settings for processing very large datasets
- **Single Output**: ONE comprehensive CSV file with all data from all years and methods

## Usage

### 1. Test First (Recommended)
```javascript
// In Earth Engine Code Editor, uncomment this line:
testSmallDateRange();  // Processes June 2023 only
```

### 2. Full Processing
```javascript
// After testing, uncomment this line:
runMultiYearPixelExport();  // Processes ALL 2017-2024 into ONE BIG CSV
```

## Technical Details

### Processing Strategy
- **Single Processing**: All years processed in one operation
- **Date Range**: 2017-06-01 to 2024-09-30
- **Melt Season Filter**: June, July, August, September only
- **Expected Output**: ONE massive CSV file

### Identical to test_pixel_simple.js
- **Pixel ID System**: `row*1000000+col` for unique spatial matching
- **Coordinate System**: Direct MODIS sinusoidal coordinates
- **Tile Coordinates**: Rounded lat/lon for spatial matching  
- **Terra/Aqua Handling**: Same merge + sort logic (no problematic `distinct()`)
- **Sampling**: 500m scale, all available pixels, geometries included

### Memory Management
```javascript
CONFIG = {
  SCALE: 500,
  MAX_PIXELS: 1e9,
  TILE_SCALE: 4,        // Higher for very large dataset
  BEST_EFFORT: true     // Allow Earth Engine optimization
}
```

## Expected Results

### File Organization
- **Folder**: `pixel_multiyear_complete`
- **Filename**: `ALL_pixels_three_methods_2017_2024_melt_season.csv`
- **Format**: CSV with same structure as single-day test
- **Size**: VERY LARGE file (potentially millions of pixel observations)

### Data Structure
Same CSV format as `test_pixel_simple.js`:
```
albedo_value, broadband_albedo_ren_masked, date, latitude, longitude, method, pixel_col, pixel_id, pixel_row, tile_h, tile_v, .geo
```

### Methods Processed
- **MOD09GA**: Ren method with Terra/Aqua merging
- **MOD10A1**: MODIS snow albedo with Terra/Aqua merging  
- **MCD43A3**: BRDF albedo (already combined Terra/Aqua product)

## Comparison with Single-Day Test

The multi-year script maintains **identical methodology** to ensure:
- Same pixel coordinate system for spatial matching
- Same Terra/Aqua handling for temporal consistency
- Same export format for analysis compatibility
- Same memory optimization strategies

## Monitoring

1. **Tasks Tab**: Monitor Earth Engine tasks for export progress
2. **Console Logs**: Track processing status for each monthly batch
3. **Google Drive**: Monitor available space (large exports expected)

## Risk Mitigation

- **Batch Processing**: Monthly chunks prevent memory timeouts
- **Error Handling**: Try/catch for each processing batch
- **Test Mode**: Small date range testing before full run
- **No Code Changes**: Zero risk to existing working codebase

## Integration with Existing Analysis

Results can be directly integrated with existing analysis scripts:
- Use same `analyze_pixels.py` approach for statistical analysis
- Combine with single-day results for validation
- Apply same correlation and RMSE analysis methodologies