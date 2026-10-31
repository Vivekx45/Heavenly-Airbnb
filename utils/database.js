if (process.env.NODE_ENV !== "production") require("dotenv").config();

const DEFAULT_ATLAS_DATABASE_NAME = "heavenly_cloud";
const LOCAL_MONGO_URL = "mongodb://127.0.0.1:27017/heavenly_main";

function getMongoUrl() {
    const configuredUrl = process.env.MONGODB_URI?.trim();
    if (!configuredUrl) {
        throw new Error("MONGODB_URI is required. Set it to your MongoDB Atlas connection URI in .env.");
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(configuredUrl);
    } catch {
        throw new Error("MONGODB_URI must be a valid MongoDB connection URI.");
    }

    if (!["mongodb:", "mongodb+srv:"].includes(parsedUrl.protocol)) {
        throw new Error("MONGODB_URI must use mongodb:// or mongodb+srv://.");
    }
    if (!parsedUrl.hostname.toLowerCase().endsWith(".mongodb.net")) {
        throw new Error("MONGODB_URI must point to a MongoDB Atlas cluster (*.mongodb.net).");
    }

    const databaseName = parsedUrl.pathname.replace(/^\//, "").split("/")[0];
    if (!databaseName) {
        const fallbackName = process.env.ATLAS_DB_NAME?.trim() || DEFAULT_ATLAS_DATABASE_NAME;
        parsedUrl.pathname = `/${encodeURIComponent(fallbackName)}`;
    }

    return parsedUrl.toString();
}

function getLocalMongoUrl() {
    return LOCAL_MONGO_URL;
}

module.exports = { getMongoUrl, getLocalMongoUrl };
