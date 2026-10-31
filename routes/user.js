const express = require('express');
const router = express.Router();
const wrapAsync = require('../utils/wrapAsync.js');
const passport = require("passport");
const User = require("../models/user.js");
const { saveRedirectUrl, isLoggedIn, validateSignup, validateLogin, validateObjectId } = require("../middleware.js");
const socialAuth = require("../utils/socialAuth.js");
const isConfiguredAdmin = require("../utils/adminAccess.js");

const userController = require("../controller/users.js");

const requireAuthenticatedApi = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Log in to manage saved listings." });
    }
    next();
};

const getSafeReturnTo = (value) =>
    typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/listings";

const captureLoginMode = (req, res, next) => {
    const mode = req.body?.loginMode;
    if (mode !== "user" && mode !== "admin") {
        req.flash("error", "Choose whether to sign in as a user or administrator.");
        return res.redirect("/login");
    }
    req.loginMode = mode;
    delete req.body.loginMode;
    next();
};

router.get("/auth/:provider", (req, res) => {
    if (req.isAuthenticated()) return res.redirect("/listings");
    const { provider } = req.params;
    if (provider !== "google") return res.redirect("/signup");

    if (!socialAuth.isConfigured(provider)) {
        req.flash("error", "Google sign-in needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the .env file.");
        return res.redirect(req.query.flow === "login" ? "/login" : "/signup");
    }

    const state = socialAuth.createState();
    const oidcNonce = socialAuth.createState();
    const pkce = socialAuth.createPkcePair();
    req.session.socialAuth = {
        provider,
        state,
        nonce: oidcNonce,
        codeVerifier: pkce?.verifier,
        flow: req.query.flow === "login" ? "login" : "signup",
        returnTo: getSafeReturnTo(req.query.returnTo),
    };
    res.redirect(socialAuth.getAuthorizationUrl(state, {
        nonce: oidcNonce,
        codeChallenge: pkce?.challenge,
    }));
});

router.get("/auth/:provider/callback", wrapAsync(async (req, res) => {
    const provider = req.params.provider;
    if (req.params.provider !== "google") return res.redirect("/signup");
    const savedAuth = req.session.socialAuth;
    delete req.session.socialAuth;
    const fallback = savedAuth?.flow === "login" ? "/login" : "/signup";

    if (req.query.error || savedAuth?.provider !== provider ||
        !socialAuth.stateMatches(req.query.state, savedAuth?.state) || typeof req.query.code !== "string") {
        req.flash("error", "Social sign-in was cancelled or could not be verified. Please try again.");
        return res.redirect(fallback);
    }

    try {
        const tokens = await socialAuth.exchangeCode(req.query.code, savedAuth.codeVerifier);
        const profile = await socialAuth.verifyGoogleIdToken(tokens.id_token, savedAuth.nonce);
        const adminUserId = process.env.ADMIN_USER_ID?.trim();
        if (adminUserId) {
            const admin = await User.findById(adminUserId).select("email").lean();
            if (admin?.email?.toLowerCase() === profile.email?.toLowerCase()) {
                req.flash("error", "Administrator accounts must use the administrator username and password login.");
                return res.redirect("/login/admin");
            }
        }
        const user = await userController.findOrCreateSocialUser(provider, profile);
        if (user.role === "admin" || isConfiguredAdmin(user)) {
            req.flash("error", "Administrator accounts must use the administrator username and password login.");
            return res.redirect("/login/admin");
        }
        await new Promise((resolve, reject) => req.login(user, (error) => error ? reject(error) : resolve()));
        await User.updateOne({ _id: user._id }, {
            $set: { lastLoginAt: new Date() },
            $inc: { loginCount: 1 },
        }).catch((error) => console.warn("Could not update account login history:", error.message));
        req.flash("success", `Welcome to Heavenly, ${profile.name || "traveler"}!`);
        return res.redirect(getSafeReturnTo(savedAuth.returnTo));
    } catch (error) {
        console.error("Social sign-in failed:", error.message);
        req.flash("error", "Social sign-in could not be completed. Check the provider setup and try again.");
        return res.redirect(fallback);
    }
}));

router.get("/saved", isLoggedIn, wrapAsync(userController.renderSavedListings));
router.get("/profile", isLoggedIn, userController.renderProfile);
router.post("/saved-listings/:id", requireAuthenticatedApi, validateObjectId("id", "listing"), wrapAsync(userController.saveListing));
router.delete("/saved-listings/:id", requireAuthenticatedApi, validateObjectId("id", "listing"), wrapAsync(userController.removeSavedListing));

// ---------------------------------------------------------------------------------

// SignUp Route

router.route("/signup")
    .get(userController.renderSignupForm)
    .post((req, res, next) => req.isAuthenticated() ? res.redirect("/listings") : next(), validateSignup, wrapAsync(userController.signup));

// ---------------------------------------------------------------------------------

// Login Route

router.get("/login/user", userController.renderUserLogin);
router.get("/login/admin", userController.renderAdminLogin);

router.route("/login")
    .get(userController.renderLoginFrom)
    .post(captureLoginMode, validateLogin, saveRedirectUrl, (req, res, next) => {
        passport.authenticate("local", (error, user, info) => {
            if (error) return next(error);
            if (!user) {
                req.flash("error", info?.message || "Username or password is incorrect.");
                return res.redirect(`/login/${req.loginMode}`);
            }

            if (req.loginMode === "admin" && !isConfiguredAdmin(user)) {
                req.flash("error", "This account is not enabled for administrator access.");
                return res.redirect("/login/admin");
            }
            if (req.loginMode === "user" && user.role === "admin") {
                req.flash("error", "Use administrator login for this account.");
                return res.redirect("/login/user");
            }

            req.logIn(user, (loginError) => {
                if (loginError) return next(loginError);
                next();
            });
        })(req, res, next);
    }, userController.login);

// ---------------------------------------------------------------------------------

// Logout Route

router.get("/logout", userController.logout);

module.exports = router;



