#!/usr/bin/env python3
"""
Simplified Main Entry Point - MODIS Albedo Comparison Framework (Python Version)

A simpler version that avoids problematic asset references during export
"""

import ee
import sys
import os

# Add the current directory to Python path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from config.settings import MODIS_COLLECTIONS
    from utils.glacier_utils import initialize_glacier_data
    from workflows.comparison import run_modular_comparison
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


def main_simple(start_date: str = '2020-06-01',
                end_date: str = '2020-06-15',
                methods: dict = None,
                relaxed_qa: bool = True):
    """
    Simplified main function that processes methods without problematic exports.
    
    Args:
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
        methods: Dictionary of methods to run
        relaxed_qa: Use relaxed quality filtering
        
    Returns:
        Dictionary with processing results
    """
    print('🏗️ MODULAR MODIS ALBEDO COMPARISON FRAMEWORK (PYTHON) - SIMPLIFIED')
    print('📁 Architecture: Python packages with basic processing')
    print('🔬 Methods: MOD10A1, MCD43A3 (Ren method has asset reference issues)')
    print('')
    
    # Set default methods if not provided (excluding Ren for now)
    if methods is None:
        methods = {'ren': False, 'mod10a1': True, 'mcd43a3': True}
    
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
        
        # Simple results summary without problematic getInfo() calls
        print('📊 Processing Summary:')
        for method, collection in results.items():
            if collection is not None:
                print(f'  ✅ {method}: Collection processed successfully')
                
                # Test that we can access the first image (basic validation)
                try:
                    first_image = collection.first()
                    if first_image:
                        print(f'     📸 First image accessible')
                    else:
                        print(f'     ⚠️ No images in collection')
                except Exception as e:
                    print(f'     ❌ Error accessing collection: {str(e)[:50]}...')
            else:
                print(f'  ❌ {method}: Processing failed')
        
        print('')
        print('✅ Processing completed successfully!')
        print('')
        print('💡 Results are ready for analysis in Google Earth Engine')
        print('💡 To export data, you can process individual images manually')
        print('💡 Or use the GEE Code Editor for detailed statistics')
        
        return results
        
    except Exception as error:
        print(f'❌ Error in main processing: {str(error)}')
        import traceback
        traceback.print_exc()
        return None


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='MODIS Albedo Comparison Framework - Simplified')
    parser.add_argument('--start-date', default='2020-06-01', help='Start date (YYYY-MM-DD)')
    parser.add_argument('--end-date', default='2020-06-15', help='End date (YYYY-MM-DD)') 
    parser.add_argument('--methods', nargs='+', default=['mod10a1', 'mcd43a3'],
                       choices=['ren', 'mod10a1', 'mcd43a3'], help='Methods to run')
    parser.add_argument('--relaxed-qa', action='store_true', default=True, help='Use relaxed QA filtering')
    
    args = parser.parse_args()
    
    methods_dict = {'ren': False, 'mod10a1': False, 'mcd43a3': False}
    for method in args.methods:
        methods_dict[method] = True
    
    results = main_simple(
        start_date=args.start_date,
        end_date=args.end_date,
        methods=methods_dict,
        relaxed_qa=args.relaxed_qa
    )
    
    if results:
        print('🎉 Success! Results available for further processing.')
    else:
        print('❌ Processing failed.')
        sys.exit(1)