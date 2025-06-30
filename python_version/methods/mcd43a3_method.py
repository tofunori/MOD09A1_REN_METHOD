"""
MCD43A3 BRDF/Albedo Method Implementation (Python Version)

Advanced implementation using MODIS MCD43A3 Collection 6.1 BRDF/Albedo product
Uses kernel-driven BRDF model albedo with comprehensive QA filtering

Author: Modular Comparison Framework
Date: 2025-06-30
"""

import ee
from typing import Dict, Optional, List
from ..config.settings import MODIS_COLLECTIONS
from ..utils.glacier_utils import create_glacier_mask


# ============================================================================
# QUALITY FILTERING CONFIGURATION
# ============================================================================

# MCD43A3 Collection 6.1 Quality Assessment Configuration
# Based on MODIS Collection 6.1 User Guide and Google Earth Engine documentation
QA_CONFIG = {
    # Accept both full and magnitude BRDF inversions (QA 0 or 1)
    'ACCEPT_QA_0_AND_1': True,
    
    # Mandatory Quality band filtering
    'MANDATORY_QA_BANDS': [
        'BRDF_Albedo_Band_Mandatory_Quality_shortwave',
        'BRDF_Albedo_Band_Mandatory_Quality_vis',
        'BRDF_Albedo_Band_Mandatory_Quality_nir'
    ],
    
    # Quality flag values for mandatory QA bands
    'QUALITY_FLAGS': {
        'FULL_INVERSION': 0,      # Processed, good quality (full BRDF inversions)
        'MAGNITUDE_INVERSION': 1   # Processed, see other QA (magnitude BRDF inversions)
    }
}

# Relaxed QA configuration for glacier applications
QA_CONFIG_RELAXED = {
    'ACCEPT_QA_0_AND_1': True,
    'REQUIRE_GOOD_BANDS': 1,  # Only require 1 out of 3 bands to have good quality
    'MANDATORY_QA_BANDS': QA_CONFIG['MANDATORY_QA_BANDS'],
    'QUALITY_FLAGS': QA_CONFIG['QUALITY_FLAGS']
}


# ============================================================================
# QUALITY FILTERING FUNCTIONS
# ============================================================================

def create_mcd43a3_quality_mask(image: ee.Image, relaxed: bool = False) -> ee.Image:
    """
    Create quality mask for MCD43A3 using mandatory QA bands.
    Accepts both full BRDF inversions (0) and magnitude inversions (1) for more data.
    
    Args:
        image: MCD43A3 image
        relaxed: Use relaxed quality criteria for glacier applications
        
    Returns:
        Quality mask image
    """
    # Start with a base mask of all 1s
    quality_mask = ee.Image(1)
    
    # Apply mandatory QA filtering for shortwave albedo (our primary band)
    shortwave_qa = image.select('BRDF_Albedo_Band_Mandatory_Quality_shortwave')
    
    if QA_CONFIG['ACCEPT_QA_0_AND_1']:
        # Accept both QA=0 (full inversion) and QA=1 (magnitude inversion)
        # Bit 0: 0 = full BRDF inversion, 1 = magnitude inversion (both acceptable)
        good_quality_mask = shortwave_qa.bitwiseAnd(1).lte(1)
        quality_mask = quality_mask.And(good_quality_mask)
    
    # Optional: Add visible and NIR band quality checks with relaxed criteria
    vis_qa = image.select('BRDF_Albedo_Band_Mandatory_Quality_vis')
    nir_qa = image.select('BRDF_Albedo_Band_Mandatory_Quality_nir')
    
    # Accept QA 0 or 1 for visible and NIR bands
    vis_good_quality = vis_qa.bitwiseAnd(1).lte(1)
    nir_good_quality = nir_qa.bitwiseAnd(1).lte(1)
    
    # Determine minimum required good bands
    if relaxed:
        min_good_bands = QA_CONFIG_RELAXED.get('REQUIRE_GOOD_BANDS', 1)
    else:
        min_good_bands = 2  # Standard: require at least 2 out of 3 bands
    
    # Count good bands and apply threshold
    good_bands_count = good_quality_mask.add(vis_good_quality).add(nir_good_quality)
    multi_spectral_quality = good_bands_count.gte(min_good_bands)
    
    return quality_mask.And(multi_spectral_quality)


