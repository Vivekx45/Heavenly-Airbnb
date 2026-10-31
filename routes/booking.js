const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn, validateObjectId } = require("../middleware.js");
const bookingController = require("../controller/bookings.js");

router.get("/", isLoggedIn, wrapAsync(bookingController.renderBookings));
router.get("/:id", isLoggedIn, validateObjectId("id", "booking"), wrapAsync(bookingController.showBooking));
router.post("/:id/cancel", isLoggedIn, validateObjectId("id", "booking"), wrapAsync(bookingController.cancelBooking));

module.exports = router;
