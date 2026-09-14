const crudRouter = require('./crud');

module.exports = crudRouter('messages', {
  columns: ['role', 'content', 'timestamp'],
  validate: (body) => {
    if (!body.role) return 'Role richiesto';
    if (!body.content) return 'Content richiesto';
  }
});
