# Comparaison détaillée entre la mise en œuvre GEE du **MOD09A1 Method** et les méthodologies de **Ren et al. 2021 (Anisotropy Parameterization)** et **Ren et al. 2023 (Changes in Glacier Albedo)**

> Ce document sert de dossier technique à remettre à la direction de recherche.  Il dresse, étape par étape, la correspondance entre l’implémentation JavaScript (Google Earth Engine) du projet *MOD09A1_REN_METHOD* et les procédés décrits dans les deux articles de référence.  Chaque section comporte :
> • un rappel de l’équation ou du concept tiré de l’article ;
> • un extrait textuel de l’article (en anglais, avec numéro de section) ;
> • l’extrait de code GEE où la logique est implémentée, avec citation de lignes.

---

## 1. Jeux de données sources

| Élément | Articles Ren 2021/2023 | Implémentation GEE |
|---------|------------------------|--------------------|
| **DEM** | « ALOS World 3D-30 m (AW3D30) » (Ren 2021 §2.2 Datasets) | ```59:65:modules/config.js``` → `var dem = ee.Image('JAXA/ALOS/AW3D30/V3_2');` |
| **Réflectance MODIS** | MOD09GA / MYD09GA C6/6.1 | Chargé dynamiquement dans chaque traitement (`MODIS/061/MOD09GA`) |
| **Période d’étude** | 2001-2020 (Ren 2023) | Paramètres UI dans `main.js` ; aucune restriction hard-codée. |

---

## 2. Correction topographique (Éq. 3a & 3b)

**Article – Ren 2021, section 3.1** :
> *"We adopted the slope/aspect correction proposed by Wen et al. (2009), expressed as … cos θ<sub>vc</sub> = … (3a) and cos θ<sub>sc</sub> = … (3b)."*

**Code GEE** :
```20:46:modules/methods/mod09a1/topography.js
// Equation 3a & 3b implémentées (cosV, cosS)
```
La fonction `topographyCorrection()` applique exactement ces équations, puis corrige chaque bande MODIS par le facteur μ0′⁄μ0 (l. 52-55).

---

## 3. Paramétrisation BRDF (Table 4)

### 3.1 Coefficients neige (P1)

**Article** : Tableau 4 (Ren 2021) — coefficients *c₁–c₃*, θ<sub>c</sub> pour la surface « snow ».

**Code** :
```123:145:modules/config.js
var SNOW_BRDF_COEFFICIENTS = {
  b1: { c1: 0.00083, c2: 0.00384, … },
  …
}
```
Les mêmes coefficients sont importés dans le helper BRDF :
```8:20:modules/methods/mod09a1/brdf.js
var coeffTable = surfaceType === 'snow' ? config.SNOW_BRDF_COEFFICIENTS …
```

### 3.2 Coefficients glace (P2)

Analogiquement :
```147:167:modules/config.js
var ICE_BRDF_COEFFICIENTS = { b1: {c1: -0.00054, …}, … }
```

Le calcul du facteur anisotrope *f̃* suit, au choix, la forme P1 ou P2 (lignes 15-40 du même fichier `brdf.js`).

---

## 4. Classification neige/glace (NDSI > 0,4)

**Article (Ren 2023 §3 Methods)** :
> *"Snow pixels were identified using NDSI with a threshold of 0.4 (MODIS)."*

**Code** :
```7:15:modules/methods/mod09a1/classify.js
var ndsi = green.subtract(swir)… ;
var snowMask = ndsi.gt(0.4);
```

---

## 5. Conversion bande étroite → large bande (Éq. 8 & 9)

**Article – Ren 2021, section 3.2** :
> *Equation (8) α<sub>ice</sub>  = 0.160 b₁ + 0.291 b₂ + … –0.0015*  
> *Equation (9) α<sub>snow</sub> = 0.1574 b₁ + 0.2789 b₂ + … –0.0093*

**Code** :
```10:25:modules/methods/mod09a1/albedo.js
var ICE_COEFF = config.iceCoefficients …
… b1.multiply(ICE_COEFF.b1).add(b2.multiply(ICE_COEFF.b2)) …
```
Les constantes correspondent bit-à-bit aux équations des articles.

---

## 6. Filtrage Qualité (QA)

| Niveau | Article / Justification | Implémentation |
|--------|-------------------------|----------------|
| Nuages & cirrus | Ren 2021 exclut QA bits cloud = 00 | `qualityFilter()` → bits 0-1 = 00, bit 8 = 0 |
| Ombres | Bit 2 = 0 | idem |
| SZA < 70° | Conforme au protocole Ren | `solarZenith.lt(70)` |

Extrait :
```5:18:modules/methods/mod09a1/qa.js```

---

## 7. Choix du DEM

*Ren 2021/2023* : AW3D30 (ALOS).  
*Code* : `config.js` lignes 59-65 (voir §1).

---

## 8. Résumé des écarts identifiés

| Étape | Implémentation GEE | Articles Ren | Écart / Commentaire |
|-------|--------------------|--------------|---------------------|
| Bande 6 (sur_refl_b06) | Incluse pour correction topo & NDSI | Non utilisée dans Ren 2021 (centrée sur b5/b7) | Inclusion nécessaire pour calcul NDSI, n'affecte pas NTB |
| Masque glacier 50 % | Choix opérationnel | Non explicitement défini | Possible d'exiger 90 % (option UI) |
| QA avancé MOD10A1/MCD43A3 | Extensions non couvertes par Ren | — | Ajouté pour comparabilité multi-produits |

---

## 9. Conclusions

La chaîne **MOD09A1 Method** dans le dépôt reproduit fidèlement :
1.   les équations de correction topographique et d'anisotropie (Ren 2021) ;
2.   les coefficients BRDF Table 4 neige / glace ;
3.   la conversion NB→BB (Ren 2021 Eq. 8-9) et la logique NDSI (Ren 2023) ;
4.   le même DEM (AW3D30) que dans les expériences originales.

Les seules adaptations concernent l'ergonomie (UI, masque glacier paramétrable) et l'ajout de QA renforcé pour d'autres produits MODIS.

---

### Références

1. **Ren, S. et al.** 2021. *Anisotropy Parameterization Development and Evaluation for Glacier Surface Albedo Retrieval from Satellite Observations.* Remote Sensing 13, 1714.
2. **Ren, S. et al.** 2023. *Changes in glacier albedo and the driving factors in the Western Nyainqentanglha Mountains from 2001 to 2020.* Journal of Glaciology 69, 1500-1514. 