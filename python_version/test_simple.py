#!/usr/bin/env python3
"""
Simple test script without glacier assets
"""

import ee
from datetime import datetime

# Initialize Earth Engine
ee.Initialize()

# Simple test region (no private assets)
region = ee.Geometry.Rectangle([-117.5, 51.0, -116.5, 52.0])

# Test MOD09GA collection
start_date = '2020-06-01'
end_date = '2020-06-15'

print(f"Testing MODIS collections for {start_date} to {end_date}")

# Test MOD09GA
mod09ga = ee.ImageCollection('MODIS/061/MOD09GA') \
    .filterDate(start_date, end_date) \
    .filterBounds(region)

count = mod09ga.size().getInfo()
print(f"MOD09GA images found: {count}")

if count > 0:
    # Get first image and check bands
    first_img = mod09ga.first()
    bands = first_img.bandNames().getInfo()
    print(f"MOD09GA bands: {bands[:5]}...")  # Show first 5 bands
    
    # Test simple processing
    refl = first_img.select('sur_refl_b01').multiply(0.0001)
    mean_val = refl.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=region,
        scale=500,
        maxPixels=1e6
    ).getInfo()
    print(f"Sample reflectance mean: {mean_val}")

print("✅ Simple test completed successfully!")