# MODIS Albedo Comparison Framework - Python Version

A comprehensive Python implementation using Google Earth Engine Python API for comparing three MODIS albedo retrieval methods over glacier surfaces, with pandas integration for advanced data analysis.

## 🏗️ Architecture

```
python_version/
├── main.py                      # Main entry point with CLI interface
├── requirements.txt             # Python dependencies
├── config/
│   ├── __init__.py
│   └── settings.py              # Configuration constants and parameters
├── methods/
│   ├── __init__.py
│   ├── ren_method.py            # MOD09GA Ren Method (complete implementation)
│   ├── mod10a1_method.py        # MOD10A1 Snow Albedo (placeholder)
│   └── mcd43a3_method.py        # MCD43A3 BRDF/Albedo (placeholder)
├── utils/
│   ├── __init__.py
│   ├── glacier_utils.py         # Glacier processing utilities
│   ├── quality_filters.py       # QA filtering functions
│   └── export_utils.py          # CSV export with pandas integration
├── workflows/
│   ├── __init__.py
│   └── comparison.py            # Main comparison workflow
├── notebooks/
│   ├── demo.ipynb              # Interactive demonstration
│   └── analysis.ipynb          # Results analysis
└── ui/
    ├── streamlit_app.py        # Web-based UI (optional)
    └── jupyter_widgets.py     # Notebook widgets (optional)
```

## 🔬 Methods Compared

1. **MOD09GA Ren Method**: Complete implementation with topographic correction and BRDF anisotropic correction
2. **MOD10A1 Snow Albedo**: Advanced QA filtering (simplified implementation)
3. **MCD43A3 BRDF/Albedo**: Collection 6.1 with quality assessment (simplified implementation)

## 🚀 Quick Start

### Prerequisites

