const Joi = require("joi");
const listingCategories = require("./utils/listingCategories.js");

const categorySlugs = listingCategories.map(({ slug }) => slug);

module.exports.listingSchema = Joi.object({
    listing: Joi.object({
        title: Joi.string().trim().min(3).max(100).required(),
        description: Joi.string().trim().min(10).max(3000).required(),
        location: Joi.string().trim().min(2).max(160).required(),
        country: Joi.string().trim().min(2).max(100).required(),
        price: Joi.number().integer().min(1).max(10000000).required(),
        categories: Joi.alternatives().try(
            Joi.string().valid(""),
            Joi.array().items(Joi.string().valid("", ...categorySlugs)).max(categorySlugs.length + 1)
        ).optional(),
    }).required().unknown(false),
}).unknown(false);

module.exports.reviewSchema = Joi.object({
    review: Joi.object({
        rating: Joi.number().integer().min(1).max(5).required(),
        comment: Joi.string().trim().min(3).max(1200).required(),
    }).required().unknown(false),
}).unknown(false);

module.exports.signupSchema = Joi.object({
    username: Joi.string().trim().pattern(/^[a-zA-Z0-9_.-]+$/).min(3).max(30).required(),
    email: Joi.string().trim().email({ tlds: { allow: false } }).max(254).required(),
    password: Joi.string().min(8).max(128).required(),
}).unknown(false);

module.exports.loginSchema = Joi.object({
    username: Joi.string().trim().min(1).max(30).required(),
    password: Joi.string().min(1).max(128).required(),
}).unknown(false);

module.exports.bookingSchema = Joi.object({
    booking: Joi.object({
        checkIn: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
        checkOut: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
        guests: Joi.number().integer().min(1).max(16).required(),
        fullName: Joi.string().trim().min(2).max(100).required(),
        email: Joi.string().trim().email({ tlds: { allow: false } }).max(254).required(),
        phone: Joi.string().trim().pattern(/^[0-9+().\s-]{7,25}$/).required(),
        addressLine1: Joi.string().trim().min(3).max(200).required(),
        addressLine2: Joi.string().trim().allow("").max(200).default(""),
        city: Joi.string().trim().min(2).max(100).required(),
        region: Joi.string().trim().min(2).max(100).required(),
        postalCode: Joi.string().trim().min(2).max(30).required(),
        country: Joi.string().trim().min(2).max(100).required(),
        specialRequests: Joi.string().trim().allow("").max(1000).default(""),
        paymentMethod: Joi.string().valid("card", "upi", "netbanking").required(),
        acceptedTerms: Joi.boolean().valid(true).required(),
    }).required().unknown(false),
}).unknown(false);
