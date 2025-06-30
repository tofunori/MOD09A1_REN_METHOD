"""
Export Utilities with Pandas Integration

Functions for exporting comparison results with comprehensive statistics
using Google Earth Engine Python API and pandas DataFrames.

Author: Modular Comparison Framework
Date: 2025-06-30
"""

import ee
import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Union, Tuple
from datetime import datetime
import time

try:
    from ..config.settings import EXPORT_CONFIG
except ImportError:
    from config.settings import EXPORT_CONFIG


def export_comparison_stats_to_dataframe(results: Dict[str, ee.ImageCollection],
                                        region: ee.Geometry,
                                        description: str = "modis_comparison") -> pd.DataFrame:
    """
    Export comprehensive statistics for all methods to pandas DataFrame
    Includes mean, std, min, max, count for each method and date
    
    Args:
        results: Dictionary with method names as keys and ImageCollections as values
        region: Region of interest for statistics calculation
        description: Description for the export
        
    Returns:
        pandas DataFrame with comprehensive statistics
    """
    print('📤 Exporting comprehensive statistics to DataFrame...')
    
    all_stats = []
    
    # Process Ren method results
    if 'ren' in results and results['ren'] is not None:
        print('📊 Processing Ren method statistics...')
        ren_stats = _process_method_collection(
            results['ren'], 
            'broadband_albedo_ren_masked',
            'Ren',
            region,
            EXPORT_CONFIG['scale'],
            EXPORT_CONFIG['maxPixels_ren']
        )
        all_stats.extend(ren_stats)
    
    # Process MOD10A1 results
    if 'mod10a1' in results and results['mod10a1'] is not None:
        print('📊 Processing MOD10A1 method statistics...')
        mod10a1_stats = _process_method_collection(
            results['mod10a1'],
            'broadband_albedo_mod10a1_masked', 
            'MOD10A1',
            region,
            EXPORT_CONFIG['scale_simple'],
            EXPORT_CONFIG['maxPixels_simple']
        )
        all_stats.extend(mod10a1_stats)
    
    # Process MCD43A3 results
    if 'mcd43a3' in results and results['mcd43a3'] is not None:
        print('📊 Processing MCD43A3 method statistics...')
        mcd43a3_stats = _process_method_collection(
            results['mcd43a3'],
            'broadband_albedo_mcd43a3_masked',
            'MCD43A3', 
            region,
            EXPORT_CONFIG['scale_simple'],
            EXPORT_CONFIG['maxPixels_simple']
        )
        all_stats.extend(mcd43a3_stats)
    
    # Create DataFrame
    if all_stats:
        df = pd.DataFrame(all_stats)
        print(f'✅ DataFrame created with {len(df)} observations')
        print(f'📁 Methods included: {df["method"].unique()}')
        
        # Add export metadata
        df['export_description'] = description
        df['export_timestamp'] = datetime.now().isoformat()
        
        return df
    else:
        print('⚠️ No statistics generated - empty results')
        return pd.DataFrame()


