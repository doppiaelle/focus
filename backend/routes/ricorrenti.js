const crudRouter = require('./crud');

module.exports = crudRouter('ricorrenti', {
  columns: ['descrizione', 'importo', 'categoria', 'frequenza', 'prossima', 'attiva'],
  validate: (body) => {
    if (!body.descrizione) return 'Descrizione richiesta';
    if (body.importo === undefined) return 'Importo richiesto';
    if (!body.frequenza) return 'Frequenza richiesta';
  }
});
