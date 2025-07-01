# Glacier-Albedo MOD09GA Pipeline (Ren 2021/2023 implementation)

This short guide shows how to reproduce a broadband-albedo time-series for ANY glacier polygon using our Google-Earth-Engine code in **≤ 10 steps**.

---

## Prerequisites
1. A Google Earth Engine (GEE) account with access to Code Editor.
2. Clone this repository or import it as a GEE script asset:
   `users/<your-gee-user>/MOD09A1_REN_METHOD`.
3. A glacier outline (polygon) in GEE Assets (e.g. from **RGI v6.0**).

---

## Quick-start (10 steps)

| # | Action |
|---|---------|
| 1 | **Open** GEE Code Editor. |
| 2 | In the left panel click **Scripts → My Assets → MOD09A1_REN_METHOD → main.js**. |
| 3 | Replace the constant `GLACIER_ASSET` in `modules/config.js` with the path of *your* glacier polygon. |
| 4 | (Optional) adjust `snow_threshold` or other values in **config.json** and re-`require()` it in `config.js` if you need custom thresholds. |
| 5 | Press **Run**.  The script loads MOD09GA & MYD09GA scenes for the default date range (2017-06-01 → 2024-09-30). |
| 6 | QA filtering removes cloud/cirrus & high SZA; slope/aspect correction is applied. |
| 7 | New provenance bands `shadow_mask` and `sat_vis` are generated on-the-fly. |
| 8 | BRDF anisotropy correction → narrowband → broadband conversion (snow/ice specific). |
| 9 | Two-pass 3 × 3 gap-fill and half-month compositing run automatically. |
|10 | Use **Tasks → Export** to download the 500 m half-monthly albedo stack (plus masks) as GeoTIFF or to your GEE asset. |

That's it—10 clicks/edits from scratch to a ready-to-analyse time series.

---

## Outputs
Each exported image contains:
* `broadband_albedo` – Ren 2021/2023 broadband value.
* `shadow_mask` – 1 if terrain-cast shadow, else 0.
* `sat_vis` – 1 if MODIS visible band saturated, else 0.
* `fill_level` – 0 (none), 1 (first 3×3 fill), 2 (second fill) – *to be added*.

---

## Input dataset versions
| Dataset | Version / ID |
|---------|--------------|
| MODIS Surface Reflectance | Collection 6.1 (`MODIS/061/MOD09GA`, `MYD09GA`) |
| DEM (slope/aspect) | JAXA AW3D30 v4.1 (`JAXA/ALOS/AW3D30/V4_1`) |
| Glacier outlines | RGI v6.0 |

---

## Citation
If you use this pipeline, please cite:
* Ren S. *et al.*, 2021, **Remote Sensing** 13(9):1714.  
* Ren S. *et al.*, 2023, **Journal of Glaciology** 69(277):1500-1514.

---

For questions or issues open a GitHub issue or email the maintainer.
