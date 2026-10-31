const Listing = require("../models/listing.js");
const Review = require("../models/review.js");
const ExpressError = require("../utils/ExpressError.js");

module.exports.createReview = async (req, res) => {
    const listing = await Listing.findById(req.params.id);
    if (!listing) throw new ExpressError(404, "Listing not found.");
    const newReview = new Review(req.body.review);
    newReview.author = req.user._id;
    newReview.authorName = req.user.username;
    
    listing.reviews.push(newReview);

    await newReview.save();
    await listing.save();

    req.flash("success", "Review Added!");
    // console.log("New Review Saved");
    // res.send("new Review saved");
    res.redirect(`/listings/${listing._id}`);

};

module.exports.renderEditReviewForm = (req, res) => {
    res.render("reviews/edit.ejs", {
        listing: res.locals.reviewListing,
        review: res.locals.review,
    });
};

module.exports.updateReview = async (req, res) => {
    const review = res.locals.review;
    review.rating = req.body.review.rating;
    review.comment = req.body.review.comment;
    await review.save();

    req.flash("success", "Review updated.");
    res.redirect(`/listings/${res.locals.reviewListing._id}`);
};

module.exports.destroyReview = async (req, res) => {
    const { id } = req.params;
    const review = res.locals.review;
    await Listing.updateOne({ _id: id }, { $pull: { reviews: review._id } });
    await review.deleteOne();

    req.flash("success", "Review Deleted!");
    res.redirect(`/listings/${id}`);
};

