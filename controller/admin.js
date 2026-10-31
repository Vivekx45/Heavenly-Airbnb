const mongoose = require("mongoose");
const Booking = require("../models/booking.js");
const Listing = require("../models/listing.js");
const ListingVisit = require("../models/listingVisit.js");
const Review = require("../models/review.js");
const User = require("../models/user.js");
const ExpressError = require("../utils/ExpressError.js");

const PAGE_SIZE = 20;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const readPage = (value) => {
    const page = Number.parseInt(value, 10);
    return Number.isSafeInteger(page) && page > 0 ? Math.min(page, 100000) : 1;
};

async function getTopViewedListings() {
    return ListingVisit.aggregate([
        { $group: { _id: "$listing", visits: { $sum: "$visitCount" }, snapshot: { $first: "$listingSnapshot" } } },
        { $sort: { visits: -1 } },
        { $limit: 6 },
        { $lookup: { from: Listing.collection.name, localField: "_id", foreignField: "_id", as: "listing" } },
        { $unwind: { path: "$listing", preserveNullAndEmptyArrays: true } },
        { $project: {
            _id: 1,
            visits: 1,
            title: { $ifNull: ["$listing.title", "$snapshot.title"] },
            imageUrl: { $ifNull: ["$listing.image.url", "$snapshot.imageUrl"] },
            location: { $ifNull: ["$listing.location", "$snapshot.location"] },
            country: { $ifNull: ["$listing.country", "$snapshot.country"] },
        } },
    ]);
}

async function getTopSavedListings() {
    return User.aggregate([
        { $unwind: "$savedListings" },
        { $group: { _id: "$savedListings", saves: { $sum: 1 } } },
        { $sort: { saves: -1 } },
        { $limit: 6 },
        { $lookup: { from: Listing.collection.name, localField: "_id", foreignField: "_id", as: "listing" } },
        { $unwind: "$listing" },
        { $project: {
            _id: "$listing._id",
            title: "$listing.title",
            imageUrl: "$listing.image.url",
            location: "$listing.location",
            country: "$listing.country",
            saves: 1,
        } },
    ]);
}

module.exports.renderDashboard = async (req, res) => {
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [
        userCount,
        newUsersLast30Days,
        listingCount,
        reviewCount,
        bookingCount,
        activeBookingCount,
        cancelledBookingCount,
        savedStats,
        viewStats,
        bookingValueStats,
        recentUsers,
        recentBookings,
        topViewedListings,
        topSavedListings,
    ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ role: "user", createdAt: { $gte: monthAgo } }),
        Listing.countDocuments(),
        Review.countDocuments(),
        Booking.countDocuments(),
        Booking.countDocuments({ status: "demo_confirmed" }),
        Booking.countDocuments({ status: "cancelled" }),
        User.aggregate([
            { $project: { savedCount: { $size: { $ifNull: ["$savedListings", []] } } } },
            { $group: { _id: null, total: { $sum: "$savedCount" } } },
        ]),
        ListingVisit.aggregate([
            { $group: { _id: null, totalVisits: { $sum: "$visitCount" }, uniqueUserListingViews: { $sum: 1 } } },
        ]),
        Booking.aggregate([
            { $match: { status: "demo_confirmed" } },
            { $group: { _id: null, total: { $sum: "$total" } } },
        ]),
        User.find().select("username displayName email profilePicture role createdAt lastLoginAt loginCount")
            .sort({ createdAt: -1 }).limit(6).lean(),
        Booking.find().sort({ createdAt: -1 }).limit(6).populate("user", "username displayName")
            .select("reference user listingSnapshot checkIn checkOut total status createdAt").lean(),
        getTopViewedListings(),
        getTopSavedListings(),
    ]);

    res.render("admin/dashboard.ejs", {
        pageTitle: "Admin dashboard",
        stats: {
            userCount,
            newUsersLast30Days,
            listingCount,
            reviewCount,
            bookingCount,
            activeBookingCount,
            cancelledBookingCount,
            savedCount: savedStats[0]?.total || 0,
            totalVisits: viewStats[0]?.totalVisits || 0,
            uniqueUserListingViews: viewStats[0]?.uniqueUserListingViews || 0,
            demoBookingValue: bookingValueStats[0]?.total || 0,
        },
        recentUsers,
        recentBookings,
        topViewedListings,
        topSavedListings,
    });
};

