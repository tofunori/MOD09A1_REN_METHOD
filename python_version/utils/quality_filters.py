"""
Quality Filtering Functions for MODIS Data

This module provides comprehensive quality filtering capabilities for MODIS data,
including MOD09A1, MOD10A1, and MCD43A3 products with detailed QA flag handling.

Author: Modular Comparison Framework
Date: 2025-06-30
"""

import ee
import math
from typing import Dict, List, Optional, Union


def quality_filter_mod09a1(image: ee.Image, 
                          relaxed: bool = False,
                          custom_params: Optional[Dict] = None) -> ee.Image:
    """
    Complete quality filtering for MOD09A1 following Ren et al. (2021/2023) methodology
    MOD09A1 Collection 6.1 state_1km QA flags with detailed bit documentation
    
    QA Bit Structure (MOD09A1 Collection 6.1):
    - Bits 0-1: Cloud State | 0=Clear, 1=Cloudy, 2=Mixed, 3=Not set (assumed clear)
    - Bit 2: Cloud Shadow | 0=No shadow, 1=Shadow present
    - Bits 3-5: Land/Water | 0=Shallow ocean, 1=Land, 2=Ocean coastlines, etc.
    - Bits 6-7: Aerosol Quantity | 0=Climatology, 1=Low, 2=Average, 3=High
    - Bit 8: Cirrus Detection | Combined with bit 9 for levels (0=None, 1=Small, 2=Average, 3=High)
    - Bit 10: Internal Cloud Algorithm | 0=No cloud, 1=Cloud detected
    - Bits 12-13: Snow/Ice Confidence | 0=None, 1=Low confidence, 2=Medium, 3=High confidence
    
    Fine-tuning Guidelines:
    - clearSky: Use eq(0) for strict clear-sky only, or lte(1) to include mixed conditions
    - shadowFree: Keep eq(0) for glacier applications to avoid contamination
    - noCirrus: Keep eq(0) for accurate surface reflectance retrieval
    - clearInternal: Internal algorithm usually more conservative than state flags
    - snowIceConf: gt(0) accepts any snow/ice detection; gte(2) for higher confidence only
    - lowSZA: <70° standard for MODIS; <60° for higher quality, <80° for more data
    
    RELAXED FILTERING EXAMPLES (for more data retention):
    
    Moderate Relaxation:
    - clearSky: qa.bitwiseAnd(0x3).lte(1)     // Allow clear + mixed conditions
    - noCirrus: qa.bitwiseAnd(1 << 8).lte(1)  // Allow small cirrus
    - lowSZA: solarZenith.lt(80)              // Higher solar zenith angle
    
    Maximum Data Retention:
    - clearSky: qa.bitwiseAnd(0x3).lte(2)     // Allow clear + cloudy + mixed
    - noCirrus: qa.bitwiseAnd(1 << 8).lte(2)  // Allow small + average cirrus
    - Comment out clearInternal filter        // Remove internal cloud filtering
    - validSnowIce: snowIceConf.gte(0)        // Accept even no snow/ice detection
    - lowSZA: solarZenith.lt(85)              // Very high solar zenith angle
    
    Glacier-Optimized Relaxed:
    - clearSky: qa.bitwiseAnd(0x3).lte(1)     // Clear + mixed
    - shadowFree: Keep eq(0) (critical)       // Shadows bad for glaciers
    - noCirrus: Keep eq(0) (critical)         // Cirrus affects albedo accuracy
    - Comment out clearInternal filter        // More data retention
    - lowSZA: solarZenith.lt(75)              // Slightly relaxed solar angle
    
    Collection 6.1 Improvements:
    - Enhanced snow/cloud/salt pan discrimination
    - Better cirrus detection algorithm
    - Note: State QA preferred over standard QC for cloud info (v3+ compatibility)
    
    Args:
        image: Input MODIS MOD09A1 image with state_1km QA band
        relaxed: If True, applies relaxed filtering for more data retention
        custom_params: Custom parameter overrides
        
    Returns:
        Quality-filtered image with mask applied
    """
    qa = image.select('state_1km')
    
    # Set default parameters based on mode
    if relaxed:
        # Glacier-Optimized Relaxed settings
        params = {
            'cloud_state_threshold': 1,      # Allow clear + mixed
            'allow_shadow': False,           # Keep strict for glaciers
            'cirrus_threshold': 0,           # Keep strict for glaciers
            'use_internal_cloud': False,     # Remove for more data
            'snow_ice_min': 0,              # Accept any snow/ice detection
            'solar_zenith_max': 75          # Slightly relaxed
        }
    else:
        # Strict settings (default)
        params = {
            'cloud_state_threshold': 0,      # Only clear sky
            'allow_shadow': False,           # No cloud shadows
            'cirrus_threshold': 0,           # No cirrus
            'use_internal_cloud': True,      # Use internal cloud filter
            'snow_ice_min': 0,              # Any snow/ice detection
            'solar_zenith_max': 70          # Standard MODIS threshold
        }
    
    # Override with custom parameters if provided
    if custom_params:
        params.update(custom_params)
    
    # Cloud State Filter (Bits 0-1): Accept based on threshold
    # 0=Clear, 1=Cloudy, 2=Mixed, 3=Not set (assumed clear)
    clear_sky = qa.bitwiseAnd(0x3).lte(params['cloud_state_threshold'])
    
    # Cloud Shadow Filter (Bit 2): Critical for glacier surface accuracy  
    # 0=No shadow, 1=Shadow present
    shadow_free = qa.bitwiseAnd(1 << 2).eq(0) if not params['allow_shadow'] else None
    
    # Cirrus Detection Filter (Bit 8): Affects surface reflectance accuracy
    # Combined with bit 9: 0=None, 1=Small, 2=Average, 3=High
    no_cirrus = qa.bitwiseAnd(1 << 8).lte(params['cirrus_threshold'])
    
    # Internal Cloud Algorithm Filter (Bit 10): Secondary cloud detection
    # 0=No cloud, 1=Cloud detected by internal algorithm
    clear_internal = qa.bitwiseAnd(1 << 10).eq(0) if params['use_internal_cloud'] else None
    
    # Snow/Ice Confidence Filter (Bits 12-13): Critical for glacier applications
    # 0=No snow/ice, 1=Low confidence, 2=Medium confidence, 3=High confidence  
    snow_ice_conf = qa.bitwiseAnd(0x3000).rightShift(12)
    valid_snow_ice = snow_ice_conf.gt(params['snow_ice_min'])
    
    # Solar Zenith Angle Filter: Standard MODIS retrieval constraint
    solar_zenith = image.select('SolarZenith').multiply(0.01)
    low_sza = solar_zenith.lt(params['solar_zenith_max'])
    
    # Combine all quality filters (AND operation = all conditions must be met)
    mask = clear_sky.And(no_cirrus).And(valid_snow_ice).And(low_sza)
    
    if shadow_free is not None:
        mask = mask.And(shadow_free)
    if clear_internal is not None:
        mask = mask.And(clear_internal)
    
    return image.updateMask(mask)


