const dns = require("node:dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const mongoose = require("mongoose");
const User = require("../models/user.js");
const Review = require("../models/review.js");
const { getMongoUrl } = require("../utils/database.js");

const EXPECTED_DATABASE = "heavenly_cloud";
const EXPECTED_ADMIN_USERNAME = "vivek";

async function configureAtlasAdmin() {
    const adminUserId = process.env.ADMIN_USER_ID?.trim();
    if (!mongoose.isValidObjectId(adminUserId)) {
        throw new Error("Set ADMIN_USER_ID to the existing Vivek account's MongoDB ID in .env.");
    }

    const mongoUrl = getMongoUrl();
    const configuredHost = new URL(mongoUrl).hostname.toLowerCase();
    if (!configuredHost.endsWith(".mongodb.net")) {
        throw new Error(`Refusing to modify a non-Atlas host: ${configuredHost}.`);
    }

    await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 20000 });
    if (mongoose.connection.name !== EXPECTED_DATABASE) {
        throw new Error(`Refusing to modify ${mongoose.connection.name}; expected ${EXPECTED_DATABASE}.`);
    }

    const session = await mongoose.startSession();
    let summary = { removedUsers: 0, remainingUsers: 0, reviewsWithNameSnapshots: 0 };
    try {
        await session.withTransaction(async () => {
            const admin = await User.findById(adminUserId)
                .select("username role +hash +salt")
                .session(session);
            if (!admin || admin.username.toLowerCase() !== EXPECTED_ADMIN_USERNAME) {
                throw new Error("ADMIN_USER_ID does not point to the expected existing Vivek account.");
            }
            if (!admin.hash || !admin.salt) {
                throw new Error("The selected administrator account has no local password credentials.");
            }

            const usersToRemove = await User.find({ _id: { $ne: admin._id } })
                .select("_id username")
                .session(session)
                .lean();

            if (usersToRemove.length) {
                const nameSnapshots = usersToRemove.map((user) => ({
                    updateMany: {
                        filter: {
                            author: user._id,
                            $or: [
                                { authorName: { $exists: false } },
                                { authorName: null },
                                { authorName: "" },
                            ],
                        },
                        update: { $set: { authorName: user.username } },
                    },
                }));
                const snapshotResult = await Review.bulkWrite(nameSnapshots, { session, ordered: false });
                summary.reviewsWithNameSnapshots = snapshotResult.modifiedCount;
            }

            admin.role = "admin";
            await admin.save({ session });

            const deletion = await User.deleteMany({ _id: { $ne: admin._id } }, { session });
            summary.removedUsers = deletion.deletedCount;
            summary.remainingUsers = await User.countDocuments({}).session(session);
            if (summary.remainingUsers !== 1) {
                throw new Error(`Expected one Atlas user after cleanup, found ${summary.remainingUsers}.`);
            }
        });

        console.log(`Atlas admin configured for username ${EXPECTED_ADMIN_USERNAME}; removed ${summary.removedUsers} other user accounts and kept ${summary.remainingUsers}. Preserved ${summary.reviewsWithNameSnapshots} review author names.`);
    } finally {
        await session.endSession();
    }
}

if (require.main === module) {
    configureAtlasAdmin()
        .catch((error) => {
            console.error("Atlas admin setup failed:", error.message);
            process.exitCode = 1;
        })
        .finally(async () => {
            await mongoose.disconnect().catch(() => {});
        });
}

module.exports = { configureAtlasAdmin };