module.exports.renderUsers = async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    const page = readPage(req.query.page);
    const filter = q ? { $or: ["username", "displayName", "email"].map((field) => ({ [field]: new RegExp(escapeRegex(q), "i") })) } : {};
    const [users, totalUsers] = await Promise.all([
        User.find(filter).select("username displayName email profilePicture role savedListings createdAt lastLoginAt loginCount")
            .sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
        User.countDocuments(filter),
    ]);
    const userIds = users.map(({ _id }) => _id);
    const [visitStats, bookingStats, reviewStats] = userIds.length ? await Promise.all([
        ListingVisit.aggregate([
            { $match: { user: { $in: userIds } } },
            { $group: { _id: "$user", totalVisits: { $sum: "$visitCount" }, listingsVisited: { $sum: 1 } } },
        ]),
        Booking.aggregate([
            { $match: { user: { $in: userIds } } },
            { $group: { _id: "$user", count: { $sum: 1 } } },
        ]),
        Review.aggregate([
            { $match: { author: { $in: userIds } } },
            { $group: { _id: "$author", count: { $sum: 1 } } },
        ]),
    ]) : [[], [], []];

    const byUser = (rows) => new Map(rows.map((row) => [String(row._id), row]));
    const visitsByUser = byUser(visitStats);
    const bookingsByUser = byUser(bookingStats);
    const reviewsByUser = byUser(reviewStats);
    const enrichedUsers = users.map((user) => ({
        ...user,
        savedCount: user.savedListings?.length || 0,
        totalVisits: visitsByUser.get(String(user._id))?.totalVisits || 0,
        listingsVisited: visitsByUser.get(String(user._id))?.listingsVisited || 0,
        bookingCount: bookingsByUser.get(String(user._id))?.count || 0,
        reviewCount: reviewsByUser.get(String(user._id))?.count || 0,
    }));

    res.render("admin/users.ejs", {
        pageTitle: "Manage users",
        users: enrichedUsers,
        q,
        page,
        pageCount: Math.max(1, Math.ceil(totalUsers / PAGE_SIZE)),
        totalUsers,
    });
};

module.exports.showUser = async (req, res) => {
    const userId = new mongoose.Types.ObjectId(req.params.id);
    const user = await User.findById(userId)
        .select("username displayName email profilePicture role savedListings createdAt lastLoginAt loginCount")
        .populate({ path: "savedListings", select: "title image location country price" })
        .lean();
    if (!user) throw new ExpressError(404, "User not found.");

    const [visits, bookings, reviews, bookingCount, reviewCount, visitSummary] = await Promise.all([
        ListingVisit.find({ user: userId }).sort({ lastVisitedAt: -1 }).limit(30)
            .populate("listing", "_id").lean(),
        Booking.find({ user: userId }).sort({ createdAt: -1 }).limit(20).lean(),
        Review.find({ author: userId }).sort({ createdAt: -1 }).limit(20).lean(),
        Booking.countDocuments({ user: userId }),
        Review.countDocuments({ author: userId }),
        ListingVisit.aggregate([
            { $match: { user: userId } },
            { $group: { _id: null, totalVisits: { $sum: "$visitCount" }, distinctListings: { $sum: 1 } } },
        ]),
    ]);
    const reviewIds = reviews.map(({ _id }) => _id);
    const reviewListings = reviewIds.length
        ? await Listing.find({ reviews: { $in: reviewIds } }).select("_id title location country reviews").lean()
        : [];
    const listingByReview = new Map();
    for (const listing of reviewListings) {
        for (const reviewId of listing.reviews || []) listingByReview.set(String(reviewId), listing);
    }
    const reviewDetails = reviews.map((review) => ({ ...review, listing: listingByReview.get(String(review._id)) }));

    res.render("admin/user-detail.ejs", {
        pageTitle: `User: ${user.displayName || user.username}`,
        user,
        visits,
        bookings,
        reviews: reviewDetails,
        totalVisits: visitSummary[0]?.totalVisits || 0,
        distinctListingsVisited: visitSummary[0]?.distinctListings || 0,
        bookingCount,
        reviewCount,
    });
};

