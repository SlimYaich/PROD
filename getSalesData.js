const xmlrpc = require('xmlrpc');

const odoo = xmlrpc.createSecureClient({
    host: 'test.kcatering.sa',
    port: 443,
    path: '/xmlrpc/2/object'
});

async function listDatabaseModels() {
    return new Promise((resolve, reject) => {
        odoo.methodCall('execute_kw', [
            'kcdbmars282024',  // Nom de la base de données
            1086,              // UID de l'utilisateur
            '6b326e1c71cdef29626b039b1166d6314b7acb0f', // Clé API
            'ir.model',        // Modèle ir.model pour lister les modèles de base de données
            'search_read',     // Méthode pour lire les enregistrements
            [[], ['model', 'name']], // Pas de filtres spécifiques, récupération des champs 'model' et 'name'
        ], function (error, models) {
            if (error) {
                console.error('Error fetching models:', error);
                reject(error);
            } else {
                console.log('Database Models:', models);
                resolve(models);
            }
        });
    });
}

listDatabaseModels();