def quality_filter_mod10a1(image: ee.Image, 
                          qa_config: Optional[Dict] = None) -> ee.Image:
    """
    Quality filtering for MOD10A1 snow products with advanced QA handling.
    
    Args:
        image: MOD10A1 image
        qa_config: Quality assessment configuration
        
    Returns:
        Quality-filtered image
    """
    if qa_config is None:
        qa_config = {
            'basic_level': 'good',  # 'best'(0), 'good'(0-1), 'ok'(0-2), 'all'(0-3)
            'exclude_inland_water': True,
            'exclude_visible_screen_fail': True,
            'exclude_ndsi_screen_fail': True,
            'exclude_temp_height_fail': True,
            'exclude_swir_anomaly': True,
            'exclude_probably_cloudy': True,
            'exclude_probably_clear': False,
            'exclude_high_solar_zenith': True
        }
    
    # Get QA band
    qa = image.select('NDSI_Snow_Cover_Algorithm_Flags_QA')
    
    # Basic QA levels (bits 0-1)
    basic_qa = qa.bitwiseAnd(0x3)
    qa_levels = {'best': 0, 'good': 1, 'ok': 2, 'all': 3}
    basic_mask = basic_qa.lte(qa_levels.get(qa_config['basic_level'], 1))
    
    # Individual QA flags
    mask = basic_mask
    
    if qa_config['exclude_inland_water']:
        mask = mask.And(qa.bitwiseAnd(1).eq(0))  # Bit 0
        
    if qa_config['exclude_visible_screen_fail']:
        mask = mask.And(qa.bitwiseAnd(2).eq(0))  # Bit 1
        
    if qa_config['exclude_ndsi_screen_fail']:
        mask = mask.And(qa.bitwiseAnd(4).eq(0))  # Bit 2
        
    if qa_config['exclude_temp_height_fail']:
        mask = mask.And(qa.bitwiseAnd(8).eq(0))  # Bit 3
        
    if qa_config['exclude_swir_anomaly']:
        mask = mask.And(qa.bitwiseAnd(16).eq(0))  # Bit 4
        
    if qa_config['exclude_probably_cloudy']:
        mask = mask.And(qa.bitwiseAnd(32).eq(0))  # Bit 5
        
    if qa_config['exclude_probably_clear']:
        mask = mask.And(qa.bitwiseAnd(64).eq(0))  # Bit 6
        
    if qa_config['exclude_high_solar_zenith']:
        mask = mask.And(qa.bitwiseAnd(128).eq(0))  # Bit 7
    
    return image.updateMask(mask)