def _process_method_collection(collection: ee.ImageCollection,
                              albedo_band: str,
                              method_name: str,
                              region: ee.Geometry,
                              scale: int,
                              max_pixels: int) -> List[Dict]:
    """
    Process an image collection for a specific method and extract statistics.
    
    Args:
        collection: Image collection to process
        albedo_band: Name of the albedo band to analyze
        method_name: Name of the method for labeling
        region: Region of interest
        scale: Processing scale
        max_pixels: Maximum pixels for processing
        
    Returns:
        List of dictionaries with statistics for each image
    """
    stats_list = []
    
    try:
        # Use a reasonable upper limit instead of exact size to avoid asset reference issues
        max_images = 50  # Process up to 50 images to avoid timeouts
        collection_list = collection.toList(max_images)
        print(f'  Processing images for {method_name} (up to {max_images})...')
        
        # Process images until we hit an empty one
        for i in range(max_images):
            try:
                image = ee.Image(collection_list.get(i))
                
                # Check if the albedo band exists
                band_names = image.bandNames().getInfo()
                if not band_names:  # Empty image, end of collection
                    break
                if albedo_band not in band_names:
                    print(f'  ⚠️ Band {albedo_band} not found in image {i}, skipping...')
                    continue
                
                # Calculate statistics
                stats = image.select(albedo_band).reduceRegion(
                    reducer=ee.Reducer.mean()
                        .combine(ee.Reducer.stdDev(), '', True)
                        .combine(ee.Reducer.min(), '', True)
                        .combine(ee.Reducer.max(), '', True)
                        .combine(ee.Reducer.count(), '', True),
                    geometry=region,
                    scale=scale,
                    maxPixels=max_pixels,
                    bestEffort=EXPORT_CONFIG['bestEffort'],
                    tileScale=EXPORT_CONFIG['tileScale']
                ).getInfo()
                
                # Get date information
                date_millis = image.get('system:time_start').getInfo()
                date_obj = datetime.fromtimestamp(date_millis / 1000)
                
                # Extract statistics
                albedo_mean = stats.get(f'{albedo_band}_mean')
                albedo_std = stats.get(f'{albedo_band}_stdDev')
                albedo_min = stats.get(f'{albedo_band}_min')
                albedo_max = stats.get(f'{albedo_band}_max')
                pixel_count = stats.get(f'{albedo_band}_count')
                
                # Only include if we have valid data
                if albedo_mean is not None and pixel_count is not None and pixel_count > 0:
                    stats_dict = {
                        'albedo_mean': albedo_mean,
                        'albedo_std': albedo_std,
                        'albedo_min': albedo_min,
                        'albedo_max': albedo_max,
                        'pixel_count': pixel_count,
                        'date': date_obj.strftime('%Y-%m-%d'),
                        'year': date_obj.year,
                        'month': date_obj.month,
                        'day_of_year': date_obj.timetuple().tm_yday,
                        'method': method_name,
                        'system_time_start': date_millis
                    }
                    stats_list.append(stats_dict)
                
            except Exception as e:
                print(f'  ⚠️ Error processing image {i} for {method_name}: {str(e)[:50]}...')
                # If the error is asset-related, stop processing
                if 'Collection.loadTable' in str(e):
                    print(f'  🛑 Asset reference error detected, stopping {method_name} processing')
                    break
                continue
                
    except Exception as e:
        print(f'  ❌ Error setting up {method_name} processing: {str(e)[:50]}...')
        return []
    
    print(f'  ✅ Processed {len(stats_list)} valid observations for {method_name}')
    return stats_list


def export_dataframe_to_csv(df: pd.DataFrame, 
                           filename: Optional[str] = None,
                           folder_path: str = './exports') -> str:
    """
    Export pandas DataFrame to CSV file.
    
    Args:
        df: DataFrame to export
        filename: Output filename (auto-generated if None)
        folder_path: Output folder path
        
    Returns:
        Full path to exported file
    """
    import os
    
    # Create folder if it doesn't exist
    os.makedirs(folder_path, exist_ok=True)
    
    # Generate filename if not provided
    if filename is None:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'modis_albedo_comparison_{timestamp}.csv'
    
    # Ensure .csv extension
    if not filename.endswith('.csv'):
        filename += '.csv'
    
    full_path = os.path.join(folder_path, filename)
    
    # Export to CSV
    df.to_csv(full_path, index=False)
    
    print(f'📁 CSV exported to: {full_path}')
    print(f'📊 Records: {len(df)}')
    print(f'📋 Columns: {list(df.columns)}')
    
    return full_path


def export_to_google_drive(collection: ee.FeatureCollection,
                          description: str,
                          folder: str = 'albedo_method_comparison') -> ee.batch.Task:
    """
    Export FeatureCollection to Google Drive (traditional GEE export).
    
    Args:
        collection: FeatureCollection to export
        description: Export task description
        folder: Google Drive folder name
        
    Returns:
        Export task object
    """
    task = ee.batch.Export.table.toDrive(
        collection=collection,
        description=description,
        folder=folder,
        fileFormat='CSV'
    )
    
    task.start()
    print(f'🚀 Export task started: {description}')
    print(f'📁 Check Google Drive folder: {folder}')
    
    return task