1. **Google Earth Engine Account**: [Sign up here](https://earthengine.google.com/)
2. **Python 3.8+**: Recommended Python 3.9 or later
3. **Authentication**: Complete GEE authentication first

### Installation

1. **Clone or navigate to the python_version directory**:
   ```bash
   cd python_version
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Authenticate Google Earth Engine** (one-time setup):
   ```python
   import ee
   ee.Authenticate()
   ```

### Basic Usage

#### Command Line Interface

```bash
# Run with default settings (all methods, full date range)
python main.py

# Run specific methods with relaxed QA filtering
python main.py --methods ren mod10a1 --relaxed-qa

# Run for specific date range
python main.py --start-date 2020-06-01 --end-date 2020-09-30

# Interactive mode
python main.py --interactive

# Test individual method (debug mode)
python main.py --test-method ren
```

#### Python Script Usage

```python
import ee
from main import main

# Initialize Earth Engine
ee.Initialize()

# Run comparison
df = main(
    start_date='2020-06-01',
    end_date='2020-09-30',
    methods={'ren': True, 'mod10a1': True, 'mcd43a3': False},
    export_csv=True,
    relaxed_qa=True
)

# Analyze results
print(df.head())
print(df.groupby('method')['albedo_mean'].describe())
```

## 📊 Output Format

### CSV Export Structure

The framework exports comprehensive statistics for each method and date:

| Column | Description |
|--------|-------------|
| `albedo_mean` | Mean albedo value |
| `albedo_std` | Standard deviation |
| `albedo_min` | Minimum value |
| `albedo_max` | Maximum value |
| `pixel_count` | Number of valid pixels |
| `date` | Observation date (YYYY-MM-DD) |
| `year`, `month`, `day_of_year` | Temporal metadata |
| `method` | Method identifier (Ren, MOD10A1, MCD43A3) |
| `export_description` | Export metadata |
| `export_timestamp` | Export timestamp |

### DataFrame Integration

Results are returned as pandas DataFrames for immediate analysis:

```python
# Basic statistics
summary = df.groupby('method').agg({
    'albedo_mean': ['count', 'mean', 'std'],
    'pixel_count': ['sum', 'mean']
})

# Time series analysis
import matplotlib.pyplot as plt
df['date'] = pd.to_datetime(df['date'])
df.set_index('date').groupby('method')['albedo_mean'].plot()
plt.show()
```

## ⚙️ Configuration

### Quality Filtering Options

The framework supports multiple QA filtering levels:

```python
from utils.quality_filters import quality_filter_mod09a1, create_relaxed_filter_preset

# Strict filtering (default)
filtered_strict = quality_filter_mod09a1(image, relaxed=False)

# Relaxed filtering
filtered_relaxed = quality_filter_mod09a1(image, relaxed=True)

# Custom filtering
custom_params = create_relaxed_filter_preset('glacier_optimized')
filtered_custom = quality_filter_mod09a1(image, custom_params=custom_params)
```

### Available Presets

- **`moderate`**: Balanced data retention with quality
- **`maximum`**: Maximum data retention (lower quality)
- **`glacier_optimized`**: Optimized for glacier applications

## 🔧 Advanced Features

### Pandas Integration

Direct DataFrame access eliminates export delays:

```python
from utils.export_utils import export_comparison_stats_to_dataframe

# Get results as DataFrame immediately
df = export_comparison_stats_to_dataframe(results, region)

# Advanced analysis
correlation_matrix = df.pivot_table(
    values='albedo_mean', 
    index='date', 
    columns='method'
).corr()
```

### Batch Processing

Process multiple regions or time periods:

```python
date_ranges = [
    ('2017-06-01', '2017-09-30'),
    ('2018-06-01', '2018-09-30'),
    ('2019-06-01', '2019-09-30')
]

all_results = []
for start, end in date_ranges:
    df = main(start_date=start, end_date=end)
    all_results.append(df)

combined_df = pd.concat(all_results, ignore_index=True)
```

### Custom Analysis

```python
# Seasonal analysis
df['season'] = df['month'].map({6: 'Early', 7: 'Mid', 8: 'Mid', 9: 'Late'})
seasonal_stats = df.groupby(['method', 'season'])['albedo_mean'].mean()

# Quality assessment
high_quality = df[df['pixel_count'] > 1000]
print(f"High quality observations: {len(high_quality)}/{len(df)}")
```

## 🎯 Key Advantages over JavaScript Version

### **Enhanced Functionality**
- **Direct DataFrame Access**: No export delays for analysis
- **Advanced Plotting**: matplotlib, seaborn, plotly integration
- **Statistical Analysis**: scipy, scikit-learn integration
- **Flexible Development**: Any Python IDE or environment

### **Improved Workflow**
- **Version Control**: Better integration with Git
- **Testing**: Unit tests for all functions
- **Documentation**: Sphinx-generated documentation
- **Packaging**: pip-installable package potential

### **Research Advantages**
- **Reproducible Research**: Jupyter notebooks with embedded results
- **Parameter Studies**: Easy batch processing for sensitivity analysis
- **Data Integration**: Combine with other Python data sources
- **Publication Ready**: Export-quality figures and tables

## 📚 Development

### Testing Individual Methods

```python
from main import run_individual_method_test

# Test Ren method only
df = run_individual_method_test('ren', '2020-06-01', '2020-06-30')
```

### Debug Mode

Enable debug mode in `config/settings.py`:

```python
PROCESSING_CONFIG = {
    'debug_mode': True,  # Enable detailed error reporting
    # ... other settings
}
```

## 🔍 Troubleshooting

### Common Issues

1. **Authentication Error**:
   ```bash
   # Re-authenticate
   python -c "import ee; ee.Authenticate()"
   ```

2. **Memory Errors**:
   ```python
   # Reduce date range or use relaxed filtering
   df = main(start_date='2020-06-01', end_date='2020-06-30', relaxed_qa=True)
   ```

3. **Missing Data**:
   ```python
   # Check data availability
   from utils.export_utils import print_data_counts
   print_data_counts(results)
   ```

### Performance Tips

- Use relaxed QA filtering for larger date ranges
- Process shorter time periods for initial testing
- Monitor Earth Engine quota usage
- Use `bestEffort=True` for large exports

## 📖 Documentation

- **Method Documentation**: Each module contains detailed docstrings
- **Configuration**: See `config/settings.py` for all parameters
- **Examples**: Check `notebooks/` for interactive examples
- **API Reference**: Use `help()` on any function for details

## 🤝 Contributing

The Python implementation provides a solid foundation for:
- Adding new MODIS products
- Implementing additional QA filtering methods
- Creating custom visualization tools
- Extending to other glacier regions

## 📄 License

This implementation follows the same methodology as Ren et al. (2021/2023) with proper attribution to the original research.

---

**Version**: 2.0 - Python Implementation  
**Author**: Modular Comparison Framework  
**Date**: 2025-06-30