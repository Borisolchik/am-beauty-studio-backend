const express = require('express');
const cors = require('cors');
require('dotenv').config();

const servicesRouter = require('./src/routes/services');
const mastersRouter = require('./src/routes/masters');
const slotsRouter = require('./src/routes/slots');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/services', servicesRouter);
app.use('/api/masters', mastersRouter);
app.use('/api/slots', slotsRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
