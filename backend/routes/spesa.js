const crudRouter = require('./crud');

module.exports = crudRouter('spesa', {
  columns: ['nome', 'quantita', 'unita', 'completato', 'ordine', 'data_aggiunta', 'data_completato'],
  validate: (body) => {
    if (!body.nome) return 'Nome prodotto richiesto';
  }
});
