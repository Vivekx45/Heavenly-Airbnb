const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose").default;

const socialAccountSchema = new Schema({
    provider: { type: String, enum: ["google"], required: true },
    providerId: { type: String, required: true, trim: true },
}, { _id: false });

const userSchema = new Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        maxlength: 254,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address."],
    },
    displayName: { type: String, trim: true, maxlength: 100 },
    profilePicture: { type: String, trim: true, maxlength: 2048 },
    role: { type: String, enum: ["user", "admin"], default: "user", required: true },
    lastLoginAt: { type: Date },
    loginCount: { type: Number, default: 0, min: 0 },
    socialAccounts: { type: [socialAccountSchema], default: [] },
    savedListings: [{ type: Schema.Types.ObjectId, ref: "Listing" }],
}, { timestamps: true });

userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);
