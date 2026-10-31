const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const { isAdmin, validateObjectId } = require("../middleware.js");
const adminController = require("../controller/admin.js");

router.use(isAdmin);
router.get("/", wrapAsync(adminController.renderDashboard));
router.get("/users", wrapAsync(adminController.renderUsers));
router.get("/users/:id", validateObjectId("id", "user"), wrapAsync(adminController.showUser));
router.get("/listings", wrapAsync(adminController.renderListings));
router.get("/reviews", wrapAsync(adminController.renderReviews));

module.exports = router;
