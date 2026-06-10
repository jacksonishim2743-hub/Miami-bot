# Northflank Setup

This repo is ready for a simple Northflank service deploy from GitHub.

## Service type

- Create a new `Service`
- Source: `Git Repository`
- Repository: `jacksonishim2743-hub/Miami-bot`
- Branch: `main`

## Build settings

- Build type: `Dockerfile`
- Dockerfile path: `./Dockerfile`

This deploy uses the checked-in `dist` runtime directly so it matches the currently working bot build.

## Runtime

- Port exposure: none required
- Public port: none

## Environment variables

Required:

- `DISCORD_TOKEN`

Recommended:

- `ERLC_API_KEY`
- `SERVER_API_KEY`
- `DISCORD_CLIENT_ID`
- `DISCORD_GUILD_ID`
- `PREFIX`

Use [.env.example](/Users/jthomas/Documents/Evergreen%20Bot/.env.example) as the template.

## Auto updates

Enable:

- `Automatic Deployments`

That way, when new code is pushed to GitHub, Northflank rebuilds and redeploys the bot automatically.

## Persistent notes

Some JSON state files in this bot are runtime-generated. If you want them to survive redeploys forever, attach a persistent volume later and store those files there. The bot can still run without that on first deploy.

## Local workflow after future changes

1. Make the code changes.
2. Make sure the matching `dist` files are updated too.
3. Commit and push to `main`.
4. Northflank auto-deploys the update.
