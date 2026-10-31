(() => {
    const input = document.querySelector("[data-listing-search]");
    const menu = document.querySelector("[data-search-suggestions]");
    if (!input || !menu) return;

    let timer;
    let activeRequest;

    const closeMenu = () => {
        menu.classList.remove("show");
        menu.replaceChildren();
        input.setAttribute("aria-expanded", "false");
    };

    const showMessage = (message) => {
        const item = document.createElement("span");
        item.className = "dropdown-item-text small text-body-secondary";
        item.textContent = message;
        menu.replaceChildren(item);
        menu.classList.add("show");
        input.setAttribute("aria-expanded", "true");
    };

    const showSuggestions = (listings) => {
        menu.replaceChildren();
        if (!listings.length) {
            showMessage("No matching stays");
            return;
        }

        listings.forEach((listing) => {
            const link = document.createElement("a");
            link.className = "dropdown-item text-wrap";
            link.href = `/listings/${encodeURIComponent(listing.id)}`;
            link.setAttribute("role", "option");

            const title = document.createElement("span");
            title.className = "d-block fw-semibold";
            title.textContent = listing.title;

            const location = document.createElement("small");
            location.className = "d-block text-body-secondary";
            location.textContent = listing.location;

            link.append(title, location);
            menu.append(link);
        });

        menu.classList.add("show");
        input.setAttribute("aria-expanded", "true");
    };

    const loadSuggestions = async () => {
        const query = input.value.trim();
        if (!query) {
            activeRequest?.abort();
            closeMenu();
            return;
        }

        activeRequest?.abort();
        activeRequest = new AbortController();
        try {
            const response = await fetch(`/listings/search-suggestions?q=${encodeURIComponent(query)}`, {
                headers: { Accept: "application/json" },
                signal: activeRequest.signal,
            });
            if (!response.ok) throw new Error("Search suggestions failed");
            showSuggestions(await response.json());
        } catch (error) {
            if (error.name !== "AbortError") closeMenu();
        }
    };

    input.addEventListener("input", () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(loadSuggestions, 180);
    });

    input.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown" && menu.classList.contains("show")) {
            const firstOption = menu.querySelector("a[role='option']");
            if (firstOption) {
                event.preventDefault();
                firstOption.focus();
            }
        } else if (event.key === "Escape") {
            closeMenu();
        }
    });

    menu.addEventListener("keydown", (event) => {
        const options = [...menu.querySelectorAll("a[role='option']")];
        const currentIndex = options.indexOf(document.activeElement);
        if (event.key === "ArrowDown" && currentIndex < options.length - 1) {
            event.preventDefault();
            options[currentIndex + 1].focus();
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            if (currentIndex <= 0) input.focus();
            else options[currentIndex - 1].focus();
        } else if (event.key === "Escape") {
            closeMenu();
            input.focus();
        }
    });

    document.addEventListener("click", (event) => {
        if (!menu.contains(event.target) && event.target !== input) closeMenu();
    });
})();
