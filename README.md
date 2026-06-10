# Miami Bot

A TypeScript Discord bot for Miami City Roleplay built with `discord.js`.

## Main runtime

- Entry point: [src/index.ts](/Users/jthomas/Documents/Evergreen%20Bot/src/index.ts)
- Production build: [dist/index.js](/Users/jthomas/Documents/Evergreen%20Bot/dist/index.js)

## Local commands

Install dependencies:

```bash
npm install
```

Build:

```bash
npm run build
```

Run locally:

```bash
npm start
```

Register slash commands:

```bash
npm run register
```

## Environment

Required:

- `DISCORD_TOKEN`

Optional but used by this bot:

- `ERLC_API_KEY`
- `SERVER_API_KEY`
- `DISCORD_CLIENT_ID`
- `DISCORD_GUILD_ID`

Base template:

- [.env.example](/Users/jthomas/Documents/Evergreen%20Bot/.env.example)

## Northflank 24/7 hosting

For the easiest free dashboard-based setup, use:

- [NORTHFLANK-SETUP.md](/Users/jthomas/Documents/Evergreen%20Bot/NORTHFLANK-SETUP.md)

## Oracle Cloud 24/7 hosting

If you want the stronger but more manual free setup, use:

- [ORACLE-CLOUD-SETUP.md](/Users/jthomas/Documents/Evergreen%20Bot/ORACLE-CLOUD-SETUP.md)

Included Oracle files:

- [ecosystem.config.cjs](/Users/jthomas/Documents/Evergreen%20Bot/ecosystem.config.cjs)
- [oracle/install-on-vm.sh](/Users/jthomas/Documents/Evergreen%20Bot/oracle/install-on-vm.sh)
- [oracle/update-on-vm.sh](/Users/jthomas/Documents/Evergreen%20Bot/oracle/update-on-vm.sh)
- [oracle/runtime-files.txt](/Users/jthomas/Documents/Evergreen%20Bot/oracle/runtime-files.txt)
- [.github/workflows/oracle-deploy.yml](/Users/jthomas/Documents/Evergreen%20Bot/.github/workflows/oracle-deploy.yml)

## Notes

- Runtime state files are intentionally ignored from Git so they can stay persistent on a host.
- The Oracle flow is designed so future code changes can be pushed to GitHub and then deployed to the VM with one update script or an optional GitHub Action.
