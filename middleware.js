const mongoose = require("mongoose");
const Listing = require("./models/listing.js");
const Review = require("./models/review.js");
const { listingSchema, reviewSchema, signupSchema, loginSchema, bookingSchema } = require("./schema.js");
const ExpressError = require("./utils/ExpressError.js");
const isConfiguredAdmin = require("./utils/adminAccess.js");

module.exports.isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.session.redirectUrl = req.originalUrl;
        req.flash("error", "Log in to continue.");
        return res.redirect("/login");
    }
    next();
};

module.exports.saveRedirectUrl = (req, res, next) => {
    if (req.session.redirectUrl) res.locals.redirectUrl = req.session.redirectUrl;
    next();
};

module.exports.validateObjectId = (parameter, label = "record") => (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params[parameter])) {
        return next(new ExpressError(400, `Invalid ${label} ID.`));
    }
    next();
};

module.exports.isOwner = async (req, res, next) => {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return next(new ExpressError(404, "Listing not found."));
    if (!listing.owner || !listing.owner.equals(req.user._id)) {
        req.flash("error", "Only the listing owner can make that change.");
        return res.redirect(`/listings/${listing._id}`);
    }
    res.locals.listing = listing;
    next();
};

module.exports.isAdmin = (req, res, next) => {
    if (!req.isAuthenticated()) return module.exports.isLoggedIn(req, res, next);
    if (!isConfiguredAdmin(req.user)) return next(new ExpressError(403, "Administrator access is required for this action."));
    next();
};

const validateBody = (schema, label) => (req, res, next) => {
    const { error, value } = schema.validate(req.body || {}, { abortEarly: false, convert: true });
    if (error) {
        const message = error.details.map(({ message }) => message).join(" ");
        return next(new ExpressError(400, `${label}: ${message}`));
    }
    req.body = value;
    next();
};

module.exports.validateListing = validateBody(listingSchema, "Check the listing details.");
module.exports.validateReview = validateBody(reviewSchema, "Check the review details.");
module.exports.validateSignup = validateBody(signupSchema, "Check the signup details.");
module.exports.validateLogin = validateBody(loginSchema, "Enter a username and password.");
module.exports.validateBooking = validateBody(bookingSchema, "Check the booking details.");

module.exports.requireListingImage = (req, res, next) => {
    if (!req.file) return next(new ExpressError(400, "Choose an image for the listing."));
    next();
};

module.exports.isReviewAuthor = async (req, res, next) => {
    const [listing, review] = await Promise.all([
        Listing.findById(req.params.id).select("_id reviews"),
        Review.findById(req.params.reviewId),
    ]);
    if (!listing || !review || !listing.reviews.some((id) => id.equals(review._id))) {
        return next(new ExpressError(404, "Review not found for this listing."));
    }
    if (!isConfiguredAdmin(req.user) && (!review.author || !review.author.equals(req.user._id))) {
        req.flash("error", "Only the author can delete this review.");
        return res.redirect(`/listings/${listing._id}`);
    }
    res.locals.review = review;
    res.locals.reviewListing = listing;
    next();
};

module.exports.isReviewOnListing = async (req, res, next) => {
    const [listing, review] = await Promise.all([
        Listing.findById(req.params.id).select("_id title reviews"),
        Review.findById(req.params.reviewId),
    ]);
    if (!listing || !review || !listing.reviews.some((reviewId) => reviewId.equals(review._id))) {
        return next(new ExpressError(404, "Review not found for this listing."));
    }
    res.locals.review = review;
    res.locals.reviewListing = listing;
    next();
};
