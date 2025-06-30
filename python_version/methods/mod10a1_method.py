"""
MOD10A1 Snow Albedo Method Implementation (Python Version)

Advanced implementation using MODIS MOD10A1 with comprehensive QA filtering
Enhanced with sophisticated QA filtering from MODIS_Albedo project

Author: Modular Comparison Framework
Date: 2025-06-30
"""

import ee
from typing import Dict, Optional, List
from ..config.settings import MODIS_COLLECTIONS
from ..utils.glacier_utils import create_glacier_mask


# ============================================================================
# QA CONFIGURATION (from MODIS_Albedo project)
# ============================================================================

# Standard QA configuration
QA_CONFIG = {
    'STANDARD': {
        'basicLevel': 'good',                    # QA level: 'best'(0), 'good'(0-1), 'ok'(0-2), 'all'(0-3)
        'excludeInlandWater': True,              # Exclude water/glacial lakes
        'excludeVisibleScreenFail': True,        # CRITICAL - corrupted visible data (always exclude)
        'excludeNDSIScreenFail': True,           # CRITICAL - unreliable NDSI (always exclude)
        'excludeTempHeightFail': True,           # Temperature/height screen failure
        'excludeSWIRAnomaly': True,              # SWIR optical anomalies  
        'excludeProbablyCloudy': True,           # Cloud detection (false positives over snow - consider keeping)
        'excludeProbablyClear': False,           # Clear detection (usually safe to keep)
        'excludeHighSolarZenith': True           # Solar zenith angle >70° (poor lighting)
    },
    
    # QA bit mapping for metadata-driven processing
    'BIT_MAPPING': [
        {'flag': 'excludeInlandWater', 'bit': 0, 'mask': 1, 'desc': 'Inland water'},
        {'flag': 'excludeVisibleScreenFail', 'bit': 1, 'mask': 2, 'desc': 'Low visible screen failure'},
        {'flag': 'excludeNDSIScreenFail', 'bit': 2, 'mask': 4, 'desc': 'Low NDSI screen failure'},
        {'flag': 'excludeTempHeightFail', 'bit': 3, 'mask': 8, 'desc': 'Temperature/height screen failure'},
        {'flag': 'excludeSWIRAnomaly', 'bit': 4, 'mask': 16, 'desc': 'Shortwave IR reflectance anomaly'},
        {'flag': 'excludeProbablyCloudy', 'bit': 5, 'mask': 32, 'desc': 'Probably cloudy (v6.1 cloud detection)'},
        {'flag': 'excludeProbablyClear', 'bit': 6, 'mask': 64, 'desc': 'Probably clear (v6.1 cloud detection)'},
        {'flag': 'excludeHighSolarZenith', 'bit': 7, 'mask': 128, 'desc': 'Solar zenith >70°'}
    ]
}

# Relaxed QA configuration for glacier applications
QA_CONFIG_RELAXED = {
    'STANDARD': {
        'basicLevel': 'ok',                      # Allow more data (0-2 quality)
        'excludeInlandWater': False,             # Keep glacial lakes
        'excludeVisibleScreenFail': True,        # CRITICAL - always exclude
        'excludeNDSIScreenFail': True,           # CRITICAL - always exclude
        'excludeTempHeightFail': False,          # Allow temperature issues
        'excludeSWIRAnomaly': False,             # Allow SWIR anomalies
        'excludeProbablyCloudy': False,          # Keep possible false positives
        'excludeProbablyClear': False,           # Keep clear detections
        'excludeHighSolarZenith': False          # Allow high solar zenith
    },
    'BIT_MAPPING': QA_CONFIG['BIT_MAPPING']  # Same bit mapping
}


# ============================================================================
# QUALITY FILTERING FUNCTIONS
# ============================================================================

def get_basic_qa_mask(img: ee.Image, level: str = 'good') -> ee.Image:
    """
    Create Basic QA mask based on quality level.
    
    Args:
        img: MOD10A1 image
        level: Quality level ('best', 'good', 'ok', 'all')
        
    Returns:
        Quality mask image
    """
    basic_qa = img.select('NDSI_Snow_Cover_Basic_QA')
    
    # Official GEE MOD10A1.061 values:
    # 0: Best quality, 1: Good quality, 2: OK quality, 3: Poor quality
    # 211: Night, 239: Ocean
    
    if level == 'best':
        quality_mask = basic_qa.eq(0)
    elif level == 'good':
        quality_mask = basic_qa.lte(1)  # DEFAULT
    elif level == 'ok':
        quality_mask = basic_qa.lte(2)
    elif level == 'all':
        quality_mask = basic_qa.lte(3)
    else:
        quality_mask = basic_qa.lte(1)  # Default to good
    
    # Always exclude night and ocean
    exclude_mask = basic_qa.neq(211).And(basic_qa.neq(239))
    
    return quality_mask.And(exclude_mask)


