const pool = require('./db');

pool.query('SELECT current_user, current_database()')
  .then(result => {
    console.log(result.rows);
    process.exit(0);
  })
  .catch(err => {
    console.error('BŁĄD:', err.message);
    process.exit(1);
  });	
