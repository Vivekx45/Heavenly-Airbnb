const User = require("../models/user.js");
const Listing = require("../models/listing.js");
const mongoose = require("mongoose");
const crypto = require("node:crypto");
const ExpressError = require("../utils/ExpressError.js");

module.exports.renderSavedListings = async (req, res) => {
    const user = await User.findById(req.user._id).populate("savedListings");
    if (!user) throw new ExpressError(401, "Please sign in again.");
    const savedListings = (user?.savedListings || []).filter(Boolean);
    res.render("listings/saved.ejs", { savedListings });
};

module.exports.saveListing = async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new ExpressError(400, "Invalid listing ID.");
    const listing = await Listing.findById(req.params.id);
    if (!listing) throw new ExpressError(404, "Listing not found.");

    const user = await User.findByIdAndUpdate(req.user._id, {
        $addToSet: { savedListings: listing._id },
    }, { runValidators: true });
    if (!user) throw new ExpressError(401, "Please sign in again.");
    res.json({ saved: true });
};

module.exports.removeSavedListing = async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw new ExpressError(400, "Invalid listing ID.");
    const acceptsJson = req.get("accept")?.includes("application/json");
    const user = await User.findByIdAndUpdate(req.user._id, {
        $pull: { savedListings: req.params.id },
    }, { runValidators: true });
    if (!user) throw new ExpressError(401, "Please sign in again.");

    if (acceptsJson) {
        return res.json({ saved: false });
    }

    req.flash("success", "Listing removed from your saved places.");
    res.redirect("/saved");
};


module.exports.renderSignupForm = (req, res) => {
    if (req.isAuthenticated()) return res.redirect("/listings");
    res.render("users/signup.ejs");
};

module.exports.signup = async (req, res, next) => {
    try {
        let { username, email, password } = req.body;
        const existingEmail = await User.findOne({ email: email.trim().toLowerCase() }).collation({ locale: "en", strength: 2 }).select("_id");
        if (existingEmail) {
            req.flash("error", "An account with that email already exists.");
            return res.redirect("/signup");
        }
        const newUser = new User({ email, username: username.trim(), lastLoginAt: new Date(), loginCount: 1 })
        const registeredUser = await User.register(newUser, password);
        await new Promise((resolve, reject) => req.login(registeredUser, (error) => error ? reject(error) : resolve()));
        req.flash("success", "Welcome to HEAVENLY");
        res.redirect("/listings");
    } catch (e) {
        if (e.name === "UserExistsError" || e.code === 11000) {
            req.flash("error", "That username or email is already registered.");
            return res.redirect("/signup");
        }
        next(e);
    }
};

module.exports.findOrCreateSocialUser = async (provider, profile) => {
    const email = profile.email?.trim().toLowerCase();
    if (!profile.id || !email) throw new ExpressError(422, "The identity provider did not return the information needed to create an account.");

    let profilePicture;
    try {
        const pictureUrl = new URL(profile.avatar);
        if (pictureUrl.protocol === "https:" &&
            (pictureUrl.hostname === "googleusercontent.com" || pictureUrl.hostname.endsWith(".googleusercontent.com"))) {
            profilePicture = pictureUrl.toString();
        }
    } catch {
        // Ignore missing or invalid provider photo URLs and use the profile fallback.
    }
    const updateGoogleProfile = async (user) => {
        if (profile.name?.trim()) user.displayName = profile.name.trim().slice(0, 100);
        if (profilePicture) user.profilePicture = profilePicture;
        await user.save();
        return user;
    };

    let user = await User.findOne({
        socialAccounts: { $elemMatch: { provider, providerId: String(profile.id) } },
    });
    if (user) return updateGoogleProfile(user);

    user = await User.findOne({ email }).collation({ locale: "en", strength: 2 });
    if (user) {
        user.socialAccounts.push({ provider, providerId: String(profile.id) });
        return updateGoogleProfile(user);
    }

    const name = (profile.name || `${provider} traveler`)
        .normalize("NFKD")
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 24) || "traveler";
    const username = `${name}_${provider}_${String(profile.id).replace(/[^a-zA-Z0-9]/g, "").slice(-12)}`;
    const newUser = new User({
        username,
        email,
        displayName: profile.name?.trim().slice(0, 100),
        profilePicture,
        socialAccounts: [{ provider, providerId: String(profile.id) }],
    });
    return User.register(newUser, crypto.randomBytes(32).toString("hex"));
};

module.exports.renderProfile = (req, res) => {
    res.render("users/profile.ejs", { profileUser: req.user });
};

module.exports.renderLoginFrom = (req, res) => {
    if (req.isAuthenticated()) return res.redirect("/listings");
    const returnTo = req.query.returnTo;
    if (typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
        req.session.redirectUrl = returnTo;
    }
    res.render("users/login.ejs", { loginMode: null });
};

module.exports.renderUserLogin = (req, res) => {
    if (req.isAuthenticated()) return res.redirect("/listings");
    res.render("users/login.ejs", { loginMode: "user" });
};

module.exports.renderAdminLogin = (req, res) => {
    if (req.isAuthenticated()) return res.redirect("/listings");
    res.render("users/login.ejs", { loginMode: "admin" });
};

module.exports.login = async (req, res) => {
    await User.updateOne({ _id: req.user._id }, {
        $set: { lastLoginAt: new Date() },
        $inc: { loginCount: 1 },
    }).catch((error) => console.warn("Could not update account login history:", error.message));
    req.flash("success", "Welcome to HEAVENLY");
    let redirectUrl = res.locals.redirectUrl || "/listings";
    res.redirect(redirectUrl);
};

module.exports.logout =  (req, res, next) => {
    req.logout((err) => {
        if (err) {
            return next(err);
        }
        req.flash("success", "You are logged out now!");
        res.redirect("/login");
    })

};
