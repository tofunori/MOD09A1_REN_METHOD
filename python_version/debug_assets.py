#!/usr/bin/env python3
"""
Debug script to check available assets
"""

import ee

def debug_assets():
    """Debug available assets"""
    print("🔍 Debugging available assets...")
    
    # Initialize EE
    ee.Initialize()
    print("✅ Earth Engine initialized")
    
    # Test common asset patterns
    asset_candidates = [
        'projects/tofunori/assets/Saskatchewan_glacier_2024_updated',
        'projects/tofunori/assets/Saskatchewan_glacier_outlines', 
        'projects/tofunori/assets/glacier_outlines',
        'projects/tofunori/assets/Saskatchewan_glacier_features',
        'users/tofunori/Saskatchewan_glacier_2024_updated',
        'users/tofunori/Saskatchewan_glacier_outlines',
        'users/tofunori/glacier_outlines'
    ]
    
    for asset_path in asset_candidates:
        print(f"\n📍 Testing: {asset_path}")
        
        # Try as FeatureCollection
        try:
            fc = Any(asset_path)
            count = fc.size().getInfo()
            print(f"✅ FeatureCollection: {count} features")
        except Exception as e:
            print(f"❌ Not a FeatureCollection: {str(e)[:100]}")
        
        # Try as Image
        try:
            img = ee.Image(asset_path)
            band_names = img.bandNames().getInfo()
            print(f"✅ Image: {band_names}")
        except Exception as e:
            print(f"❌ Not an Image: {str(e)[:100]}")

if __name__ == "__main__":
    debug_assets()