const crypto = require("node:crypto");

const google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    scope: "openid email profile",
};
const googleJwksUrl = "https://www.googleapis.com/oauth2/v3/certs";
let googleJwksCache;

function isConfigured(provider) {
    return provider === "google" && Boolean(google.clientId && google.clientSecret);
}

function getCallbackUrl(provider) {
    const configuredBaseUrl = process.env.APP_BASE_URL?.trim();
    if (!configuredBaseUrl && process.env.NODE_ENV === "production") {
        throw new Error("APP_BASE_URL is required in production for OAuth callbacks.");
    }

    const baseUrl = configuredBaseUrl || "http://localhost:8080";
    let parsedBaseUrl;
    try {
        parsedBaseUrl = new URL(baseUrl);
    } catch {
        throw new Error("APP_BASE_URL must be a valid application origin.");
    }
    if (!["http:", "https:"].includes(parsedBaseUrl.protocol) || parsedBaseUrl.username || parsedBaseUrl.password ||
        parsedBaseUrl.pathname !== "/" || parsedBaseUrl.search || parsedBaseUrl.hash ||
        (process.env.NODE_ENV === "production" && parsedBaseUrl.protocol !== "https:")) {
        throw new Error("APP_BASE_URL must be an origin only, and production must use HTTPS.");
    }

    return `${parsedBaseUrl.origin}/auth/${provider}/callback`;
}

function createPkcePair() {
    const verifier = crypto.randomBytes(32).toString("base64url");
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    return { verifier, challenge };
}

function getAuthorizationUrl(state, { nonce, codeChallenge } = {}) {
    if (!isConfigured("google")) throw new Error("Google sign-in is not configured yet.");
    if (!nonce || !codeChallenge) throw new Error("Google sign-in requires OIDC nonce and PKCE values.");

    const url = new URL(google.authorizationEndpoint);
    url.searchParams.set("client_id", google.clientId);
    url.searchParams.set("redirect_uri", getCallbackUrl("google"));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", google.scope);
    url.searchParams.set("state", state);
    url.searchParams.set("nonce", nonce);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("prompt", "select_account");
    return url.toString();
}

async function requestJson(url, options = {}) {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
    const payload = await response.json();
    if (!response.ok) {
        throw new Error(payload.error_description || payload.error?.message || payload.message || "The identity provider rejected the sign-in request.");
    }
    return payload;
}

async function exchangeCode(code, codeVerifier) {
    if (!isConfigured("google")) throw new Error("Google sign-in is not configured yet.");
    if (!codeVerifier) throw new Error("Google sign-in is missing its PKCE verifier.");

    const params = new URLSearchParams({
        client_id: google.clientId,
        client_secret: google.clientSecret,
        code,
        redirect_uri: getCallbackUrl("google"),
        grant_type: "authorization_code",
        code_verifier: codeVerifier,
    });
    return requestJson(google.tokenEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
    });
}

function decodeJwtPart(part) {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

async function getGoogleJwks(forceRefresh = false) {
    if (!forceRefresh && googleJwksCache && googleJwksCache.expiresAt > Date.now()) {
        return googleJwksCache.keys;
    }

    const response = await fetch(googleJwksUrl, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("Could not retrieve Google's OIDC signing keys.");
    const payload = await response.json();
    if (!Array.isArray(payload.keys)) throw new Error("Google returned invalid OIDC signing keys.");
    const maxAge = Number(response.headers.get("cache-control")?.match(/max-age=(\d+)/i)?.[1]) || 3600;
    googleJwksCache = { keys: payload.keys, expiresAt: Date.now() + maxAge * 1000 };
    return googleJwksCache.keys;
}

async function verifyGoogleIdToken(idToken, expectedNonce) {
    if (typeof idToken !== "string" || typeof expectedNonce !== "string") {
        throw new Error("Google did not return a valid OIDC identity token.");
    }

    const parts = idToken.split(".");
    if (parts.length !== 3) throw new Error("Google returned a malformed OIDC identity token.");
    let header;
    let claims;
    try {
        header = decodeJwtPart(parts[0]);
        claims = decodeJwtPart(parts[1]);
    } catch {
        throw new Error("Google returned a malformed OIDC identity token.");
    }
    if (header.alg !== "RS256" || typeof header.kid !== "string") {
        throw new Error("Google used an unsupported OIDC signing key.");
    }

    let key = (await getGoogleJwks()).find((item) => item.kid === header.kid && item.kty === "RSA");
    if (!key) key = (await getGoogleJwks(true)).find((item) => item.kid === header.kid && item.kty === "RSA");
    if (!key) throw new Error("Google's OIDC signing key could not be found.");

    const publicKey = crypto.createPublicKey({ key, format: "jwk" });
    const signatureValid = crypto.verify(
        "RSA-SHA256",
        Buffer.from(`${parts[0]}.${parts[1]}`),
        publicKey,
        Buffer.from(parts[2], "base64url")
    );
    if (!signatureValid) throw new Error("Google's OIDC identity token signature is invalid.");

    const now = Math.floor(Date.now() / 1000);
    const audienceMatches = claims.aud === google.clientId ||
        (Array.isArray(claims.aud) && claims.aud.includes(google.clientId));
    if (!["https://accounts.google.com", "accounts.google.com"].includes(claims.iss) ||
        !audienceMatches || (Array.isArray(claims.aud) && claims.aud.length > 1 && claims.azp !== google.clientId) ||
        (claims.azp !== undefined && claims.azp !== google.clientId) ||
        typeof claims.exp !== "number" || claims.exp <= now ||
        typeof claims.iat !== "number" || claims.iat > now + 60 ||
        typeof claims.sub !== "string" || !claims.sub ||
        claims.nonce !== expectedNonce || claims.email_verified !== true ||
        typeof claims.email !== "string" || !claims.email) {
        throw new Error("Google's OIDC identity token failed validation.");
    }

    return { id: claims.sub, email: claims.email, name: claims.name, avatar: claims.picture };
}

function createState() {
    return crypto.randomBytes(32).toString("hex");
}

function stateMatches(received, expected) {
    if (typeof received !== "string" || typeof expected !== "string" || received.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

module.exports = {
    isConfigured,
    getCallbackUrl,
    getAuthorizationUrl,
    exchangeCode,
    verifyGoogleIdToken,
    createState,
    createPkcePair,
    stateMatches,
};
