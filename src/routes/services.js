const express = require('express');
const router = express.Router();
const { getServicesByMaster } = require('../controllers/servicesController');

router.get('/by-master/:masterId', getServicesByMaster);

module.exports = router;
