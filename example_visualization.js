/**
 * Instructions d'utilisation de la visualisation interactive des 3 méthodes
 * 
 * IMPORTANT: La visualisation interactive est maintenant automatiquement 
 * activée quand vous lancez main.js - plus besoin de lancer ce fichier séparément !
 * 
 * Ce fichier sert uniquement de documentation pour comprendre le fonctionnement.
 */

print('=== VISUALISATION INTERACTIVE ACTIVÉE AUTOMATIQUEMENT ===');
print('');
print('La visualisation interactive se lance automatiquement avec main.js');
print('Le widget de sélection de date apparaît en haut à gauche');
print('');
print('=== Instructions d\'utilisation ===');
print('1. Utilisez le slider pour sélectionner une date');
print('2. Les 3 méthodes s\'affichent avec la même palette de couleurs');
print('3. Activez l\'Inspector (onglet à droite)');
print('4. Cliquez sur un pixel pour voir :');
print('   - MOD09GA_albedo : Méthode Ren et al.');
print('   - MOD10A1_albedo : Produit MODIS neige');
print('   - MCD43A3_albedo : Produit BRDF MODIS');
print('   - NDSI : Indice de neige normalisé');
print('   - solar_zenith_deg : Angle solaire en degrés');
print('');
print('Les pixels sont clippés au masque glaciaire (50% abundance)');
print('');
print('=== Utilisation manuelle (si nécessaire) ===');
print('Si vous voulez lancer la visualisation manuellement :');
print('');
print('var comparison = require(\'users/tofunori/MOD09A1_REN_METHOD:modules/workflows/comparison.js\');');
print('var glacierUtils = require(\'users/tofunori/MOD09A1_REN_METHOD:modules/utils/glacier.js\');');
print('var glacierData = glacierUtils.initializeGlacierData();');
print('comparison.createDateVisualizationWidget(glacierData.outlines, glacierData.bounds);');