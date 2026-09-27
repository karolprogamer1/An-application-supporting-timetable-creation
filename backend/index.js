const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Log all incoming requests for debugging
app.use((req, res, next) => {
  try {
    console.log('[HTTP]', req.method, req.originalUrl || req.url)
  } catch (e) {
    // ignore
  }
  next()
})

// Trasy
app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/zajecia'));
app.use('/api', require('./routes/wykladowca'));
app.use('/api', require('./routes/uzytkownicy'));
app.use('/api', require('./routes/student'));
app.use('/api', require('./routes/przedmiot'));
app.use('/api', require('./routes/grupa'));
app.use('/api/plan/', require('./routes/plan'));
app.use('/api', require('./routes/availability'));
app.use('/api', require('./routes/sala'));
app.use('/api', require('./routes/sale'))
app.use('/api', require('./routes/slots'))
app.use('/api', require('./routes/planista'));
// (routes/sale.js is obsolete; sala.js is the single CRUD source for rooms)
// app.use('/api', require('./routes/sale'));
app.get('/', (req, res) => {
    res.json({ message: 'Backend dzia�a!' });
});

// 404 dla nieznanych tras
app.use((req, res) => {
  res.status(404).json({ message: 'Nie znaleziono zasobu' });
});

// Obsługa błędów parsowania JSON
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ message: 'Nieprawidłowy format JSON' });
  }
  next(err);
});

// Globalny error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Wewnętrzny błąd serwera' });
});

app.listen(PORT, () => {
  console.log(`Serwer działa na porcie ${PORT}`);
});
