# Veylora – Fashion Beyond Borders

Veylora uses HTML, CSS, JavaScript, PHP, and Supabase. PHP serves the site and handles the customer auth API; Supabase Auth manages credentials and Supabase Postgres stores customer profiles. There is no build step or npm dependency.

## Folder structure
```
veylora/
├── index.html        ← page markup
├── css/
│   └── style.css     ← all styling
├── js/
│   ├── main.js       ← shop, cart, checkout, wishlist, catalog, etc.
│   ├── search.js     ← site search popup
│   └── admin.js      ← admin portal
├── api/
│   ├── auth.php      ← signup, login, logout, and session API
│   ├── addresses.php ← authenticated customer address CRUD API
│   ├── orders.php    ← authenticated order create/list API
│   ├── reviews.php   ← public product reviews and authenticated review submission
│   └── supabase.php  ← shared Supabase Auth and PostgREST client
├── database/
│   ├── schema.sql    ← Supabase profiles, addresses, orders, and invoice fields with RLS
│   ├── orders.sql    ← incremental order and invoice migration for existing projects
│   └── reviews.sql   ← incremental product review migration for existing projects
└── images/           ← all photos + UPI QR
```

## Run locally
You cannot run the PHP-backed website by opening `index.html` from GitHub or by double-clicking it. Download the whole repository and run it through PHP; each person also needs their own Supabase project and local `.env` configuration.

1. Get the project files. Either clone the repository:

   ```sh
   git clone <your-github-repository-url> veylora
   cd veylora
   ```

   Or on GitHub click **Code → Download ZIP**, extract the ZIP, and open a terminal in the extracted `veylora` folder.
2. Install PHP 8.1+ with the `curl` and `mbstring` extensions, then confirm `php -v` works in your terminal. This project uses PHP, HTML, CSS, JavaScript, and Supabase; it has no Node.js, npm, or build-step requirement.
3. Create your own Supabase project. In its SQL Editor, run the full contents of `database/schema.sql`. Supabase Auth owns passwords in `auth.users`; the trigger creates a matching row in `public.profiles`. The schema also creates `public.addresses`, `public.orders`, and `public.reviews` with row-level security and automatic `updated_at` timestamps. Orders store a unique invoice number, issue time, and a snapshot of the customer and delivery details used on the invoice. For an existing project that already has profiles, addresses, and orders, run both `database/orders.sql` and `database/reviews.sql` to add invoice fields and review storage. Confirm that the SQL Editor is open to the same project whose URL you will put in `.env`.
4. Create your local environment file from the placeholders:

   ```sh
   cp .env.example .env
   ```

   Edit `.env` and replace the placeholders with your own Supabase **Project URL** and **publishable key** (or legacy **anon key**):

   ```dotenv
   SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
   ```

   `.env` and other `.env.*` files are ignored by Git; `.env.example` is the only exception and contains placeholders only. PHP loads `.env` from the project root automatically, and process environment variables take precedence. Never put a Supabase `service_role` or secret key in this project. Apache is configured by the included `.htaccess` to deny web access to environment files; configure equivalent protection if you deploy with another web server. PHP keeps customer Supabase tokens in its server-side session; the browser receives only an HttpOnly PHP session cookie.
5. From the project folder, start PHP:

   ```sh
   php -S 127.0.0.1:8000
   ```

   Keep that terminal open and open http://127.0.0.1:8000 in your browser. On Windows, use PowerShell or Command Prompt opened in the project folder to run the same command. Do not open `index.html` directly or use Live Server for authentication. Restart PHP after changing `.env`.

Signup and login requests go from PHP to Supabase Auth. If email confirmation is enabled in Supabase Auth, users must confirm their email before logging in. The API's `GET /api/auth.php` returns the current session and a CSRF token; configuration or connectivity errors are reported to the signup/login forms. Orders and their invoices are inserted into `public.orders` through the authenticated PHP API before checkout confirmation is shown. Each invoice preserves its number, issue time, customer contact and delivery-address snapshot, item names/types/sizes, unit prices and quantities, calculated total, and payment method/status. Customers can find invoices under **My orders & invoices** and print them or use their browser's **Save as PDF** option. If order submission is rejected due to a database constraint/schema mismatch, the API now points to the required `database/orders.sql` migration instead of showing an unexplained generic error.

Product reviews are saved in Supabase. Anyone can read a product's ratings and reviews; signed-in customers can leave one rating/review per product and update their own review. The product detail modal shows the average rating, review count, and review text.

If signup reports that Supabase could not save the new account, verify that `database/schema.sql` completed successfully in the same project as `.env`, especially the `public.profiles` table and `on_auth_user_created` trigger. If login says the email is unconfirmed, use the confirmation link Supabase sent or request a resend from the login form; configure SMTP or Supabase Auth email settings if confirmation messages are not delivered.

Supabase 429 responses are temporary provider-side rate limits, not a local account setting. Wait for the retry time shown and avoid repeatedly submitting signup, login, or resend requests. If signup specifically hits the built-in email sending limit, the project owner should configure custom SMTP under **Project Settings → Authentication → SMTP Settings** (menu labels can vary by Supabase version). For other rate limits, review **Authentication → Rate Limits**. Do not disable auth protections to work around the limit.

The current checkout supports UPI reference submission and Cash on Delivery; it does not connect to a payment gateway or verify settlements automatically. UPI orders remain **Awaiting verification**, and COD orders remain **Pay on delivery** on the invoice until payment is confirmed through a future payment-verification integration.

The VS Code Chrome debug configuration expects the PHP server to be running; press **F5** after starting it. Do not open `index.html` directly or use Live Server for authentication.

Accounts created in the old browser-only demo are not Supabase accounts; customers need to sign up again. Customer address-book entries are loaded from and saved to Supabase through PHP and are not written to localStorage. Orders keep the address ID for the saved address book and a separate delivery-address snapshot for the invoice, so invoices remain accurate if an address is later changed or removed. Cart and wishlist preferences remain browser-local.

Script order in index.html matters: main.js → search.js → admin.js. Don't reorder.

## Test signup, login, and addresses
1. Start PHP after configuring the project `.env` file, open the site at `http://127.0.0.1:8000`, and create a customer account. Confirm the email if Supabase email confirmation is enabled.
2. Log in using that account. The PHP session cookie should keep the customer signed in across page reloads.
3. Open the account menu and select **My addresses**. Save an address, close and reopen the dialog, then reload the page or sign in from another browser/device; the saved address should still appear.
4. Place a test order using COD or UPI. Verify it appears in Supabase Table Editor under `public.orders`, including item/category/price details, total, invoice number and issue time, billing snapshot, payment method/status, and `created_at`. In the account menu, open **My orders & invoices**, select **View / Print invoice**, then print it or choose **Save as PDF**. The browser does not supply the authoritative customer `user_id`; PHP derives it from the verified Supabase session and RLS independently enforces ownership.
5. Open a product, submit a star rating and optional review while signed in, then reopen the product or visit it from another browser to verify the saved average, review, and count. The current checkout collects UPI references but does not independently verify them or connect a payment gateway, so it does not mark those payments as settled automatically.
5. Use **Remove** to verify address deletion. Orders retain their saved details; deleting a delivery address sets the order's `address_id` reference to null.
