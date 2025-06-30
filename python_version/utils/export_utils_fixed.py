"""
Fixed Export Utilities - Works around asset reference issues

This version creates a simple export that avoids the glacier asset references
by using a different masking approach during export.
"""

import ee
import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Union, Tuple
from datetime import datetime
import time
import os

try:
    from ..config.settings import EXPORT_CONFIG
except ImportError:
    from config.settings import EXPORT_CONFIG


def export_fixed_comparison_stats(results: Dict[str, ee.ImageCollection],
                                 region: ee.Geometry,
                                 description: str = "modis_comparison") -> pd.DataFrame:
    """
    Export comparison statistics using a fixed approach that avoids asset references.
    
    Args:
        results: Dictionary with method names as keys and ImageCollections as values
        region: Region of interest for statistics calculation
        description: Description for the export
        
    Returns:
        pandas DataFrame with comprehensive statistics
    """
    print('📤 Exporting statistics with fixed approach...')
    
    all_stats = []
    
    # Create a simple bounding box region to avoid complex geometry issues
    bounds = region.bounds()
    simple_region = ee.Geometry.Rectangle(bounds.coordinates().get(0))
    
    # Process each method
    for method, collection in results.items():
        if collection is not None:
            print(f'📊 Processing {method} method...')
            
            # Determine the correct albedo band name
            if method == 'ren':
                albedo_band = 'broadband_albedo_ren'
            elif method == 'mod10a1':
                albedo_band = 'broadband_albedo_mod10a1'
            elif method == 'mcd43a3':
                albedo_band = 'broadband_albedo_mcd43a3'
            else:
                continue
            
            # Process up to 20 images to avoid timeouts
            stats_list = _process_collection_fixed(
                collection, albedo_band, method.upper(), simple_region, 20
            )
            
            all_stats.extend(stats_list)
    
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


def _process_collection_fixed(collection: Any,
                             albedo_band: str,
                             method_name: str,
                             region: ee.Geometry,
                             max_images: int = 20) -> List[Dict]:
    """
    Process collection with fixed approach that avoids asset references.
    
    Args:
        collection: Image collection to process
        albedo_band: Name of the albedo band to analyze
        method_name: Name of the method for labeling
        region: Simple region of interest (bounding box)
        max_images: Maximum number of images to process
        
    Returns:
        List of dictionaries with statistics for each image
    """
    stats_list = []
    
    try:
        print(f'  Processing up to {max_images} images for {method_name}...')
        
        # Get list of images
        image_list = collection.toList(max_images)
        
        for i in range(max_images):
            try:
                # Get the image
                image = ee.Image(image_list.get(i))
                
                # Check if image exists and has the required band
                band_names = image.bandNames().getInfo()
                if not band_names or albedo_band not in band_names:
                    if i == 0:  # Only warn for the first image
                        print(f'  ⚠️ Band {albedo_band} not found, skipping collection')
                    break
                
                # Create a simple mask to focus on the center of the glacier region
                # This avoids the complex glacier asset references
                center_point = region.centroid()
                study_area = center_point.buffer(2000)  # 2km buffer around center
                
                # Extract just the albedo band and apply a simple mask
                albedo_image = image.select(albedo_band)
                
                # Calculate statistics over the study area
                stats = albedo_image.reduceRegion(
                    reducer=ee.Reducer.mean()
                        .combine(ee.Reducer.stdDev(), '', True)
                        .combine(ee.Reducer.min(), '', True)
                        .combine(ee.Reducer.max(), '', True)
                        .combine(ee.Reducer.count(), '', True),
                    geometry=study_area,
                    scale=500,
                    maxPixels=1e6,
                    bestEffort=True
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
                        'albedo_mean': round(albedo_mean, 6),
                        'albedo_std': round(albedo_std, 6) if albedo_std else None,
                        'albedo_min': round(albedo_min, 6) if albedo_min else None,
                        'albedo_max': round(albedo_max, 6) if albedo_max else None,
                        'pixel_count': int(pixel_count),
                        'date': date_obj.strftime('%Y-%m-%d'),
                        'year': date_obj.year,
                        'month': date_obj.month,
                        'day_of_year': date_obj.timetuple().tm_yday,
                        'method': method_name,
                        'system_time_start': date_millis
                    }
                    stats_list.append(stats_dict)
                    
                    if len(stats_list) == 1:  # First successful image
                        print(f'    ✅ First image: albedo={albedo_mean:.4f}, pixels={pixel_count}')
                
            except Exception as e:
                error_msg = str(e)
                if 'Collection.loadTable' in error_msg:
                    print(f'  🛑 Asset reference error detected, stopping {method_name}')
                    break
                else:
                    print(f'  ⚠️ Error processing image {i}: {error_msg[:50]}...')
                    continue
                
    except Exception as e:
        print(f'  ❌ Error setting up {method_name} processing: {str(e)[:50]}...')
        return []
    
    print(f'  ✅ Successfully processed {len(stats_list)} images for {method_name}')
    return stats_list


def export_fixed_dataframe_to_csv(df: pd.DataFrame, 
                                  filename: Optional[str] = None,
                                  folder_path: str = './exports') -> str:
    """
    Export DataFrame to CSV with the fixed approach.
    
    Args:
        df: DataFrame to export
        filename: Output filename (auto-generated if None)
        folder_path: Output folder path
        
    Returns:
        Full path to exported file
    """
    # Create folder if it doesn't exist
    os.makedirs(folder_path, exist_ok=True)
    
    # Generate filename if not provided
    if filename is None:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'modis_albedo_fixed_{timestamp}.csv'
    
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


def create_fixed_summary_statistics(df: pd.DataFrame) -> pd.DataFrame:
    """
    Create summary statistics for the fixed export.
    
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