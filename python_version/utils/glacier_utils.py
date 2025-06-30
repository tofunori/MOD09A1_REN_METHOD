"""
Glacier Processing Utilities

Functions for glacier data handling, masking, and filtering for MODIS albedo analysis.

Author: Modular Comparison Framework
Date: 2025-06-30
"""

import ee
from typing import Dict, Optional, Tuple, Any
try:
    from ..config.settings import GLACIER_ASSET, GLACIER_CONFIG, PROCESSING_CONFIG
except ImportError:
    from config.settings import GLACIER_ASSET, GLACIER_CONFIG, PROCESSING_CONFIG


def initialize_glacier_data() -> Dict:
    """
    Initialize glacier data and create necessary processing objects.
    
    Returns:
        Dictionary containing glacier outlines, geometry, and reference image
    """
    # Handle case where no glacier asset is defined
    if GLACIER_ASSET is None:
        # Use a simple test region (Saskatchewan Glacier area)
        glacier_geometry = ee.Geometry.Rectangle([-117.5, 51.0, -116.5, 52.0])
        glacier_outlines = None
        reference_image = ee.Image.constant(1).clip(glacier_geometry)
        use_vector = False
        
        return {
            'outlines': glacier_outlines,
            'geometry': glacier_geometry,
            'image': reference_image,
            'use_vector': use_vector
        }
    
    # Load glacier asset - can be either FeatureCollection or Image
    try:
        # Try as FeatureCollection first
        glacier_outlines = ee.FeatureCollection(GLACIER_ASSET)
        glacier_geometry = glacier_outlines.geometry()
        use_vector = True
    except:
        # Fall back to Image (rasterized glacier mask)
        glacier_image = ee.Image(GLACIER_ASSET)
        # Create geometry from image footprint
        glacier_geometry = glacier_image.geometry()
        # Convert image to fake FeatureCollection for compatibility
        glacier_outlines = glacier_image.gt(0).reduceToVectors(
            geometry=glacier_geometry,
            scale=30,
            maxPixels=1e8
        )
        use_vector = False
    
    # Create a reference image for glacier fraction calculations
    # Use a constant image to establish the glacier grid
    reference_image = ee.Image.constant(1).clip(glacier_geometry)
    
    return {
        'outlines': glacier_outlines,
        'geometry': glacier_geometry,
        'image': reference_image,
        'use_vector': use_vector
    }


def create_glacier_mask(glacier_outlines: ee.FeatureCollection,
                       reference_image: ee.Image,
                       abundance_threshold: Optional[float] = None) -> ee.Image:
    """
    Create glacier abundance mask for MODIS pixel filtering.
    
    Args:
        glacier_outlines: Glacier outline features (or vectorized raster)
        reference_image: Reference image for grid alignment
        abundance_threshold: Minimum glacier fraction threshold (default from config)
        
    Returns:
        Binary glacier mask image
    """
    # If no glacier outlines provided or glacier asset disabled, return full mask
    if glacier_outlines is None or GLACIER_ASSET is None:
        return ee.Image.constant(1).clip(reference_image.geometry())
    
    if abundance_threshold is None:
        abundance_threshold = GLACIER_CONFIG['abundance_threshold']
    
    # Try to use the original raster if available
    try:
        # If we have the original glacier image, use it directly
        glacier_image = ee.Image(GLACIER_ASSET)
        band_names = glacier_image.bandNames().getInfo()
        
        # Use the first band (usually B3 or similar)
        if band_names:
            glacier_raster = glacier_image.select(band_names[0]).gt(0)
        else:
            raise Exception("No bands found")
            
    except:
        # Fall back to rasterizing the FeatureCollection
        glacier_raster = glacier_outlines.reduceToImage(
            properties=[glacier_outlines.first().propertyNames().get(0)],
            reducer=ee.Reducer.first()
        ).gt(0)
    
    # Calculate glacier fraction at MODIS scale
    glacier_fraction = glacier_raster.reduceResolution(
        reducer=ee.Reducer.mean(),
        maxPixels=1024
    ).reproject(
        crs=reference_image.projection(),
        scale=GLACIER_CONFIG['modis_scale']
    )
    
    # Apply abundance threshold
    glacier_mask = glacier_fraction.gte(abundance_threshold)
    
    return glacier_mask


def apply_standard_filtering(collection: ee.ImageCollection,
                           start_date: str,
                           end_date: str,
                           region: Any,
                           melt_season_only: bool = True) -> ee.ImageCollection:
    """
    Apply standard temporal and spatial filtering to MODIS collection.
    
    Args:
        collection: Input MODIS image collection
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD) 
        region: Region of interest geometry
        melt_season_only: Filter to melt season only
        
    Returns:
        Filtered image collection
    """
    # Apply spatial filter
    filtered = collection.filterBounds(region)
    
    # Apply temporal filter
    filtered = filtered.filterDate(start_date, end_date)
    
    # Apply melt season filter if requested
    if melt_season_only:
        filtered = filtered.filter(ee.Filter.calendarRange(6, 9, 'month'))
    
    return filtered