def quality_filter_mcd43a3(image: ee.Image, 
                          qa_config: Optional[Dict] = None) -> ee.Image:
    """
    Quality filtering for MCD43A3 BRDF/Albedo products with Collection 6.1 QA.
    
    Args:
        image: MCD43A3 image
        qa_config: Quality assessment configuration
        
    Returns:
        Quality-filtered image
    """
    if qa_config is None:
        qa_config = {
            'accept_qa_0_and_1': True,  # Accept both full and magnitude inversions
            'use_mandatory_qa': True,   # Use mandatory QA filtering
            'use_brdf_quality': True   # Use BRDF quality flags
        }
    
    # BRDF_Albedo_Quality band contains quality information
    qa = image.select('BRDF_Albedo_Quality')
    
    # Basic quality: 0 = best quality, 1 = good quality, 2-3 = lower quality
    if qa_config['accept_qa_0_and_1']:
        basic_mask = qa.lte(1)  # Accept QA 0 and 1
    else:
        basic_mask = qa.eq(0)   # Only best quality
    
    # Additional quality filtering can be added here based on specific needs
    mask = basic_mask
    
    return image.updateMask(mask)


def create_relaxed_filter_preset(preset_name: str) -> Dict:
    """
    Create predefined relaxed filtering parameter sets.
    
    Args:
        preset_name: Name of the preset ('moderate', 'maximum', 'glacier_optimized')
        
    Returns:
        Dictionary of filter parameters
    """
    presets = {
        'moderate': {
            'cloud_state_threshold': 1,      # Allow clear + mixed
            'allow_shadow': False,           # Keep strict
            'cirrus_threshold': 1,           # Allow small cirrus
            'use_internal_cloud': True,      # Keep internal cloud filter
            'snow_ice_min': 0,              # Any snow/ice detection
            'solar_zenith_max': 80          # Higher SZA
        },
        'maximum': {
            'cloud_state_threshold': 2,      # Allow clear + cloudy + mixed
            'allow_shadow': False,           # Keep strict for safety
            'cirrus_threshold': 2,           # Allow small + average cirrus
            'use_internal_cloud': False,     # Remove internal cloud filter
            'snow_ice_min': -1,             # Accept even no snow/ice detection
            'solar_zenith_max': 85          # Very high SZA
        },
        'glacier_optimized': {
            'cloud_state_threshold': 1,      # Clear + mixed
            'allow_shadow': False,           # Critical: no shadows
            'cirrus_threshold': 0,           # Critical: no cirrus
            'use_internal_cloud': False,     # More data retention
            'snow_ice_min': 0,              # Any snow/ice detection
            'solar_zenith_max': 75          # Slightly relaxed SZA
        }
    }
    
    return presets.get(preset_name, presets['moderate'])


def apply_temporal_filter(collection: ee.ImageCollection,
                         start_date: str,
                         end_date: str,
                         melt_season_only: bool = True) -> ee.ImageCollection:
    """
    Apply temporal filtering to image collection.
    
    Args:
        collection: Input image collection
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
        melt_season_only: If True, filter to melt season (June-September)
        
    Returns:
        Temporally filtered collection
    """
    # Apply date range filter
    filtered = collection.filterDate(start_date, end_date)
    
    # Apply melt season filter if requested
    if melt_season_only:
        filtered = filtered.filter(ee.Filter.calendarRange(6, 9, 'month'))
    
    return filtered


def get_quality_summary(image: ee.Image, 
                       region: ee.Geometry,
                       scale: int = 500) -> Dict:
    """
    Generate quality assessment summary statistics for an image.
    
    Args:
        image: Input image with QA bands
        region: Region of interest
        scale: Processing scale
        
    Returns:
        Dictionary with quality statistics
    """
    qa = image.select('state_1km')
    
    # Extract different QA components
    cloud_state = qa.bitwiseAnd(0x3)
    shadow_flag = qa.bitwiseAnd(1 << 2).rightShift(2)
    cirrus_flag = qa.bitwiseAnd(1 << 8).rightShift(8)
    snow_ice_conf = qa.bitwiseAnd(0x3000).rightShift(12)
    
    # Calculate statistics
    stats = ee.Image.cat([
        cloud_state.rename('cloud_state'),
        shadow_flag.rename('shadow_flag'), 
        cirrus_flag.rename('cirrus_flag'),
        snow_ice_conf.rename('snow_ice_conf')
    ]).reduceRegion(
        reducer=ee.Reducer.frequencyHistogram(),
        geometry=region,
        scale=scale,
        maxPixels=1e8,
        bestEffort=True
    )
    
    return stats