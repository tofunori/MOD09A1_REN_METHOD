# Analyse de Pixel_Data_2023_analysis

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
![figure](plots/pixel_2023/monthly_rmse.png)
![figure](plots/pixel_2023/hist_MCD43A3.png)
![figure](plots/pixel_2023/monthly_bias.png)
![figure](plots/pixel_2023/scatter_MCD43A3_MOD10A1.png)
![figure](plots/pixel_2023/scatter_MCD43A3_MOD09GA.png)
![figure](plots/pixel_2023/hist_MOD10A1.png)
![figure](plots/pixel_2023/hist_MOD09GA.png)
![figure](plots/pixel_2023/scatter_MOD09GA_MOD10A1.png)
![figure](plots/pixel_2023/hist_MCD43A3.png)
![figure](plots/pixel_2023/hist_MOD09GA.png)
![figure](plots/pixel_2023/hist_MOD10A1.png)
