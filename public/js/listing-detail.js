document.querySelectorAll("[data-save-listing]").forEach((button) => {
    let isSaved = button.dataset.saved === "true";
    const icon = button.querySelector("i");
    const label = button.querySelector("span");

    const updateButton = () => {
        button.dataset.saved = String(isSaved);
        button.setAttribute("aria-pressed", String(isSaved));
        button.setAttribute("aria-label", isSaved ? "Remove from saved listings" : "Save this listing");
        icon.classList.toggle("bi-heart-fill", isSaved);
        icon.classList.toggle("bi-heart", !isSaved);
        label.textContent = isSaved ? "Saved" : "Save";
    };

    button.addEventListener("click", async () => {
        const wasSaved = isSaved;
        button.disabled = true;
        try {
            const response = await fetch(button.dataset.saveUrl, {
                method: wasSaved ? "DELETE" : "POST",
                headers: { Accept: "application/json" },
                credentials: "same-origin",
            });
            if (response.status === 401) {
                window.location.href = "/login";
                return;
            }
            if (!response.ok) throw new Error("Unable to update saved listing");
            isSaved = !wasSaved;
            updateButton();
        } catch {
            label.textContent = "Try again";
            window.setTimeout(updateButton, 1600);
        } finally {
            button.disabled = false;
        }
    });

    updateButton();
});

document.querySelectorAll("[data-share-listing]").forEach((button) => {
    button.addEventListener("click", async () => {
        const title = document.querySelector(".listing-show-title")?.textContent.trim() || document.title;
        const label = button.querySelector("span");

        if (navigator.share) {
            try {
                await navigator.share({ title, url: window.location.href });
                return;
            } catch (error) {
                if (error.name === "AbortError") return;
            }
        }

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(window.location.href);
            } else {
                const copyField = document.createElement("textarea");
                copyField.value = window.location.href;
                copyField.setAttribute("readonly", "");
                copyField.style.position = "fixed";
                copyField.style.opacity = "0";
                document.body.appendChild(copyField);
                copyField.select();
                const copied = document.execCommand("copy");
                copyField.remove();
                if (!copied) throw new Error("Clipboard copy failed");
            }

            label.textContent = "Copied";
            window.setTimeout(() => { label.textContent = "Share"; }, 1800);
        } catch {
            label.textContent = "Copy unavailable";
            window.setTimeout(() => { label.textContent = "Share"; }, 1800);
        }
    });
});

document.querySelectorAll(".listing-review-form form").forEach((form) => {
    const ratingGroup = form.querySelector(".listing-review-rating");
    const ratingFeedback = ratingGroup.querySelector("[data-rating-feedback]");
    const ratingInputs = [...ratingGroup.querySelectorAll('input[name="review[rating]"]:not(.input-no-rate)')];
    const ratingMessages = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];
    const comment = form.querySelector("#comment");
    const characterCount = form.querySelector("[data-review-character-count]");

    ratingInputs.forEach((input) => {
        input.addEventListener("change", () => {
            ratingGroup.classList.remove("rating-invalid");
            ratingFeedback.textContent = ratingMessages[Number(input.value)];
        });
    });

    form.addEventListener("submit", (event) => {
        const selectedRating = form.querySelector('input[name="review[rating]"]:checked:not(.input-no-rate)');
        if (!selectedRating) {
            event.preventDefault();
            event.stopPropagation();
            ratingGroup.classList.add("rating-invalid");
            ratingFeedback.textContent = "Choose a star rating before submitting.";
            ratingInputs[0]?.focus();
        }
    });

    const updateCharacterCount = () => {
        const count = comment.value.length;
        characterCount.textContent = `${count} character${count === 1 ? "" : "s"}`;
    };

    comment.addEventListener("input", updateCharacterCount);
    updateCharacterCount();
});
