"""
MOD09GA Ren Method Implementation - Python Version

Complete implementation of Ren et al. (2021/2023) methodology for glacier albedo retrieval
Includes P1/P2 BRDF models, complete QA filtering, and exact mathematical formulations

Author: Modular Comparison Framework  
Date: 2025-06-30
Source: Ren et al. (2021/2023) methodology - EXACT implementation
"""

import ee
import math
from typing import Dict, Optional, Tuple, Union
try:
    from ..config.settings import (
        REFL_BANDS, TOPO_BANDS_ALL, TOPO_BANDS_SNOW, NARROWBAND_ALL, NARROWBAND_SNOW,
        BAND_NUMS_ALL, BAND_NUMS_SNOW, ICE_COEFFICIENTS, SNOW_COEFFICIENTS,
        SNOW_BRDF_COEFFICIENTS, ICE_BRDF_COEFFICIENTS, get_topographic_data
    )
    from ..utils.quality_filters import quality_filter_mod09a1
    from ..utils.glacier_utils import create_glacier_mask
except ImportError:
    from config.settings import (
        REFL_BANDS, TOPO_BANDS_ALL, TOPO_BANDS_SNOW, NARROWBAND_ALL, NARROWBAND_SNOW,
        BAND_NUMS_ALL, BAND_NUMS_SNOW, ICE_COEFFICIENTS, SNOW_COEFFICIENTS,
        SNOW_BRDF_COEFFICIENTS, ICE_BRDF_COEFFICIENTS, get_topographic_data
    )
    from utils.quality_filters import quality_filter_mod09a1
    from utils.glacier_utils import create_glacier_mask


def process_ren_method(image: ee.Image, 
                      glacier_outlines: ee.FeatureCollection,
                      create_glacier_mask_func: callable,
                      relaxed_qa: bool = False) -> ee.Image:
    """
    Complete Ren method processing pipeline - EXACT from full_script.js
    Implements the complete 3-step methodology with configurable QA filters
    
    Args:
        image: Input MODIS MOD09GA image
        glacier_outlines: Glacier boundary polygons
        create_glacier_mask_func: Glacier mask creation function
        relaxed_qa: Use relaxed quality filtering
        
    Returns:
        Processed image with Ren method albedo
    """
    # 1) QA & topography
    filtered = quality_filter_mod09a1(image, relaxed=relaxed_qa)
    topo_img = topography_correction(filtered)
    
    # 2) Snow/ice classification
    classified = classify_snow_ice(topo_img)
    
    # 3) Apply P1 & P2 separately
    nb_snow = apply_brdf_anisotropic_correction(classified, 'snow')
    nb_ice = apply_brdf_anisotropic_correction(classified, 'ice')
    
    # 4) Merge narrow-band albedos using the snow mask
    snow_mask = classified.select('snow_mask')
    merged_nb = []
    
    for band in NARROWBAND_ALL:
        # Band 4 is missing in the snow stack – always take ice value
        if band == 'narrowband_b4':
            merged_nb.append(nb_ice.select(band).rename(band))
        else:
            ice_band = nb_ice.select(band)
            snow_band = nb_snow.select(band)
            merged_band = ice_band.where(snow_mask, snow_band).rename(band)
            merged_nb.append(merged_band)
    
    with_nb = classified.addBands(ee.Image.cat(merged_nb))
    
    # 5) Broadband albedo
    with_bb = compute_broadband_albedo(with_nb)
    
    # 6) Glacier mask
    glacier_mask_raw = create_glacier_mask_func(glacier_outlines, None)
    # Reproject mask using a single-band projection to avoid mixed-projection errors
    ref_proj = with_bb.select('broadband_albedo_ren').projection()
    glacier_mask = glacier_mask_raw.reproject(ref_proj)
    
    masked_albedo = with_bb.select('broadband_albedo_ren').updateMask(glacier_mask)
    
    return (filtered
            .addBands(with_bb)
            .addBands(masked_albedo.rename('broadband_albedo_ren_masked'))
            .copyProperties(image, ['system:time_start']))


