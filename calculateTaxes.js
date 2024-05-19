const { createWorker } = require('./workerUtils');

async function calculateTaxes(orders) {
  const taxTasks = orders.map(order => createWorker({
    type: 'account.tax',
    model: 'account.tax',
    method: 'search_read',
    params: [[['id', 'in', order.tax_ids]], ['name', 'amount', 'amount_total']],
    id: order.id
  }));

  const taxResults = await Promise.all(taxTasks);
  let globalTaxes = {};

  for (const taxResult of taxResults) {
    if (taxResult.error) {
      console.error(`Erreur lors de la récupération des taxes pour la commande ${taxResult.id}:`, taxResult.error);
      continue;
    }

    for (const tax of taxResult.result) {
      if (globalTaxes[tax.name]) {
        globalTaxes[tax.name].amount += tax.amount;
        globalTaxes[tax.name].base += tax.amount_total;
      } else {
        globalTaxes[tax.name] = {
          amount: tax.amount,
          base: tax.amount_total
        };
      }
    }
  }

  return globalTaxes;
}

module.exports = { calculateTaxes };
