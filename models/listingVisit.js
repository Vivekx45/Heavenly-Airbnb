const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const listingVisitSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    listing: { type: Schema.Types.ObjectId, ref: "Listing", required: true },
    visitCount: { type: Number, default: 0, min: 0, required: true },
    firstVisitedAt: { type: Date, required: true },
    lastVisitedAt: { type: Date, required: true },
    listingSnapshot: {
        title: { type: String, required: true, trim: true, maxlength: 100 },
        imageUrl: { type: String, required: true, trim: true, maxlength: 2048 },
        location: { type: String, required: true, trim: true, maxlength: 160 },
        country: { type: String, required: true, trim: true, maxlength: 100 },
    },
}, { timestamps: true });

listingVisitSchema.index({ user: 1, listing: 1 }, { unique: true });
listingVisitSchema.index({ user: 1, lastVisitedAt: -1 });
listingVisitSchema.index({ listing: 1, lastVisitedAt: -1 });

module.exports = mongoose.model("ListingVisit", listingVisitSchema);
