import { REST, Routes } from "discord.js";
import { commands } from "./commands.js";
import { config } from "./config.js";

async function registerCommands(): Promise<void> {
  if (!config.clientId || !config.guildId) {
    throw new Error(
      "Missing DISCORD_CLIENT_ID or DISCORD_GUILD_ID. These are required to register slash commands.",
    );
  }

  const rest = new REST({ version: "10" }).setToken(config.token);

  await rest.put(
    Routes.applicationGuildCommands(config.clientId, config.guildId),
    { body: commands },
  );

  console.log(
    `Registered ${commands.length} guild command(s) for ${config.guildId}.`,
  );
}

registerCommands().catch((error: unknown) => {
  console.error("Failed to register commands.");
  console.error(error);
  process.exitCode = 1;
});
