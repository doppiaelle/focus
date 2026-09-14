const crudRouter = require('./crud');

module.exports = crudRouter('scadenze', {
  columns: ['titolo', 'data', 'completata', 'note'],
  validate: (body) => {
    if (!body.titolo) return 'Titolo richiesto';
    if (!body.data) return 'Data richiesta';
  }
});
