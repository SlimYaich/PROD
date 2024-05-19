const { createWorker } = require('./workerUtils');

async function calculatePayments(orders) {
  const paymentTasks = orders.map(order => createWorker({
    type: 'pos.payment',
    model: 'pos.payment',
    method: 'search_read',
    params: [[['id', 'in', order.payment_ids]], ['amount', 'payment_method_id']],
    id: order.id
  }));

  const paymentResults = await Promise.all(paymentTasks);
  let globalPayments = {};

  for (const paymentResult of paymentResults) {
    if (paymentResult.error) {
      console.error(`Erreur lors de la récupération des paiements pour la commande ${paymentResult.id}:`, paymentResult.error);
      continue;
    }

    for (const payment of paymentResult.result) {
      const methodName = payment.payment_method_id[1];
      const amount = payment.amount || 0;
      if (globalPayments[methodName]) {
        globalPayments[methodName] += amount;
      } else {
        globalPayments[methodName] = amount;
      }
    }
  }

  return globalPayments;
}

module.exports = { calculatePayments };
