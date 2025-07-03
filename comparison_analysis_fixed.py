import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats

# Read CSV file
df = pd.read_csv("data/weekly_pixels_test.csv")

# Basic information
print("Dataset shape:", df.shape)
print("\nColumns:", df.columns.tolist())
print("\nUnique methods:", df['method'].unique())
print("\nSamples per method:")
print(df['method'].value_counts())

# Examine pixel_id and duplicates
print("\nPixel ID analysis:")
print("Unique pixel_id values:", len(df['pixel_id'].unique()))
print("Records per pixel_id and method:")
print(df.groupby(['pixel_id', 'method']).size().head(20))

# Create unique identifier based on coordinates
df['unique_pixel_id'] = df['latitude'].round(6).astype(str) + '_' + df['longitude'].round(6).astype(str)

# Identify common pixels
unique_pixels = df['unique_pixel_id'].unique()
print(f"\nTotal unique pixels (coordinate-based): {len(unique_pixels)}")

# Create pivot for analyzing same pixels
pivot_data = df.groupby(['unique_pixel_id', 'method'])['albedo_value'].first().unstack(fill_value=np.nan)
print(f"\nPixel coverage by method:")
for method in pivot_data.columns:
    coverage = (~pivot_data[method].isna()).sum()
    print(f"  {method}: {coverage} pixels")

# Find complete pixels (all 3 methods)
complete_pixels = pivot_data.dropna()
print(f"\nPixels with data for all 3 methods: {len(complete_pixels)}")

# Descriptive statistics by method
print("\n=== DESCRIPTIVE STATISTICS BY METHOD ===")
for method in df['method'].unique():
    data = df[df['method'] == method]['albedo_value']
    print(f"\n{method}:")
    print(f"  Mean: {data.mean():.4f}")
    print(f"  Median: {data.median():.4f}")
    print(f"  Std: {data.std():.4f}")
    print(f"  Min: {data.min():.4f}")
    print(f"  Max: {data.max():.4f}")
    print(f"  Count: {len(data)}")

# Analysis of common pixels only
if len(complete_pixels) > 0:
    print("\n=== COMMON PIXELS ANALYSIS ===")
    print(f"Pixels with all 3 methods: {len(complete_pixels)}")
    
    # Statistics on common pixels
    for method in complete_pixels.columns:
        data = complete_pixels[method]
        print(f"\n{method} (common pixels):")
        print(f"  Mean: {data.mean():.4f}")
        print(f"  Median: {data.median():.4f}")
        print(f"  Std: {data.std():.4f}")
        print(f"  Min: {data.min():.4f}")
        print(f"  Max: {data.max():.4f}")
    
    # Correlations between methods
    print("\n=== CORRELATIONS BETWEEN METHODS ===")
    correlation_matrix = complete_pixels.corr()
    print(correlation_matrix)
    
    # Correlation tests
    methods = complete_pixels.columns.tolist()
    for i, method1 in enumerate(methods):
        for method2 in methods[i+1:]:
            corr, p_value = stats.pearsonr(complete_pixels[method1], complete_pixels[method2])
            print(f"\nCorrelation {method1} vs {method2}:")
            print(f"  Pearson r: {corr:.4f}")
            print(f"  p-value: {p_value:.6f}")
    
    # Differences between methods
    print("\n=== DIFFERENCES BETWEEN METHODS ===")
    if 'MOD09GA' in methods and 'MOD10A1' in methods:
        diff_09ga_10a1 = complete_pixels['MOD09GA'] - complete_pixels['MOD10A1']
        print(f"MOD09GA - MOD10A1:")
        print(f"  Mean difference: {diff_09ga_10a1.mean():.4f}")
        print(f"  Std of differences: {diff_09ga_10a1.std():.4f}")
        print(f"  RMSE: {np.sqrt(np.mean(diff_09ga_10a1**2)):.4f}")
    
    if 'MOD09GA' in methods and 'MCD43A3' in methods:
        diff_09ga_mcd = complete_pixels['MOD09GA'] - complete_pixels['MCD43A3']
        print(f"\nMOD09GA - MCD43A3:")
        print(f"  Mean difference: {diff_09ga_mcd.mean():.4f}")
        print(f"  Std of differences: {diff_09ga_mcd.std():.4f}")
        print(f"  RMSE: {np.sqrt(np.mean(diff_09ga_mcd**2)):.4f}")
    
    if 'MOD10A1' in methods and 'MCD43A3' in methods:
        diff_10a1_mcd = complete_pixels['MOD10A1'] - complete_pixels['MCD43A3']
        print(f"\nMOD10A1 - MCD43A3:")
        print(f"  Mean difference: {diff_10a1_mcd.mean():.4f}")
        print(f"  Std of differences: {diff_10a1_mcd.std():.4f}")
        print(f"  RMSE: {np.sqrt(np.mean(diff_10a1_mcd**2)):.4f}")

# Comparison plots
plt.figure(figsize=(15, 10))

# Histograms by method
plt.subplot(2, 3, 1)
for method in df['method'].unique():
    data = df[df['method'] == method]['albedo_value']
    plt.hist(data, alpha=0.7, label=method, bins=30)
plt.xlabel('Albedo Value')
plt.ylabel('Frequency')
plt.title('Albedo Value Distribution by Method')
plt.legend()

# Boxplot
plt.subplot(2, 3, 2)
sns.boxplot(data=df, x='method', y='albedo_value')
plt.title('Albedo Values by Method')
plt.xticks(rotation=45)

# Scatter plots for common pixels if available
if len(complete_pixels) > 0 and len(complete_pixels.columns) >= 2:
    methods = complete_pixels.columns.tolist()
    
    # MOD09GA vs MOD10A1
    if 'MOD09GA' in methods and 'MOD10A1' in methods:
        plt.subplot(2, 3, 3)
        plt.scatter(complete_pixels['MOD09GA'], complete_pixels['MOD10A1'], alpha=0.6)
        plt.plot([0, 1], [0, 1], 'r--', label='1:1 line')
        plt.xlabel('MOD09GA')
        plt.ylabel('MOD10A1')
        plt.title('MOD09GA vs MOD10A1')
        plt.legend()
    
    # MOD09GA vs MCD43A3
    if 'MOD09GA' in methods and 'MCD43A3' in methods:
        plt.subplot(2, 3, 4)
        plt.scatter(complete_pixels['MOD09GA'], complete_pixels['MCD43A3'], alpha=0.6)
        plt.plot([0, 1], [0, 1], 'r--', label='1:1 line')
        plt.xlabel('MOD09GA')
        plt.ylabel('MCD43A3')
        plt.title('MOD09GA vs MCD43A3')
        plt.legend()
    
    # MOD10A1 vs MCD43A3
    if 'MOD10A1' in methods and 'MCD43A3' in methods:
        plt.subplot(2, 3, 5)
        plt.scatter(complete_pixels['MOD10A1'], complete_pixels['MCD43A3'], alpha=0.6)
        plt.plot([0, 1], [0, 1], 'r--', label='1:1 line')
        plt.xlabel('MOD10A1')
        plt.ylabel('MCD43A3')
        plt.title('MOD10A1 vs MCD43A3')
        plt.legend()

    # Correlation matrix
    plt.subplot(2, 3, 6)
    sns.heatmap(correlation_matrix, annot=True, cmap='coolwarm', center=0, 
                square=True, fmt='.3f')
    plt.title('Correlation Matrix')

plt.tight_layout()
plt.savefig('comparison_three_methods.png', dpi=300, bbox_inches='tight')
plt.close()

print("\nPlots saved to 'comparison_three_methods.png'")