def generate_export_description(prefix: str, 
                               start_date: str, 
                               end_date: str) -> str:
    """
    Generate export description with timestamp.
    
    Args:
        prefix: Description prefix
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
        
    Returns:
        Formatted description string
    """
    now = datetime.now()
    timestamp = now.strftime('%Y%m%d')
    
    start_clean = start_date.replace('-', '')
    end_clean = end_date.replace('-', '')
    
    return f'{prefix}_{start_clean}_to_{end_clean}_{timestamp}'


def print_data_counts(results: Dict[str, ee.ImageCollection]) -> None:
    """
    Print data counts for verification.
    
    Args:
        results: Dictionary with method results
    """
    print('📊 Data counts by method:')
    
    for method, collection in results.items():
        if collection is not None:
            try:
                # Avoid getInfo() calls that might trigger asset reference issues
                # Just check if collection is valid
                first_image = collection.first()
                if first_image:
                    print(f'  • {method}: Collection available (count check skipped)')
                else:
                    print(f'  • {method}: Empty collection')
            except Exception as e:
                print(f'  • {method}: Error accessing collection - {str(e)[:50]}...')
        else:
            print(f'  • {method}: No data')


def create_summary_statistics(df: pd.DataFrame) -> pd.DataFrame:
    """
    Create summary statistics across all methods and dates.
    
    Args:
        df: Input DataFrame with individual observations
        
    Returns:
        Summary statistics DataFrame
    """
    if df.empty:
        return pd.DataFrame()
    
    # Group by method and calculate summary statistics
    summary = df.groupby('method').agg({
        'albedo_mean': ['count', 'mean', 'std', 'min', 'max'],
        'pixel_count': ['sum', 'mean'],
        'date': ['min', 'max']
    }).round(6)
    
    # Flatten column names
    summary.columns = ['_'.join(col).strip() for col in summary.columns]
    
    # Reset index to make method a column
    summary = summary.reset_index()
    
    print('📈 Summary statistics generated')
    print(f'📊 Methods: {summary["method"].tolist()}')
    
    return summary


def export_individual_method(collection: ee.ImageCollection,
                            band_name: str,
                            method_name: str, 
                            region: ee.Geometry,
                            description: str) -> pd.DataFrame:
    """
    Export individual method results for debugging.
    
    Args:
        collection: Image collection for single method
        band_name: Albedo band name
        method_name: Method identifier
        region: Region of interest
        description: Export description
        
    Returns:
        DataFrame with method results
    """
    print(f'🔍 Exporting individual method: {method_name}')
    
    stats_list = _process_method_collection(
        collection, band_name, method_name, region,
        EXPORT_CONFIG['scale'], EXPORT_CONFIG['maxPixels_ren']
    )
    
    if stats_list:
        df = pd.DataFrame(stats_list)
        df['export_description'] = description + f'_{method_name}'
        df['export_timestamp'] = datetime.now().isoformat()
        
        print(f'✅ Individual export complete: {method_name}')
        return df
    else:
        print(f'⚠️ No data for method: {method_name}')
        return pd.DataFrame()


def monitor_export_tasks(tasks: List[ee.batch.Task], 
                        check_interval: int = 30) -> None:
    """
    Monitor Google Earth Engine export tasks.
    
    Args:
        tasks: List of export tasks to monitor
        check_interval: Check interval in seconds
    """
    print('👀 Monitoring export tasks...')
    
    while True:
        all_complete = True
        
        for i, task in enumerate(tasks):
            state = task.status()['state']
            print(f'  Task {i+1}: {state}')
            
            if state in ['RUNNING', 'READY']:
                all_complete = False
        
        if all_complete:
            print('✅ All export tasks completed!')
            break
        
        print(f'⏳ Checking again in {check_interval} seconds...')
        time.sleep(check_interval)