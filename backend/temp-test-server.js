const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/plan', require('./routes/plan'));
app.listen(5010, () => console.log('ready'));
