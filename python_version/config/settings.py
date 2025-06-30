"""
Global Constants and Configuration for MODIS Albedo Comparison

This module contains all shared constants, coefficients, and configuration
used across different MODIS albedo retrieval methods.

Author: Modular Comparison Framework
Date: 2025-06-30
"""

import ee

# ============================================================================
# MODIS BAND CONSTANTS
# ============================================================================

# Global band constants for MOD09GA Ren method (bands 1,2,3,4,5,7 - no band 6)
REFL_BANDS = [
    'sur_refl_b01', 'sur_refl_b02', 'sur_refl_b03', 
    'sur_refl_b04', 'sur_refl_b05', 'sur_refl_b07'
]

TOPO_BANDS_ALL = [
    'sur_refl_b01_topo', 'sur_refl_b02_topo', 'sur_refl_b03_topo',
    'sur_refl_b04_topo', 'sur_refl_b05_topo', 'sur_refl_b07_topo'
]

TOPO_BANDS_SNOW = [
    'sur_refl_b01_topo', 'sur_refl_b02_topo', 'sur_refl_b03_topo',
    'sur_refl_b05_topo', 'sur_refl_b07_topo'  # B4 excluded for snow
]

NARROWBAND_ALL = [
    'narrowband_b1', 'narrowband_b2', 'narrowband_b3', 
    'narrowband_b4', 'narrowband_b5', 'narrowband_b7'
]

NARROWBAND_SNOW = [
    'narrowband_b1', 'narrowband_b2', 'narrowband_b3',
    'narrowband_b5', 'narrowband_b7'  # B4 excluded for snow
]

BAND_NUMS_ALL = ['b1', 'b2', 'b3', 'b4', 'b5', 'b7']
BAND_NUMS_SNOW = ['b1', 'b2', 'b3', 'b5', 'b7']  # B4 excluded for snow

# ============================================================================
# EMPIRICAL COEFFICIENTS (Ren et al. 2023)
# ============================================================================

# Ice albedo coefficients (Equation 8) - MOD09GA bands only
ICE_COEFFICIENTS = {
    'b1': 0.160, 
    'b2': 0.291, 
    'b3': 0.243, 
    'b4': 0.116, 
    'b5': 0.112, 
    'b7': 0.081, 
    'constant': -0.0015
}

# Snow albedo coefficients (Equation 9)
SNOW_COEFFICIENTS = {
    'b1': 0.1574, 
    'b2': 0.2789, 
    'b3': 0.3829, 
    'b5': 0.1131, 
    'b7': 0.0694, 
    'constant': -0.0093
}

# ============================================================================
# TOPOGRAPHIC DATA CONFIGURATION
# ============================================================================

def get_topographic_data():
    """
    Load DEM and derive topographic variables for correction.
    
    Returns:
        dict: Dictionary containing DEM, slope, and aspect images
    """
    dem = ee.Image('USGS/SRTMGL1_003')
    slope = ee.Terrain.slope(dem)
    aspect = ee.Terrain.aspect(dem)
    
    return {
        'dem': dem,
        'slope': slope,
        'aspect': aspect
    }

# ============================================================================
# MODIS COLLECTION IDENTIFIERS
# ============================================================================

MODIS_COLLECTIONS = {
    'MOD09GA': 'MODIS/061/MOD09GA',    # Surface Reflectance Daily Global 1km and 500m (bands 1,2,3,4,5,7)
    'MOD09A1': 'MODIS/061/MOD09A1',    # Surface Reflectance 8-Day Global 500m (has band 6)
    'MOD10A1': 'MODIS/061/MOD10A1',    # Snow Cover Daily Global 500m
    'MCD43A3': 'MODIS/061/MCD43A3'     # BRDF/Albedo Daily Global 500m
}

# ============================================================================
# GLACIER CONFIGURATION
# ============================================================================

# Saskatchewan Glacier asset path
# GLACIER_ASSET = 'projects/tofunori/assets/Saskatchewan_glacier_2024_updated'
# Use a simple public geometry instead to avoid asset reference issues
GLACIER_ASSET = None  # Disable glacier asset for testing

# Glacier processing parameters
GLACIER_CONFIG = {
    'scale': 30,                      # Glacier outline scale
    'abundance_threshold': 0.50,      # 50% glacier abundance criterion
    'modis_scale': 500               # MODIS pixel scale
}

# ============================================================================
# PROCESSING PARAMETERS
# ============================================================================

# Processing workflow configuration
PROCESSING_CONFIG = {
    'melt_season_only': True,        # Filter to melt season (June-September)
    'apply_cloud_masking': True,     # Apply cloud masking where available
    'debug_mode': False             # Enable debug logging
}

