const crypto = require("node:crypto");
const mongoose = require("mongoose");
const Booking = require("../models/booking.js");
const Listing = require("../models/listing.js");
const ExpressError = require("../utils/ExpressError.js");
const isConfiguredAdmin = require("../utils/adminAccess.js");

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_NIGHTS = 30;
const paymentMethodLabels = {
    card: "Credit or debit card",
    upi: "UPI",
    netbanking: "Net banking",
};

const dateOnly = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const dateInputValue = (date) => date.toISOString().slice(0, 10);

function parseDateOnly(value, label) {
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (parsed.toISOString().slice(0, 10) !== value) {
        throw new ExpressError(400, `Choose a valid ${label} date.`);
    }
    return parsed;
}

function canManageBooking(req, booking) {
    return isConfiguredAdmin(req.user) || booking.user.equals(req.user._id);
}

function renderBooking(res, booking, req, pageTitle = "Booking details") {
    const today = dateOnly(new Date());
    return res.render("bookings/show.ejs", {
        pageTitle,
        booking,
        paymentMethodLabel: paymentMethodLabels[booking.paymentMethod],
        canCancel: booking.status !== "cancelled" && booking.checkIn > today,
        isAdmin: isConfiguredAdmin(req.user),
    });
}

async function reserveDatesAndCreateBooking(req, submitted, checkIn, checkOut, nights, session) {
    const listingQuery = Listing.findById(req.params.id);
    if (session) listingQuery.session(session);
    const listing = await listingQuery;
    if (!listing) throw new ExpressError(404, "Listing not found.");

    const options = session ? { session } : {};
    // On Atlas this write makes concurrent transactions for the same listing conflict and retry.
    await Listing.updateOne({ _id: listing._id }, { $inc: { bookingLockVersion: 1 } }, options);

    const conflictQuery = Booking.findOne({
        listing: listing._id,
        status: "demo_confirmed",
        checkIn: { $lt: checkOut },
        checkOut: { $gt: checkIn },
    }).select("_id");
    if (session) conflictQuery.session(session);
    if (await conflictQuery) throw new ExpressError(409, "Those dates are already booked. Choose different dates.");

    const subtotal = listing.price * nights;
    const [booking] = await Booking.create([{
        reference: `HV-${crypto.randomBytes(5).toString("hex").toUpperCase()}`,
        user: req.user._id,
        listing: listing._id,
        listingSnapshot: {
            title: listing.title,
            imageUrl: listing.image.url,
            location: listing.location,
            country: listing.country,
        },
        guest: {
            fullName: submitted.fullName,
            email: submitted.email,
            phone: submitted.phone,
            addressLine1: submitted.addressLine1,
            addressLine2: submitted.addressLine2,
            city: submitted.city,
            region: submitted.region,
            postalCode: submitted.postalCode,
            country: submitted.country,
            specialRequests: submitted.specialRequests,
        },
        checkIn,
        checkOut,
        guests: submitted.guests,
        nights,
        pricePerNight: listing.price,
        subtotal,
        total: subtotal,
        currency: "INR",
        paymentMethod: submitted.paymentMethod,
        paymentStatus: "not_processed",
        termsAcceptedAt: new Date(),
        status: "demo_confirmed",
    }], options);

    return booking;
}

module.exports.renderCheckout = async (req, res) => {
    const listing = await Listing.findById(req.params.id).select("title image price location country");
    if (!listing) throw new ExpressError(404, "Listing not found.");

    res.render("bookings/checkout.ejs", {
        pageTitle: `Book ${listing.title}`,
        listing,
        minDate: dateInputValue(dateOnly(new Date())),
        guestDefaults: {
            fullName: req.user.displayName || req.user.username,
            email: req.user.email,
        },
    });
};

module.exports.createBooking = async (req, res) => {
    const submitted = req.body.booking;
    const checkIn = parseDateOnly(submitted.checkIn, "check-in");
    const checkOut = parseDateOnly(submitted.checkOut, "check-out");
    const today = dateOnly(new Date());

    if (checkIn < today) throw new ExpressError(400, "Check-in cannot be in the past.");
    if (checkOut <= checkIn) throw new ExpressError(400, "Check-out must be after check-in.");

    const nights = (checkOut.getTime() - checkIn.getTime()) / DAY_MS;
    if (!Number.isInteger(nights) || nights > MAX_NIGHTS) {
        throw new ExpressError(400, `Bookings can be from 1 to ${MAX_NIGHTS} nights.`);
    }

    let createdBooking;
    const topologyType = mongoose.connection.client?.topology?.description?.type;
    const supportsTransactions = ["ReplicaSetWithPrimary", "ReplicaSetNoPrimary", "Sharded"].includes(topologyType);
    if (supportsTransactions) {
        const session = await mongoose.startSession();
        try {
            await session.withTransaction(async () => {
                createdBooking = await reserveDatesAndCreateBooking(req, submitted, checkIn, checkOut, nights, session);
            });
        } finally {
            await session.endSession();
        }
    } else {
        // Standalone MongoDB does not support transactions; keep the booking flow usable there too.
        createdBooking = await reserveDatesAndCreateBooking(req, submitted, checkIn, checkOut, nights, null);
    }

    req.flash("success", "Demo booking saved. No payment was processed.");
    res.redirect(`/bookings/${createdBooking._id}`);
};

module.exports.renderBookings = async (req, res) => {
    const filter = isConfiguredAdmin(req.user) ? {} : { user: req.user._id };
    const bookings = await Booking.find(filter).sort({ createdAt: -1 }).lean();
    res.render("bookings/index.ejs", {
        pageTitle: isConfiguredAdmin(req.user) ? "All bookings" : "Your bookings",
        bookings,
        isAdmin: isConfiguredAdmin(req.user),
    });
};

module.exports.showBooking = async (req, res) => {
    const booking = await Booking.findById(req.params.id);
    if (!booking) throw new ExpressError(404, "Booking not found.");
    if (!canManageBooking(req, booking)) throw new ExpressError(403, "You do not have access to this booking.");
    return renderBooking(res, booking, req);
};

module.exports.cancelBooking = async (req, res) => {
    const booking = await Booking.findById(req.params.id);
    if (!booking) throw new ExpressError(404, "Booking not found.");
    if (!canManageBooking(req, booking)) throw new ExpressError(403, "You do not have access to this booking.");
    if (booking.status === "cancelled") {
        req.flash("error", "This booking has already been cancelled.");
        return res.redirect(`/bookings/${booking._id}`);
    }
    if (booking.checkIn <= dateOnly(new Date())) {
        throw new ExpressError(400, "Bookings can only be cancelled before the check-in date.");
    }

    booking.status = "cancelled";
    booking.cancelledAt = new Date();
    await booking.save();
    req.flash("success", "Demo booking cancelled. No payment or refund was involved.");
    res.redirect(`/bookings/${booking._id}`);
};
