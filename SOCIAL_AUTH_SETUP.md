# Google sign-in setup

Heavenly supports username-and-password accounts and Google OpenID Connect sign-in for user accounts. Administrators sign in with their Heavenly username and password.

## Configure Google

1. Create a Google OAuth client with application type **Web application**.
2. Add this authorized redirect URI for local development:

   `http://localhost:8080/auth/google/callback`

3. Copy `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from the client into the existing private `.env` file. Keep the database, Cloudinary, Mapbox, session, and administrator settings already there.
4. Set `APP_BASE_URL` to the application's origin. Use `http://localhost:8080` locally and an HTTPS origin in production, without a trailing slash.

Google sign-in requests the `openid`, `email`, and `profile` scopes. The app validates Google's ID token and does not store provider tokens. Administrator accounts must continue using the local username-and-password form.

For local testing, keep the OAuth consent screen in testing mode and allow the Google account used for testing. For production, register the production callback URL with Google and publish or verify the consent screen as required by the project configuration.
