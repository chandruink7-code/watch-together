# Deploy Watch Together

Two scripts. Run them in order. Each handles install + login + deploy.

You'll need:
- Node.js installed (already required for the project)
- Email access (for Railway and Vercel signup confirmations)
- A credit/debit card on file with Railway (no charge — required for abuse prevention; first $5/mo is free credit)

---

## macOS / Linux

```bash
cd watch-together
chmod +x deploy-server.sh deploy-client.sh
./deploy-server.sh    # ~3 min, gives you a Railway URL
./deploy-client.sh    # ~2 min, gives you the final shareable URL
```

## Windows (PowerShell)

If your PowerShell blocks scripts, run this **once** as administrator:
```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Then:
```powershell
cd watch-together
.\deploy-server.ps1
.\deploy-client.ps1
```

---

## What each script does

### `deploy-server.sh` / `.ps1`
1. Installs Railway CLI if you don't have it
2. Opens your browser for Railway login (sign up here if needed — email or Google works)
3. Creates a Railway project named `watch-together-server`
4. Deploys the `/server` folder
5. Generates a public domain
6. Saves the URL to `.server-url` for the client script to read

### `deploy-client.sh` / `.ps1`
1. Installs Vercel CLI if missing
2. Opens your browser for Vercel login (email magic-link)
3. Reads the server URL from `.server-url` (or asks you to paste it)
4. Sets `VITE_SERVER_URL` env var in Vercel
5. Deploys `/client` to production
6. Prints the final shareable `https://*.vercel.app` URL

---

## Troubleshooting

**"command not found: npm"** — Install Node.js from [nodejs.org](https://nodejs.org).

**Railway asks for a payment method** — That's normal. They don't charge unless you exceed the free $5/mo credit; this app uses about $0.50/mo idle.

**"Application failed to respond"** — Railway server is sleeping after inactivity. Open the server URL in a browser once to wake it up, then share the client URL.

**Voice call fails on different networks** — Symmetric NAT. STUN can't always traverse it. For real product use, add a TURN server (Twilio, Cloudflare Calls). For testing, try both peers on a different network combination.

**Need to redeploy after a code change** — From inside `client/` run `vercel --prod --yes`. From inside `server/` run `railway up --detach`.

---

## Costs

- **Vercel** — free for hobby projects, no card required
- **Railway** — $5/mo free credit, requires card on file. This app uses well under that idling between tests.
