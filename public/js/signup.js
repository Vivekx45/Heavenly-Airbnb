(() => {
    const passwordInput = document.querySelector("#password");
    const toggleButton = document.querySelector("[data-password-toggle]");
    const toggleIcon = toggleButton?.querySelector("i");
    const status = document.querySelector("[data-password-status]");

    if (!passwordInput || !toggleButton) return;

    toggleButton.addEventListener("click", () => {
        const reveal = passwordInput.type === "password";
        passwordInput.type = reveal ? "text" : "password";
        toggleButton.setAttribute("aria-label", reveal ? "Hide password" : "Show password");
        toggleButton.setAttribute("aria-pressed", String(reveal));
        toggleIcon?.classList.toggle("bi-eye", !reveal);
        toggleIcon?.classList.toggle("bi-eye-slash", reveal);
    });

    passwordInput.addEventListener("input", () => {
        if (!status) return;
        const remaining = Math.max(0, 8 - passwordInput.value.length);
        status.textContent = passwordInput.value.length === 0
            ? ""
            : remaining === 0
                ? "That meets the minimum length."
                : `${remaining} more character${remaining === 1 ? "" : "s"} needed.`;
    });
})();
