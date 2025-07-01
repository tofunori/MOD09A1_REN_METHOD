Of course. Here is the entire "MODIS Surface Reflectance User's Guide" converted to Markdown format.

***

# MODIS Surface Reflectance User's Guide
## Collection 6

**MODIS Land Surface Reflectance Science Computing Facility**

**Principal Investigator:** Dr. Eric F. Vermote

**Web site:** <http://modis-sr.ltdri.org>

**Correspondence e-mail address:** mod09@ltdri.org

Prepared by E. F. Vermote, J. C. Roger, and J. P. Ray

**Version 1.4**

**May, 2015**



***

# Table of Contents
1.  Product description...........................................................................................4
2.  Overview of MODIS processing ........................................................................4
    2.1. MODIS surface reflectance data products......................................................4
    2.2. Products of MOD PR09.exe -- levels 2 and 3 ................................................5
    2.3. Products of MOD PRMGR.exe -- level 2G ....................................................6
    2.4. Products of MOD PR09A.exe -- level 3 ........................................................7
    2.5. Products of MOD_PR09G.exe -- level 2G-lite .............................................8
    2.6. Products of MOD_PR09C.exe -- level 3 CMG ...............................................8
3.  Detailed product descriptions ...........................................................................9
    3.1. Description and Science Data Sets .............................................................9
        3.1.1. MOD09 ................................................................................................9
        3.1.2. MOD09GQ ..........................................................................................12
        3.1.3. MOD09GA ..........................................................................................13
        3.1.4. MOD09Q1 ..........................................................................................15
        3.1.5. MOD09A1 ..........................................................................................16
        3.1.6. MOD09CMG .......................................................................................17
    3.2. Data product quality ................................................................................19
        3.2.1. 250 m resolution QA.............................................................................19
        3.2.2. 500 m, 1km and coarse resolution QA....................................................21
    3.3. Data product state QA flags .....................................................................24
    3.4. Internal CM .............................................................................................26
    3.5. Number Mapping .....................................................................................27
    3.6. Geolocation flags .....................................................................................27
    3.7. Scan value information ............................................................................28
    3.8. Orbit and coverage...................................................................................29
4.  Frequently asked questions..............................................................................30
    4.1. How are MODLAND QA bits set, and how should they be used?...................30
    4.2. How do you unpack Level 2G or Level 2G-lite's compact data?..................31
    4.3. Of what does the atmospheric correction algorithm consist?.........................32
    4.4. What is surface reflectance? What are its units?.........................................33
    4.5. All I've seen in this document is "MOD", meaning Terra -- what about Aqua ("MYD”)?......33
5.  Caveats and Known Problems ........................................................................34
6.  Data ordering (& browsing)............................................................................34
    6.1. Where to get data from ............................................................................34
    6.2. Data product granule ID............................................................................35
    6.3. Data viewing tools....................................................................................35
7.  Useful links...................................................................................................35

***

# List of Tables
1. Inputs and outputs of MODIS surface reflectance programs.................................5
2. Science Data Sets for MOD09.............................................................................9
3. Science Data Sets for MOD09GQ........................................................................12
4. Science Data Sets for MOD09GA........................................................................13
5. Science Data Sets for MOD09Q1........................................................................15
6. Science Data Sets for MOD09A1........................................................................16
7. Science Data Sets for MOD09CMG.....................................................................17
8. 250 m Level 2G Surface Reflectance Band Quality Description (16-bit)..................19
9. 250 m Level 3 Surface Reflectance Band Quality Description (16-bit)....................20
10. 500 m,1 km and Coarse Resolution Surface Reflectance Band Quality Description (32-bit)....21
11. 1 km Surface Reflectance Bands 8-15 Quality Description (32-bit)........................22
12. 1 km Surface Reflectance Band 16 Quality Description (8-bit)............................23
13. State QA Description (16-bit)............................................................................24
14. Coarse Resolution Internal CM, 1km Atmospheric Optical Depth Band QA (16-bit)........26
15. Coarse Resolution Number Mapping (32-bit)......................................................27
16. 1 km Geolocation Flags (16-bit)........................................................................27
17. 250 m Scan Value Information Description (8-bit)..............................................28
18. Orbit and Coverage.........................................................................................29

***

# 1. Product description
MOD09 (MODIS Surface Reflectance) is a seven-band product computed from the MODIS Level 1B land bands 1 (620-670 nm), 2 (841-876 nm), 3 (459-479), 4 (545-565 nm), 5 (1230-1250 nm), 6 (1628-1652 nm), and 7 (2105-2155 nm). The product is an estimate of the surface spectral reflectance for each band as it would have been measured at ground level as if there were no atmospheric scattering or absorption. It corrects for the effects of atmospheric gases and aerosols.

# 2. Overview of MODIS processing
Most satellite data processing systems recognize five distinct levels of processing. Level 0 data is raw satellite feeds: level 1 data has been radiometrically calibrated, but not otherwise altered. Level 2 data is level 1 data that has been atmospherically corrected to yield a surface reflectance product. Level 3 data is level 2 data that has been gridded into a map projection, and usually has also been temporally composited or averaged. Level 4 data are products that have been put through additional processing. All data up to and including level 2 are in an ungridded orbital swath format, with each swath typically cut into small segments, or **granules**, to facilitate processing. Data at level 3 and up are geolocated into a specific map projection, with the geolocated products typically in a set of non-overlapping **tiles** (figure 1).

The advantage of level 3 data over less processed forms of data is that each pixel of L3 data is precisely geolocated; a disadvantage is that the process of compositing or averaging that results in L3 data limits the usefulness of the L3 product. The Level 2G format, consisting of gridded Level 2 data, was developed as a means of separating geolocating from compositing and averaging. The L2G format preserves all the data that maps to a given pixel as observations at that pixel. Programs which produce level 3 data can then have all available data at each pixel to choose from, without having to geolocate everything themselves. An additional step of processing, level 2G-lite, provides a minimal level of compositing of daily level 2G data.

