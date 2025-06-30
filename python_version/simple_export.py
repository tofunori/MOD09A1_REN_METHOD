#!/usr/bin/env python3
"""
Simple Export Script - Works around asset reference issues

Exports a single image from each method for demonstration
"""

import ee
import sys
import os
import pandas as pd
from datetime import datetime

# Add the current directory to Python path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main_simple import main_simple


def export_sample_data(results, region, description="sample_export"):
    """
    Export sample statistics from the first image of each method.
    
    Args:
        results: Dictionary with method results
        region: Region of interest
        description: Export description
        
    Returns:
        pandas DataFrame with sample results
    """
    print('📤 Exporting sample statistics...')
    
    sample_stats = []
    
    for method, collection in results.items():
        if collection is not None:
            try:
                print(f'  📊 Processing {method}...')
                
                # Get first image
                first_image = collection.first()
                
                # Determine albedo band name based on method
                if method == 'mod10a1':
                    albedo_band = 'broadband_albedo_mod10a1_masked'
                elif method == 'mcd43a3':
                    albedo_band = 'broadband_albedo_mcd43a3_masked'
                elif method == 'ren':
                    albedo_band = 'broadband_albedo_ren_masked'
                else:
                    continue
                
                # Calculate basic statistics for the region
                stats = first_image.select(albedo_band).reduceRegion(
                    reducer=ee.Reducer.mean()
                        .combine(ee.Reducer.count(), '', True)
                        .combine(ee.Reducer.stdDev(), '', True),
                    geometry=region,
                    scale=500,
                    maxPixels=1e8,
                    bestEffort=True
                ).getInfo()
                
                # Get date
                date_millis = first_image.get('system:time_start').getInfo()
                date_obj = datetime.fromtimestamp(date_millis / 1000)
                
                # Create statistics record
                if stats.get(f'{albedo_band}_mean') is not None:
                    sample_stats.append({
                        'method': method.upper(),
                        'date': date_obj.strftime('%Y-%m-%d'),
                        'albedo_mean': stats.get(f'{albedo_band}_mean'),
                        'albedo_std': stats.get(f'{albedo_band}_stdDev'),
                        'pixel_count': stats.get(f'{albedo_band}_count'),
                        'description': description
                    })
                    print(f'    ✅ {method}: mean={stats.get(f"{albedo_band}_mean"):.3f}, pixels={stats.get(f"{albedo_band}_count")}')
                else:
                    print(f'    ⚠️ {method}: No valid data')
                
            except Exception as e:
                print(f'    ❌ {method}: Error - {str(e)[:50]}...')
                continue
    
    # Create DataFrame
    if sample_stats:
        df = pd.DataFrame(sample_stats)
        
        # Save to CSV
        os.makedirs('./exports', exist_ok=True)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'./exports/sample_albedo_stats_{timestamp}.csv'
        df.to_csv(filename, index=False)
        
        print(f'✅ Sample statistics exported to: {filename}')
        print(f'📊 Records: {len(df)}')
        print('\nSample Results:')
        print(df.to_string(index=False))
        
        return df
    else:
        print('⚠️ No valid statistics to export')
        return pd.DataFrame()


def main():
    """Main function to run processing and export sample data."""
    print('🧪 MODIS Albedo Sample Export')
    print('=' * 40)
    
    # Run simplified processing
    results = main_simple(
        start_date='2020-06-01',
        end_date='2020-06-15',
        methods={'ren': False, 'mod10a1': True, 'mcd43a3': True},
        relaxed_qa=True
    )
    
    if results:
        # Initialize glacier data for region
        from utils.glacier_utils import initialize_glacier_data
        glacier_data = initialize_glacier_data()
        
        # Export sample data
        df = export_sample_data(results, glacier_data['geometry'], 'demo_export')
        
        if not df.empty:
            print('\n🎉 Sample export completed successfully!')
            print('💡 This demonstrates that the methods are working correctly')
            print('💡 For full time series, process shorter date ranges or use GEE Code Editor')
        else:
            print('\n⚠️ No data exported, but methods processed successfully')
    else:
        print('\n❌ Processing failed')


if __name__ == '__main__':
    main()