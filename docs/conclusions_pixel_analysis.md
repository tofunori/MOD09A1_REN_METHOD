# Synthèse et interprétation – Analyse Pixel_Data_2023

*Période : 1ᵉʳ juin → 30 septembre 2023 – 18 359 mesures, 115 pixels*

## 1. Contexte
Nous comparons les albedos journaliers MOD09GA (Ren) et MOD10A1 (neige) au
produit 16 jours MCD43A3 (référence). Les analyses précédentes ont montré :

* Corrélations globales MOD09GA/MOD10A1 > 0.87 ; corrélations avec
  MCD43A3 plus modestes (0.55–0.64).
* Biais positifs (surestimation) moyens : +0.095 (MOD09GA) et +0.067 (MOD10A1).
* Écart type et RMSE s’accentuent en fin de saison (septembre).

Le présent document décrit deux analyses complémentaires :

| Analyse | Objectif |
|---------|----------|
| Corrélation |bias| – N | Vérifier si les gros biais proviennent de pixels peu observés. |
| Correction par pixel | Soustraire le biais moyen de chaque pixel et mesurer le gain de RMSE. |

---

## 2. Corrélation |bias| – nombre d’observations (N)

| Méthode | r(|bias|, N) | Interprétation |
|---------|-------------|----------------|
| MOD09GA | **−0.14** | Les pixels peu vus (N faible) ont tendance à présenter un biais absolu plus grand ; la variance décroît avec N. |
| MOD10A1 | **+0.18** | Tend inverse mais faible ; le lien biais–N est moins marqué. |

> **Implication** : filtrer les pixels avec N < 10 stabilisera surtout MOD09GA ;
> pour MOD10A1 le gain sera marginal.

![scatter](../plots/scatter_bias_vs_N.png)

---

## 3. Pixels les plus biaisés

Les 10 pixels présentant le biais positif le plus élevé (tous MOD09GA) :

| pixel_id | bias | rmse |
|---------:|------:|------:|
| 8416024037 | 0.287 | 0.398 |
| 8414024037 | 0.223 | 0.279 |
| 8416024034 | 0.214 | 0.269 |
| 8416024035 | 0.208 | 0.274 |
| 8417024024 | 0.202 | 0.222 |
| … | … | … |

> Ces pixels se situent tous dans les tuiles sinusoidales 8416–8417 : zones de
> neige/glace persistante ou d’ombrage marqué.

---

## 4. Correction "par pixel"

Formule :
\[\hat A_{\text{corr}}(p,t) = A_{\text{test}}(p,t)\;−\;\overline{\text{bias}_p}\]

| Méthode | RMSE brut | RMSE corrigé | Gain |
|---------|-----------|-------------|-------|
| MOD09GA | 0.1665 | **0.1166** | −30 % |
| MOD10A1 | 0.1490 | **0.1281** | −14 % |

![box](../plots/box_bias_per_pixel.png)

> **Conclusion** : la majeure partie de l'erreur est stationnaire dans l'espace.
> Une simple calibration par pixel réduit fortement le RMSE, surtout pour MOD09GA.

---

## 5. Recommandations

1. **Filtrer** les pixels avec N < 10 pour atténuer l'influence des cas rares.
2. **Appliquer le correctif par pixel** avant toute analyse temporelle ou
   cartographique ; on obtient un RMSE < 0.13 pour les deux méthodes.
3. Examiner la dépendance saisonnière résiduelle ; si nécessaire, ajouter une
   correction par mois (ou par angle solaire).
4. Cartographier les pixels encore fortement biaisés après correction pour
   vérifier des problèmes locaux (topographie, neige résiduelle, ombrage). 