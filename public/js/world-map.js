(() => {
    const container = document.querySelector("#earth-map");
    if (!container) return;

    const mapToken = container.dataset.mapToken;
    const listings = JSON.parse(container.dataset.listings || "[]");
    if (!mapToken || typeof mapboxgl === "undefined") {
        container.innerHTML = '<div class="alert alert-warning m-3" role="alert">The world map is unavailable. Check the Mapbox token and try again.</div>';
        return;
    }

    mapboxgl.accessToken = mapToken;

    const newDelhi = [77.209, 28.6139];
    const map = new mapboxgl.Map({
        container,
        style: "mapbox://styles/mapbox/standard",
        projection: "globe",
        center: newDelhi,
        zoom: 9,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "top-right");
    map.addControl(new mapboxgl.FullscreenControl(), "top-right");

    map.on("style.load", () => map.setFog({}));

    map.on("load", () => {
        const features = listings.map((listing) => ({
            type: "Feature",
            properties: listing,
            geometry: { type: "Point", coordinates: listing.coordinates },
        }));

        map.addSource("listing-destinations", {
            type: "geojson",
            data: { type: "FeatureCollection", features },
            cluster: true,
            clusterMaxZoom: 9,
            clusterRadius: 48,
        });

        map.addLayer({
            id: "destination-clusters",
            type: "circle",
            source: "listing-destinations",
            filter: ["has", "point_count"],
            paint: {
                "circle-color": "#fe424d",
                "circle-radius": ["step", ["get", "point_count"], 17, 10, 21, 30, 26],
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 2,
            },
        });

        map.addLayer({
            id: "destination-cluster-count",
            type: "symbol",
            source: "listing-destinations",
            filter: ["has", "point_count"],
            layout: {
                "text-field": ["get", "point_count_abbreviated"],
                "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
                "text-size": 12,
            },
            paint: { "text-color": "#ffffff" },
        });

        map.addLayer({
            id: "destination-points",
            type: "circle",
            source: "listing-destinations",
            filter: ["!", ["has", "point_count"]],
            paint: {
                "circle-color": "#fe424d",
                "circle-radius": 8,
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 2,
            },
        });

        map.on("click", "destination-clusters", (event) => {
            const cluster = map.queryRenderedFeatures(event.point, { layers: ["destination-clusters"] })[0];
            const source = map.getSource("listing-destinations");
            source.getClusterExpansionZoom(cluster.properties.cluster_id, (error, zoom) => {
                if (!error) map.easeTo({ center: cluster.geometry.coordinates, zoom });
            });
        });

        map.on("click", "destination-points", (event) => {
            const listing = event.features[0].properties;
            const popupContent = document.createElement("div");
            popupContent.className = "d-grid gap-1";

            const title = document.createElement("strong");
            title.textContent = listing.title;
            popupContent.append(title);

            const location = document.createElement("span");
            location.className = "small text-body-secondary";
            location.textContent = [listing.location, listing.country].filter(Boolean).join(", ");
            popupContent.append(location);

            const viewLink = document.createElement("a");
            viewLink.className = "btn btn-sm btn-danger rounded-pill mt-1";
            viewLink.href = listing.url;
            viewLink.textContent = "View listing";
            popupContent.append(viewLink);

            new mapboxgl.Popup({ offset: 12 })
                .setLngLat(event.features[0].geometry.coordinates)
                .setDOMContent(popupContent)
                .addTo(map);
        });

        map.on("mouseenter", "destination-clusters", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "destination-clusters", () => { map.getCanvas().style.cursor = ""; });
        map.on("mouseenter", "destination-points", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "destination-points", () => { map.getCanvas().style.cursor = ""; });

        document.querySelector("[data-fit-listings]")?.addEventListener("click", () => {
            if (features.length === 1) {
                map.flyTo({ center: features[0].geometry.coordinates, zoom: 9 });
                return;
            }

            const bounds = new mapboxgl.LngLatBounds();
            features.forEach(({ geometry }) => bounds.extend(geometry.coordinates));
            map.fitBounds(bounds, { padding: 80, maxZoom: 2.5, duration: 1000 });
        });
    });
})();
