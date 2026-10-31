(() => {
    const pageUrl = `${window.location.origin}/listings`;
    const shareText = "Discover places to stay on Heavenly";
    const shareLinks = {
        facebook: ["https://www.facebook.com/sharer/sharer.php", { url: pageUrl }],
        x: ["https://twitter.com/intent/tweet", { url: pageUrl, text: shareText }],
        whatsapp: ["https://api.whatsapp.com/send", { text: `${shareText}: ${pageUrl}` }],
        telegram: ["https://t.me/share/url", { url: pageUrl, text: shareText }],
        linkedin: ["https://www.linkedin.com/sharing/share-offsite/", { url: pageUrl }],
    };

    document.querySelectorAll("[data-share-platform]").forEach((link) => {
        const share = shareLinks[link.dataset.sharePlatform];
        if (!share) return;

        const url = new URL(share[0]);
        Object.entries(share[1]).forEach(([key, value]) => url.searchParams.set(key, value));
        link.href = url.toString();
    });

    const copyButton = document.querySelector("[data-copy-site-link]");
    const status = document.querySelector("[data-footer-copy-status]");
    let resetStatusTimer;

    copyButton?.addEventListener("click", async () => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(pageUrl);
            } else {
                const copyField = document.createElement("textarea");
                copyField.value = pageUrl;
                copyField.setAttribute("readonly", "");
                copyField.className = "position-fixed top-0 start-0 opacity-0";
                document.body.append(copyField);
                copyField.select();
                const copied = document.execCommand("copy");
                copyField.remove();
                if (!copied) throw new Error("Copy failed");
            }

            status.textContent = "Link copied";
        } catch {
            status.textContent = "Could not copy link";
        }

        window.clearTimeout(resetStatusTimer);
        resetStatusTimer = window.setTimeout(() => { status.textContent = ""; }, 2500);
    });
})();
