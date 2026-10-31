const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const ExpressError = require("./ExpressError.js");

module.exports = async function geocodeLocation(location, country) {
    const token = process.env.MAP_TOKEN;
    if (!token) throw new ExpressError(503, "Location lookup is unavailable. Configure MAP_TOKEN and try again.");

    try {
        const client = mbxGeocoding({ accessToken: token });
        const response = await client.forwardGeocode({
            query: [location, country].filter(Boolean).join(", "),
            limit: 1,
            types: ["place", "locality", "neighborhood", "address", "region", "country"],
        }).send();
        const geometry = response.body.features?.[0]?.geometry;
        const coordinates = geometry?.coordinates;
        if (geometry?.type !== "Point" || !Array.isArray(coordinates) || coordinates.length < 2 ||
            !coordinates.slice(0, 2).every(Number.isFinite) || coordinates[0] < -180 || coordinates[0] > 180 ||
            coordinates[1] < -90 || coordinates[1] > 90) {
            throw new ExpressError(422, "We couldn't locate that destination. Check the city and country and try again.");
        }
        return { type: "Point", coordinates: coordinates.slice(0, 2) };
    } catch (error) {
        if (error instanceof ExpressError) throw error;
        throw new ExpressError(502, "Location lookup failed. Please try again in a moment.");
    }
};
