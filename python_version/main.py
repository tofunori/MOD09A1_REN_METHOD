"""
Main Entry Point - MODIS Albedo Comparison Framework (Python Version)

Clean main script for Python implementation using Google Earth Engine Python API
Orchestrates UI setup and workflow execution with pandas integration

Author: Modular Comparison Framework
Date: 2025-06-30
Version: 2.0 - Python Implementation
"""

import ee
import pandas as pd
from typing import Dict, Optional, List, Any, Union
import sys
import os
from datetime import datetime

# Add the current directory to Python path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    # Try relative imports first (when run as module)
    from .config.settings import (
        MODIS_COLLECTIONS, GLACIER_ASSET, PROCESSING_CONFIG, 
        DEBUG_MODE, get_all_config
    )
    from .utils.glacier_utils import initialize_glacier_data, apply_standard_filtering
    from .workflows.comparison import run_modular_comparison
except ImportError:
    # Fall back to absolute imports (when run directly)
    from config.settings import (
        MODIS_COLLECTIONS, GLACIER_ASSET, PROCESSING_CONFIG, 
        DEBUG_MODE, get_all_config
    )
    from utils.glacier_utils import initialize_glacier_data, apply_standard_filtering
    from workflows.comparison import run_modular_comparison


def authenticate_ee():
    """Initialize and authenticate Google Earth Engine."""
    try:
        ee.Initialize()
        print('✅ Google Earth Engine initialized successfully')
    except Exception as e:
        print('❌ Earth Engine initialization failed')
        print('💡 Run: ee.Authenticate() in a separate script first')
        print(f'Error: {str(e)}')
        return False
    return True


def export_robust_collection(collection: ee.ImageCollection, 
                             albedo_band: str, 
                             method_name: str,
                             region: Any) -> pd.DataFrame:
    """
    Robust collection export that handles collection size properly.
    
    Args:
        collection: Image collection to process
        albedo_band: Name of the albedo band
        method_name: Method name for labeling
        region: Region of interest
        
    Returns:
        DataFrame with results
    """
    print(f'📊 Processing {method_name} statistics...')
    
    try:
        # Get actual collection size first
        collection_size_raw = collection.size().getInfo()
        if collection_size_raw is None:
            print(f'  ⚠️ Cannot determine collection size for {method_name}')
            return pd.DataFrame()
            
        collection_size: int = int(collection_size_raw)
        print(f'  Collection size: {collection_size} images')
        
        if collection_size == 0:
            print(f'  ⚠️ No images in {method_name} collection')
            return pd.DataFrame()
        
        # Process only available images
        max_process = min(collection_size, 10)  # Process up to 10 images
        print(f'  Processing first {max_process} images...')
        
        results = []
        collection_list = collection.toList(max_process)
        
        for i in range(max_process):
            try:
                image = ee.Image(collection_list.get(i))
                
                # Get image date
                date_millis_raw = image.get('system:time_start').getInfo()
                if date_millis_raw is None:
                    print(f'  ⚠️ No time stamp available in image {i}')
                    continue
                date_millis: int = int(date_millis_raw)
                date_obj = datetime.fromtimestamp(date_millis / 1000)
                
                # Check if band exists
                band_names_raw = image.bandNames().getInfo()
                if not band_names_raw:  # Handle None or empty list
                    print(f'  ⚠️ No band names available in image {i}')
                    continue
                
                band_names: List[str] = list(band_names_raw)
                available_band: Optional[str] = None
                
                # Try different band name variations
                for band_candidate in [albedo_band, albedo_band.replace('_masked', ''), f'{albedo_band}_masked']:
                    if band_candidate in band_names:
                        available_band = band_candidate
                        break
                
                if available_band is None:
                    print(f'  ⚠️ No suitable albedo band found in image {i}')
                    continue
                
                # Calculate statistics for a smaller area to avoid timeouts
                center = region.centroid()
                study_area = center.buffer(2000)  # 2km buffer around center
                
                stats_raw = image.select(available_band).reduceRegion(
                    reducer=ee.Reducer.mean().combine(ee.Reducer.count(), '', True),
                    geometry=study_area,
                    scale=500,
                    maxPixels=1e5,
                    bestEffort=True
                ).getInfo()
                
                if stats_raw is None:
                    print(f'  ⚠️ No statistics available for image {i}')
                    continue
                
                stats: Dict[str, Any] = dict(stats_raw)
                mean_key = f'{available_band}_mean'
                count_key = f'{available_band}_count'
                
                mean_value = stats.get(mean_key)
                count_value = stats.get(count_key, 0)
                
                if mean_value is not None:
                    results.append({
                        'method': method_name,
                        'date': date_obj.strftime('%Y-%m-%d'),
                        'year': date_obj.year,
                        'month': date_obj.month,
                        'day_of_year': date_obj.timetuple().tm_yday,
                        'albedo_mean': round(float(mean_value), 6),
                        'pixel_count': int(count_value),
                        'system_time_start': date_millis
                    })
                    print(f'  ✅ Image {i}: albedo={mean_value:.4f}, pixels={count_value}')
                else:
                    print(f'  ⚠️ No valid data in image {i}')
                    
            except Exception as e:
                print(f'  ⚠️ Error processing image {i} for {method_name}: {str(e)[:100]}...')
                continue
        
        if results:
            df = pd.DataFrame(results)
            print(f'  ✅ Processed {len(df)} valid observations for {method_name}')
            return df
        else:
            print(f'  ✅ Processed 0 valid observations for {method_name}')
            return pd.DataFrame()
            
    except Exception as e:
        print(f'  ❌ Error processing {method_name}: {str(e)}')
        return pd.DataFrame()


