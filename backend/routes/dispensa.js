const crudRouter = require('./crud');

module.exports = crudRouter('dispensa', {
  columns: ['nome', 'quantita', 'unita'],
  validate: (body) => {
    if (!body.nome) return 'Nome prodotto richiesto';
  }
});
