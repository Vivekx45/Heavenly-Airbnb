const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");
const Review = require("../models/review.js");
const User = require("../models/user.js");
const geocodeLocation = require("../utils/geocodeLocation.js");
const listingCategories = require("../utils/listingCategories.js");
const { getLocalMongoUrl } = require("../utils/database.js");

async function initDB() {
    await mongoose.connect(getLocalMongoUrl());
    if (mongoose.connection.host !== "127.0.0.1" || mongoose.connection.name !== "heavenly_main") {
        throw new Error("Refusing to seed listings outside local heavenly_main.");
    }

    const owner = await User.findOne({}).select("_id").lean();
    if (!owner) throw new Error("Create or register a local user before initializing local listings.");

    const resetRequested = process.env.RESET_LISTINGS === "true";
    if (resetRequested) {
        const reviewIds = await Listing.distinct("reviews");
        if (reviewIds.length) await Review.deleteMany({ _id: { $in: reviewIds } });
        await Listing.deleteMany({});
    }

    const existingTitles = new Set(await Listing.distinct("title", {
        title: { $in: initData.data.map(({ title }) => title) },
    }));
    const defaultCategories = new Set(listingCategories.map(({ slug }) => slug));
    const pending = [];
    for (const source of initData.data) {
        if (existingTitles.has(source.title)) continue;
        const listing = {
            ...source,
            owner: owner._id,
            categories: [],
            geometry: await geocodeLocation(source.location, source.country),
        };
        if (!Array.isArray(listing.categories) || listing.categories.some((category) => !defaultCategories.has(category))) {
            throw new Error(`Invalid category data on listing: ${source.title}`);
        }
        pending.push(listing);
    }
    if (pending.length) await Listing.insertMany(pending);
    console.log(`Initialized ${pending.length} local listings in heavenly_main.${resetRequested ? " Existing listings and their reviews were reset as requested." : " Existing listings were preserved."}`);
}

initDB()
    .catch((error) => {
        console.error("Listing initialization failed:", error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect();
    });
