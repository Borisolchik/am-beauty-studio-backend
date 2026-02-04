const express = require('express');
const router = express.Router();
const { getSlotsByMaster, createBooking } = require('../controllers/slotsController');

router.post('/', createBooking);
router.get('/:masterName', getSlotsByMaster);
router.get('/admin/:masterId/slots', getSlotsByMasterId);
router.patch('/toggle', toggleSlotByMaster);

module.exports = router;
