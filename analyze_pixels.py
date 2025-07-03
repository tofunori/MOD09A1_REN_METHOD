import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats

# Lire le fichier CSV
df = pd.read_csv("data/weekly_pixels_test.csv")

# Afficher les informations de base
print("Dataset shape:", df.shape)
print("\nColonnes:", df.columns.tolist())
print("\nMethodes uniques:", df['method'].unique())
print("\nNombre de pixels par méthode:")
print(df['method'].value_counts())

# Examiner les données plus en détail
print("\nExamen des pixel_id et des doublons:")
print("Valeurs uniques de pixel_id:", df['pixel_id'].unique())
print("Nombre de lignes par pixel_id et méthode:")
print(df.groupby(['pixel_id', 'method']).size().head(20))

# Créer un identifiant unique basé sur les coordonnées
df['unique_pixel_id'] = df['latitude'].round(6).astype(str) + '_' + df['longitude'].round(6).astype(str)

# Identifier les pixels communs
unique_pixels = df['unique_pixel_id'].unique()
print(f"\nNombre total de pixels uniques (basé sur coordonnées): {len(unique_pixels)}")

# Créer un pivot pour analyser les mêmes pixels
try:
    pivot_data = df.pivot_table(index='unique_pixel_id', columns='method', values='albedo_value', aggfunc='first')
    print("\nPixels avec données pour les 3 méthodes:")
    complete_pixels = pivot_data.dropna()
    print(f"Nombre de pixels complets: {len(complete_pixels)}")
except Exception as e:
    print(f"Erreur lors du pivot: {e}")
    # Alternative: utiliser groupby
    complete_pixels = None
    print("Utilisation d'une approche alternative...")

# Statistiques descriptives par méthode
print("\n=== STATISTIQUES DESCRIPTIVES PAR MÉTHODE ===")
for method in df['method'].unique():
    data = df[df['method'] == method]['albedo_value']
    print(f"\n{method}:")
    print(f"  Moyenne: {data.mean():.4f}")
    print(f"  Médiane: {data.median():.4f}")
    print(f"  Écart-type: {data.std():.4f}")
    print(f"  Min: {data.min():.4f}")
    print(f"  Max: {data.max():.4f}")
    print(f"  Nombre de valeurs: {len(data)}")

# Analyse des pixels communs seulement
if complete_pixels is not None and len(complete_pixels) > 0:
    print("\n=== ANALYSE DES PIXELS COMMUNS ===")
    print(f"Nombre de pixels avec données pour les 3 méthodes: {len(complete_pixels)}")
    
    # Statistiques sur les pixels communs
    for method in complete_pixels.columns:
        data = complete_pixels[method]
        print(f"\n{method} (pixels communs):")
        print(f"  Moyenne: {data.mean():.4f}")
        print(f"  Médiane: {data.median():.4f}")
        print(f"  Écart-type: {data.std():.4f}")
        print(f"  Min: {data.min():.4f}")
        print(f"  Max: {data.max():.4f}")
    
    # Corrélations entre méthodes
    print("\n=== CORRÉLATIONS ENTRE MÉTHODES ===")
    correlation_matrix = complete_pixels.corr()
    print(correlation_matrix)
    
    # Tests de corrélation
    methods = complete_pixels.columns.tolist()
    for i, method1 in enumerate(methods):
        for method2 in methods[i+1:]:
            corr, p_value = stats.pearsonr(complete_pixels[method1], complete_pixels[method2])
            print(f"\nCorrélation {method1} vs {method2}:")
            print(f"  Pearson r: {corr:.4f}")
            print(f"  p-value: {p_value:.6f}")
    
    # Différences entre méthodes
    print("\n=== DIFFÉRENCES ENTRE MÉTHODES ===")
    if 'MOD09GA' in methods and 'MOD10A1' in methods:
        diff_09ga_10a1 = complete_pixels['MOD09GA'] - complete_pixels['MOD10A1']
        print(f"MOD09GA - MOD10A1:")
        print(f"  Différence moyenne: {diff_09ga_10a1.mean():.4f}")
        print(f"  Écart-type des différences: {diff_09ga_10a1.std():.4f}")
        print(f"  RMSE: {np.sqrt(np.mean(diff_09ga_10a1**2)):.4f}")
    
    if 'MOD09GA' in methods and 'MCD43A3' in methods:
        diff_09ga_mcd = complete_pixels['MOD09GA'] - complete_pixels['MCD43A3']
        print(f"\nMOD09GA - MCD43A3:")
        print(f"  Différence moyenne: {diff_09ga_mcd.mean():.4f}")
        print(f"  Écart-type des différences: {diff_09ga_mcd.std():.4f}")
        print(f"  RMSE: {np.sqrt(np.mean(diff_09ga_mcd**2)):.4f}")
    
    if 'MOD10A1' in methods and 'MCD43A3' in methods:
        diff_10a1_mcd = complete_pixels['MOD10A1'] - complete_pixels['MCD43A3']
        print(f"\nMOD10A1 - MCD43A3:")
        print(f"  Différence moyenne: {diff_10a1_mcd.mean():.4f}")
        print(f"  Écart-type des différences: {diff_10a1_mcd.std():.4f}")
        print(f"  RMSE: {np.sqrt(np.mean(diff_10a1_mcd**2)):.4f}")

