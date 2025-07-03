# Analyse de report

## Vue d'ensemble
- Mesures totales : **18,359**

### Pixels distincts
- MCD43A3 : 115
- MOD09GA : 90
- MOD10A1 : 115

## Statistiques descriptives
| method   |   count |   mean |    std |     min |    25% |    50% |    75% |    max |
|:---------|--------:|-------:|-------:|--------:|-------:|-------:|-------:|-------:|
| MCD43A3  |    7742 | 0.3228 | 0.0963 |  0.109  | 0.244  | 0.325  | 0.39   | 0.845  |
| MOD09GA  |    4779 | 0.4768 | 0.1891 | -0.0094 | 0.3321 | 0.4756 | 0.6201 | 1.3999 |
| MOD10A1  |    5838 | 0.4331 | 0.1811 |  0      | 0.29   | 0.44   | 0.58   | 1      |

## Corrélations / Bias / RMSE (global)
| pair               |    N |     r |   bias |   rmse |
|:-------------------|-----:|------:|-------:|-------:|
| MCD43A3 vs MOD09GA | 2934 | 0.643 | -0.092 |  0.166 |
| MCD43A3 vs MOD10A1 | 2934 | 0.55  | -0.069 |  0.149 |
| MOD09GA vs MOD10A1 | 2934 | 0.876 |  0.023 |  0.088 |

## Biais & RMSE mensuels (vs MCD43A3)
|   month | method   |    N |   bias |   rmse |
|--------:|:---------|-----:|-------:|-------:|
|       6 | MOD09GA  |   82 | -0.002 |  0.076 |
|       6 | MOD10A1  |   82 |  0.007 |  0.069 |
|       7 | MOD09GA  |  876 |  0.1   |  0.154 |
|       7 | MOD10A1  |  876 |  0.068 |  0.123 |
|       8 | MOD09GA  | 1198 |  0.059 |  0.115 |
|       8 | MOD10A1  | 1198 |  0.028 |  0.097 |
|       9 | MOD09GA  |  778 |  0.145 |  0.238 |
|       9 | MOD10A1  |  778 |  0.139 |  0.227 |

## Figures
![figure](plots/box_bias_per_pixel.png)
![figure](plots/monthly_counts.png)
![figure](plots/monthly_rmse.png)
![figure](plots/hist_MCD43A3.png)
![figure](plots/scatter_bias_vs_elev.png)
![figure](plots/monthly_bias.png)
![figure](plots/scatter_MCD43A3_MOD10A1.png)
![figure](plots/scatter_MCD43A3_MOD09GA.png)
![figure](plots/scatter_bias_vs_sza.png)
![figure](plots/hist_MOD10A1.png)
![figure](plots/scatter_bias_vs_N.png)
![figure](plots/hist_MOD09GA.png)
![figure](plots/scatter_MOD09GA_MOD10A1.png)
![figure](plots/hist_MCD43A3.png)
![figure](plots/hist_MOD09GA.png)
![figure](plots/hist_MOD10A1.png)
![figure](plots/box_bias_per_pixel.png)
![figure](plots/monthly_counts.png)
![figure](plots/scatter_bias_vs_N.png)
![figure](plots/scatter_bias_vs_sza.png)
![figure](plots/scatter_bias_vs_elev.png)

## Fichier métriques par pixel
Export CSV : `plots/per_pixel_metrics.csv`

### Pixels avec biais le plus élevé
|   pixel_id | method   |   bias |   rmse |
|-----------:|:---------|-------:|-------:|
| 8416024037 | MOD09GA  |  0.287 |  0.398 |
| 8414024037 | MOD09GA  |  0.223 |  0.279 |
| 8416024034 | MOD09GA  |  0.214 |  0.269 |
| 8416024035 | MOD09GA  |  0.208 |  0.274 |
| 8417024024 | MOD09GA  |  0.202 |  0.222 |
| 8416024026 | MOD09GA  |  0.189 |  0.204 |
| 8416024028 | MOD09GA  |  0.188 |  0.224 |
| 8419024022 | MOD09GA  |  0.187 |  0.231 |
| 8418024030 | MOD09GA  |  0.185 |  0.261 |
| 8418024022 | MOD09GA  |  0.185 |  0.224 |

### Corrélation |bias| – N
| method   |   r_bias_N |
|:---------|-----------:|
| MOD09GA  |     -0.138 |
| MOD10A1  |      0.179 |

### Impact de la correction par pixel
| method   |   rmse_raw |   rmse_corr |
|:---------|-----------:|------------:|
| MOD09GA  |     0.1665 |      0.1166 |
| MOD10A1  |     0.149  |      0.1281 |

## Influence de l'angle solaire (MOD09GA)
Corrélation bias–SZA : **r = 0.17**

| sza_bin   |   count |    mean |     std |
|:----------|--------:|--------:|--------:|
| (0, 30]   |       4 |  -0.096 |   0.035 |
| (30, 40]  |    1360 |   0.074 |   0.113 |
| (40, 50]  |    1319 |   0.085 |   0.115 |
| (50, 60]  |     515 |   0.161 |   0.206 |
| (60, 90]  |       0 | nan     | nan     |

## Influence de l'élévation
| method   |   r_bias_elev |
|:---------|--------------:|
| MOD09GA  |         0.562 |
| MOD10A1  |         0.584 |