const express = require('express');
const router = express.Router();
const { getSlotsByMaster, createBooking } = require('../controllers/slotsController');

router.get('/:masterName', getSlotsByMaster);
router.post('/', createBooking);

module.exports = router;
