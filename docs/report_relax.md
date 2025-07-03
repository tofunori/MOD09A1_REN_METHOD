# Analyse de report_relax

## Vue d'ensemble
- Mesures totales : **24,176**

### Pixels distincts
- MCD43A3 : 115
- MOD09GA : 90
- MOD10A1 : 115

## Statistiques descriptives
| method   |   count |   mean |    std |     min |    25% |    50% |    75% |    max |
|:---------|--------:|-------:|-------:|--------:|-------:|-------:|-------:|-------:|
| MCD43A3  |    7742 | 0.3228 | 0.0963 |  0.109  | 0.244  | 0.325  | 0.39   | 0.845  |
| MOD09GA  |   10596 | 0.549  | 0.2165 | -0.0094 | 0.3917 | 0.5559 | 0.7008 | 1.6324 |
| MOD10A1  |    5838 | 0.4331 | 0.1811 |  0      | 0.29   | 0.44   | 0.58   | 1      |

## Corrélations / Bias / RMSE (global)
| pair               |    N |     r |   bias |   rmse |
|:-------------------|-----:|------:|-------:|-------:|
| MCD43A3 vs MOD09GA | 3204 | 0.631 | -0.097 |  0.173 |
| MCD43A3 vs MOD10A1 | 3204 | 0.534 | -0.069 |  0.155 |
| MOD09GA vs MOD10A1 | 3204 | 0.834 |  0.028 |  0.104 |

## Biais & RMSE mensuels (vs MCD43A3)
|   month | method   |    N |   bias |   rmse |
|--------:|:---------|-----:|-------:|-------:|
|       6 | MOD09GA  |   91 |  0.003 |  0.071 |
|       6 | MOD10A1  |   91 |  0.005 |  0.07  |
|       7 | MOD09GA  |  937 |  0.098 |  0.154 |
|       7 | MOD10A1  |  937 |  0.06  |  0.125 |
|       8 | MOD09GA  | 1263 |  0.063 |  0.122 |
|       8 | MOD10A1  | 1263 |  0.025 |  0.097 |
|       9 | MOD09GA  |  913 |  0.152 |  0.243 |
|       9 | MOD10A1  |  913 |  0.146 |  0.235 |

## Figures
![figure](plots/pixel_2023_relax/monthly_rmse.png)
![figure](plots/pixel_2023_relax/monthly_bias.png)
![figure](plots/pixel_2023_relax/scatter_MCD43A3_MOD10A1.png)
![figure](plots/pixel_2023_relax/scatter_MCD43A3_MOD09GA.png)
![figure](plots/pixel_2023_relax/scatter_MOD09GA_MOD10A1.png)
![figure](plots/pixel_2023_relax/hist_MCD43A3.png)
![figure](plots/pixel_2023_relax/hist_MOD09GA.png)
![figure](plots/pixel_2023_relax/hist_MOD10A1.png)
![figure](plots/pixel_2023_relax/box_bias_per_pixel.png)
![figure](plots/pixel_2023_relax/monthly_counts.png)
![figure](plots/pixel_2023_relax/scatter_bias_vs_N.png)
![figure](plots/pixel_2023_relax/scatter_bias_vs_sza.png)
![figure](plots/pixel_2023_relax/scatter_bias_vs_elev.png)

## Fichier métriques par pixel
Export CSV : `plots/pixel_2023_relax/per_pixel_metrics.csv`

### Pixels avec biais le plus élevé
|   pixel_id | method   |   bias |   rmse |
|-----------:|:---------|-------:|-------:|
| 8416024037 | MOD09GA  |  0.282 |  0.381 |
| 8416024034 | MOD09GA  |  0.229 |  0.283 |
| 8414024037 | MOD09GA  |  0.223 |  0.279 |
| 8416024035 | MOD09GA  |  0.213 |  0.274 |
| 8417024024 | MOD09GA  |  0.203 |  0.224 |
| 8416024028 | MOD09GA  |  0.202 |  0.239 |
| 8415024035 | MOD09GA  |  0.201 |  0.267 |
| 8418024022 | MOD09GA  |  0.201 |  0.239 |
| 8419024021 | MOD09GA  |  0.199 |  0.244 |
| 8417024031 | MOD09GA  |  0.199 |  0.267 |

### Corrélation |bias| – N
| method   |   r_bias_N |
|:---------|-----------:|
| MOD09GA  |     -0.225 |
| MOD10A1  |      0.193 |

### Impact de la correction par pixel
| method   |   rmse_raw |   rmse_corr |
|:---------|-----------:|------------:|
| MOD09GA  |     0.1727 |      0.1215 |
| MOD10A1  |     0.1554 |      0.1343 |

## Influence de l'angle solaire (MOD09GA)
Corrélation bias–SZA : **r = 0.18**

| sza_bin   |   count |    mean |     std |
|:----------|--------:|--------:|--------:|
| (0, 30]   |      16 |  -0.011 |   0.083 |
| (30, 40]  |    2434 |   0.142 |   0.166 |
| (40, 50]  |    2405 |   0.144 |   0.161 |
| (50, 60]  |    1272 |   0.227 |   0.209 |
| (60, 90]  |       0 | nan     | nan     |

## Influence de l'élévation
| method   |   r_bias_elev |
|:---------|--------------:|
| MOD09GA  |         0.574 |
| MOD10A1  |         0.679 |