## 2.1. MODIS surface reflectance data products
MODIS surface reflectance data are found in the MOD09 series of data products, including a level 2 product (MOD09, generated by PGE11's MOD_PR09.exe program), level 2G daily products (MOD09GHK, MOD09GQK, and MOD09GST, generated by PGE12's MOD_PRMGR.exe program), level 2G-Lite daily products (MOD09GA and MOD09GQ, generated by PGE13's MOD_PR09G.exe program), level 3, 8-day composited products (MOD09A1 and MOD09Q1, generated by PGE21's MOD_PR09A.exe program), and daily level 3 CMG (climate modeling grid) products (MOD09CMG and MOD09CMA, generated by PGE75's MOD_PR09C.exe program). See Table 1.

Please note that not all MOD09 products are publically available. This User's Guide is meant to be a guide for the use of publically available MOD09 products, so it is the publically available products that are described here in detail. Other products are described for the sake of completeness (e. g., the MOD09IDN, -IDT and -IDS products).

### Table 1: Inputs and outputs of MODIS surface reflectance programs.
| program | input file | level | res. | output publically available | not publically available | level | res. | collection |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| MOD_PR09.exe | MOD021KM | 1B | 1 | MOD09 | | 2 | 1,H,Q | all |
| | MOD02HKM | 1B | H | | MOD09IDT | 3 | 5 | 4 and up |
| | MOD02QKM | 1B | Q | | MOD09IDN | 3 | 5 | 4 and up |
| | MOD03 | 1A | 1 | | MOD09IDS | 3 | 5 | 4 and up |
| | MOD35_L2 | 2 | 1 | | | | | |
| MOD_PRMGR.exe | MOD09 | 2 | 1,H,Q | MOD09GHK | none | 2G | H | all |
| | | | | MOD09GQK | | 2G | Q | all |
| | | | | MOD09GST | | 2G | 1 | all |
| MOD_PR09A.exe | MOD09GHK | 2G | H | MOD09A1 | none | 3 | H | up to/and 4 |
| | MOD09GQK | 2G | Q | MOD09Q1 | | 3 | Q | up to/and 4 |
| | MOD09GST | 2G | 1 | | | | | |
| MOD_PR09G.exe | MOD09GHK | 2G | H | MOD09GA | none | 2GL | 1,H | 5 and up |
| | MOD09GQK | 2G | Q | MOD09GQ | | 2GL | Q | 5 and up |
| | MOD09GST | 2G | 1 | | | | | |
| MOD_PR09A.exe | MOD09GA | 2GL | 1,H | MOD09A1 | none | 3 | H | 5 and up |
| | MOD09GQ | 2GL | Q | MOD09Q1 | | 3 | Q | 5 and up |
| MOD_PR09C.exe | MOD09IDT | 3 | 5 | MOD09CMG | none | 3 | 5 | 4 and up |
| | MOD09IDN | 3 | 5 | MOD09CMA | | | | |
| | MOD09IDS | 3 | 5 | | | | | |

where '2GL' stands for level 2G-lite and resolutions ('res.') are '5', 0.05°, 'Q', 250 m, 'H', 500 m, and '1', 1 km.

**Please also note:**
1) A **collection** is a MODIS data archive that has been reprocessed in order to incorporate better calibration, algorithm refinements, and improved upstream products into all MODIS products. The current collection is 6. Later collections supersede all earlier collections.
2) This table focuses upon MOD09-related products, and for purposes of clarity omits pointer files, coarse-resolution files, browse files, ancillary data files, destriped L1B input files, subsets, et cetera.
3) The "MOD" prefix should be taken as referring to the dataset in general, *not* to Terra-derived data in particular. All programs discussed in this document process either Terra- or Aqua-derived data. All datasets referred to in this document will be referred to as "MOD" data, but meaning either Terra-or Aqua-derived data.

## 2.2. Products of MOD_PR09.exe -- levels 2 and 3
`MOD_PR09.exe` is run on whole orbit's worth of level 1B calibrated radiance data at each available resolution (1 km, 500 m and 250 m). Daytime data is corrected for the effects of atmospheric gases and aerosols. Specifically, bands 1 and 2 at 250 m, bands 1 through 7 at 500 m, and bands 1 through 16 at 1 km are corrected, yielding an estimate of the surface spectral reflectance for each band as it would be measured at ground level if there were no atmospheric scattering or absorption. Band quality control information for the correction is also generated (e. g., flags denoting if ancillary data is unavailable, if L1B data is faulty, etc.), for each resolution, and for bands 1 through 7.

The level 2 MOD09 output includes all corrected bands and band quality data, as well as aerosol retrieval data and data for assessing the quality of the aerosol retrieval algorithm (brightness temperature data from thermal bands 20, 31 and 32, water vapor data, path radiance data, et cetera). Data is written to the output files as Scientific Data Sets (SDSs). One additional data set of importance is the 1 km State QA SDS. While band quality SDSs contain information about the quality of the atmospheric correction of each pixel, the State QA SDS contains information about the pixel's **state** – that is, characteristics of each pixel that are not dependent upon band or resolution. Each State QA pixel contains data such as whether the pixel has been flagged as land, deep ocean, shallow ocean, or as containing cloud, high aerosol, low aerosol, snow, or fire. State QA data reflects the qualities of the pixel itself, not the quality of any of the surface reflectance data.

Other outputs of `MOD_PR09.exe` are the MOD09 Intermediate Surface Reflectance datasets (MOD09IDN, -IDT and -IDS), in which all surface reflectance data and band quality data for each orbit are geolocated into a linear latitude and longitude projection at 5 km (0.05°) resolution. Data in these files is averaged. These files are intermediate in the sense that they serve as inputs to `MOD_PR09C.exe`, which composites MOD09IDN, -IDT and -IDS files for each orbit into daily MOD09CMG and MOD09CMA files.

## 2.3. Products of MOD_PRMGR.exe -- level 2G
`MOD_PRMGR.exe` is run for each tile in the MODIS sinusoidal grid (figure 1) for each day, and is run on all MOD09 level 2 granules that map to the tile for that day. The number of observations at each pixel is determined not only by the number of orbits at that location (one at the equator and up to 15 at the poles), but also by the spread of observational coverage of off-nadir pixels.

**Figure 1.** The MODIS sinusoidal grid consists of 460 nonoverlapping tiles which measure approximately 10° x 10°. Data from an example tile (tile h11v05, derived from MOD09A1.A2000337.h11v05.005.2006342055602.hdf) is shown as a RGB-image.

The resulting data can be conceived of as forming a three-dimensional cube, with its depth determined by the number of observations at each pixel. The L2G data is written to output files in two parts: the first part consisting of "first layer" data, data at zero depth in the cube, as a 2-dimensional SDSs; and the second part as either "full format" data (the rest of the observations as 3-dimensional SDSs) or as "compact format" data (the rest of the observations with all fill values removed and written as one-dimensional SDSs). The format operationally generated is the compact format.

The level 2G output includes MOD09GHK (500 m surface reflectance and band quality data), MOD09GQK (250 m surface reflectance and band quality data), and MOD09GST (1 km State QA data). These datasets were archived until collection 5, when they were superseded by level 2G-lite products (see below). Apart from having been geolocated, the 1 km State QA dataset is identical to the State QA in MOD09 files.

