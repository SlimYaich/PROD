const { createWorker } = require('./workerUtils');

async function calculateOrderLines(orders) {
  const orderLineTasks = orders.map(order => createWorker({
    type: 'pos.order.line',
    model: 'pos.order.line',
    method: 'search_read',
    params: [[['order_id', '=', order.id]], ['product_id', 'qty', 'price_unit', 'price_subtotal']],
    id: order.id
  }));

  const orderLineResults = await Promise.all(orderLineTasks);
  let totalSales = 0;
  let productsSold = [];

  for (const orderLinesResult of orderLineResults) {
    if (orderLinesResult.error) {
      console.error(`Erreur lors de la récupération des lignes de commande pour la commande ${orderLinesResult.id}:`, orderLinesResult.error);
      continue;
    }

    for (const line of orderLinesResult.result) {
      totalSales += line.price_subtotal || 0;
      productsSold.push({
        name: line.product_id[1],
        quantity: line.qty,
        priceUnit: line.price_unit
      });
    }
  }

  return { totalSales, productsSold };
}

module.exports = { calculateOrderLines };
