/**
 * Exemple d'utilisation de la visualisation interactive des 3 méthodes
 * 
 * Ce script démontre comment utiliser le widget de sélection de date
 * pour comparer visuellement les variations spatiales des pixels d'albédo
 * entre les 3 méthodes : MOD09GA (Ren), MOD10A1, et MCD43A3
 */

// Imports
var comparison = require('users/tofunori/MOD09A1_REN_METHOD:modules/workflows/comparison.js');
var glacierUtils = require('users/tofunori/MOD09A1_REN_METHOD:modules/utils/glacier.js');

// Initialiser les données glaciaires
var glacierData = glacierUtils.initializeGlacierData();
var glacierOutlines = glacierData.outlines;
var region = glacierData.bounds;

// Créer le widget de visualisation interactive
comparison.createDateVisualizationWidget(glacierOutlines, region);

// Instructions d'utilisation
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