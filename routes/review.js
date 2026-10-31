const express = require("express");
const router = express.Router({ mergeParams: true });
const wrapAsync = require("../utils/wrapAsync.js");
const { validateReview, isLoggedIn, isAdmin, isReviewAuthor, isReviewOnListing, validateObjectId } = require("../middleware.js");
const reviewController = require("../controller/reviews.js");


// Another POST Route - for Reviews Section. - this route only submit those reviews in our Reviews DB
router.post("/", isLoggedIn, validateObjectId("id", "listing"), validateReview, wrapAsync(reviewController.createReview));

router.get("/:reviewId/edit", isAdmin, validateObjectId("id", "listing"), validateObjectId("reviewId", "review"), isReviewOnListing, reviewController.renderEditReviewForm);
router.put("/:reviewId", isAdmin, validateObjectId("id", "listing"), validateObjectId("reviewId", "review"), isReviewOnListing, validateReview, wrapAsync(reviewController.updateReview));


// New DELETE route for deleting each review.
router.delete("/:reviewId", isLoggedIn, validateObjectId("id", "listing"), validateObjectId("reviewId", "review"), isReviewAuthor, wrapAsync(reviewController.destroyReview));


module.exports = router;

