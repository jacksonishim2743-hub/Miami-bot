module.exports = {
  apps: [
    {
      name: "miami-bot",
      cwd: process.env.MIAMI_BOT_DIR || process.cwd(),
      script: "dist/index.js",
      interpreter: "node",
      autorestart: true,
      watch: false,
      max_restarts: 20,
      min_uptime: "10s",
      restart_delay: 5000,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
