const crudRouter = require('./crud');

module.exports = crudRouter('buoni_pasto', {
  columns: ['tipo', 'quantita', 'data', 'note'],
  validate: (body) => {
    if (!body.tipo || !['ricarica', 'utilizzo'].includes(body.tipo)) return 'Tipo deve essere ricarica o utilizzo';
    if (!body.data) return 'Data richiesta';
  }
});
