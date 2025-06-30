#!/usr/bin/env python3
"""
Simple Google Earth Engine Authentication Script
"""

import ee

def authenticate_ee():
    print('🔑 Authenticating with Google Earth Engine...')
    
    try:
        # Try different authentication modes
        print('Trying colab mode...')
        ee.Authenticate(auth_mode='colab')
        
    except Exception as e:
        print(f'Colab mode failed: {e}')
        try:
            print('Trying notebook mode...')
            ee.Authenticate(auth_mode='notebook')
        except Exception as e2:
            print(f'Notebook mode failed: {e2}')
            try:
                print('Trying localhost mode...')
                ee.Authenticate(auth_mode='localhost')
            except Exception as e3:
                print(f'Localhost mode failed: {e3}')
                print('Trying default mode...')
                ee.Authenticate()
    
    print('✅ Authentication completed!')
    
    # Test initialization
    print('🧪 Testing Earth Engine initialization...')
    ee.Initialize()
    print('✅ Earth Engine initialized successfully!')
    
    # Quick test
    print('🔬 Testing with a simple operation...')
    img = ee.Image('MODIS/061/MOD09GA/2020_01_01')
    bands = img.bandNames().getInfo()
    print(f'✅ Test successful! Image has {len(bands)} bands')
    
    print('🎉 Google Earth Engine is ready to use!')

if __name__ == '__main__':
    authenticate_ee()