# Debug mode flag (also available at top level for convenience)
DEBUG_MODE = PROCESSING_CONFIG['debug_mode']

# Quality filtering parameters
QA_CONFIG = {
    'solar_zenith_max': 70,          # Maximum solar zenith angle (degrees)
    'ndsi_threshold': 0.4            # NDSI threshold for snow/ice classification
}

# ============================================================================
# EXPORT CONFIGURATION
# ============================================================================

# Export processing parameters
EXPORT_CONFIG = {
    'scale': 463,                    # Processing scale for Ren method
    'scale_simple': 500,             # Processing scale for simpler methods
    'maxPixels_ren': int(1e9),       # Max pixels for Ren method exports
    'maxPixels_simple': int(1e8),    # Max pixels for simpler method exports
    'bestEffort': True,              # Use best effort for processing
    'tileScale': 2                   # Tile scale for memory management
}

# ============================================================================
# BRDF COEFFICIENTS (for reference - used in method implementations)
# ============================================================================

# Snow BRDF coefficients (P1 model) from Table 4 - EXACT VALUES
SNOW_BRDF_COEFFICIENTS = {
    'b1': {'c1': 0.00083, 'c2': 0.00384, 'c3': 0.00452, 'theta_c': 0.34527},
    'b2': {'c1': 0.00123, 'c2': 0.00459, 'c3': 0.00521, 'theta_c': 0.34834},
    'b3': {'c1': 0.00000, 'c2': 0.00001, 'c3': 0.00002, 'theta_c': 0.12131},
    # Band 4 has no snow coefficients – excluded by TOPO_BANDS_SNOW
    'b5': {'c1': 0.00663, 'c2': 0.01081, 'c3': 0.01076, 'theta_c': 0.46132},
    'b7': {'c1': 0.00622, 'c2': 0.01410, 'c3': 0.01314, 'theta_c': 0.55261}
}

# Ice BRDF coefficients (P2 model) from Table 4 - EXACT VALUES
ICE_BRDF_COEFFICIENTS = {
    'b1': {'c1': -0.00054, 'c2': 0.00002, 'c3': 0.00001, 'theta_c': 0.17600},
    'b2': {'c1': -0.00924, 'c2': 0.00033, 'c3': -0.00005, 'theta_c': 0.31750},
    'b3': {'c1': -0.00369, 'c2': 0.00000, 'c3': 0.00007, 'theta_c': 0.27632},
    'b4': {'c1': -0.02920, 'c2': -0.00810, 'c3': 0.00462, 'theta_c': 0.52360},
    'b5': {'c1': -0.02388, 'c2': 0.00656, 'c3': 0.00227, 'theta_c': 0.58473},
    'b7': {'c1': -0.02081, 'c2': 0.00683, 'c3': 0.00390, 'theta_c': 0.575}
}

# ============================================================================
# CONVENIENCE FUNCTIONS
# ============================================================================

def get_all_config():
    """
    Get all configuration as a single dictionary.
    
    Returns:
        dict: Complete configuration dictionary
    """
    topo_data = get_topographic_data()
    
    return {
        'REFL_BANDS': REFL_BANDS,
        'TOPO_BANDS_ALL': TOPO_BANDS_ALL,
        'TOPO_BANDS_SNOW': TOPO_BANDS_SNOW,
        'NARROWBAND_ALL': NARROWBAND_ALL,
        'NARROWBAND_SNOW': NARROWBAND_SNOW,
        'BAND_NUMS_ALL': BAND_NUMS_ALL,
        'BAND_NUMS_SNOW': BAND_NUMS_SNOW,
        'ICE_COEFFICIENTS': ICE_COEFFICIENTS,
        'SNOW_COEFFICIENTS': SNOW_COEFFICIENTS,
        'dem': topo_data['dem'],
        'slope': topo_data['slope'],
        'aspect': topo_data['aspect'],
        'MODIS_COLLECTIONS': MODIS_COLLECTIONS,
        'GLACIER_ASSET': GLACIER_ASSET,
        'GLACIER_CONFIG': GLACIER_CONFIG,
        'PROCESSING_CONFIG': PROCESSING_CONFIG,
        'DEBUG_MODE': DEBUG_MODE,
        'QA_CONFIG': QA_CONFIG,
        'EXPORT_CONFIG': EXPORT_CONFIG,
        'SNOW_BRDF_COEFFICIENTS': SNOW_BRDF_COEFFICIENTS,
        'ICE_BRDF_COEFFICIENTS': ICE_BRDF_COEFFICIENTS
    }