def create_glacier_fraction_map(glacier_outlines: ee.FeatureCollection,
                               scale: Optional[int] = None) -> ee.Image:
    """
    Create glacier fraction map for visualization and analysis.
    
    Args:
        glacier_outlines: Glacier outline features
        scale: Processing scale (default from config)
        
    Returns:
        Glacier fraction image (0-1)
    """
    if scale is None:
        scale = GLACIER_CONFIG['modis_scale']
    
    # Rasterize glacier outlines
    glacier_raster = glacier_outlines.reduceToImage(
        properties=['glacier_id'],
        reducer=ee.Reducer.first()
    ).gt(0)
    
    # Calculate fraction at specified scale
    glacier_fraction = glacier_raster.reduceResolution(
        reducer=ee.Reducer.mean(),
        maxPixels=1024
    ).reproject(
        crs='EPSG:4326',
        scale=scale
    )
    
    return glacier_fraction.rename('glacier_fraction')


def get_glacier_bounds(glacier_outlines: ee.FeatureCollection) -> Dict:
    """
    Get bounding box coordinates for glacier region.
    
    Args:
        glacier_outlines: Glacier outline features
        
    Returns:
        Dictionary with bounding coordinates
    """
    bounds = glacier_outlines.geometry().bounds()
    coords = ee.List(bounds.coordinates().get(0))
    
    return {
        'west': ee.Number(coords.get(0)),
        'south': ee.Number(coords.get(1)), 
        'east': ee.Number(coords.get(2)),
        'north': ee.Number(coords.get(3))
    }


def calculate_glacier_statistics(image: ee.Image,
                                glacier_mask: ee.Image,
                                region: Any,
                                scale: Optional[int] = None) -> Dict:
    """
    Calculate statistics for glacier pixels only.
    
    Args:
        image: Input image with bands to analyze
        glacier_mask: Binary glacier mask
        region: Region of interest
        scale: Processing scale
        
    Returns:
        Dictionary with glacier statistics
    """
    if scale is None:
        scale = GLACIER_CONFIG['modis_scale']
    
    # Apply glacier mask
    masked_image = image.updateMask(glacier_mask)
    
    # Calculate statistics
    stats = masked_image.reduceRegion(
        reducer=ee.Reducer.mean()
            .combine(ee.Reducer.stdDev(), '', True)
            .combine(ee.Reducer.min(), '', True)
            .combine(ee.Reducer.max(), '', True)
            .combine(ee.Reducer.count(), '', True),
        geometry=region,
        scale=scale,
        maxPixels=1e9,
        bestEffort=True
    )
    
    return stats


def filter_glacier_pixels(image: ee.Image,
                         glacier_outlines: ee.FeatureCollection,
                         abundance_threshold: Optional[float] = None) -> ee.Image:
    """
    Filter image to glacier pixels only based on abundance threshold.
    
    Args:
        image: Input image to filter
        glacier_outlines: Glacier outline features
        abundance_threshold: Minimum glacier fraction threshold
        
    Returns:
        Image masked to glacier pixels
    """
    # Create glacier mask
    glacier_mask = create_glacier_mask(glacier_outlines, image, abundance_threshold)
    
    # Apply mask
    return image.updateMask(glacier_mask)


def create_elevation_bands(region: Any) -> ee.Image:
    """
    Create elevation-related bands for topographic analysis.
    
    Args:
        region: Region of interest
        
    Returns:
        Image with elevation, slope, and aspect bands
    """
    # Load DEM
    dem = ee.Image('USGS/SRTMGL1_003').clip(region)
    
    # Calculate terrain variables
    slope = ee.Terrain.slope(dem)
    aspect = ee.Terrain.aspect(dem)
    
    return ee.Image.cat([
        dem.rename('elevation'),
        slope.rename('slope'),
        aspect.rename('aspect')
    ])


def validate_glacier_coverage(image: ee.Image,
                             glacier_mask: ee.Image,
                             region: Any,
                             min_pixel_count: int = 100) -> ee.Image:
    """
    Validate that sufficient glacier pixels are available.
    
    Args:
        image: Input image
        glacier_mask: Glacier mask
        region: Region of interest  
        min_pixel_count: Minimum required pixel count
        
    Returns:
        Image with validation mask applied
    """
    # Count glacier pixels
    pixel_count = glacier_mask.reduceRegion(
        reducer=ee.Reducer.sum(),
        geometry=region,
        scale=GLACIER_CONFIG['modis_scale'],
        maxPixels=1e8,
        bestEffort=True
    )
    
    # Create conditional mask based on pixel count
    sufficient_coverage = ee.Number(pixel_count.get('glacier_mask')).gte(min_pixel_count)
    
    # Apply validation mask
    validation_mask = ee.Image.constant(1).updateMask(sufficient_coverage)
    
    return image.updateMask(validation_mask)


def get_glacier_time_series_mask(collection: ee.ImageCollection,
                                glacier_outlines: ee.FeatureCollection) -> ee.ImageCollection:
    """
    Apply glacier masking to entire image collection.
    
    Args:
        collection: Input image collection
        glacier_outlines: Glacier outline features
        
    Returns:
        Collection with glacier masks applied
    """
    def apply_glacier_mask(image):
        glacier_mask = create_glacier_mask(glacier_outlines, image)
        return image.updateMask(glacier_mask)
    
    return collection.map(apply_glacier_mask)