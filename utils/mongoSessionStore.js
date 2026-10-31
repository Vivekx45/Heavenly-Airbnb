const session = require("express-session");

class MongoSessionStore extends session.Store {
    constructor(connection, collectionName = "sessions") {
        super();
        this.connection = connection;
        this.collectionName = collectionName;
    }

    get collection() {
        if (this.connection.readyState !== 1) {
            throw new Error("MongoDB must be connected before reading sessions.");
        }
        return this.connection.collection(this.collectionName);
    }

    async initialize() {
        await this.collection.createIndex({ expires: 1 }, { expireAfterSeconds: 0, name: "session_expiry_ttl" });
    }

    get(sessionId, callback) {
        this.collection.findOne({ _id: sessionId, expires: { $gt: new Date() } })
            .then((record) => callback(null, record ? JSON.parse(record.session) : null))
            .catch(callback);
    }

    set(sessionId, sessionData, callback) {
        const expiration = sessionData.cookie?.expires
            ? new Date(sessionData.cookie.expires)
            : new Date(Date.now() + (Number(sessionData.cookie?.maxAge) || 24 * 60 * 60 * 1000));
        this.collection.updateOne(
            { _id: sessionId },
            { $set: { session: JSON.stringify(sessionData), expires: expiration } },
            { upsert: true }
        ).then(() => callback?.(null)).catch((error) => callback?.(error));
    }

    touch(sessionId, sessionData, callback) {
        const expiration = sessionData.cookie?.expires
            ? new Date(sessionData.cookie.expires)
            : new Date(Date.now() + (Number(sessionData.cookie?.maxAge) || 24 * 60 * 60 * 1000));
        this.collection.updateOne({ _id: sessionId }, { $set: { expires: expiration } })
            .then(() => callback?.(null)).catch((error) => callback?.(error));
    }

    destroy(sessionId, callback) {
        this.collection.deleteOne({ _id: sessionId })
            .then(() => callback?.(null)).catch((error) => callback?.(error));
    }
}

module.exports = MongoSessionStore;
