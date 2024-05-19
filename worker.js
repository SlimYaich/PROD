const { parentPort, workerData } = require('worker_threads');
const xmlrpc = require('xmlrpc');
require('dotenv').config();

const host = process.env.ODOO_HOST || 'lms.kcatering.sa';
const dbName = process.env.ODOO_DB_NAME || 'DBPROD';
const userId = process.env.ODOO_USER_ID || 662;
const password = process.env.ODOO_PASSWORD || 'a68d8b2dca751b38c66bfc8c0f9293eb4b3edc24';

const client = xmlrpc.createSecureClient({
  url: `https://${host}/xmlrpc/2/object`
});

async function execute_rpc(model, method, params, retryCount = 3) {
  return new Promise((resolve, reject) => {
    client.methodCall('execute_kw', [dbName, userId, password, model, method, params], (error, value) => {
      if (error) {
        if (retryCount > 0) {
          console.warn(`Retrying... (${retryCount - 1} attempts left)`);
          return resolve(execute_rpc(model, method, params, retryCount - 1));
        } else {
          console.error('Erreur lors de l\'exécution de la méthode:', error);
          return reject(error);
        }
      }
      resolve(value);
    });
  });
}

(async () => {
  try {
    let result;
    switch (workerData.type) {
      case 'pos.order':
        result = await execute_rpc(workerData.model, workerData.method, workerData.params);
        break;
      case 'pos.payment':
        result = await execute_rpc(workerData.model, workerData.method, workerData.params);
        break;
      case 'account.tax':
        result = await execute_rpc(workerData.model, workerData.method, workerData.params);
        break;
      case 'pos.order.line':
        result = await execute_rpc(workerData.model, workerData.method, workerData.params);
        break;
      default:
        throw new Error(`Unknown task type: ${workerData.type}`);
    }
    console.log(`Data for ${workerData.model} with params ${JSON.stringify(workerData.params)}: ${JSON.stringify(result)}`);
    parentPort.postMessage({ id: workerData.id, result });
  } catch (error) {
    console.error(`Erreur lors de la récupération des données pour ${workerData.model} avec params ${JSON.stringify(workerData.params)}: ${error.message}`);
    parentPort.postMessage({ id: workerData.id, error: error.message });
  }
})();
