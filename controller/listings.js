const Listing = require("../models/listing.js");
const ListingVisit = require("../models/listingVisit.js");
const listingCategories = require("../utils/listingCategories.js");
const geocodeLocation = require("../utils/geocodeLocation.js");
const ExpressError = require("../utils/ExpressError.js");
const { cloudinary } = require("../cloudConfig.js");
const isConfiguredAdmin = require("../utils/adminAccess.js");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const categorySlugs = new Set(listingCategories.map(({ slug }) => slug));
const normalizeCategories = (value) => [...new Set((Array.isArray(value) ? value : [value])
    .filter((category) => categorySlugs.has(category)))];

module.exports.index = async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    const requestedCategory = typeof req.query.category === "string" ? req.query.category : "";
    const selectedCategory = categorySlugs.has(requestedCategory) ? requestedCategory : "";
    const conditions = [];
    if (q) {
        conditions.push({ $or: ["title", "location", "country", "categories"].map((field) => ({ [field]: { $regex: escapeRegex(q), $options: "i" } })) });
    }
    if (selectedCategory) conditions.push({ categories: selectedCategory });
    const filter = conditions.length > 1 ? { $and: conditions } : conditions[0] || {};
    const allListings = await Listing.find(filter).sort({ title: 1 });
    const selectedCategoryLabel = listingCategories.find(({ slug }) => slug === selectedCategory)?.label || "";
    res.render("listings/index.ejs", { allListings, q, listingCategories, selectedCategory, selectedCategoryLabel });
};

module.exports.searchSuggestions = async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    if (!q) return res.json([]);

    const regex = new RegExp(escapeRegex(q), "i");
    const suggestions = await Listing.find({
        $or: ["title", "location", "country", "categories"].map((field) => ({ [field]: regex })),
    })
        .select("title location country")
        .limit(12)
        .lean();

    const normalizedQuery = q.toLocaleLowerCase();
    suggestions.sort((a, b) => {
        const score = (listing) => {
            const title = listing.title.toLocaleLowerCase();
            const location = `${listing.location || ""} ${listing.country || ""}`.toLocaleLowerCase();
            if (title.startsWith(normalizedQuery)) return 0;
            if (title.includes(normalizedQuery)) return 1;
            if (location.startsWith(normalizedQuery)) return 2;
            return 3;
        };
        return score(a) - score(b) || a.title.localeCompare(b.title);
    });

    res.json(suggestions.map((listing) => ({
        id: listing._id,
        title: listing.title,
        location: [listing.location, listing.country].filter(Boolean).join(", "),
    })));
};

module.exports.renderNewForm = (req, res) => {
    res.render("listings/new.ejs", { listingCategories });
};


module.exports.showListing = async (req, res) => {
    let { id } = req.params;
    const listing = await Listing.findById(id)
        .populate({
            path: "reviews",
            populate: {
                path: "author"
            },
        })
        .populate("owner");

    if (!listing) throw new ExpressError(404, "Listing not found.");
    if (req.user?._id && !isConfiguredAdmin(req.user)) {
        const filter = { user: req.user._id, listing: listing._id };
        const now = new Date();
        const update = {
            $inc: { visitCount: 1 },
            $set: {
                lastVisitedAt: now,
                listingSnapshot: {
                    title: listing.title,
                    imageUrl: listing.image.url,
                    location: listing.location,
                    country: listing.country,
                },
            },
            $setOnInsert: { firstVisitedAt: now },
        };
        try {
            await ListingVisit.updateOne(filter, update, { upsert: true });
        } catch (error) {
            if (error.code === 11000) {
                await ListingVisit.updateOne(filter, update).catch((retryError) => {
                    console.warn("Could not record listing visit:", retryError.message);
                });
            } else {
                console.warn("Could not record listing visit:", error.message);
            }
        }
    }
    const savedListingIds = req.user?.savedListings || [];
    const isSaved = savedListingIds.some((savedId) => savedId.toString() === listing._id.toString());
    res.render("listings/show.ejs", { listing, isSaved });
};

module.exports.createListing = async (req, res) => {
    if (!req.file) throw new ExpressError(400, "Choose an image for the listing.");
    const { path: url, filename } = req.file;
    const listingData = {
        ...req.body.listing,
        categories: normalizeCategories(req.body.listing.categories),
    };
    const newListing = new Listing(listingData);
    newListing.owner = req.user._id;
    newListing.image = { url, filename };
    newListing.geometry = await geocodeLocation(listingData.location, listingData.country);
    await newListing.save();
    
    req.flash("success", "New Listing Created");
    res.redirect("/listings");
};

module.exports.renderEditForm = async (req, res) => {
    const listing = res.locals.listing;

    let originalImgUrl = listing.image.url;
    originalImgUrl = originalImgUrl.replace("/upload/", "/upload/w_250/");

    res.render("listings/edit.ejs", { listing, originalImgUrl, listingCategories });
};

module.exports.updateListing = async (req, res) => {
    const { id } = req.params;
    const listingData = {
        ...req.body.listing,
        categories: normalizeCategories(req.body.listing.categories),
    };
    const listing = res.locals.listing;
    const locationChanged = listing.location !== listingData.location || listing.country !== listingData.country;
    const coordinates = listing.geometry?.coordinates;
    const invalidGeometry = !Array.isArray(coordinates) || coordinates.length !== 2 ||
        !coordinates.every(Number.isFinite) || coordinates[0] < -180 || coordinates[0] > 180 ||
        coordinates[1] < -90 || coordinates[1] > 90;
    Object.assign(listing, listingData);
    if (locationChanged || invalidGeometry) {
        listing.geometry = await geocodeLocation(listingData.location, listingData.country);
    }
    const previousImage = listing.image?.filename;
    if (req.file) listing.image = { url: req.file.path, filename: req.file.filename };
    await listing.save();
    if (req.file && previousImage && previousImage !== req.file.filename && !previousImage.startsWith("external:")) {
        await cloudinary.uploader.destroy(previousImage).catch(() => {});
    }

    req.flash("success", "Listing Updated!");
    res.redirect(`/listings/${id}`);
};

module.exports.destroyListing = async (req, res) => {
    const listing = res.locals.listing;
    await listing.deleteOne();
    if (listing.image?.filename && !listing.image.filename.startsWith("external:")) {
        await cloudinary.uploader.destroy(listing.image.filename).catch(() => {});
    }
    req.flash("success", "Listing Deleted!");
    res.redirect("/listings");
};