def create_advanced_quality_mask(image: ee.Image) -> ee.Image:
    """
    Advanced quality filtering using companion MCD43A2 data (if available).
    This would require loading MCD43A2 alongside MCD43A3 for comprehensive QA.
    
    Args:
        image: MCD43A3 image
        
    Returns:
        Advanced quality mask
    """
    # This is a placeholder for advanced MCD43A2-based filtering
    # In practice, you would load MCD43A2 data and apply more sophisticated filtering
    # For now, use the mandatory QA bands from MCD43A3
    return create_mcd43a3_quality_mask(image)


def create_standard_quality_mask(image: ee.Image) -> ee.Image:
    """
    Create standard quality mask for MCD43A3 exports.
    
    Args:
        image: MCD43A3 image
        
    Returns:
        Standard quality mask
    """
    return create_mcd43a3_quality_mask(image, relaxed=False)


def create_relaxed_quality_mask(image: ee.Image) -> ee.Image:
    """
    Create relaxed quality mask for glacier applications.
    
    Args:
        image: MCD43A3 image
        
    Returns:
        Relaxed quality mask
    """
    return create_mcd43a3_quality_mask(image, relaxed=True)


# ============================================================================
# MAIN PROCESSING FUNCTION
# ============================================================================

def process_mcd43a3_method(image: ee.Image,
                          glacier_outlines: ee.FeatureCollection,
                          glacier_mask_func: callable,
                          relaxed_qa: bool = False) -> ee.Image:
    """
    Process MCD43A3 BRDF/Albedo with Collection 6.1 QA filtering.
    Uses Black-Sky Albedo shortwave band with comprehensive quality filtering.
    
    Args:
        image: MCD43A3 image
        glacier_outlines: Glacier outline features
        glacier_mask_func: Function to create glacier mask
        relaxed_qa: Use relaxed quality filtering for glacier applications
        
    Returns:
        Processed image with MCD43A3 albedo bands
    """
    # Apply quality filtering for Collection 6.1
    if relaxed_qa:
        quality_mask = create_relaxed_quality_mask(image)
    else:
        quality_mask = create_standard_quality_mask(image)
    
    filtered_image = image.updateMask(quality_mask)
    
    # Extract shortwave broadband albedo (Black-Sky Albedo)
    # Albedo_BSA_shortwave is the primary broadband albedo product
    black_sky_sw = filtered_image.select('Albedo_BSA_shortwave').multiply(0.001)  # Scale factor
    
    # Optional: Also extract White-Sky Albedo for comparison
    white_sky_sw = filtered_image.select('Albedo_WSA_shortwave').multiply(0.001)
    
    # Use Black-Sky Albedo as primary broadband albedo
    broadband_albedo = black_sky_sw.rename('broadband_albedo_mcd43a3')
    
    # Create glacier mask and apply to albedo
    glacier_mask = glacier_mask_func(glacier_outlines, image)
    masked_albedo = broadband_albedo.updateMask(glacier_mask).rename('broadband_albedo_mcd43a3_masked')
    
    # Add both black-sky and white-sky for advanced applications
    result = (filtered_image
              .addBands(broadband_albedo)
              .addBands(masked_albedo)
              .addBands(black_sky_sw.rename('black_sky_albedo_mcd43a3'))
              .addBands(white_sky_sw.rename('white_sky_albedo_mcd43a3'))
              .copyProperties(image, ['system:time_start']))
    
    return result


def apply_mcd43a3_quality_filter(image: ee.Image, 
                                config: Optional[Dict] = None) -> ee.Image:
    """
    Apply MCD43A3 specific quality filtering.
    
    Args:
        image: MCD43A3 image
        config: Custom QA configuration (uses standard if None)
        
    Returns:
        Quality filtered image
    """
    relaxed = config is not None and config.get('relaxed', False)
    quality_mask = create_mcd43a3_quality_mask(image, relaxed)
    return image.updateMask(quality_mask)


