function isConfiguredAdmin(user) {
    const adminUserId = process.env.ADMIN_USER_ID?.trim();
    return Boolean(user && adminUserId && user.role === "admin" && String(user._id) === adminUserId);
}

module.exports = isConfiguredAdmin;
