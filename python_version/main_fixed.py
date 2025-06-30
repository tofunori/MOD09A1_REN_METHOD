#!/usr/bin/env python3
"""
Fixed Main Entry Point - MODIS Albedo Comparison Framework

This version fixes the asset reference issue and provides working data export.
"""

import ee
import pandas as pd
from typing import Dict, Optional
import sys
import os

# Add the current directory to Python path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from config.settings import MODIS_COLLECTIONS
    from utils.glacier_utils import initialize_glacier_data
    from workflows.comparison import run_modular_comparison
    from utils.export_utils_fixed import (
        export_fixed_comparison_stats, 
        export_fixed_dataframe_to_csv,
        create_fixed_summary_statistics
    )
except ImportError as e:
    print(f"❌ Import error: {e}")
    sys.exit(1)


def authenticate_ee():
    """Initialize and authenticate Google Earth Engine."""
    try:
        ee.Initialize()
        print('✅ Google Earth Engine initialized successfully')
        return True
    except Exception as e:
        print('❌ Earth Engine initialization failed')
        print('💡 Run: ee.Authenticate() in a separate script first')
        print(f'Error: {str(e)}')
        return False


def main_fixed(start_date: str = '2020-06-01',
               end_date: str = '2020-06-15',
               methods: Optional[Dict[str, bool]] = None,
               export_csv: bool = True,
               relaxed_qa: bool = True) -> Optional[pd.DataFrame]:
    """
    Fixed main function that processes methods and exports data successfully.
    
    Args:
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
        methods: Dictionary of methods to run
        export_csv: Whether to export results to CSV
        relaxed_qa: Use relaxed quality filtering
        
    Returns:
        DataFrame with results if successful, None otherwise
    """
    print('🏗️ MODULAR MODIS ALBEDO COMPARISON FRAMEWORK - FIXED VERSION')
    print('📁 Architecture: Python packages with working export')
    print('🔬 Methods: Ren, MOD10A1, MCD43A3')
    print('🛠️ Fixed: Asset reference issues resolved')
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
        print('📊 Processing Summary:')
        successful_methods = []
        for method, collection in results.items():
            if collection is not None:
                print(f'  ✅ {method}: Collection processed successfully')
                successful_methods.append(method)
            else:
                print(f'  ❌ {method}: Processing failed')
        
        if not successful_methods:
            print('❌ No methods processed successfully')
            return None
        
        print('')
        
        # Export to DataFrame using fixed approach
        if export_csv:
            print('📤 Exporting results using fixed approach...')
            df = export_fixed_comparison_stats(
                results, 
                glacier_data['geometry'],
                f'fixed_albedo_comparison_{start_date.replace("-", "")}_to_{end_date.replace("-", "")}'
            )
            
            if not df.empty:
                # Export to CSV
                csv_path = export_fixed_dataframe_to_csv(df)
                
                # Generate summary statistics
                summary = create_fixed_summary_statistics(df)
                if not summary.empty:
                    summary_path = export_fixed_dataframe_to_csv(
                        summary, 
                        filename=f'fixed_summary_statistics_{start_date.replace("-", "")}_to_{end_date.replace("-", "")}.csv'
                    )
                
                print('')
                print('✅ FIXED EXPORT COMPLETED SUCCESSFULLY!')
                print(f'📊 Total observations: {len(df)}')
                print(f'📋 Methods with data: {df["method"].unique().tolist()}')
                print('')
                
                # Show sample data
                print('📋 Sample Results:')
                print(df.head(10).to_string(index=False))
                
                return df
            else:
                print('⚠️ No valid observations to export')
                return None
        else:
            print('ℹ️ CSV export skipped')
            return None
            
    except Exception as error:
        print(f'❌ Error in main processing: {str(error)}')
        import traceback
        traceback.print_exc()
        return None


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='MODIS Albedo Comparison Framework - Fixed Version')
    parser.add_argument('--start-date', default='2020-06-01', help='Start date (YYYY-MM-DD)')
    parser.add_argument('--end-date', default='2020-06-15', help='End date (YYYY-MM-DD)') 
    parser.add_argument('--methods', nargs='+', default=['ren', 'mod10a1', 'mcd43a3'],
                       choices=['ren', 'mod10a1', 'mcd43a3'], help='Methods to run')
    parser.add_argument('--relaxed-qa', action='store_true', default=True, help='Use relaxed QA filtering')
    parser.add_argument('--no-export', action='store_true', help='Skip CSV export')
    
    args = parser.parse_args()
    
    methods_dict = {'ren': False, 'mod10a1': False, 'mcd43a3': False}
    for method in args.methods:
        methods_dict[method] = True
    
    df = main_fixed(
        start_date=args.start_date,
        end_date=args.end_date,
        methods=methods_dict,
        export_csv=not args.no_export,
        relaxed_qa=args.relaxed_qa
    )
    
    if df is not None and not df.empty:
        print('🎉 SUCCESS! All methods processed and data exported successfully!')
        print(f'📈 Data available for {len(df)} observations across methods')
    else:
        print('❌ Processing failed or no data exported.')
        sys.exit(1)