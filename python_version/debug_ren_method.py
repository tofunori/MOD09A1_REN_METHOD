#!/usr/bin/env python3
"""
Debug script to test Ren method processing step by step
"""

import ee
from config.settings import MODIS_COLLECTIONS
from utils.glacier_utils import initialize_glacier_data, apply_standard_filtering, create_glacier_mask
from methods.ren_method import process_ren_method

def debug_ren_method():
    """Debug Ren method processing step by step"""
    print("🔍 Debugging Ren method processing...")
    
    # Initialize EE
    ee.Initialize()
    print("✅ Earth Engine initialized")
    
    # Initialize glacier data
    print("🚀 Initializing glacier data...")
    glacier_data = initialize_glacier_data()
    print("✅ Glacier data initialized")
    
    # Get test image
    print("📡 Getting MODIS collection...")
    start_date = '2020-06-01'
    end_date = '2020-06-15'
    
    collection = ee.ImageCollection(MODIS_COLLECTIONS['MOD09GA'])
    filtered = apply_standard_filtering(collection, start_date, end_date, glacier_data['geometry'], True)
    print("✅ Collection filtered")
    
    # Get first image without checking count first
    first_image = ee.Image(filtered.first())
    print("✅ Got first image")
    
    # Test image properties
    try:
        band_names = first_image.bandNames().getInfo()
        print(f"✅ Band names: {band_names}")
        
        projection = first_image.projection().getInfo()
        print(f"✅ Projection: {projection}")
        
    except Exception as e:
        print(f"❌ Error getting image properties: {e}")
        return False
    
    # Test Ren method processing
    try:
        print("🔬 Testing Ren method processing...")
        result = process_ren_method(first_image, glacier_data['outlines'], create_glacier_mask, True)
        print("✅ Ren method processing successful")
        
        result_bands = result.bandNames().getInfo()
        print(f"✅ Result bands: {result_bands}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error in Ren method: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = debug_ren_method()
    print(f"\n{'✅ Success' if success else '❌ Failed'}")