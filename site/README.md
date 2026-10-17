# dayscriptplanner.org — landing page + app waitlist

Static site served by **Cloudflare Pages**, straight from this GitHub repo. No build step.

```
site/
  public/                 ← the website (what Cloudflare serves)
    index.html            one page: hero + waitlist, the method, the book, smile lines, the app, footer
    style.css             brand system (cream / ink / copper, Playfair Display + Karla)
    app.js                waitlist form, ?src= tracking, graceful fallback if the API isn't live
    fonts/                self-hosted woff2 (Open Font License) — no Google Fonts call
    og.png                link preview image (1200×630)
    _headers              security + cache headers
  functions/api/
    waitlist.js           POST /api/waitlist  → saves {email, ts, source, ua} to KV
    count.js              GET  /api/count?key=ADMIN_KEY → how many have joined (Katie only)
  preview-mobile.png      rendered at 390px (what a phone sees after scanning the QR)
  preview-desktop.png     rendered at 1280px
```

Links to put in things:

| Where | URL |
|---|---|
| Social bios, Etsy "about" | `https://dayscriptplanner.org` |
| QR code inside the sold planner PDFs | `https://dayscriptplanner.org/?src=pdf` |
| Pinterest pins / IG link | `https://dayscriptplanner.org/?src=pin` or `?src=ig` (any short word works and gets counted separately) |

---

## Cloudflare setup (one time, ~10 minutes)

Log in at <https://dash.cloudflare.com>.

### 1. Create the Pages project from GitHub
1. Left sidebar → **Workers & Pages** → **Create** → **Pages** tab → **Connect to Git**.
2. Pick the GitHub account `dayscriptplanner` → repository **dayscript-assets** → **Begin setup**.
3. Fill in exactly:
   - **Project name:** `dayscriptplanner` (this gives you the free preview URL `dayscriptplanner.pages.dev`)
   - **Production branch:** `main`
   - **Framework preset:** `None`
   - **Build command:** *(leave empty)*
   - **Build output directory:** `public`
   - Open **Root directory (advanced)** → **Path:** `site`
4. **Save and Deploy**. Wait for the green check. Open `https://dayscriptplanner.pages.dev` — the page should be up. (The waitlist form will show its "email us instead" fallback until step 2 is done. That's expected.)

> Why `site` + `public`: Cloudflare looks for the `functions/` folder next to the output folder, so with root `site` it finds `site/functions` and serves `site/public`.

### 2. Create the KV namespace (where the emails are stored)
1. Left sidebar → **Storage & Databases** → **KV** → **Create a namespace**.
2. Name: `dayscript-waitlist` → **Add**.

### 3. Bind it to the Pages project as `WAITLIST`
1. **Workers & Pages** → **dayscriptplanner** → **Settings** → **Bindings** (older dashboards: *Functions → KV namespace bindings*).
2. **Add** → **KV namespace**.
   - **Variable name:** `WAITLIST` (all caps, exactly)
   - **KV namespace:** `dayscript-waitlist`
3. Save. If the dashboard offers a Production / Preview choice, add it to **both**.

### 4. Set the admin key (so only you can read the count)
1. Still in **Settings** → **Variables and Secrets** → **Add**.
   - **Type:** Secret
   - **Variable name:** `ADMIN_KEY`
   - **Value:** make up a long password (e.g. 20+ random letters). Save it in your password manager.
2. Save. Production environment is enough.

### 5. Redeploy once so the bindings take effect
**Deployments** → the latest deployment → **⋯** → **Retry deployment**. (Bindings only apply to deployments made after they were added.)

### 6. Test it
1. Open `https://dayscriptplanner.pages.dev/?src=pdf`, enter your own email, press **join the app waitlist**. You should see *"You're on the list."*
2. Open `https://dayscriptplanner.pages.dev/api/count?key=YOUR_ADMIN_KEY` → you should see `"count": 1` and `"bySource": {"pdf": 1}`.
   Add `&list=1` to see the actual emails. Bookmark this URL (privately) — it's the only metric until December.

### 7. Add the custom domain
1. **Workers & Pages** → **dayscriptplanner** → **Custom domains** → **Set up a custom domain**.
2. Enter `dayscriptplanner.org` → **Continue** → **Activate domain**. Because the domain's DNS is already on Cloudflare, it creates the record for you. Repeat for `www.dayscriptplanner.org` (it will redirect).
3. Wait a few minutes; `https://dayscriptplanner.org` is live with HTTPS.

### 8. (Optional, 2 min) make the footer email real
The footer and the form's fallback use `hello@dayscriptplanner.org`. To receive mail there for free:
**Cloudflare dashboard → dayscriptplanner.org → Email → Email Routing → Get started** → create the address `hello` → forward to your Gmail → verify. If you'd rather use a different address, change `MAIL` at the top of `public/app.js` and the `mailto:` in the footer of `public/index.html`.

---

## Day to day

- **Updating the site:** edit files in `site/public/`, commit, push to `main`. Cloudflare redeploys in about a minute. Nothing in `social/` is touched by this.
- **Reading the waitlist:** `https://dayscriptplanner.org/api/count?key=…` (count + split by source) or `…&list=1` (full list, newest first). Paste the JSON into a sheet when it's time to send the launch email.
- **Rotating the admin key:** Settings → Variables and Secrets → edit `ADMIN_KEY` → Retry deployment.
- **Abuse brake:** the function allows 10 signups per IP per hour and stores each email once (lower-cased), so duplicates don't inflate the count.

## What the page promises (keep it honest)
The copy says the app is a prototype, arrives "winter 2026", there is no download yet, and subscribers get **one** email when it opens. If any of that changes, change the page.
