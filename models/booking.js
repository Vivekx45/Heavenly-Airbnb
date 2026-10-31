const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const guestSchema = new Schema({
    fullName: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    phone: { type: String, required: true, trim: true, maxlength: 25 },
    addressLine1: { type: String, required: true, trim: true, maxlength: 200 },
    addressLine2: { type: String, trim: true, maxlength: 200, default: "" },
    city: { type: String, required: true, trim: true, maxlength: 100 },
    region: { type: String, required: true, trim: true, maxlength: 100 },
    postalCode: { type: String, required: true, trim: true, maxlength: 30 },
    country: { type: String, required: true, trim: true, maxlength: 100 },
    specialRequests: { type: String, trim: true, maxlength: 1000, default: "" },
}, { _id: false });

const listingSnapshotSchema = new Schema({
    title: { type: String, required: true, trim: true, maxlength: 100 },
    imageUrl: { type: String, required: true, trim: true, maxlength: 2048 },
    location: { type: String, required: true, trim: true, maxlength: 160 },
    country: { type: String, required: true, trim: true, maxlength: 100 },
}, { _id: false });

const bookingSchema = new Schema({
    reference: { type: String, required: true, unique: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    listing: { type: Schema.Types.ObjectId, ref: "Listing", required: true },
    listingSnapshot: { type: listingSnapshotSchema, required: true },
    guest: { type: guestSchema, required: true },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    guests: { type: Number, required: true, min: 1, max: 16 },
    nights: { type: Number, required: true, min: 1, max: 30 },
    pricePerNight: { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true, min: 1 },
    total: { type: Number, required: true, min: 1 },
    currency: { type: String, enum: ["INR"], default: "INR", required: true },
    paymentMethod: { type: String, enum: ["card", "upi", "netbanking"], required: true },
    paymentStatus: { type: String, enum: ["not_processed"], default: "not_processed", required: true },
    termsAcceptedAt: { type: Date, required: true },
    status: { type: String, enum: ["demo_confirmed", "cancelled"], default: "demo_confirmed", required: true },
    cancelledAt: { type: Date },
}, { timestamps: true });

bookingSchema.index({ listing: 1, status: 1, checkIn: 1, checkOut: 1 });
bookingSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("Booking", bookingSchema);
