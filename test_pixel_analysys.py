import pandas as pd, numpy as np
from scipy.stats import pearsonr

df = pd.read_csv("data/weekly_pixels_test.csv")

print("Total lignes :", len(df))
print("\nPixels par date :")
print(df.groupby("date").size())

print("\nPixels par méthode :")
print(df.groupby("method").size())

# Pivot commun aux trois méthodes
pivot = (df.pivot_table(index="pixel_id",
                        columns="method",
                        values="albedo_value",
                        aggfunc="first")
           .dropna())

print("\nPixels communs aux 3 méthodes :", len(pivot))

# Corrélations
meths = pivot.columns
for i, m1 in enumerate(meths):
    for m2 in meths[i+1:]:
        r, p = pearsonr(pivot[m1], pivot[m2])
        diff = pivot[m1] - pivot[m2]
        rmse = np.sqrt(np.mean(diff**2))
        print(f"{m1} vs {m2}: r={r:.3f}, RMSE={rmse:.4f}")