## 2.4. Products of MOD_PR09A.exe -- level 3
`MOD_PR09A.exe` is run for each tile in the MODIS sinusoidal grid for each 8-day period. Up to and including collection 4, it was run on all MOD09GHK, -GQK and -GST files for that tile and 8-day period. As of collection 5, it is run on all MOD09GA and MOD09GQ files for that tile and 8-day period. All data in input files that map to a given pixel are called observations. The MOD_PR09A compositing process selects the best observation for each pixel. The criteria for selection include observational coverage and view angle, and whether the observation is flagged as cloudy, clear, containing high aerosol or low aerosol, or in cloud shadow.

For each pixel, the compositing steps are:
1) Observations from the same orbit are composited by observational coverage. Observations with the highest coverage are saved, and the rest discarded. This yields a list of one observation from each orbit.

2) Each orbit's observation is then assigned a score, based upon whether it is flagged for cloud, cloud shadow, high aerosol or low aerosol, or contains high view angle or low solar zenith angle. The lowest score, 0, is assigned to observations with fill values for data. The remaining scores are:
    * `1 BAD` data derived from a faulty or poorly corrected L1B pixel
    * `2 HIGHVIEW` data with a high view angle (60 degrees or more)
    * `3 LOWSUN` data with a high solar zenith angle (85 degrees or more)
    * `4 CLOUDY` data flagged as cloudy or adjacent to cloud
    * `5 SHADOW` data flagged as containing cloud shadow
    * `6 UNCORRECTED` data flagged as uncorrected
    * `7 CLIMAEROSOL` data flagged as containing the default level of aerosols
    * `8 HIGHAEROSOL` data flagged as containing the highest level of aerosols
    * `9 SNOW` data flagged as snow
    * `10 GOOD` data which meets none of the above criteria

The observation with the highest score and the lowest view angle is selected for the MOD09A1 and MOD09Q1 outputs.

The MOD09A1 outputs also contain a 500 m version of the 1 km State QA composited from all 8-day inputs.

## 2.5. Products of MOD_PR09G.exe -- level 2G-lite
Each observation in the L2G 'cube' is added not in any meaningful order, but in the order it is read from level 2 files – so, data in the "first layer" is not inherently more useful than the compact format data. In spite of this, however, in time the "first layer" of the L2G outputs became all that most users paid attention to. In the level 2G-lite format, efforts were made to improve the quality of the "first layer" data by sorting the observations in a manner similar to the selection process of `MOD_PR09A.exe` (above). The sorting of observations also eliminated the need for several SDSs in the level 2G pointer files, which reduced the overall volume of each day's data.

## 2.6. Products of MOD_PR09C.exe -- level 3 CMG
The MODIS Surface Reflectance Climate Modeling Grid (CMG) format is level 3 and global; its projection is in linear latitude and longitude (Plate Carre), and its resolution is 0.05° (figure 2). It is derived from MOD09IDN, MOD09IDT and MOD09IDS files for each orbit by compositing the data in these files on the basis of minimum band 3 (459 - 479 nm band) values (after excluding pixels flagged for clouds and high solar zenith angles). The MOD09CMG file contains surface reflectance for bands 1 through 7, band quality data and other important information, but does not contain retrieved aerosol data -- aerosol data is put into a separate file, the MOD09CMA file.

**Figure 2.** An RGB-image derived from MOD09CMG.A2000338.005.2006332091104.hdf.

***

# 3. Detailed product descriptions
## 3.1. Description and Science Data Sets
### 3.1.1. MOD09
**MODIS Terra/Aqua Surface Reflectance 5-minute L2 Swath**

**Product description:** MOD09 provides MODIS surface reflectance for bands 1 and 2 (at 250m), bands 1 – 7 (at 500 m) and bands 1 – 16 (at 1 km resolution), multiresolution QA, and 1 km observation statistics.

**Figure 3.** A MOD09 RGB-image composed of surface reflectance measured by MODIS bands 1 (red), 4 (green) and 3 (blue) on January 26, 2011 over northern Australia and Borneo. Product granule ID: `MOD09.A2011026.0035.005.2011027195038.hdf`

**Table 2. Science Data Sets for MOD09. (HDF Layers (46))**
*Note: This table combines information from pages 9, 10, and 11 of the original document.*

