(() => {
    const imageInput = document.querySelector("[data-listing-image]");
    const imagePreview = document.querySelector("[data-image-preview]");
    const previewWrap = document.querySelector("[data-image-preview-wrap]");
    const descriptionInput = document.querySelector("[data-description-input]");
    const descriptionCount = document.querySelector("[data-description-count]");
    const form = imageInput?.form;
    let previewUrl;

    imageInput?.addEventListener("change", () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        const file = imageInput.files?.[0];

        if (!file || !file.type.startsWith("image/")) {
            previewWrap?.classList.add("d-none");
            imagePreview?.removeAttribute("src");
            return;
        }

        previewUrl = URL.createObjectURL(file);
        imagePreview.src = previewUrl;
        previewWrap.classList.remove("d-none");
    });

    const updateDescriptionCount = () => {
        if (descriptionInput && descriptionCount) {
            descriptionCount.textContent = descriptionInput.value.length;
        }
    };

    descriptionInput?.addEventListener("input", updateDescriptionCount);
    form?.addEventListener("reset", () => {
        requestAnimationFrame(() => {
            updateDescriptionCount();
            previewWrap?.classList.add("d-none");
            imagePreview?.removeAttribute("src");
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            previewUrl = undefined;
        });
    });
})();
