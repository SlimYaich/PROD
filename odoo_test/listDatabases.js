const xmlrpc = require('xmlrpc');

// Client pour lister les bases de données
const odooDbList = xmlrpc.createSecureClient({
    host: 'test.kcatering.sa',
    port: 443,
    path: '/xmlrpc/2/db'
});

odooDbList.methodCall('list', [], function(error, value) {
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Available Databases:', value);
    }
});
