#!/usr/bin/env python3
"""
Simple debug script to isolate the asset access issue
"""

import ee

def debug_simple():
    """Simple debug test"""
    print("🔍 Simple debugging...")
    
    # Initialize EE
    ee.Initialize()
    print("✅ Earth Engine initialized")
    
    # Test MODIS collection directly
    try:
        collection = ee.ImageCollection('MODIS/061/MOD09GA')
        first_image = collection.filterDate('2020-06-01', '2020-06-15').first()
        band_names = first_image.bandNames().getInfo()
        print(f"✅ MODIS collection works: {band_names}")
    except Exception as e:
        print(f"❌ MODIS collection failed: {e}")
        return False
    
    # Test glacier asset directly
    try:
        glacier_asset = 'projects/tofunori/assets/Saskatchewan_glacier_2024_updated'
        glacier_img = ee.Image(glacier_asset)
        glacier_bands = glacier_img.bandNames().getInfo()
        print(f"✅ Glacier asset works: {glacier_bands}")
    except Exception as e:
        print(f"❌ Glacier asset failed: {e}")
        return False
    
    print("✅ Both assets work independently")
    return True

if __name__ == "__main__":
    success = debug_simple()
    print(f"\n{'✅ Success' if success else '❌ Failed'}")