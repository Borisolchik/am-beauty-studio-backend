const express = require('express');
const router = express.Router();
const { getAllMasters } = require('../controllers/mastersController'); // новая функция

// маршрут GET /api/masters
router.get('/', getAllMasters); // ✅ теперь без serviceId

module.exports = router;
