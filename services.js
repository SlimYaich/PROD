const { Worker } = require('worker_threads');
const xmlrpc = require('xmlrpc');
const path = require('path');
require('dotenv').config();

const { calculatePayments } = require('./calculatePayments');
const { calculateTaxes } = require('./calculateTaxes');
const { calculateOrderLines } = require('./calculateOrderLines');

const host = process.env.ODOO_HOST || 'lms.kcatering.sa';
const dbName = process.env.ODOO_DB_NAME || 'DBPROD';
const userId = process.env.ODOO_USER_ID || 662;
const password = process.env.ODOO_PASSWORD || 'a68d8b2dca751b38c66bfc8c0f9293eb4b3edc24';

const client = xmlrpc.createSecureClient({
  url: `https://${host}/xmlrpc/2/object`
});

function createWorker(task) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.resolve(__dirname, 'worker.js'), { workerData: task });
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}

function execute_rpc(model, method, params, retryCount = 3) {
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

function chunkArray(array, size) {
  const chunkedArr = [];
  for (let i = 0; i < array.length; i += size) {
    chunkedArr.push(array.slice(i, i + size));
  }
  return chunkedArr;
}

async function getTotalSalesAndPassengers(socket, startDate, endDate) {
  const formatDate = (date) => {
    const d = new Date(date);
    return d.toISOString().split('T')[0] + ' 00:00:00';
  };

  if (!startDate || !endDate) {
    console.error('Invalid date range');
    return;
  }

  startDate = formatDate(startDate);
  endDate = formatDate(endDate);

  console.log(`Fetching POS configurations between ${startDate} and ${endDate}`);
  
  try {
    const posConfigs = await execute_rpc('pos.config', 'search_read', [[], ['id', 'name', 'branch_id']]);
    console.log(`POS configurations fetched: ${JSON.stringify(posConfigs)}`);

    const posSalesData = [];
    const tasks = posConfigs.map((posConfig, index) => {
      const task = {
        type: 'pos.order',
        model: 'pos.order',
        method: 'search_read',
        params: [
          [['config_id', '=', posConfig.id], ['date_order', '>=', startDate], ['date_order', '<=', endDate]], ['id', 'payment_ids', 'amount_tax', 'amount_total', 'brand_id']
        ],
        id: index
      };
      return createWorker(task).then(result => ({ posConfig, result }));
    });

    const results = await Promise.all(tasks);

    let globalPayments = {};
    let globalTaxes = {};
    let totalSalesByBrand = {};
    let finalTotalAfterTaxes = 0;

    const calculationTasks = results.map(async ({ posConfig, result }) => {
      if (result.error) {
        console.error('Erreur lors de la récupération des commandes:', result.error);
        return;
      }
      const orders = result.result;
      const orderChunks = chunkArray(orders, 50);

      for (const orderChunk of orderChunks) {
        const [orderLines, payments, taxes] = await Promise.all([
          calculateOrderLines(orderChunk),
          calculatePayments(orderChunk),
          calculateTaxes(orderChunk)
        ]);

        const { totalSales, productsSold } = orderLines;

        for (const order of orderChunk) {
          const brandName = order.brand_id[1];
          const amountTotal = order.amount_total || 0;
          if (totalSalesByBrand[brandName]) {
            totalSalesByBrand[brandName] += amountTotal;
          } else {
            totalSalesByBrand[brandName] = amountTotal;
          }
        }

        const totalAfterTaxes = totalSales + (Object.values(taxes).reduce((acc, tax) => acc + tax.amount, 0));
        finalTotalAfterTaxes += totalAfterTaxes;

        posSalesData.push({
          posName: posConfig.name,
          totalSales,
          totalPassengers: orders.length,
          totalAfterTaxes,
          productsSold,
          payments,
          taxes
        });

        globalPayments = { ...globalPayments, ...payments };
        globalTaxes = { ...globalTaxes, ...taxes };
      }
    });

    await Promise.all(calculationTasks);

    console.log('Résultats pour chaque point de vente :', JSON.stringify(posSalesData, null, 2));
    console.log('Global Payments:', JSON.stringify(globalPayments, null, 2));
    console.log('Global Taxes:', JSON.stringify(globalTaxes, null, 2));
    console.log('Total Sales by Brand:', JSON.stringify(totalSalesByBrand, null, 2));
    console.log('Final Total After Taxes:', finalTotalAfterTaxes);

    socket.emit('salesUpdate', { posSalesData, globalPayments, globalTaxes, totalSalesByBrand, finalTotalAfterTaxes });

  } catch (error) {
    console.error('Erreur lors de la récupération des configurations de points de vente :', error);
  }
}

module.exports = { getTotalSalesAndPassengers };
