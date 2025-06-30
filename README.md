# Modular MODIS Albedo Comparison Framework

A clean, modular framework for comparing three MODIS albedo retrieval methods over glacier surfaces.

## 🏗️ Architecture

Following the proven MODIS_Albedo project pattern:

```
MOD09A1_REN_METHOD/
├── main.js                    # Main entry point (60 lines)
├── modules/
│   ├── config.js             # Centralized configuration
│   ├── methods/              # Individual method implementations
│   │   ├── mod09a1.js       # MOD09A1 Method (complete)
│   │   ├── mod10a1.js       # MOD10A1 Snow Albedo (advanced QA)
│   │   └── mcd43a3.js       # MCD43A3 BRDF/Albedo (Collection 6.1)
│   ├── ui/                   # User interface components
│   │   ├── controls.js      # UI controls and inputs
│   │   ├── setup.js         # UI orchestrator
│   │   └── visualization.js # Map visualization
│   ├── utils/                # Common utilities
│   │   ├── export.js        # CSV export with statistics
│   │   └── glacier.js       # Glacier utilities and filtering
│   └── workflows/            # Main processing workflows
│       └── comparison.js    # Comparison orchestrator
└── legacy/                   # Original scripts (preserved)
    ├── original_script.js
    ├── full_script.js
    ├── full_script_with_elevation.js
    └── comprehensive_albedo_comparison.js
```

## 🔬 Methods Compared

1. **MOD09A1 Method**: Complete implementation with topographic correction and BRDF anisotropic correction
2. **MOD10A1 Snow Albedo**: Advanced QA filtering from MODIS_Albedo project  
3. **MCD43A3 BRDF/Albedo**: Collection 6.1 with comprehensive quality assessment

## 🚀 Usage

1. **Load in Google Earth Engine**: Use the main.js file
2. **Configure dates**: Use the UI panel (default: 2017-2024 melt season)
3. **Select methods**: Choose which methods to compare
4. **Run comparison**: Click "Run Modular Comparison"
5. **Export results**: Click "Export CSV Results" for comprehensive statistics

## 📊 CSV Export Structure

Comprehensive statistics exported for each method and date:
- `albedo_mean`: Mean albedo value
- `albedo_std`: Standard deviation
- `albedo_min`: Minimum value
- `albedo_max`: Maximum value  
- `pixel_count`: Number of valid pixels
- `date`: Observation date (YYYY-MM-DD)
- `year`, `month`, `day_of_year`: Temporal metadata
- `method`: Method identifier (MOD09A1, MOD10A1, MCD43A3)

## 🎯 Key Features

- **Modular Architecture**: Clean separation of concerns
- **Advanced QA Filtering**: Sophisticated quality assessment for all methods
- **Melt Season Focus**: June-September filtering for glacial applications
- **Comprehensive Export**: Statistical summaries with temporal metadata
- **Interactive UI**: User-friendly control panel and map visualization
- **Google Earth Engine Paths**: Correct absolute paths with .js extensions

## 🔧 Technical Details

- **Module Loading**: Uses absolute GEE paths: `users/tofunori/MOD09A1_REN_METHOD:modules/...`  
- **QA Configuration**: Metadata-driven quality filtering
- **Memory Optimization**: Efficient processing for large temporal ranges
- **Error Handling**: Comprehensive error management and user feedback
- **Debug Mode**: Development utilities for individual method testing

## 📁 Legacy Preservation

Original scripts preserved in `legacy/` folder for reference and comparison.

## 🎨 Map Visualization

- **Method Layers**: Individual albedo products with consistent color scales
- **Difference Layers**: Method comparisons (MOD09A1-MOD10A1, MOD09A1-MCD43A3, etc.)
- **Glacier Context**: Glacier fraction and outline overlays
- **QA Debugging**: Quality assessment layer visualization
- **Interactive Legend**: Color scale reference

## 💾 Configuration

Central configuration in `modules/config.js`:
- MODIS collection paths
- Processing parameters  
- Export settings
- Glacier thresholds
- QA filtering levels

---

**Version**: 2.0 - Modular Architecture  
**Author**: Modular Comparison Framework  
**Date**: 2025-06-30