def main(start_date: str = '2020-06-01',
         end_date: str = '2020-06-15',
         methods: Optional[Dict[str, bool]] = None,
         export_csv: bool = True,
         relaxed_qa: bool = True) -> Optional[pd.DataFrame]:
    """
    Main application entry point for Python implementation.
    
    Args:
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)  
        methods: Dictionary of methods to run {'ren': True, 'mod10a1': True, 'mcd43a3': True}
        export_csv: Whether to export results to CSV
        relaxed_qa: Use relaxed quality filtering
        
    Returns:
        DataFrame with results if successful, None otherwise
    """
    print('🏗️ MODULAR MODIS ALBEDO COMPARISON FRAMEWORK (PYTHON)')
    print('📁 Architecture: Python packages with pandas integration')
    print('🔬 Methods: Ren, MOD10A1, MCD43A3')
    print('')
    
    # Set default methods if not provided
    if methods is None:
        methods = {'ren': True, 'mod10a1': True, 'mcd43a3': True}
    
    # Initialize Google Earth Engine
    if not authenticate_ee():
        return None
    
    try:
        # Initialize glacier data
        print('🚀 Initializing glacier data...')
        glacier_data = initialize_glacier_data()
        
        print('✅ Glacier data initialized successfully')
        print('📍 Processing region: Saskatchewan Glacier')
        print('')
        
        # Run comparison workflow
        print(f'📅 Date range: {start_date} to {end_date}')
        print(f'🔬 Methods selected: {[k for k, v in methods.items() if v]}')
        print(f'⚙️ Relaxed QA filtering: {relaxed_qa}')
        print('')
        
        results = run_modular_comparison(
            start_date=start_date,
            end_date=end_date,
            methods=methods,
            glacier_outlines=glacier_data['outlines'],
            region=glacier_data['geometry'],
            relaxed_qa=relaxed_qa
        )
        
        if not results:
            print('❌ No results generated')
            return None
        
        # Show processing summary
        print('📊 Data counts by method:')
        successful_methods = []
        for method, collection in results.items():
            if collection is not None:
                print(f'  • {method}: Collection available (count check skipped)')
                successful_methods.append(method)
            else:
                print(f'  • {method}: Processing failed')
        print('')
        
        # Export using robust approach
        if export_csv:
            print('📤 Exporting results to DataFrame...')
            all_dataframes = []
            
            # Export each method robustly
            if 'ren' in results and results['ren'] is not None:
                ren_df = export_robust_collection(
                    results['ren'], 
                    'broadband_albedo_ren', 
                    'Ren',
                    glacier_data['geometry']
                )
                if not ren_df.empty:
                    all_dataframes.append(ren_df)
            
            if 'mod10a1' in results and results['mod10a1'] is not None:
                mod10a1_df = export_robust_collection(
                    results['mod10a1'], 
                    'broadband_albedo_mod10a1', 
                    'MOD10A1',
                    glacier_data['geometry']
                )
                if not mod10a1_df.empty:
                    all_dataframes.append(mod10a1_df)
            
            if 'mcd43a3' in results and results['mcd43a3'] is not None:
                mcd43a3_df = export_robust_collection(
                    results['mcd43a3'], 
                    'broadband_albedo_mcd43a3', 
                    'MCD43A3',
                    glacier_data['geometry']
                )
                if not mcd43a3_df.empty:
                    all_dataframes.append(mcd43a3_df)
            
            # Combine all results
            if all_dataframes:
                final_df = pd.concat(all_dataframes, ignore_index=True)
                final_df['export_description'] = f'modular_albedo_comparison_{start_date.replace("-", "")}_to_{end_date.replace("-", "")}'
                final_df['export_timestamp'] = datetime.now().isoformat()
                
                # Export to CSV
                os.makedirs('./exports', exist_ok=True)
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                filename = f'./exports/modis_albedo_comparison_{timestamp}.csv'
                final_df.to_csv(filename, index=False)
                
                # Create summary statistics
                summary_stats = final_df.groupby('method').agg({
                    'albedo_mean': ['count', 'mean', 'std', 'min', 'max'],
                    'pixel_count': ['sum', 'mean'],
                    'date': ['min', 'max']
                }).round(6)
                summary_stats.columns = ['_'.join(col).strip() for col in summary_stats.columns.values]
                summary_stats = summary_stats.reset_index()
                
                summary_filename = f'./exports/summary_statistics_{start_date.replace("-", "")}_to_{end_date.replace("-", "")}.csv'
                summary_stats.to_csv(summary_filename, index=False)
                
                print('✅ Export completed successfully!')
                print(f'📁 CSV exported to: {filename}')
                print(f'📊 Records: {len(final_df)}')
                print(f'📋 Columns: {list(final_df.columns)}')
                print('📈 Summary statistics generated')
                print(f'📊 Methods: {final_df["method"].unique().tolist()}')
                print(f'📁 CSV exported to: {summary_filename}')
                print(f'📊 Records: {len(summary_stats)}')
                print(f'📋 Columns: {list(summary_stats.columns)}')
                print(f'📊 Total observations: {len(final_df)}')
                print(f'📋 Methods: {final_df["method"].unique().tolist()}')
                return final_df
            else:
                print('⚠️ No valid observations to export')
                return pd.DataFrame()
        else:
            print('ℹ️ CSV export skipped')
            return None
            
    except Exception as error:
        print(f'❌ Error in main processing: {str(error)}')
        if DEBUG_MODE:
            import traceback
            traceback.print_exc()
        return None


