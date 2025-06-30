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
from typing import Dict, Optional
import sys
import os

# Add the current directory to Python path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    # Try relative imports first (when run as module)
    from .config.settings import (
        MODIS_COLLECTIONS, GLACIER_ASSET, PROCESSING_CONFIG, 
        DEBUG_MODE, get_all_config
    )
    from .utils.glacier_utils import initialize_glacier_data, apply_standard_filtering
    from .utils.export_utils import (
        export_comparison_stats_to_dataframe, export_dataframe_to_csv,
        print_data_counts, create_summary_statistics
    )
    from .workflows.comparison import run_modular_comparison
except ImportError:
    # Fall back to absolute imports (when run directly)
    from config.settings import (
        MODIS_COLLECTIONS, GLACIER_ASSET, PROCESSING_CONFIG, 
        DEBUG_MODE, get_all_config
    )
    from utils.glacier_utils import initialize_glacier_data, apply_standard_filtering
    from utils.export_utils import (
        export_comparison_stats_to_dataframe, export_dataframe_to_csv,
        print_data_counts, create_summary_statistics
    )
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


def main(start_date: str = '2017-06-01',
         end_date: str = '2024-09-30',
         methods: Optional[Dict[str, bool]] = None,
         export_csv: bool = True,
         relaxed_qa: bool = False) -> Optional[pd.DataFrame]:
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
        
        # Print data counts
        print_data_counts(results)
        print('')
        
        # Export to DataFrame
        if export_csv:
            print('📤 Exporting results to DataFrame...')
            df = export_comparison_stats_to_dataframe(
                results, 
                glacier_data['geometry'],
                f'modular_albedo_comparison_{start_date.replace("-", "")}_to_{end_date.replace("-", "")}'
            )
            
            if not df.empty:
                # Export to CSV
                csv_path = export_dataframe_to_csv(df)
                
                # Generate summary statistics
                summary = create_summary_statistics(df)
                if not summary.empty:
                    summary_path = export_dataframe_to_csv(
                        summary, 
                        filename=f'summary_statistics_{start_date.replace("-", "")}_to_{end_date.replace("-", "")}.csv'
                    )
                
                print('✅ Export completed successfully!')
                print(f'📊 Total observations: {len(df)}')
                print(f'📋 Methods: {df["method"].unique().tolist()}')
                return df
            else:
                print('⚠️ No valid observations to export')
                return None
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
    parser.add_argument('--start-date', default='2017-06-01', help='Start date (YYYY-MM-DD)')
    parser.add_argument('--end-date', default='2024-09-30', help='End date (YYYY-MM-DD)') 
    parser.add_argument('--methods', nargs='+', default=['ren', 'mod10a1', 'mcd43a3'],
                       choices=['ren', 'mod10a1', 'mcd43a3'], help='Methods to run')
    parser.add_argument('--relaxed-qa', action='store_true', help='Use relaxed QA filtering')
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
        
        main(
            start_date=args.start_date,
            end_date=args.end_date,
            methods=methods_dict,
            export_csv=not args.no_export,
            relaxed_qa=args.relaxed_qa
        )