def get_algorithm_flags_mask(img: ee.Image, flags: Dict[str, bool]) -> ee.Image:
    """
    Create Algorithm Flags QA mask based on flag configuration.
    
    Args:
        img: MOD10A1 image
        flags: Dictionary of QA flags to apply
        
    Returns:
        Algorithm flags mask
    """
    alg_flags = img.select('NDSI_Snow_Cover_Algorithm_Flags_QA').uint8()
    mask = ee.Image(1)
    
    # Metadata-driven QA bit processing
    qa_bit_mapping = QA_CONFIG['BIT_MAPPING']
    
    for mapping in qa_bit_mapping:
        if flags.get(mapping['flag'], False):
            mask = mask.And(alg_flags.bitwiseAnd(mapping['mask']).eq(0))
    
    return mask


def create_comprehensive_quality_mask(img: ee.Image, qa_config: Optional[Dict] = None) -> ee.Image:
    """
    Create comprehensive quality mask combining Basic QA and Algorithm Flags.
    
    Args:
        img: MOD10A1 image
        qa_config: QA configuration (uses standard if None)
        
    Returns:
        Comprehensive quality mask
    """
    if qa_config is None:
        qa_config = QA_CONFIG['STANDARD']
    
    basic_mask = get_basic_qa_mask(img, qa_config.get('basicLevel', 'good'))
    flags_mask = get_algorithm_flags_mask(img, qa_config)
    
    return basic_mask.And(flags_mask)


def create_standard_quality_mask(img: ee.Image) -> ee.Image:
    """
    Create standard quality mask for exports (uses conservative configuration).
    
    Args:
        img: MOD10A1 image
        
    Returns:
        Standard quality mask
    """
    return create_comprehensive_quality_mask(img, QA_CONFIG['STANDARD'])


def create_relaxed_quality_mask(img: ee.Image) -> ee.Image:
    """
    Create relaxed quality mask for glacier applications.
    
    Args:
        img: MOD10A1 image
        
    Returns:
        Relaxed quality mask
    """
    return create_comprehensive_quality_mask(img, QA_CONFIG_RELAXED['STANDARD'])


# ============================================================================
# MAIN PROCESSING FUNCTION
# ============================================================================

def process_mod10a1_method(image: ee.Image, 
                          glacier_outlines: ee.FeatureCollection,
                          glacier_mask_func: callable,
                          relaxed_qa: bool = False) -> ee.Image:
    """
    Process MOD10A1 snow data with ADVANCED QA FILTERING.
    Uses sophisticated quality filtering from MODIS_Albedo project.
    
    Args:
        image: MOD10A1 image
        glacier_outlines: Glacier outline features
        glacier_mask_func: Function to create glacier mask
        relaxed_qa: Use relaxed quality filtering for glacier applications
        
    Returns:
        Processed image with MOD10A1 albedo bands
    """
    # Apply sophisticated quality filtering
    if relaxed_qa:
        quality_mask = create_relaxed_quality_mask(image)
    else:
        quality_mask = create_standard_quality_mask(image)
    
    filtered = image.updateMask(quality_mask)
    
    # Extract NDSI snow cover data with quality filtering applied
    # NDSI_Snow_Cover is the primary snow band in MOD10A1 Collection 6.1
    snow_cover = filtered.select('NDSI_Snow_Cover').clamp(0, 100).multiply(0.01)  # Convert percentage to 0-1 range
    
    # Try to use Snow_Albedo_Daily_Tile if available
    band_names = image.bandNames()
    has_albedo_band = band_names.contains('Snow_Albedo_Daily_Tile')
    
    snow_albedo = ee.Algorithms.If(
        has_albedo_band,
        filtered.select('Snow_Albedo_Daily_Tile').multiply(0.01),  # Scale if available
        snow_cover  # Fallback to NDSI snow cover
    )
    
    # Use the better albedo product when available
    final_albedo = ee.Image(snow_albedo).rename('broadband_albedo_mod10a1')
    
    # Create glacier mask and apply to albedo
    glacier_mask = glacier_mask_func(glacier_outlines, image)
    masked_albedo = final_albedo.updateMask(glacier_mask).rename('broadband_albedo_mod10a1_masked')
    
    # Add bands to original image
    result = (filtered
              .addBands(final_albedo)
              .addBands(masked_albedo)
              .copyProperties(image, ['system:time_start']))
    
    return result