def run_individual_method_test(method_name: str,
                              start_date: str = '2017-06-01', 
                              end_date: str = '2017-06-30') -> Optional[pd.DataFrame]:
    """
    Development helper: Test individual method.
    
    Args:
        method_name: Method to test ('ren', 'mod10a1', 'mcd43a3')
        start_date: Start date for testing
        end_date: End date for testing
        
    Returns:
        DataFrame with test results
    """
    if not DEBUG_MODE:
        print('Debug mode disabled')
        return None
    
    print(f'🧪 Testing method: {method_name}')
    
    methods = {'ren': False, 'mod10a1': False, 'mcd43a3': False}
    methods[method_name] = True
    
    return main(
        start_date=start_date,
        end_date=end_date, 
        methods=methods,
        export_csv=True,
        relaxed_qa=True  # Use relaxed QA for testing
    )


def interactive_run():
    """Interactive command-line interface for the comparison framework."""
    print('🎛️ Interactive MODIS Albedo Comparison')
    print('=====================================')
    
    # Get user input
    start_date = input('Enter start date (YYYY-MM-DD) [2017-06-01]: ').strip() or '2017-06-01'
    end_date = input('Enter end date (YYYY-MM-DD) [2024-09-30]: ').strip() or '2024-09-30'
    
    print('\\nSelect methods to run:')
    ren_method = input('Run Ren method? (y/n) [y]: ').strip().lower() in ('', 'y', 'yes')
    mod10a1_method = input('Run MOD10A1 method? (y/n) [y]: ').strip().lower() in ('', 'y', 'yes')
    mcd43a3_method = input('Run MCD43A3 method? (y/n) [y]: ').strip().lower() in ('', 'y', 'yes')
    
    relaxed_qa = input('Use relaxed QA filtering? (y/n) [n]: ').strip().lower() in ('y', 'yes')
    
    methods = {
        'ren': ren_method,
        'mod10a1': mod10a1_method, 
        'mcd43a3': mcd43a3_method
    }
    
    print('\\n🚀 Starting comparison...')
    return main(
        start_date=start_date,
        end_date=end_date,
        methods=methods,
        export_csv=True,
        relaxed_qa=relaxed_qa
    )


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='MODIS Albedo Comparison Framework')
    parser.add_argument('--start-date', default='2020-06-01', help='Start date (YYYY-MM-DD)')
    parser.add_argument('--end-date', default='2020-06-15', help='End date (YYYY-MM-DD)') 
    parser.add_argument('--methods', nargs='+', default=['ren', 'mod10a1', 'mcd43a3'],
                       choices=['ren', 'mod10a1', 'mcd43a3'], help='Methods to run')
    parser.add_argument('--relaxed-qa', action='store_true', default=True, help='Use relaxed QA filtering')
    parser.add_argument('--standard-qa', action='store_true', help='Use standard QA filtering instead of relaxed')
    parser.add_argument('--no-export', action='store_true', help='Skip CSV export')
    parser.add_argument('--interactive', action='store_true', help='Run in interactive mode')
    parser.add_argument('--test-method', choices=['ren', 'mod10a1', 'mcd43a3'],
                       help='Test individual method (debug mode)')
    
    args = parser.parse_args()
    
    if args.interactive:
        interactive_run()
    elif args.test_method:
        run_individual_method_test(args.test_method)
    else:
        methods_dict = {method: True for method in ['ren', 'mod10a1', 'mcd43a3']}
        for method in methods_dict:
            if method not in args.methods:
                methods_dict[method] = False
        
        # Determine QA filtering mode
        use_relaxed_qa = args.relaxed_qa and not args.standard_qa
        
        main(
            start_date=args.start_date,
            end_date=args.end_date,
            methods=methods_dict,
            export_csv=not args.no_export,
            relaxed_qa=use_relaxed_qa
        )