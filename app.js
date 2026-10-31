if(process.env.NODE_ENV != "production") {
    require("dotenv").config();
};

const dns = require('node:dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const express = require('express');
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError.js");
const session = require("express-session");
const MongoSessionStore = require("./utils/mongoSessionStore.js");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const { getMongoUrl, getLocalMongoUrl } = require("./utils/database.js");
const isConfiguredAdmin = require("./utils/adminAccess.js");
const { cloudinary } = require("./cloudConfig.js");
const User = require("./models/user.js");
const Listing = require("./models/listing.js");

const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const bookingRouter = require("./routes/booking.js");
const adminRouter = require("./routes/admin.js");
const userRouter = require('./routes/user.js');

// ----------------------------------------------------------

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }))
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "public")));


// -------------------------------------------------------------------------------------------------------------------

// --------------------------------------------------------------------------------------------------------------------

// Root Route check

// app.get("/", (req, res) => {
//     res.send("I am the Root Page");
// });

// --------------------------------------------------------------------------------------------------------------------

// Sessions implementation.

const sessionOptions = {
    secret: process.env.SESSION_SECRET || "heavenly-local-development-session-secret-change-before-deployment",
    store: new MongoSessionStore(mongoose.connection),
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
    }
};

if (process.env.NODE_ENV === "production") {
    if (!process.env.SESSION_SECRET) throw new Error("SESSION_SECRET is required in production.");
    app.set("trust proxy", 1);
}

app.use(session(sessionOptions));
app.use(flash());

app.use((req, res, next) => {
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    next();
});

// ----------------------------------------------------------------------------

// Creating demo user 

// app.get("/demouser", async (req, res) => {
//     let fakeUser = new User({
//         email: "student@gmail.com",
//         username: "Xstudent",
//     });

//     let registeredUser = await User.register(fakeUser, "Demouserpass"); 
//     res.send(registeredUser);
    
// });


// ----------------------------------------------------------------------------

// Here we gonna configure Passport and initialize a middleware after session cuz they also use sessions.

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
    res.locals.currUser = req.user;
    res.locals.isAdmin = isConfiguredAdmin(req.user);
    next();
})

const publicAuthPaths = new Set([
    "/login",
    "/login/user",
    "/login/admin",
    "/signup",
    "/auth/google",
    "/auth/google/callback",
]);

app.use((req, res, next) => {
    if (req.isAuthenticated() || publicAuthPaths.has(req.path)) return next();
    if (req.accepts("json") && !req.accepts("html")) {
        return res.status(401).json({ error: "Log in or create an account to continue." });
    }
    req.session.redirectUrl = req.originalUrl;
    req.flash("error", "Log in or create an account to continue.");
    res.redirect("/login");
});

app.get("/", (req, res) => res.redirect("/listings"));

app.get("/terms", (req, res) => {
    res.render("legal/terms.ejs", { pageTitle: "Terms and conditions" });
});

app.get("/privacy", (req, res) => {
    res.render("legal/privacy.ejs", { pageTitle: "Privacy policy" });
});

app.get("/map", async (req, res, next) => {
    try {
        const listings = await Listing.find({
            "geometry.type": "Point",
            "geometry.coordinates.0": { $exists: true },
            "geometry.coordinates.1": { $exists: true },
        }).select("title location country price geometry").lean();

        const mapListings = listings
            .filter(({ geometry }) => {
                const coordinates = geometry?.coordinates;
                return Array.isArray(coordinates) && coordinates.length >= 2 &&
                    coordinates.slice(0, 2).every(Number.isFinite) &&
                    coordinates[0] >= -180 && coordinates[0] <= 180 &&
                    coordinates[1] >= -90 && coordinates[1] <= 90;
            })
            .map((listing) => ({
                title: listing.title,
                location: listing.location,
                country: listing.country,
                price: listing.price,
                coordinates: listing.geometry.coordinates.slice(0, 2),
                url: `/listings/${listing._id}`,
            }));

        res.render("map.ejs", { pageTitle: "Explore the world", mapToken: process.env.MAP_TOKEN, mapListings });
    } catch (error) {
        next(error);
    }
});

// ----------------------------------------------------------------------------

// Listings 

app.use("/listings", listingRouter);

// Bookings
app.use("/bookings", bookingRouter);

// Administrator dashboard
app.use("/admin", adminRouter);

// ----------------------------------------------------------------------------

// Reviews 

app.use("/listings/:id/reviews", reviewRouter);

// ----------------------------------------------------------------------------

// Users 

app.use("/", userRouter);


// --------------------------------------------------------------------------------------------------------------------

// Error Handling Middlewares

app.all("/{*splat}", (req, res, next) => {
    next(new ExpressError(404, "Page Not Found"));
});

app.use(async (err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (req.file?.filename) await cloudinary.uploader.destroy(req.file.filename).catch(() => {});

    let statusCode = Number.isInteger(err.statusCode) && err.statusCode >= 400 && err.statusCode <= 599 ? err.statusCode : 500;
    let message = err.message || "Something went wrong. Please try again.";
    if (err.name === "ValidationError") {
        statusCode = 400;
        message = Object.values(err.errors || {}).map(({ message: detail }) => detail).join(" ") || "Please check the submitted details.";
    } else if (err.name === "CastError") {
        statusCode = 400;
        message = "The requested record has an invalid ID.";
    } else if (err.code === 11000) {
        statusCode = 409;
        message = "That username or email is already in use.";
    } else if (err.name === "MulterError") {
        statusCode = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
        message = err.code === "LIMIT_FILE_SIZE" ? "Images must be 8 MB or smaller." : "The uploaded image could not be accepted.";
    } else if (err.name === "CloudinaryStorageError" || err.name === "CloudinaryError") {
        statusCode = 502;
        message = "Image storage is temporarily unavailable. Please try again.";
    } else if (statusCode >= 500) {
        message = "Something went wrong. Please try again.";
        console.error("Request failed:", err.message);
    }

    if (req.accepts("json") && !req.accepts("html")) {
        return res.status(statusCode).json({ error: message });
    }
    res.status(statusCode).render("error.ejs", { err: { statusCode, message } });
});


// --------------------------------------------------------------------------------------------------------------------

// Basis server checkup 

async function startServer() {
    let connectedTo = "MongoDB Atlas";
    try {
        await mongoose.connect(getMongoUrl(), {
            serverSelectionTimeoutMS: Number(process.env.ATLAS_CONNECT_TIMEOUT_MS) || 10000,
        });
    } catch (atlasError) {
        console.warn(`MongoDB Atlas connection failed (${atlasError.name}); trying local MongoDB.`);
        await mongoose.disconnect().catch(() => {});
        connectedTo = "local MongoDB";
        await mongoose.connect(getLocalMongoUrl(), { serverSelectionTimeoutMS: 5000 });
    }
    await sessionOptions.store.initialize();
    console.log(`Connected to ${connectedTo} at ${mongoose.connection.host}, database ${mongoose.connection.name}.`);
    const port = Number(process.env.PORT) || 8080;
    app.listen(port, () => console.log(`Heavenly is listening on port ${port}.`));
}

if (require.main === module) {
    startServer().catch((error) => {
        console.error("Could not start Heavenly. Check MongoDB availability and MONGODB_URI configuration.", error.message);
        process.exit(1);
    });
}

module.exports = app;