| Data Group | Science Data Set | Units | Data Type | Fill Value | Valid Range | Scale Factor |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 km | 1km Atmospheric Optical Depth Band 1: (AOT retrieval residual values) | none | 16-bit signed integer | 60 | 0 - 5000 | 0.001 |
| 1 km | 1km Atmospheric Optical Depth Band 3 | none | 16-bit signed integer | 60 | 0 - 5000 | 0.001 |
| 1 km | 1km Atmospheric Optical Depth Band 8: (Angstrom exponent values) | none | 16-bit signed integer | 60 | 0 - 5000 | 0.001 |
| 1 km | 1km Atmospheric Optical Depth Model | none | 8-bit unsigned integer | 0 | 1 - 5 | 1 |
| 1 km | 1km water_vapor | g/cm² | 16-bit unsigned integer | 0 | 0 - 5000 | 0.01 |
| 1 km | 1km Atmospheric Optical Depth Band QA (see Table 14) | Bit Field | 16-bit unsigned integer | 0 | 0 - 65535 | 1 |
| 1 km | 1km Atmospheric Optical Depth Band CM | none | 8-bit unsigned integer | 0 | 0 - 19 | 1 |
| 250 m | 250m Surface Reflectance Band 1: (620-670 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| 250 m | 250m Surface Reflectance Band 2: (841-876 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| 500 m | 500m Surface Reflectance Band 1: (620-670 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| 500 m | 500m Surface Reflectance Band 2: (841-876 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| 500 m | 500m Surface Reflectance Band 3: (459-479 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| 500 m | 500m Surface Reflectance Band 4: (545-565 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| 500 m | 500m Surface Reflectance Band 5: (1230-1250 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| 500 m | 500m Surface Reflectance Band 6: (1628-1652 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| 500 m | 500m Surface Reflectance Band 7: (2105-2155 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| 1 km | 1km Surface Reflectance Band 1: (620-670 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| 1 km | 1km Surface Reflectance Band 2: (841-876 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| 1 km | 1km Surface Reflectance Band 3: (459-479 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| 1 km | 1km Surface Reflectance Band 4: (545-565 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| 1 km | 1km Surface Reflectance Band 5: (1230-1250 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| 1 km | 1km Surface Reflectance Band 6: (1628-1652 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| 1 km | 1km Surface Reflectance Band 7: (2105-2155 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| 1 km | 1km Surface Reflectance Band 8: (405-420 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| 1 km | 1km Surface Reflectance Band 9: (438-448 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| 1 km | 1km Surface Reflectance Band 10: (483-493 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| 1 km | 1km Surface Reflectance Band 11: (526-536 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| 1 km | 1km Surface Reflectance Band 12: (546-556 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| 1 km | 1km Surface Reflectance Band 13: (662-672 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| | 1km Surface Reflectance Band 14: (673-683 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| | 1km Surface Reflectance Band 15: (743-753 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| | 1km Surface Reflectance Band 16: (862-877 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| | BAND20: (3.66-3.84 μm) | Degrees K | 16-bit unsigned integer | 0 | 0 - 33300 | 0.01 |
| | 1km Surface Reflectance Band 26: (1.36-1.39 μm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| | BAND31: (10.78-11.284 μm) | Degrees K | 16-bit unsigned integer | 0 | 0 - 33300 | 0.01 |
| | BAND32: (11.77-12.27 μm) | Degrees K | 16-bit unsigned integer | 0 | 0 - 33300 | 0.01 |
| | BAND20ALBEDO: (3.66-3.84 μm) | Reflectance | 16-bit signed integer | -28672 | -100 - 5000 | 0.0001 |
| | Latitude | Degrees | 32-bit float | 0.0 | -90.0 - 90.0 | 1.0 |
| | Longitude | Degrees | 32-bit float | 0.0 | -180 - 180 | 1.0 |
| | 250m Reflectance Band Quality (see Table 8) | Bit Field | 16-bit unsigned integer | 2995 | NA | NA |
| | 500m Reflectance Band Quality (see Table 10) | Bit Field | 32-bit unsigned integer | 3 | NA | NA |
| | 1km Reflectance Band Quality (see Table 10) | Bit Field | 32-bit unsigned integer | 3 | NA | NA |
| | 1km b8-15 Reflectance Band Quality (see Table 11) | Bit Field | 32-bit unsigned integer | 3 | NA | NA |
| | 1km b16 Reflectance Band Quality (see Table 12) | Bit Field | 8-bit unsigned integer | 3 | NA | NA |
| | 1km Reflectance Data State QA (see Table 13) | Bit Field | 16-bit unsigned integer | 0 | NA | NA |
| | 1km Band 3 Path Radiance | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |

*Note: Tables 2 – 13 list what data fill values should be, but bugs in some programs can result in different fill values for band quality SDSs.*

### 3.1.2. MOD09GQ
**MODIS Terra/Aqua Surface Reflectance Daily L2G Global 250 m**

**Product description:** MOD09GQ provides MODIS band 1-2 daily surface reflectance at 250 m resolution. This product is meant to be used in conjunction with the MOD09GA where important quality and viewing geometry information is stored.

**Figure 4.** An example of MOD09GQ surface reflectance product. The corresponding MODIS data were collected on December 3, 2000 over Alabama, Mississippi and Florida. Product Granule ID: `MOD09GQ.A2000339.h10v05.005.2006339053418.hdf`.
*Upper image:* Band 2 (near-infrared) surface reflectance shown on a gray scale.
*Lower image:* A false-color RGB combination of bands 2, 1, and 1. Vegetation appears red, water appears black, and clouds appear white.

**Table 3. Science Data Sets for MOD09GQ. (Only 2-dimensional SDSs are listed.)**
| Science Data Sets (HDF Layers) (8) | Units | Data Type | Fill Value | Valid Range | Scale Factor |
| :--- | :--- | :--- | :--- | :--- | :--- |
| num_observations: number of observations within a pixel | none | 8-bit signed integer | -1 | 0 - 127 | NA |
| sur_refl_b01_1: 250m Surface Reflectance Band 1 (620-670 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| sur_refl_b02_1: 250m Surface Reflectance Band 2 (841-876 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| QC_250m_1: 250m Reflectance Band Quality (see Table 8) | Bit Field | 16-bit unsigned integer | 2995 | 0 - 4096 | NA |
| obscov_1: Observation Coverage (percentage of the grid cell area covered by the observation) | Percent | 8-bit signed integer | -1 | 0 - 100 | 0.01 |
| iobs_res_1 | none | 8-bit unsigned integer | 255 | 0 - 254 | NA |
| orbit_pnt_1 | none | 8-bit signed integer | -1 | 0 - 15 | NA |
| granule_pnt_1 | none | 8-bit unsigned integer | 255 | 0 - 254 | NA |

### 3.1.3. MOD09GA
**MODIS Terra/Aqua Surface Reflectance Daily L2G Global 500 m and 1 km**

**Product description:** MOD09GA provides MODIS band 1-7 daily surface reflectance at 500 m resolution and 1 km observation and geolocation statistics.

**Figure 5.** A MOD09GA RGB-image composed of surface reflectance measured by MODIS bands 1 (red), 4 (green) and 3 (blue) on December 6, 2000 over the US East coast. Product granule ID: `MOD09GA.A2000340.h11v05.005.2006339102700.hdf`

**Table 4. Science Data Sets for MOD09GA. (Only 2-dimensional SDSs are listed.)**
*Note: This table combines information from pages 13 and 14 of the original document.*

| Data Group | Science Data Set (HDF Layers (22)) | Units | Data Type | Fill Value | Valid Range | Scale Factor |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 km | num_observations_1km: Number of Observations | none | 8-bit signed integer | -1 | 0 - 127 | NA |
| 1 km | state_1km_1: Reflectance Data State (see Table 13) | Bit Field | 16-bit unsigned integer | 65535 | NA | NA |
| 1 km | SensorZenith_1 | Degree | 16-bit signed integer | -32767 | 0 - 18000 | 0.01 |
| 1 km | SensorAzimuth_1 | Degree | 16-bit signed integer | -32767 | -18000 - 18000 | 0.01 |
| 1 km | Range_1: pixel to sensor | Meter | 16-bit unsigned integer | 65535 | 27000 - 65535 | 0.04 |
| 1 km | SolarZenith_1 | Degree | 16-bit signed integer | -32767 | 0 - 18000 | 0.01 |
| 1 km | SolarAzimuth_1 | Degree | 16-bit signed integer | -32767 | -18000 - 18000 | 0.01 |
| 1 km | gflags_1: Geolocation flags (see Table 16) | Bit Field | 8-bit unsigned integer | 255 | 0 - 248 | NA |
| 1 km | orbit_pnt_1: Orbit Pointer | none | 8-bit signed integer | -1 | 0 - 15 | NA |
| 1 km | granule_pnt_1: Granule Pointer | none | 8-bit unsigned integer | 255 | 0 - 254 | NA |
| 500 m | num_observations_500m | none | 8-bit signed integer | -1 | 0 - 127 | NA |
| 500 m | sur_refl_b01_1: 500m Surface Reflectance Band 1 (620-670 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| 500 m | sur_refl_b02_1: 500m Surface Reflectance Band 2 (841-876 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| 500 m | sur_refl_b03_1: 500m Surface Reflectance Band 3 (459-479 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| 500 m | sur_refl_b04_1: 500m Surface Reflectance Band 4 (545-565 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| 500 m | sur_refl_b05_1: 500m Surface Reflectance Band 5 (1230-1250 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| 500 m | sur_refl_b06_1: 500m Surface Reflectance Band 6 (1628-1652 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| 500 m | sur_refl_b07_1: 500m Surface Reflectance Band 7 (2105-2155 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| 500 m | QC_500m_1: 500m Reflectance Band Quality (see Table 10) | Bit Field | 32-bit unsigned integer | 787410671 | NA | NA |
| 500 m | obscov_500m_1: Observation coverage | Percent | 8-bit signed integer | -1 | 0 - 100 | 0.01 |
| 500 m | iobs_res_1: Observation number | none | 8-bit unsigned integer | 255 | 0 - 254 | NA |
| 500 m | q_scan_1: 250m scan value information (see Table 17) | none | 8-bit unsigned integer | 255 | 0 - 254 | NA |

### 3.1.4. MOD09Q1
**MODIS Terra/Aqua Surface Reflectance 8-Day L3 Global 250 m**

**Product description:** MOD09Q1 provides MODIS band 1-2 surface reflectance at 250 m resolution. It is a level 3 composite of MOD09GQ. Each MOD09Q1 pixel contains the best possible L2G observation during an 8-day period as selected on the basis of high observation coverage, low view angle, the absence of clouds or cloud shadow, and aerosol loading.

**Figure 6.** An example of MOD09Q1 surface reflectance product. The corresponding MODIS data were collected in December, 2000 over Alabama, Mississippi and Florida. Product Granule ID: `MOD09Q1.A2000337.h10v05.005.2006342044337.hdf`.
*Upper image:* Band 2 (near-infrared) surface reflectance shown on a gray scale.
*Lower image:* A false-color RGB combination of bands 2, 1, and 1. Vegetation appears red, water appears black, and clouds appear white.

**Table 5. Science Data Sets for MOD09Q1**
| Science Data Sets (HDF Layers (4)) | Units | Data Type | Fill Value | Valid Range | Scale Factor |
| :--- | :--- | :--- | :--- | :--- | :--- |
| sur_refl_b01: 250m Surface Reflectance Band 1 (620-670 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| sur_refl_b02: 250m Surface Reflectance Band 2 (841-876 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| sur_refl_state_250m: 250m Reflectance State QA (see Table 13) | Bit Field | 16-bit unsigned integer | 65535 | NA | NA |
| sur_refl_qc_250m: 250m Reflectance Band Quality (see Table 9) | Bit Field | 16-bit unsigned integer | 65535 | 0 - 32767 | NA |

### 3.1.5. MOD09A1
**MODIS Terra/Aqua Surface Reflectance 8-Day L3 Global 500 m**

**Product description:** MOD09A1 provides MODIS band 1-7 surface reflectance at 500 m resolution. It is a level-3 composite of 500 m resolution MOD09GA. Each product pixel contains the best possible L2G observation during an 8-day period as selected on the basis of high observation coverage, low view angle, absence of clouds or cloud shadow, and aerosol loading.

**Figure 7.** A MOD09A1 RGB image composed of surface reflectance data measured by bands 1 (red), 4 (green) and 3(blue) in December, 2000 over the US East coast. Granule ID: `MOD09A1.A2000337.h11v05.005.2006342055602.hdf`

**Table 6. Science Data Sets for MOD09A1**
| Science Data Sets (HDF Layers (13)) | Units | Data Type | Fill Value | Valid Range | Scale Factor |
| :--- | :--- | :--- | :--- | :--- | :--- |
| sur_refl_b01: 500m Surface Reflectance Band 1 (620-670 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| sur_refl_b02: 500m Surface Reflectance Band 2 (841-876 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| sur_refl_b03: 500m Surface Reflectance Band 3 (459-479 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| sur_refl_b04: 500m Surface Reflectance Band 4 (545-565 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| sur_refl_b05: 500m Surface Reflectance Band 5 (1230-1250 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| sur_refl_b06: 500m Surface Reflectance Band 6 (1628-1652 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| sur_refl_b07: 500m Surface Reflectance Band 7 (2105-2155 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| sur_refl_qc_500m: 500m Reflectance Band Quality (see Table 10) | Bit Field | 32-bit unsigned integer | 4294967295 | NA | NA |
| sur_refl_szen: Solar Zenith Angle | Degree | 16-bit signed integer | 0 | 0 - 18000 | 0.01 |
| sur_refl_vzen: View Zenith Angle | Degree | 16-bit signed integer | 0 | 0 - 18000 | 0.01 |
| sur_refl_raz: Relative Azimuth Angle | Degree | 16-bit signed integer | 0 | -18000 - 18000 | 0.01 |
| sur_refl_state_500m: 500m State Flags (see Table 13) | Bit field | 16-bit unsigned integer | 65535 | NA | NA |
| sur_refl_day_of_year: Day of Year | Julian day | 16-bit unsigned integer | 65535 | 1 - 366 | NA |

### 3.1.6. MOD09CMG
**MODIS Terra/Aqua Surface Reflectance Daily L3 Global 0.05 Deg CMG**

**Product description:** MOD09CMG provides MODIS band 1-7 surface reflectance at 0.05-degree resolution. This product is based on a Climate Modeling Grid (CMG) for the purpose of being used in climate simulation models.

**Figure 8.** A MOD09CMG RGB-image composed of surface reflectance data measured by bands 1 (red), 4 (green) and 3 (blue) on December 7, 2000. The MODIS product granule ID is `MOD09CMG.A2000341.005.2006347161131.hdf`.

**Table 7. Science Data Sets for MOD09CMG.**
*Note: This table combines information from pages 17 and 18 of the original document.*

| Science Data Sets (HDF Layers (25)) | Units | Data Type | Fill Value | Valid Range | Scale Factor |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Coarse Resolution Surface Reflectance Band 1 (620-670 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| Coarse Resolution Surface Reflectance Band 2 (841-876 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| Coarse Resolution Surface Reflectance Band 3 (459-479 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| Coarse Resolution Surface Reflectance Band 4 (545-565 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| Coarse Resolution Surface Reflectance Band 5 (1230-1250 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| Coarse Resolution Surface Reflectance Band 6 (1628-1652 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| Coarse Resolution Surface Reflectance Band 7 (2105-2155 nm) | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| Coarse Resolution Solar Zenith Angle | Degree | 16-bit signed integer | 0 | 0 - 18000 | 0.01 |
| Coarse Resolution View Zenith Angle | Degree | 16-bit signed integer | 0 | 0 - 18000 | 0.01 |
| Coarse Resolution Relative Azimuth Angle | Degree | 16-bit signed integer | 0 | -18000 - 18000 | 0.01 |
| Coarse Resolution Ozone | cm atm | 8-bit unsigned integer | 0 | 0 - 255 | 0.0025 |
| Coarse Resolution Brightness Temperature Band 20 (3.360-3.840 μm) | degrees K | 16-bit unsigned integer | 0 | 0 - 40000 | 0.01 |
| Coarse Resolution Brightness Temperature Band 21 (3.929-3.989 μm) | degrees K | 16-bit unsigned integer | 0 | 0 - 40000 | 0.01 |
| Coarse Resolution Brightness Temperature Band 31 (10.780-11.280 µm) | degrees K | 16-bit unsigned integer | 0 | 0 - 40000 | 0.01 |
| Coarse Resolution Brightness Temperature Band 32 (11.770-12.270 μm) | degrees K | 16-bit unsigned integer | 0 | 0 - 40000 | 0.01 |
| Coarse Resolution Granule Time | HHMM | 16-bit integer | 0 | 0 - 2355 | 1 |
| Coarse Resolution Band 3 Path Radiance | Reflectance | 16-bit signed integer | -28672 | -100 - 16000 | 0.0001 |
| Coarse Resolution QA (see Table 10) | Bit Field | 32-bit unsigned integer | 0 | 1 - 1073741824 | NA |
| Coarse Resolution Internal CM (see Table 14) | Bit Field | 16-bit unsigned integer | 0 | 1 - 8191 | NA |
| Coarse Resolution State QA (see Table 13) | Bit Field | 16-bit unsigned integer | 0 | 1 - 65535 | NA |
| Coarse Resolution Number Mapping (see Table 15) | Bit Field | 32-bit unsigned integer | 0 | 1 - 2097151 | NA |
| number of 500m pixels averaged b3-7 | none | 16-bit unsigned integer | 0 | 1 - 200 | NA |
| number of 500m rej. detector | none | 8-bit unsigned integer | 0 | 1 - 100 | NA |
| number of 250m pixels averaged b1-2 | none | 16-bit unsigned integer | 0 | 1 - 640 | NA |
| n pixels averaged | none | 8-bit unsigned integer | 0 | 1 - 40 | NA |

## 3.2. Data product quality
### 3.2.1. 250 m resolution QA

**Table 8. 250 m Level 2/Level 2G Surface Reflectance Band Quality Description (16-bit).** *Note that bit 0 is the Least Significant Bit (LSB).*

| Bit No. | Parameter Name | Bit Comb. | QC_250m |
| :--- | :--- | :--- | :--- |
| 0-1 | MODLAND QA bits | 00 | corrected product produced at ideal quality all bands |
| 0-1 | | 01 | corrected product produced at less than ideal quality some or all bands |
| 0-1 | | 10 | corrected product not produced due to cloud effects all bands |
| 0-1 | | 11 | corrected product not produced due to other reasons some or all bands may be fill value [Note that a value of (11) overrides a value of (01)]. |
| 2-3 | Spare (unused) | - | --- |
| 4-7 | band 1 data quality four bit range | 0000 | highest quality |
| 4-7 | | 0111 | noisy detector |
| 4-7 | | 1000 | dead detector, data interpolated in L1B |
| 4-7 | | 1001 | solar zenith >= 86 degrees |
| 4-7 | | 1010 | solar zenith >= 85 and < 86 degrees |
| 4-7 | | 1011 | missing input |
| 4-7 | | 1100 | internal constant used in place of climatological data for at least one atmospheric constant |
| 4-7 | | 1101 | correction out of bounds, pixel constrained to extreme allowable value |
| 4-7 | | 1110 | L1B data faulty |
| 4-7 | | 1111 | not processed due to deep ocean or clouds |
| 8-11 | band 2 data quality four bit range | | SAME AS BAND ABOVE |
| 12 | atmospheric correction performed | 1 | yes |
| 12 | | 0 | no |
| 13 | adjacency correction performed | 1 | yes |
| 13 | | 0 | no |
| 14-15 | spare (unused) | - | --- |

### 3.2.2. 500 m, 1km and coarse resolution QA

**Table 9. 250 m Level 3 Surface Reflectance Band Quality Description (16-bit).** *Bit 0 is LSB.*

| Bit No. | Parameter Name | Bit Comb. | sur_refl_qc_250m |
| :--- | :--- | :--- | :--- |
| 0-1 | MODLAND QA bits | 00 | corrected product produced at ideal quality all bands |
| 0-1 | | 01 | corrected product produced at less than ideal quality some or all bands |
| 0-1 | | 10 | corrected product not produced due to cloud effects all bands |
| 0-1 | | 11 | corrected product not produced due to other reasons some or all bands may be fill value [Note that a value of (11) overrides a value of (01)]. |
| 2-3 | Spare (unused) | -- | --- |
| 4-7 | band 1 data quality four bit range | 0000 | highest quality |
| 4-7 | | 0111 | noisy detector |
| 4-7 | | 1000 | dead detector, data interpolated in L1B |
| 4-7 | | 1001 | solar zenith >= 86 degrees |
| 4-7 | | 1010 | solar zenith >= 85 and < 86 degrees |
| 4-7 | | 1011 | missing input |
| 4-7 | | 1100 | internal constant used in place of climatological data for at least one atmospheric constant |
| 4-7 | | 1101 | correction out of bounds, pixel constrained to extreme allowable value |
| 4-7 | | 1110 | L1B data faulty |
| 4-7 | | 1111 | not processed due to deep ocean or clouds |
| 8-11 | band 2 data quality four bit range | | SAME AS BAND 1 ABOVE |
| 12 | atmospheric correction performed | 1 | yes |
| 12 | | 0 | no |
| 13 | adjacency correction performed | 1 | yes |
| 13 | | 0 | no |
| 14 | different orbit from 500 m | 1 | yes |
| 14 | | 0 | no |
| 15 | spare (unused) | - | --- |

**Table 10. 500 m, 1 km and Coarse Resolution Surface Reflectance Band Quality Description (32-bit).** *Bit 0 is LSB.*

| Bit No. | Parameter Name | Bit Comb. | QC_500m / Coarse Resolution QA / surf_refl_qc_500m/ 500m Reflectance Band Quality / 1km Reflectance Band Quality |
| :--- | :--- | :--- | :--- |
| 0-1 | MODLAND QA bits | 00 | corrected product produced at ideal quality -- all bands |
| 0-1 | | 01 | corrected product produced at less than ideal quality -- some or all bands |
| 0-1 | | 10 | corrected product not produced due to cloud effects -- all bands |
| 0-1 | | 11 | corrected product not produced for other reasons some or all bands, may be fill value (11) [Note that a value of (11) overrides a value of (01)]. |
| 2-5 | band 1 data quality, four bit range | 0000 | highest quality |
| 2-5 | | 0111 | noisy detector |
| 2-5 | | 1000 | dead detector, data interpolated in L1B |
| 2-5 | | 1001 | solar zenith >= 86 degrees |
| 2-5 | | 1010 | solar zenith >= 85 and < 86 degrees |
| 2-5 | | 1011 | missing input |
| 2-5 | | 1100 | internal constant used in place of climatological data for at least one atmospheric constant |
| 2-5 | | 1101 | correction out of bounds, pixel constrained to extreme allowable value |
| 2-5 | | 1110 | L1B data faulty |
| 2-5 | | 1111 | not processed due to deep ocean or clouds |
| 6-9 | band 2 data quality four bit range | | same as band above |
| 10-13 | band 3 data quality four bit range | | same as band above |
| 14-17 | band 4 data quality four bit range | | same as band above |
| 18-21 | band 5 data quality four bit range | | same as band above |
| 22-25 | band 6 data quality four bit range | | same as band above |
| 26-29 | band 7 data quality four bit range | | same as band above |
| 30 | atmospheric correction performed | 1 | yes |
| 30 | | 0 | no |
| 31 | adjacency correction performed | 1 | yes |
| 31 | | 0 | no |

**Table 11. 1 km Surface Reflectance Bands 8-15 Quality Description (32-bit).** *Bit 0 is LSB.*

| Bit No. | Parameter Name | Bit Comb. | 1km Reflectance Band Quality |
| :--- | :--- | :--- | :--- |
| 0-3 | band 8 data quality, four bit range | 0000 | highest quality |
| 0-3 | | 0111 | noisy detector |
| 0-3 | | 1000 | dead detector, data interpolated in L1B |
| 0-3 | | 1001 | solar zenith >= 86 degrees |
| 0-3 | | 1010 | solar zenith >= 85 and < 86 degrees |
| 0-3 | | 1011 | missing input |
| 0-3 | | 1100 | internal constant used in place of climatological data for at least one atmospheric constant |
| 0-3 | | 1101 | correction out of bounds, pixel constrained to extreme allowable value |
| 0-3 | | 1110 | L1B data faulty |
| 0-3 | | 1111 | not processed due to deep ocean or clouds |
| 4-7 | band 9 data quality four bit range | | same as band above |
| 8-11 | band 10 data quality four bit range | | same as band above |
| 12-15 | band 11 data quality four bit range | | same as band above |
| 16-19 | band 12 data quality four bit range | | same as band above |
| 20-23 | band 13 data quality four bit range | | same as band above |
| 24-27 | band 14 data quality four bit range | | same as band above |
| 28-31 | band 15 data quality four bit range | | same as band above |

**Table 12. 1 km Surface Reflectance Band 16 Quality Description (8-bit).** *Bit 0 is LSB.*

| Bit No. | Parameter Name | Bit Comb. | 1km Reflectance Band Quality |
| :--- | :--- | :--- | :--- |
| 0-3 | Spare (Unused) | | |
| 4-7 | band 16 data quality, four bit range | 0000 | highest quality |
| 4-7 | | 0111 | noisy detector |
| 4-7 | | 1000 | dead detector, data interpolated in L1B |
| 4-7 | | 1001 | solar zenith >= 86 degrees |
| 4-7 | | 1010 | solar zenith >= 85 and < 86 degrees |
| 4-7 | | 1011 | missing input |
| 4-7 | | 1100 | internal constant used in place of climatological data for at least one atmospheric constant |
| 4-7 | | 1101 | correction out of bounds, pixel constrained to extreme allowable value |
| 4-7 | | 1110 | L1B data faulty |
| 4-7 | | 1111 | not processed due to deep ocean or clouds |

## 3.3. Data product state QA flags
**Table 13. State QA description (16-bit).** *Bit 0 is LSB.*
*Note: This table combines information from pages 24 and 25 of the original document.*

| Bit No. | Parameter Name | Bit Comb. | state_1km / Coarse Resolution State QA / surf_refl_state_500m / 1km Reflectance Data State QA |
| :--- | :--- | :--- | :--- |
| 0-1 | cloud state | 00 | clear |
| 0-1 | | 01 | cloudy |
| 0-1 | | 10 | mixed |
| 0-1 | | 11 | not set, assumed clear |
| 2 | cloud shadow | 1 | yes |
| 2 | | 0 | no |
| 3-5 | land/water flag | 000 | shallow ocean |
| 3-5 | | 001 | land |
| 3-5 | | 010 | ocean coastlines and lake shorelines |
| 3-5 | | 011 | shallow inland water |
| 3-5 | | 100 | ephemeral water |
| 3-5 | | 101 | deep inland water |
| 3-5 | | 110 | continental/moderate ocean |
| 3-5 | | 111 | deep ocean |
| 6-7 | aerosol quantity | 00 | climatology |
| 6-7 | | 01 | low |
| 6-7 | | 10 | average |
| 6-7 | | 11 | high |
| 8-9 | cirrus detected | 00 | none |
| 8-9 | | 01 | small |
| 8-9 | | 10 | average |
| 8-9 | | 11 | high |
| 10 | internal cloud algorithm flag | 1 | cloud |
| 10 | | 0 | no cloud |
| 11 | internal fire algorithm flag | 1 | fire |
| 11 | | 0 | no fire |
| 12 | MOD35 snow/ice flag | 1 | yes |
| 12 | | 0 | no |
| 13 | Pixel is adjacent to cloud | 1 | yes |
| 13 | | 0 | no |
| 14 | Salt pan | 1 | yes |
| 14 | | 0 | no |
| 15 | internal snow mask | 1 | snow |
| 15 | | 0 | no snow |

## 3.4. Internal CM
**Table 14. Coarse Resolution Internal CM, 1km Atmospheric Optical Depth Band QA (16-bit).** *Bit 0 is LSB.*

| Bit No. | Description | Bit Comb. | state |
| :--- | :--- | :--- | :--- |
| 0 | cloudy | 1 | yes |
| 0 | | 0 | no |
| 1 | clear | 1 | yes |
| 1 | | 0 | no |
| 2 | high clouds | 1 | yes |
| 2 | | 0 | no |
| 3 | low clouds | 1 | yes |
| 3 | | 0 | no |
| 4 | snow | 1 | yes |
| 4 | | 0 | no |
| 5 | fire | 1 | yes |
| 5 | | 0 | no |
| 6 | sun glint | 1 | yes |
| 6 | | 0 | no |
| 7 | dust | 1 | yes |
| 7 | | 0 | no |
| 8 | cloud shadow | 1 | yes |
| 8 | | 0 | no |
| 9 | pixel is adjacent to cloud | 1 | yes |
| 9 | | 0 | no |
| 10-11 | cirrus | 00 | none |
| 10-11 | | 01 | small |
| 10-11 | | 10 | average |
| 10-11 | | 11 | high |
| 12 | pan flag | 1 | salt pan |
| 12 | | 0 | no salt pan |
| 13 | criteria used for aerosol retrieval | 1 | criterion 2 |
| 13 | | 0 | criterion 1 |
| 14 | AOT (aerosol optical thickness) has climatological values | 1 | yes |
| 14 | | 0 | no |
| 15 | Pixel has interpolated TR, PR or SA data | 1 | yes |
| 15 | | 0 | no |

## 3.5. Number Mapping
**Table 15. Coarse Resolution Number Mapping (32-bit).** *Bit 0 is LSB.*

| Bit No. | Description |
| :--- | :--- |
| 0-7 | Number of pixel mapping flagged as cloudy |
| 8-15 | Number of pixel mapping flagged as cloud shadow |
| 16-23 | Number of pixel mapping flagged as adjacent to cloud |
| 24-31 | Number of pixel mapping flagged for snow |

## 3.6. Geolocation flags
**Table 16. 1 km Geolocation Flags (16-bit).** *Bit 0 is LSB.*

| Bit No. | Description | Bit Comb. | state_1km |
| :--- | :--- | :--- | :--- |
| 0-2 | Fill | 00 | Fill |
| 3 | Sensor range validity flag | 0 | Valid |
| 3 | | 1 | Invalid |
| 4 | Digital elevation model quality flag | 0 | Valid |
| 4 | | 1 | Missing/inferior |
| 5 | Terrain data validity | 0 | Valid |
| 5 | | 1 | Invalid |
| 6 | Ellipsoid intersection flag | 0 | Valid intersection |
| 6 | | 1 | No intersection |
| 7 | Input data flag | 0 | Valid |
| 7 | | 1 | Invalid |

## 3.7. Scan value information
**Table 17. 250 m Scan Value Information Description (8-bit).** *Bit 0 is LSB.*

| Bit No. | Parameter Name | Bit Comb. | q_scan |
| :--- | :--- | :--- | :--- |
| 0 | scan of observation in quadrant 1 [-0.5 row, -0.5 column] | 1 | yes |
| 0 | | 0 | no |
| 1 | scan of observation in quadrant 2 [-0.5 row, +0.5 column] | 1 | yes |
| 1 | | 0 | no |
| 2 | scan of observation in quadrant 3 [+0.5 row, -0.5 column] | 1 | yes |
| 2 | | 0 | no |
| 3 | scan of observation in quadrant 4 [+0.5 row, +0.5 column] | 1 | yes |
| 3 | | 0 | no |
| 4 | missing observation in quadrant 1 [-0.5 row, -0.5 column] | 1 | same |
| 4 | | 0 | different |
| 5 | missing observation in quadrant 2 [-0.5 row, +0.5 column] | 1 | same |
| 5 | | 0 | different |
| 6 | missing observation in quadrant 3 [+0.5 row, -0.5 column] | 1 | same |
| 6 | | 0 | different |
| 7 | missing observation in quadrant 4 [+0.5 row, +0.5 column] | 1 | same |
| 7 | | 0 | different |

**Note:** The 250 m samples are for each of four quadrants within a 500 m cell. The first line/sample is in the upper left (north-west) corner of the image.
* 0 -- first 250m line (row), first 250m sample (column)
* 1 -- first 250m line, second 250m sample
* 2 -- second 250m line, first 250m sample
* 3 -- second 250m line, second 250m sample

## 3.8. Orbit and coverage
**Table 18. Orbit and coverage data set (8-bit) for Collection 4 (the orbit the observation came from and the observation coverage).** *Bit 0 is LSB.*

| Bit No. | Parameter Name | Bit Comb. | orb_cov_1 |
| :--- | :--- | :--- | :--- |
| 0-3 | orbit number | range: from 0 to 13, key: from 0000 (0) to 1011 (13) | |
| 4 | scan half flag | 0 | top half |
| 4 | | 1 | bottom half |
| 6-7 | land/water flag | 000 | 0.0 - 12.5% |
| 6-7 | | 001 | 12.5 - 25.0% |
| 6-7 | | 010 | 25.0 - 37.5% |
| 6-7 | | 011 | 37.5 - 50.0% |
| 6-7 | | 100 | 50.0 - 62.5% |
| 6-7 | | 101 | 62.5 - 75.0% |
| 6-7 | | 110 | 75.0 - 87.5% |
| 6-7 | | 111 | 87.5 - 100.0% |

**Note:** The orbit number is not the absolute orbit number but a relative orbit number in the file. In addition a flag is stored which distinguishes between observations which are in the top half of the scan (the first 5 1 km scan lines in the along track direction) and the bottom half of the scan (the last 5 1 km scan lines). The observation coverage is the area of intersection of observation footprint and cell divided by the area of the observation.

***

# 4. Frequently asked questions.
## 4.1. How are MODLAND QA bits set, and how should they be used?
The MODLAND QA bits are bits 0 and 1 of the band quality SDS pixel values. They are meant as a brief summary of quality control aspects of each pixel, with ‘00' meaning the best possible atmospheric correction and any other value indicating errors or problems, and serving as a flag to check other QA data in more detail. Although the MODLAND QA bits are still set in this manner, other band quality bits and other QA products (e. g., the State QA) have superseded the MODLAND QA bits in importance.

**a) `MOD_PR09.exe` processing.**

In the `MOD_PR09.exe` program, the MODLAND QA bits are initialized to '00' and