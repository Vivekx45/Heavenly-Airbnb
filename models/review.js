const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const reviewSchema = new Schema({
    comment: { type: String, required: true, trim: true, minlength: 3, maxlength: 1200 },
    rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
    createdAt: { type: Date, default: Date.now },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String, trim: true, maxlength: 100 },
}, { timestamps: false });

module.exports = mongoose.model("Review", reviewSchema);