def topography_correction(image: ee.Image) -> ee.Image:
    """
    Apply topography correction to MODIS surface reflectance
    Following exact methodology from Ren et al. (2021) Equations 3a and 3b
    
    Args:
        image: Input MODIS image with angle bands
        
    Returns:
        Image with topographically corrected reflectance bands
    """
    topo_data = get_topographic_data()
    slope = topo_data['slope']
    aspect = topo_data['aspect']
    
    # Get angles and convert to appropriate units
    solar_zenith = image.select('SolarZenith').multiply(0.01)  # Convert to degrees
    solar_azimuth = image.select('SolarAzimuth').multiply(0.01)
    sensor_zenith = image.select('SensorZenith').multiply(0.01)
    sensor_azimuth = image.select('SensorAzimuth').multiply(0.01)
    
    # Convert to radians for calculations
    solar_zenith_rad = solar_zenith.multiply(math.pi/180)
    solar_azimuth_rad = solar_azimuth.multiply(math.pi/180)
    sensor_zenith_rad = sensor_zenith.multiply(math.pi/180)
    sensor_azimuth_rad = sensor_azimuth.multiply(math.pi/180)
    slope_rad = slope.multiply(math.pi/180)  # a in equations
    aspect_rad = aspect.multiply(math.pi/180)  # b in equations
    
    # Apply exact topographic angle corrections from Ren et al. (2021)
    # Equation 3a: cos θvc = cos a cos θv + sin a sin θv cos(b - φv)
    cos_sensor_zenith_corrected = (slope_rad.cos().multiply(sensor_zenith_rad.cos())
                                  .add(slope_rad.sin().multiply(sensor_zenith_rad.sin())
                                      .multiply(aspect_rad.subtract(sensor_azimuth_rad).cos())))
    
    # Equation 3b: cos θsc = cos a cos θs + sin a sin θs cos(b - φs)
    cos_solar_zenith_corrected = (slope_rad.cos().multiply(solar_zenith_rad.cos())
                                 .add(slope_rad.sin().multiply(solar_zenith_rad.sin())
                                     .multiply(aspect_rad.subtract(solar_azimuth_rad).cos())))
    
    # Convert back to angles for storage
    sensor_zenith_corrected = cos_sensor_zenith_corrected.acos().multiply(180/math.pi)
    solar_zenith_corrected = cos_solar_zenith_corrected.acos().multiply(180/math.pi)
    
    # Apply topographic correction to reflectance
    # Ren et al. (2021) topographic correction factor: ρflat = ρslope × (μ0'/μ0)
    correction_factor = cos_solar_zenith_corrected.divide(solar_zenith_rad.cos())
    
    # Apply topographic correction to each reflectance band with scaling
    corrected_bands = []
    for i, band_name in enumerate(REFL_BANDS):
        band = image.select(band_name).multiply(0.0001)  # Scale to reflectance
        corrected = band.multiply(correction_factor)
        corrected_bands.append(corrected.rename(TOPO_BANDS_ALL[i]))
    
    # Store corrected angles for BRDF correction
    topo_image = (image.addBands(ee.Image.cat(corrected_bands))
                      .addBands(sensor_zenith_corrected.rename('sensor_zenith_corrected'))
                      .addBands(solar_zenith_corrected.rename('solar_zenith_corrected')))
    
    return topo_image


def apply_brdf_anisotropic_correction(image: ee.Image, surface_type: str) -> ee.Image:
    """
    Apply BRDF anisotropic correction using P1 (snow) and P2 (ice) models
    EXACT implementation from Ren et al. (2021/2023) Table 4 coefficients
    
    Args:
        image: Input image with corrected angles and topographic bands
        surface_type: Either 'snow' or 'ice'
        
    Returns:
        Image with BRDF-corrected narrow-band albedo
    """
    # Extract corrected angles from topographic correction
    sensor_zenith_corrected = image.select('sensor_zenith_corrected')
    sensor_azimuth = image.select('SensorAzimuth').multiply(0.01).multiply(math.pi/180)
    solar_azimuth = image.select('SolarAzimuth').multiply(0.01).multiply(math.pi/180)
    
    # Calculate relative azimuth angle for BRDF correction
    relative_azimuth = sensor_azimuth.subtract(solar_azimuth)
    
    # Select BRDF coefficients based on surface type
    if surface_type == 'snow':
        brdf_coefficients = SNOW_BRDF_COEFFICIENTS
        bands = TOPO_BANDS_SNOW
        band_nums = BAND_NUMS_SNOW
    else:  # ice
        brdf_coefficients = ICE_BRDF_COEFFICIENTS
        bands = TOPO_BANDS_ALL
        band_nums = BAND_NUMS_ALL
    
    # Apply band-specific anisotropic correction: α_i = r - f̃
    corrected_bands = []
    
    for i, band in enumerate(bands):
        band_num = band_nums[i]
        coeffs = brdf_coefficients[band_num]
        
        # Get BRDF coefficients for this band
        c1 = coeffs['c1']
        c2 = coeffs['c2'] 
        c3 = coeffs['c3']
        theta_c = coeffs['theta_c']
        
        # Get topographically corrected reflectance
        r_topo = image.select(band)
        
        # Convert angles to radians for BRDF calculation
        theta_v = sensor_zenith_corrected.multiply(math.pi/180)
        phi_rel = relative_azimuth
        
        # Calculate BRDF correction term f̃ using Ren et al. formulation
        # f̃ = c1 + c2*cos(θv) + c3*cos(φrel) + θc*θv
        f_tilde = (ee.Image.constant(c1)
                   .add(ee.Image.constant(c2).multiply(theta_v.cos()))
                   .add(ee.Image.constant(c3).multiply(phi_rel.cos()))
                   .add(ee.Image.constant(theta_c).multiply(theta_v)))
        
        # Apply anisotropic correction: α_i = r - f̃
        alpha_i = r_topo.subtract(f_tilde)
        
        corrected_bands.append(alpha_i.rename(f'narrowband_{band_num}'))
    
    return image.addBands(ee.Image.cat(corrected_bands))


