const express = require('express');
const router = express.Router();

const {
  getSlotsByMaster,
  createBooking,
  findBooking,
  cancelBooking
} = require('../controllers/slotsController');


router.post('/find', findBooking);

router.post('/cancel', cancelBooking);

router.post('/', createBooking);

router.get('/:masterName', getSlotsByMaster);


module.exports = router;