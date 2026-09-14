const crudRouter = require('./crud');

module.exports = crudRouter('eventi', {
  columns: ['titolo', 'data', 'ora', 'luogo', 'tipo', 'note'],
  validate: (body) => {
    if (!body.titolo) return 'Titolo richiesto';
    if (!body.data) return 'Data richiesta';
  }
});