def apply_mod10a1_quality_filter(image: ee.Image, 
                                config: Optional[Dict] = None) -> ee.Image:
    """
    Apply MOD10A1 specific quality filtering.
    
    Args:
        image: MOD10A1 image
        config: Custom QA configuration (uses standard if None)
        
    Returns:
        Quality filtered image
    """
    if config is None:
        config = QA_CONFIG['STANDARD']
    
    quality_mask = create_comprehensive_quality_mask(image, config)
    return image.updateMask(quality_mask)


def get_mod10a1_band_info(image: ee.Image) -> Dict:
    """
    Get information about available MOD10A1 bands.
    
    Args:
        image: MOD10A1 image
        
    Returns:
        Dictionary with band availability information
    """
    band_names = image.bandNames().getInfo()
    
    return {
        'has_ndsi_snow_cover': 'NDSI_Snow_Cover' in band_names,
        'has_snow_albedo': 'Snow_Albedo_Daily_Tile' in band_names,
        'has_basic_qa': 'NDSI_Snow_Cover_Basic_QA' in band_names,
        'has_algorithm_qa': 'NDSI_Snow_Cover_Algorithm_Flags_QA' in band_names,
        'all_bands': band_names
    }


def create_mod10a1_collection_processor(glacier_outlines: ee.FeatureCollection,
                                       relaxed_qa: bool = False) -> callable:
    """
    Create a processing function for MOD10A1 image collections.
    
    Args:
        glacier_outlines: Glacier outline features
        relaxed_qa: Use relaxed quality filtering
        
    Returns:
        Processing function for image collections
    """
    def process_image(img):
        return process_mod10a1_method(img, glacier_outlines, create_glacier_mask, relaxed_qa)
    
    return process_image


# ============================================================================
# VALIDATION AND TESTING FUNCTIONS
# ============================================================================

def validate_mod10a1_processing(image: ee.Image, 
                               glacier_outlines: ee.FeatureCollection,
                               region: ee.Geometry) -> Dict:
    """
    Validate MOD10A1 processing results.
    
    Args:
        image: Processed MOD10A1 image
        glacier_outlines: Glacier outline features
        region: Region of interest for validation
        
    Returns:
        Validation results dictionary
    """
    try:
        # Check for required bands
        band_names = image.bandNames().getInfo()
        required_bands = ['broadband_albedo_mod10a1', 'broadband_albedo_mod10a1_masked']
        has_required_bands = all(band in band_names for band in required_bands)
        
        # Calculate basic statistics
        stats = image.select('broadband_albedo_mod10a1').reduceRegion(
            reducer=ee.Reducer.mean().combine(ee.Reducer.count(), '', True),
            geometry=region,
            scale=500,
            maxPixels=1e8
        ).getInfo()
        
        return {
            'valid_processing': has_required_bands,
            'band_names': band_names,
            'albedo_mean': stats.get('broadband_albedo_mod10a1_mean'),
            'pixel_count': stats.get('broadband_albedo_mod10a1_count'),
            'has_data': stats.get('broadband_albedo_mod10a1_count', 0) > 0
        }
        
    except Exception as e:
        return {
            'valid_processing': False,
            'error': str(e),
            'has_data': False
        }


# ============================================================================
# EXPORTS
# ============================================================================

__all__ = [
    'process_mod10a1_method',
    'create_standard_quality_mask',
    'create_relaxed_quality_mask',
    'get_basic_qa_mask',
    'get_algorithm_flags_mask',
    'apply_mod10a1_quality_filter',
    'get_mod10a1_band_info',
    'create_mod10a1_collection_processor',
    'validate_mod10a1_processing',
    'QA_CONFIG',
    'QA_CONFIG_RELAXED'
]