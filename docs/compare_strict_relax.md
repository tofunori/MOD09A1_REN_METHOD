# Comparatif des filtres QA – Strict vs Relaxé (MOD09GA)

| Indicateur | Strict | Relaxé | Δ |
|------------|-------:|-------:|----|
| Mesures totales (lignes CSV) | **18 359** | **24 176** | × 1,32 |
| Observations complètes (3 méthodes) | 2 934 | 3 204 | +9 % |
| Pixels distincts (MOD09GA) | 90 | 90 | — |
| RMSE corrigé MOD09GA | 0.1166 | 0.1215 | +0.0049 |
| RMSE corrigé MOD10A1 | 0.1281 | 0.1343 | +0.0062 |
| Biais global MOD09GA | -0.092 | -0.097 | -0.005 |
| Corrélation bias–N (MOD09GA) | -0.14 | -0.23 | plus forte |

## Lecture rapide
* **Couverture** : +30 % de mesures et +9 % d’intersections grâce au masque relaxé.
* **Précision** : le RMSE corrigé augmente de ≈ 0.005 (4 %) mais reste ≤ 0.122.
* **Pixels** : nombre de `pixel_id` identiques (90) – on gagne donc des dates, pas de nouveaux pixels.
* **Impact** : avantage net si votre seuil d’erreur cible est 0.13.

## Recommandation
Conserver le masque relaxé ; appliquer :
1. Filtre `N ≥ 10` par pixel.
2. Exclure observations SZA > 55 ° pour analyses fines.
3. Correction par pixel, éventuellement corriger l’effet altitude.

Ainsi, vous maximisez la couverture tout en gardant une précision < 0.12 suffisante pour détecter le noircissement dû aux feux de forêt. 