def classify_snow_ice(image: ee.Image) -> ee.Image:
    """
    Classify glacier surface as snow or ice using NDSI threshold
    Following Ren et al. (2021) methodology with NDSI thresholds
    Uses topographically corrected reflectances when available (per Ren et al.)
    
    Args:
        image: Input image with topographically corrected bands
        
    Returns:
        Image with NDSI and snow mask bands added
    """
    # Check if topographically corrected bands are available
    band_names = image.bandNames()
    has_topo_correction = band_names.contains('sur_refl_b04_topo')
    
    # Use topographically corrected bands if available (Ren et al. recommendation)
    topo_green = 'sur_refl_b04_topo'
    topo_swir = 'sur_refl_b06_topo'
    
    # Check for topo-corrected green band (B4)
    green = ee.Algorithms.If(
        image.bandNames().contains(topo_green),
        image.select(topo_green),
        image.select('sur_refl_b04').multiply(0.0001)
    )
    
    # Check for topo-corrected SWIR band (B6), fallback to B7 raw if needed
    swir = ee.Algorithms.If(
        image.bandNames().contains(topo_swir),
        image.select(topo_swir),
        image.select('sur_refl_b07').multiply(0.0001)  # Fallback to B7 raw
    )
    
    green = ee.Image(green)
    swir = ee.Image(swir)
    
    # Calculate NDSI = (Green - SWIR) / (Green + SWIR)
    ndsi = green.subtract(swir).divide(green.add(swir)).rename('NDSI')
    
    # Apply NDSI threshold for MODIS (0.4) following Girona-Mata et al. and Härer et al.
    snow_mask = ndsi.gt(0.4).rename('snow_mask')
    
    return image.addBands([ndsi, snow_mask])


def compute_broadband_albedo(image: ee.Image) -> ee.Image:
    """
    Compute broadband albedo using Ren et al. (2021) empirical coefficients
    EXACT coefficients from Equations 8 & 9
    
    Args:
        image: Input image with narrow-band albedo bands and snow mask
        
    Returns:
        Image with broadband albedo bands added
    """
    # Get narrow-band albedo values for each band
    narrowband_values = {}
    for band_num in BAND_NUMS_ALL:
        narrowband_values[band_num] = image.select(f'narrowband_{band_num}')
    
    # Ice albedo calculation (Equation 8) - uses all bands
    alpha_ice = (ee.Image.constant(ICE_COEFFICIENTS['constant'])
                 .add(narrowband_values['b1'].multiply(ICE_COEFFICIENTS['b1']))
                 .add(narrowband_values['b2'].multiply(ICE_COEFFICIENTS['b2']))
                 .add(narrowband_values['b3'].multiply(ICE_COEFFICIENTS['b3']))
                 .add(narrowband_values['b4'].multiply(ICE_COEFFICIENTS['b4']))
                 .add(narrowband_values['b5'].multiply(ICE_COEFFICIENTS['b5']))
                 .add(narrowband_values['b7'].multiply(ICE_COEFFICIENTS['b7'])))
    
    # Snow albedo calculation (Equation 9) - excludes band 4
    alpha_snow = (ee.Image.constant(SNOW_COEFFICIENTS['constant'])
                  .add(narrowband_values['b1'].multiply(SNOW_COEFFICIENTS['b1']))
                  .add(narrowband_values['b2'].multiply(SNOW_COEFFICIENTS['b2']))
                  .add(narrowband_values['b3'].multiply(SNOW_COEFFICIENTS['b3']))
                  .add(narrowband_values['b5'].multiply(SNOW_COEFFICIENTS['b5']))
                  .add(narrowband_values['b7'].multiply(SNOW_COEFFICIENTS['b7'])))
    
    # Use alphaIce as the base so that its data mask propagates
    # This prevents artificially introducing zero values in areas where no valid data exist
    snow_mask = image.select('snow_mask')
    broadband_albedo = alpha_ice.where(snow_mask, alpha_snow).rename('broadband_albedo_ren')
    
    return image.addBands([
        alpha_ice.rename('ice_albedo'), 
        alpha_snow.rename('snow_albedo'), 
        broadband_albedo
    ])