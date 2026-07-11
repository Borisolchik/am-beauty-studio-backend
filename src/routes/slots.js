const express = require('express');
const router = express.Router();

const {
  getSlotsByMaster,
  createBooking,
  findBooking
} = require('../controllers/slotsController');


router.get('/:masterName', getSlotsByMaster);

router.post('/find', findBooking);

router.post('/', createBooking);


module.exports = router;