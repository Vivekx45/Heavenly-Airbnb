const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review = require("./review.js");
const listingCategories = require("../utils/listingCategories.js");
const categorySlugs = listingCategories.map(({ slug }) => slug);

const listingSchema = new Schema({
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 3000 },
    image: {
        url: { type: String, required: true, trim: true },
        filename: { type: String, required: true, trim: true },
        sourceUrl: { type: String, trim: true, maxlength: 2048 },
        attribution: { type: String, trim: true, maxlength: 300 },
        license: { type: String, trim: true, maxlength: 100 },
        licenseUrl: { type: String, trim: true, maxlength: 2048 },
    },
    price: { type: Number, required: true, min: 1, max: 10000000 },
    location: { type: String, required: true, trim: true, minlength: 2, maxlength: 160 },
    country: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    categories: {
        type: [{ type: String, enum: categorySlugs }],
        default: [],
    },
    reviews: [{ type: Schema.Types.ObjectId, ref: "Review" }],
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    bookingLockVersion: { type: Number, default: 0, min: 0 },
    geometry: {
        type: { type: String, enum: ["Point"], required: true },
        coordinates: {
            type: [Number],
            required: true,
            validate: {
                validator: (coordinates) => Array.isArray(coordinates) && coordinates.length === 2 &&
                    Number.isFinite(coordinates[0]) && Number.isFinite(coordinates[1]) &&
                    coordinates[0] >= -180 && coordinates[0] <= 180 &&
                    coordinates[1] >= -90 && coordinates[1] <= 90,
                message: "Coordinates must contain a valid longitude and latitude.",
            },
        },
    },
}, { timestamps: true });

listingSchema.post("findOneAndDelete", async (listing) => {
    if (listing?.reviews?.length) {
        await Review.deleteMany({ _id: { $in: listing.reviews } });
    }
});
listingSchema.post("deleteOne", { document: true, query: false }, async (listing) => {
    if (listing?.reviews?.length) await Review.deleteMany({ _id: { $in: listing.reviews } });
});

module.exports = mongoose.model("Listing", listingSchema);
