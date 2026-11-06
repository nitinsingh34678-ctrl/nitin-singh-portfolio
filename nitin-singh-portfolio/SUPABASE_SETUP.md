# Owner-only editing and public portfolio publishing

V17 starts in **read-only mode**. Visitors can browse the portfolio, open certificates, follow public links, use theme controls and view project information. They cannot see the edit buttons or change the published portfolio. The editor unlocks only after a Supabase session whose email exactly matches `ownerEmail` in `cloud-config.js`.

The database also enforces this rule with Row Level Security (RLS). Hiding controls in the browser is only the user interface; the RLS policies are the actual write protection.

## What you need

- A Supabase account and a new Supabase project.
- The email address you will use as the one portfolio owner.
- Your Supabase Project URL and the **anon / publishable** key.

Never put a Supabase `service_role` or secret key in this website. The anon / publishable key is intended for browser use when RLS is correctly enabled.

## 1. Create the Supabase project and owner account

1. Create a project in the Supabase dashboard.
2. Open **Authentication → Users** and create/invite the one email address that will own this portfolio. Make sure the email is confirmed/verified. This site uses email magic-link sign-in and does not store a password.
3. Do not create additional editor accounts for visitors.

## 2. Create the protected portfolio table

1. Open the `supabase/schema.sql` file in this folder.
2. Replace `YOUR_VERIFIED_OWNER_EMAIL` with the exact owner email, keeping the single quotes around it.
3. Paste the complete SQL into Supabase **SQL Editor** and run it.
4. In **Table Editor → portfolio_state → Policies**, confirm RLS is enabled and the policies from the SQL are present.

The policy design is: public `SELECT`, owner-only `INSERT` and `UPDATE`; anonymous users receive no write permission. Do not disable RLS.

## 3. Configure the website

Open `cloud-config.js` and fill in the values from **Project Settings → API**:

```js
window.PORTFOLIO_CLOUD_CONFIG = {
  enabled: true,
  supabaseUrl: "https://YOUR_PROJECT_ID.supabase.co",
  supabaseAnonKey: "YOUR_ANON_OR_PUBLISHABLE_KEY",
  ownerEmail: "YOUR_VERIFIED_OWNER_EMAIL"
};
```

The email must match the email in the SQL policy exactly (case-insensitive matching is applied). Do not use a `service_role` or secret key.

## 4. Configure the secure magic-link callback

This version uses Supabase's PKCE email flow. The one-time email token is verified by the included `auth/confirm.html` page before the portfolio unlocks.

1. In Supabase **Authentication → URL Configuration**, set the Site URL to your deployed website URL.
2. Add the exact local callback URL (for example `http://127.0.0.1:5500/auth/confirm.html`) to Redirect URLs.
3. Add the exact production callback URL (for example `https://your-portfolio.vercel.app/auth/confirm.html`) to Redirect URLs.
4. Open **Authentication → Email Templates → Magic Link**.
5. Replace the template HTML with the contents of `OWNER_MAGIC_LINK_TEMPLATE.html`, then save it. The template uses `{{ .RedirectTo }}` and `{{ .TokenHash }}` to send the one-time token to the included callback page.

Use your actual site domain, including `www` if you use it. The `emailRedirectTo` in the site code points to `/auth/confirm.html`.

## 5. Publish the first version

1. Deploy this configured site to your static host (Vercel, Netlify, or GitHub Pages).
2. Open the deployed website and click **Owner sign-in** in the header or the Notes section.
3. Enter the configured owner email and request a magic link.
4. Open the email link in the same browser where the portfolio is open. It first passes through `auth/confirm.html`, which verifies the one-time token and checks the owner email.
5. The editor controls should appear. Click **Publish now** in the owner sync dialog to publish the first copy.
6. Open the site in a private/incognito window. It should show the published content but no edit controls.

After this, edits made while signed in as the owner automatically publish after a short delay. Visitors receive the latest state through the public read policy and the realtime refresh subscription.

## Visitor and owner behavior

| Feature | Visitor | Verified owner |
| --- | --- | --- |
| Browse projects and certificates | Yes | Yes |
| Open certificate PDFs and public links | Yes | Yes |
| Change local theme preference | Yes, on their own browser | Yes |
| Add/remove credentials | No | Yes |
| Add/edit/remove projects | No | Yes |
| Change portrait | No | Yes |
| Edit profile/social links | No | Yes |
| Add/remove technical notes and LeetCode journal entries | No | Yes |

## Public content warning

Anything stored in `portfolio_state.payload` is public portfolio content. Treat cloud-synced notes, project descriptions, screenshots, credentials, social links and portrait overrides as information you are happy for anyone to see. Certificate PDFs inside `assets/certificates/` are public static files as well.

The JSON payload limit in the frontend is 3.5 MB. Project and portrait uploads are compressed before syncing. If publishing fails due to size, reduce uploaded images and try again.

## Troubleshooting

- **Public preview / owner editing locked:** `cloud-config.js` is still disabled or missing a Project URL, anon key or owner email.
- **Invalid API key / fetch error:** copy the Project URL and anon/publishable key from the correct Supabase project.
- **Magic link not sent:** confirm the owner user exists in Supabase Auth and the email is verified. The login flow intentionally does not create arbitrary new users.
- **Redirect URL not allowed:** add the exact local/live URL under Authentication → URL Configuration.
- **Permission denied on publish:** check the owner email in the SQL policy, the owner email in `cloud-config.js`, and that RLS remains enabled.
- **Owner signed in but edit controls hidden:** make sure the email on the Supabase session matches `ownerEmail` exactly, the Magic Link template contains the token-hash link, and `/auth/confirm.html` is deployed.
- **Changes visible only in one browser:** confirm the owner sign-in completed and the cloud sync status says publishing succeeded.
