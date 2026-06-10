"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const commands_js_1 = require("./commands.js");
const config_js_1 = require("./config.js");
async function registerCommands() {
    if (!config_js_1.config.clientId || !config_js_1.config.guildId) {
        throw new Error("Missing DISCORD_CLIENT_ID or DISCORD_GUILD_ID. These are required to register slash commands.");
    }
    const rest = new discord_js_1.REST({ version: "10" }).setToken(config_js_1.config.token);
    await rest.put(discord_js_1.Routes.applicationGuildCommands(config_js_1.config.clientId, config_js_1.config.guildId), { body: commands_js_1.commands });
    console.log(`Registered ${commands_js_1.commands.length} guild command(s) for ${config_js_1.config.guildId}.`);
}
registerCommands().catch((error) => {
    console.error("Failed to register commands.");
    console.error(error);
    process.exitCode = 1;
});
