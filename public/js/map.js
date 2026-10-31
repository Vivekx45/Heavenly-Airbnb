const mapContainer = document.getElementById("map");
const hasCoordinates = Array.isArray(coordinates) && coordinates.length === 2 &&
    coordinates.every(Number.isFinite) && coordinates[0] >= -180 && coordinates[0] <= 180 &&
    coordinates[1] >= -90 && coordinates[1] <= 90;

if (!mapContainer) {
    // The map script can be included by pages without a listing map.
} else if (!mapToken || !hasCoordinates || typeof mapboxgl === "undefined") {
    mapContainer.textContent = "Map preview is unavailable for this listing right now.";
    mapContainer.setAttribute("role", "status");
} else {
    mapboxgl.accessToken = mapToken;
    const map = new mapboxgl.Map({
        container: mapContainer,
        style: "mapbox://styles/mapbox/streets-v12",
        center: coordinates,
        zoom: 9,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    const popupContent = document.createElement("div");
    const heading = document.createElement("h6");
    heading.textContent = locationName || "Listing area";
    const note = document.createElement("p");
    note.textContent = "Exact location will be provided after booking.";
    popupContent.append(heading, note);

    new mapboxgl.Marker({ color: "red" })
        .setLngLat(coordinates)
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setDOMContent(popupContent))
        .addTo(map);
}
