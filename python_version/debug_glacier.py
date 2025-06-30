#!/usr/bin/env python3
"""
Debug script to test glacier data initialization
"""

import ee
from config.settings import GLACIER_ASSET
from utils.glacier_utils import initialize_glacier_data

def debug_glacier_data():
    """Debug glacier data initialization"""
    print("🔍 Debugging glacier data initialization...")
    
    # Initialize EE
    ee.Initialize()
    print("✅ Earth Engine initialized")
    
    # Test direct asset access
    print(f"📍 Testing asset: {GLACIER_ASSET}")
    try:
        # Try as Image first (based on our findings)
        glacier_img = ee.Image(GLACIER_ASSET)
        band_names = glacier_img.bandNames().getInfo()
        print(f"✅ Asset accessible as Image: {band_names}")
        
        # Get geometry
        geometry = glacier_img.geometry()
        bounds = geometry.bounds().getInfo()
        print(f"✅ Geometry accessible: {bounds}")
        
    except Exception as e:
        print(f"❌ Error accessing asset: {e}")
        return False
    
    # Test glacier utils function
    try:
        print("🔧 Testing glacier_utils.initialize_glacier_data()...")
        glacier_data = initialize_glacier_data()
        print("✅ Glacier data initialized successfully")
        print(f"📊 Keys: {list(glacier_data.keys())}")
        return True
        
    except Exception as e:
        print(f"❌ Error in initialize_glacier_data: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = debug_glacier_data()
    print(f"\n{'✅ Success' if success else '❌ Failed'}")