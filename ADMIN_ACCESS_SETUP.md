# User and administrator access

Visitors must sign in before opening application pages. The login page lets them choose user or administrator access. New accounts always receive the `user` role. Google sign-in is available for users; administrator access requires the configured local username and password.

The administrator identity is pinned by both the MongoDB user role and `ADMIN_USER_ID`. Keep that value in the private `.env` file and configure the same variable in production. The application never accepts a role from a signup or profile form.

The administrator can edit and delete any listing and edit or delete any review. Users can create listings, save stays, submit reviews, and delete their own reviews.

`npm run admin:atlas:keep-only-admin` is a one-time Atlas data operation. It verifies the configured ID belongs to the existing `vivek` account and that local password credentials exist, promotes that account, stores review-author name snapshots, and removes every other user document from `heavenly_cloud`. Listings and reviews remain in place; reviews by removed accounts display their saved author names.