# Graphiques de comparaison
plt.figure(figsize=(15, 10))

# Histogrammes par méthode
plt.subplot(2, 3, 1)
for method in df['method'].unique():
    data = df[df['method'] == method]['albedo_value']
    plt.hist(data, alpha=0.7, label=method, bins=30)
plt.xlabel('Albedo Value')
plt.ylabel('Fréquence')
plt.title('Distribution des valeurs d\'albédo par méthode')
plt.legend()

# Boxplot
plt.subplot(2, 3, 2)
df.boxplot(column='albedo_value', by='method', ax=plt.gca())
plt.title('Boxplot des valeurs d\'albédo par méthode')
plt.ylabel('Albedo Value')

# Scatter plots pour pixels communs si disponibles
if complete_pixels is not None and len(complete_pixels) > 0 and len(complete_pixels.columns) >= 2:
    methods = complete_pixels.columns.tolist()
    
    # MOD09GA vs MOD10A1
    if 'MOD09GA' in methods and 'MOD10A1' in methods:
        plt.subplot(2, 3, 3)
        plt.scatter(complete_pixels['MOD09GA'], complete_pixels['MOD10A1'], alpha=0.6)
        plt.plot([0, 1], [0, 1], 'r--', label='1:1 line')
        plt.xlabel('MOD09GA')
        plt.ylabel('MOD10A1')
        plt.title('MOD09GA vs MOD10A1')
        plt.legend()
    
    # MOD09GA vs MCD43A3
    if 'MOD09GA' in methods and 'MCD43A3' in methods:
        plt.subplot(2, 3, 4)
        plt.scatter(complete_pixels['MOD09GA'], complete_pixels['MCD43A3'], alpha=0.6)
        plt.plot([0, 1], [0, 1], 'r--', label='1:1 line')
        plt.xlabel('MOD09GA')
        plt.ylabel('MCD43A3')
        plt.title('MOD09GA vs MCD43A3')
        plt.legend()
    
    # MOD10A1 vs MCD43A3
    if 'MOD10A1' in methods and 'MCD43A3' in methods:
        plt.subplot(2, 3, 5)
        plt.scatter(complete_pixels['MOD10A1'], complete_pixels['MCD43A3'], alpha=0.6)
        plt.plot([0, 1], [0, 1], 'r--', label='1:1 line')
        plt.xlabel('MOD10A1')
        plt.ylabel('MCD43A3')
        plt.title('MOD10A1 vs MCD43A3')
        plt.legend()

# Matrice de corrélation
if complete_pixels is not None and len(complete_pixels) > 0:
    plt.subplot(2, 3, 6)
    sns.heatmap(correlation_matrix, annot=True, cmap='coolwarm', center=0, 
                square=True, fmt='.3f')
    plt.title('Matrice de corrélation')

plt.tight_layout()
plt.savefig('/home/tofunori/Projects/MOD09A1_REN_METHOD/comparison_three_methods.png', dpi=300, bbox_inches='tight')
plt.show()

print("\nGraphiques sauvegardés dans 'comparison_three_methods.png'")