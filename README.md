# Modular MODIS Albedo Comparison Framework

A **clean and fully-modular** Google Earth Engine (GEE) framework for comparing three different MODIS albedo retrieval approaches over glacier surfaces.

> This repository is the **refactored** successor of the one-off notebooks contained in the `legacy/` folder.  All logic is now organised in small, testable modules that can be reused in other GEE projects.

---

## 📂 Directory overview

```
MOD09A1_REN_METHOD_CLEAN/
├── main.js                       # Entry point – wires UI & workflows together
├── modules/
│   ├── config.js                 # Centralised constants & global settings
│   ├── methods/                  # Individual albedo products
│   │   ├── ren.js                # MOD09A1 Ren et al. 2023 method
│   │   ├── mod10a1.js            # MOD10A1 daily snow albedo product
│   │   └── mcd43a3.js            # MCD43A3 BRDF/albedo product
│   ├── ui/                       # Interactive Code-Editor panels
│   │   ├── controls.js           # Widgets/inputs
│   │   ├── setup.js              # Panel assembly & callbacks
│   │   └── visualization.js      # Map layer styling & legends
│   ├── utils/                    # Pure helper functions
│   │   ├── export.js             # CSV export helpers
│   │   └── glacier.js            # Glacier masks & filtering
│   └── workflows/
│       └── comparison.js         # High-level processing orchestration
├── data/                         # Optional local lookup assets (empty by default)
└── legacy/                       # Original monolithic scripts kept for reference
```

---

## 🔬 Albedo products compared

| Method | Product ID | Temporal res. | Notes |
|--------|------------|---------------|-------|
| **Ren** | MOD09A1 | 8-day | Empirical broadband coefficients after Ren *et al.* 2023; includes topographic & BRDF correction |
| **MOD10A1** | MOD10A1 | daily | NDSI-based snow albedo with rigorous QA filtering |
| **MCD43A3** | MCD43A3 | daily | BRDF/albedo kernel-driven product (C6.1) |

---

## 🚀 Quick start (Google Earth Engine)

1. Open the GEE Code Editor.
2. In a new script add a single line:

   ```js
   var app = require('users/tofunori/MOD09A1_REN_METHOD:main.js');
   ```

3. Save & run the script – an interactive control panel will appear.
4. Choose **start/end date** (defaults to melt season 2017-2024) and select the albedo products to compare.
5. Click **Run Modular Comparison**.
6. After processing, click **Export CSV Results** to save per-date statistics to Google Drive.

> A demo script is available in the GEE asset `users/tofunori/MOD09A1_REN_METHOD:demo/main_demo.js`.

---

## 📊 Exported statistics

The CSV export provides one record per product & date containing:

* `albedo_mean`, `albedo_std`, `albedo_min`, `albedo_max`
* `pixel_count`
* `date`, `year`, `month`, `day_of_year`
* `method` – one of *Ren*, *MOD10A1*, *MCD43A3*

---

## 🎯 Feature highlights

* **Separation of concerns** – UI, business logic and utilities live in their own folders.
* **Melt-season focus** – June-September filtering configured in `modules/config.js`.
* **Asset paths ready for publishing** – all `require(...)` calls use absolute user paths.
* **Robust QA masking** – cloud, solar-zenith and snow/ice tests centralised in a single place.
* **Headless export option** – all workflows are functions that can be called without the UI.

---

## ⚙️ Requirements

* A Google Earth Engine account.
* Access to the glacier outline asset defined in `modules/config.js` (`GLACIER_ASSET`).  Replace with your own if necessary.
* (Optional) Google Drive for CSV export.

---

## 🧑‍💻 Development tips

* Set `DEBUG_MODE = true` in `modules/config.js` to enable verbose logging.
* Each module is standalone – you can `require` e.g. `modules/methods/ren.js` directly for unit testing.
* The legacy scripts provide a 1-to-1 reference of the original workflow before refactor.

---

**Version 2.1 – 2025-06-30**  ·  Author: *Modular Comparison Framework*