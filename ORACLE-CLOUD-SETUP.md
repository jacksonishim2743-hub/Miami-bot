# Oracle Cloud Free Setup

This bot can run 24/7 on an Oracle Cloud Always Free Ubuntu VM.

## What this setup gives you

- 24/7 hosting even when your Mac is off
- automatic restart with PM2
- a simple update flow for future code changes
- optional GitHub auto-deploy on every push to `main`

## Recommended Oracle VM

- Image: **Ubuntu 24.04** or **Ubuntu 22.04**
- Shape: **Always Free eligible**
- Public IP: **Yes**

For a Discord bot, you do not need to open inbound web ports just to keep it online.

## Step 1. Put this project on GitHub

From your Mac:

```bash
cd "/Users/jthomas/Documents/Evergreen Bot"
git init
git add .
git commit -m "Initial Miami bot Oracle setup"
```

Then create a GitHub repo and connect it:

```bash
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

Important:
- `.env` and runtime JSON files are ignored on purpose
- that keeps secrets and live server data out of GitHub

## Step 2. SSH into the Oracle VM

Example:

```bash
ssh ubuntu@YOUR_ORACLE_PUBLIC_IP
```

## Step 3. Run the first install

On the Oracle VM:

```bash
git clone https://github.com/YOUR-USERNAME/YOUR-REPO.git /opt/miami-bot
cd /opt/miami-bot
bash oracle/install-on-vm.sh https://github.com/YOUR-USERNAME/YOUR-REPO.git
```

## Step 4. Copy runtime files once

You need these files on the server:

- `.env`
- `antiraid-settings.json`
- `moderation-role-settings.json`
- `moderation-settings.json`
- `server-log-settings.json`
- `session-settings.json`
- `rp-state.json`
- `reason-tracker.json`
- `watchlist-store.json`

The full list is also in:

- [oracle/runtime-files.txt](/Users/jthomas/Documents/Evergreen%20Bot/oracle/runtime-files.txt)

From your Mac, example copy commands:

```bash
scp "/Users/jthomas/Documents/Evergreen Bot/.env" ubuntu@YOUR_ORACLE_PUBLIC_IP:/opt/miami-bot/.env
scp "/Users/jthomas/Documents/Evergreen Bot/antiraid-settings.json" ubuntu@YOUR_ORACLE_PUBLIC_IP:/opt/miami-bot/
scp "/Users/jthomas/Documents/Evergreen Bot/moderation-role-settings.json" ubuntu@YOUR_ORACLE_PUBLIC_IP:/opt/miami-bot/
scp "/Users/jthomas/Documents/Evergreen Bot/moderation-settings.json" ubuntu@YOUR_ORACLE_PUBLIC_IP:/opt/miami-bot/
scp "/Users/jthomas/Documents/Evergreen Bot/server-log-settings.json" ubuntu@YOUR_ORACLE_PUBLIC_IP:/opt/miami-bot/
scp "/Users/jthomas/Documents/Evergreen Bot/session-settings.json" ubuntu@YOUR_ORACLE_PUBLIC_IP:/opt/miami-bot/
scp "/Users/jthomas/Documents/Evergreen Bot/rp-state.json" ubuntu@YOUR_ORACLE_PUBLIC_IP:/opt/miami-bot/
scp "/Users/jthomas/Documents/Evergreen Bot/reason-tracker.json" ubuntu@YOUR_ORACLE_PUBLIC_IP:/opt/miami-bot/
scp "/Users/jthomas/Documents/Evergreen Bot/watchlist-store.json" ubuntu@YOUR_ORACLE_PUBLIC_IP:/opt/miami-bot/
```

## Step 5. Build and start after copying files

On the Oracle VM:

```bash
cd /opt/miami-bot
npm ci
npm run build
pm2 start ecosystem.config.cjs --update-env
pm2 save
pm2 status
```

## Future updates

When we add more code later:

1. commit and push to GitHub from your Mac
2. on the Oracle VM run:

```bash
cd /opt/miami-bot
bash oracle/update-on-vm.sh
```

That will:
- pull the newest code
- install dependencies
- rebuild `dist`
- restart the bot

## Optional auto-deploy from GitHub

This project already includes:

- [.github/workflows/oracle-deploy.yml](/Users/jthomas/Documents/Evergreen%20Bot/.github/workflows/oracle-deploy.yml)

To use it, add these GitHub Actions secrets:

- `ORACLE_HOST`
- `ORACLE_USER`
- `ORACLE_SSH_KEY`

Then every push to `main` can update Oracle automatically.

## Useful Oracle/PM2 commands

Check bot status:

```bash
pm2 status
```

View logs:

```bash
pm2 logs miami-bot
```

Restart manually:

```bash
pm2 restart miami-bot --update-env
```

Stop:

```bash
pm2 stop miami-bot
```

Start again:

```bash
pm2 start ecosystem.config.cjs --update-env
```