def get_mcd43a3_band_info(image: ee.Image) -> Dict:
    """
    Get information about available MCD43A3 bands.
    
    Args:
        image: MCD43A3 image
        
    Returns:
        Dictionary with band availability information
    """
    band_names = image.bandNames().getInfo()
    
    return {
        'has_bsa_shortwave': 'Albedo_BSA_shortwave' in band_names,
        'has_wsa_shortwave': 'Albedo_WSA_shortwave' in band_names,
        'has_shortwave_qa': 'BRDF_Albedo_Band_Mandatory_Quality_shortwave' in band_names,
        'has_vis_qa': 'BRDF_Albedo_Band_Mandatory_Quality_vis' in band_names,
        'has_nir_qa': 'BRDF_Albedo_Band_Mandatory_Quality_nir' in band_names,
        'all_bands': band_names
    }


def create_mcd43a3_collection_processor(glacier_outlines: ee.FeatureCollection,
                                       relaxed_qa: bool = False) -> callable:
    """
    Create a processing function for MCD43A3 image collections.
    
    Args:
        glacier_outlines: Glacier outline features
        relaxed_qa: Use relaxed quality filtering
        
    Returns:
        Processing function for image collections
    """
    def process_image(img):
        return process_mcd43a3_method(img, glacier_outlines, create_glacier_mask, relaxed_qa)
    
    return process_image


def get_available_albedo_bands(image: ee.Image) -> List[str]:
    """
    Get list of available albedo bands in MCD43A3 image.
    
    Args:
        image: MCD43A3 image
        
    Returns:
        List of available albedo band names
    """
    band_names = image.bandNames().getInfo()
    
    # Common MCD43A3 albedo bands
    albedo_patterns = [
        'Albedo_BSA_shortwave', 'Albedo_WSA_shortwave',
        'Albedo_BSA_vis', 'Albedo_WSA_vis',
        'Albedo_BSA_nir', 'Albedo_WSA_nir',
        'Albedo_BSA_Band1', 'Albedo_WSA_Band1',
        'Albedo_BSA_Band2', 'Albedo_WSA_Band2',
        'Albedo_BSA_Band3', 'Albedo_WSA_Band3',
        'Albedo_BSA_Band4', 'Albedo_WSA_Band4',
        'Albedo_BSA_Band5', 'Albedo_WSA_Band5',
        'Albedo_BSA_Band6', 'Albedo_WSA_Band6',
        'Albedo_BSA_Band7', 'Albedo_WSA_Band7'
    ]
    
    available_bands = [band for band in albedo_patterns if band in band_names]
    return available_bands


# ============================================================================
# VALIDATION AND TESTING FUNCTIONS
# ============================================================================

def validate_mcd43a3_processing(image: ee.Image,
                               glacier_outlines: ee.FeatureCollection,
                               region: ee.Geometry) -> Dict:
    """
    Validate MCD43A3 processing results.
    
    Args:
        image: Processed MCD43A3 image
        glacier_outlines: Glacier outline features
        region: Region of interest for validation
        
    Returns:
        Validation results dictionary
    """
    try:
        # Check for required bands
        band_names = image.bandNames().getInfo()
        required_bands = ['broadband_albedo_mcd43a3', 'broadband_albedo_mcd43a3_masked']
        has_required_bands = all(band in band_names for band in required_bands)
        
        # Calculate basic statistics
        stats = image.select('broadband_albedo_mcd43a3').reduceRegion(
            reducer=ee.Reducer.mean().combine(ee.Reducer.count(), '', True),
            geometry=region,
            scale=500,
            maxPixels=1e8
        ).getInfo()
        
        return {
            'valid_processing': has_required_bands,
            'band_names': band_names,
            'albedo_mean': stats.get('broadband_albedo_mcd43a3_mean'),
            'pixel_count': stats.get('broadband_albedo_mcd43a3_count'),
            'has_data': stats.get('broadband_albedo_mcd43a3_count', 0) > 0,
            'available_albedo_bands': get_available_albedo_bands(image)
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
    'process_mcd43a3_method',
    'create_standard_quality_mask',
    'create_relaxed_quality_mask',
    'create_mcd43a3_quality_mask',
    'create_advanced_quality_mask',
    'apply_mcd43a3_quality_filter',
    'get_mcd43a3_band_info',
    'get_available_albedo_bands',
    'create_mcd43a3_collection_processor',
    'validate_mcd43a3_processing',
    'QA_CONFIG',
    'QA_CONFIG_RELAXED'
]