module.exports.renderListings = async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    const page = readPage(req.query.page);
    const sortOptions = {
        recent: { createdAt: -1 },
        title: { title: 1 },
        priceLow: { price: 1 },
        priceHigh: { price: -1 },
    };
    const sort = Object.hasOwn(sortOptions, req.query.sort) ? req.query.sort : "recent";
    const filter = q ? { $or: ["title", "location", "country"].map((field) => ({ [field]: new RegExp(escapeRegex(q), "i") })) } : {};
    const [listings, totalListings] = await Promise.all([
        Listing.find(filter).select("title image price location country owner reviews createdAt")
            .populate("owner", "username displayName").sort(sortOptions[sort])
            .skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
        Listing.countDocuments(filter),
    ]);
    const listingIds = listings.map(({ _id }) => _id);
    const [visitStats, saveStats] = listingIds.length ? await Promise.all([
        ListingVisit.aggregate([
            { $match: { listing: { $in: listingIds } } },
            { $group: { _id: "$listing", count: { $sum: "$visitCount" } } },
        ]),
        User.aggregate([
            { $unwind: "$savedListings" },
            { $match: { savedListings: { $in: listingIds } } },
            { $group: { _id: "$savedListings", count: { $sum: 1 } } },
        ]),
    ]) : [[], []];
    const visitsByListing = new Map(visitStats.map(({ _id, count }) => [String(_id), count]));
    const savesByListing = new Map(saveStats.map(({ _id, count }) => [String(_id), count]));
    const enrichedListings = listings.map((listing) => ({
        ...listing,
        visitCount: visitsByListing.get(String(listing._id)) || 0,
        saveCount: savesByListing.get(String(listing._id)) || 0,
        reviewCount: listing.reviews?.length || 0,
    }));

    res.render("admin/listings.ejs", {
        pageTitle: "Manage listings",
        listings: enrichedListings,
        q,
        page,
        pageCount: Math.max(1, Math.ceil(totalListings / PAGE_SIZE)),
        totalListings,
        sort,
    });
};

module.exports.renderReviews = async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    const rating = ["1", "2", "3", "4", "5"].includes(req.query.rating) ? Number(req.query.rating) : null;
    const page = readPage(req.query.page);
    const conditions = [];
    if (q) {
        const expression = new RegExp(escapeRegex(q), "i");
        conditions.push({ $or: [{ comment: expression }, { authorName: expression }] });
    }
    if (rating) conditions.push({ rating });
    const filter = conditions.length > 1 ? { $and: conditions } : conditions[0] || {};
    const [reviews, totalReviews] = await Promise.all([
        Review.find(filter).sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
        Review.countDocuments(filter),
    ]);
    const reviewIds = reviews.map(({ _id }) => _id);
    const authorIds = [...new Map(reviews.filter(({ author }) => author).map(({ author }) => [String(author), author])).values()];
    const [listings, authors] = reviewIds.length ? await Promise.all([
        Listing.find({ reviews: { $in: reviewIds } }).select("_id title location country reviews").lean(),
        User.find({ _id: { $in: authorIds } }).select("_id username displayName").lean(),
    ]) : [[], []];
    const listingByReview = new Map();
    for (const listing of listings) {
        for (const reviewId of listing.reviews || []) listingByReview.set(String(reviewId), listing);
    }
    const authorById = new Map(authors.map((author) => [String(author._id), author]));
    const reviewRows = reviews.map((review) => ({
        ...review,
        listing: listingByReview.get(String(review._id)),
        authorUser: review.author ? authorById.get(String(review.author)) : null,
    }));

    res.render("admin/reviews.ejs", {
        pageTitle: "Manage reviews",
        reviews: reviewRows,
        q,
        rating,
        page,
        pageCount: Math.max(1, Math.ceil(totalReviews / PAGE_SIZE)),
        totalReviews,
    });
};
