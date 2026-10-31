const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn, isAdmin, validateListing, validateBooking, validateObjectId, requireListingImage } = require("../middleware.js");


const listingController = require("../controller/listings.js");
const bookingController = require("../controller/bookings.js");
const multer = require("multer");
const { storage } = require("../cloudConfig.js");
const ExpressError = require("../utils/ExpressError.js");

const upload = multer({
    storage,
    limits: { fileSize: 8 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, callback) => {
        const accepted = new Set(["image/jpeg", "image/png", "image/webp"]);
        if (!accepted.has(file.mimetype)) return callback(new ExpressError(415, "Upload a JPG, PNG, or WebP image."));
        callback(null, true);
    },
});



// ------------------------------------------------------------------------------

// Router.route for compacting same path routes.

// Index Route - GET /listings  -> we return all listings 
// Create Route - POST /listings -> via getting req of submit to post the submitted form details to main listings.

router.route("/")
    .get(wrapAsync(listingController.index))
    .post(
        isLoggedIn,
        upload.single('listing[image]'),
        validateListing,
        requireListingImage,
        wrapAsync(listingController.createListing)
    );

router.get("/search-suggestions", wrapAsync(listingController.searchSuggestions));

router.get("/:id/book",
    isLoggedIn,
    validateObjectId("id", "listing"),
    wrapAsync(bookingController.renderCheckout));

router.post("/:id/bookings",
    isLoggedIn,
    validateObjectId("id", "listing"),
    validateBooking,
    wrapAsync(bookingController.createBooking));
    
// ------------------------------------------------------------------------------

// New & Create Route - NEW route feed new doc. which sends a req via Submit(form) button to Create Route.

router.get("/new",
    isLoggedIn,
    listingController.renderNewForm);

// ------------------------------------------------------------------------------

// Show Route - GET /listings/:id -> to read each doc via _id
// Update Route - PUT /listings/:id -> 
// Delete Route - DELETE /listings/:id -> 

router.route("/:id")
    .get(validateObjectId("id", "listing"), wrapAsync(listingController.showListing))
    .put(
        isAdmin,
        validateObjectId("id", "listing"),
        upload.single('listing[image]'),
        validateListing,
        wrapAsync(listingController.updateListing))
    .delete(
        isAdmin,
        validateObjectId("id", "listing"),
        wrapAsync(listingController.destroyListing));

// ------------------------------------------------------------------------------

// Edit & Update Route - GET sends req via edit form via submission to PUT req which update the specific listing.

// Edit Route - GET /listings/:id/edit -> 
router.get("/:id/edit",
    isAdmin,
    validateObjectId("id", "listing"),
    wrapAsync(listingController.renderEditForm));


module.exports = router;
