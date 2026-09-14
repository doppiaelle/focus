const crudRouter = require('./crud');

module.exports = crudRouter('transazioni', {
  columns: ['importo', 'tipo', 'categoria', 'descrizione', 'data'],
  validate: (body) => {
    if (body.importo === undefined) return 'Importo richiesto';
    if (!body.tipo || !['entrata', 'uscita'].includes(body.tipo)) return 'Tipo deve essere entrata o uscita';
    if (!body.data) return 'Data richiesta';
  }
});
