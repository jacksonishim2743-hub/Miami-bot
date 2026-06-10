import {
  Channel,
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  ContainerBuilder,
  Events,
  GatewayIntentBits,
  Message,
  MessageFlags,
  Partials,
  REST,
  Role,
  Routes,
  StringSelectMenuInteraction,
  TextChannel,
  TextDisplayBuilder,
  ModalSubmitInteraction,
} from "discord.js";
import {
  existsSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  handleAfkMentions,
  handleAfkReturn,
  isAfkCommandMessage,
  setAfk,
} from "./afk.js";
import {
  handleAntiRaidChannelCreate,
  handleAntiRaidChannelDelete,
  handleAntiRaidMemberJoin,
  handleAntiRaidMessage,
  handleAntiRaidPrefixCommand,
  handleAntiRaidRoleCreate,
  handleAntiRaidRoleDelete,
} from "./antiraid.js";
import { postApplicationPanelMessage } from "./application.js";
import { postIngameBanAppealPanelMessage } from "./banappeal.js";
import {
  handleCommunityButtonInteraction,
  handleCommunityCommand,
} from "./community.js";
import { config } from "./config.js";
import { commands } from "./commands.js";
import { gameCommandLines, handleGameCommand } from "./games.js";
import { handleIntelButtonInteraction, handleIntelLogCommand } from "./intelogs.js";
import { handleLockdownPrefixCommand } from "./lockdown.js";
import { handleModerationPrefixCommand } from "./modcommands.js";
import { handleAutomodMessage, handleModerationRoleSetupPrefixCommand } from "./moderation.js";
import {
  handlePartnershipsSelectInteraction,
  postPartnershipsPanelMessage,
} from "./partnerships.js";
import {
  handleSideApplicationsSelectInteraction,
  postSideApplicationsPanelMessage,
} from "./sideapplications.js";
import {
  handleSelfRoleButtonInteraction,
  postSelfRolePanelMessage,
} from "./selfroles.js";
import {
  endSessionChannel,
  handleSessionButtonInteraction,
  handleSessionCommand,
  postSessionReminderPanelMessage,
  postSessionStartPanelMessage,
  postSessionInfoPanelMessage,
  postSessionVotePanelMessage,
} from "./session.js";
import { applyReasonUpdate } from "./reasontracker.js";
import {
  applyRpChange,
  buildRpInfoMessage,
  handleQueueCommand,
  postRpChangeMessage,
} from "./rp.js";
import {
  buildDiscordIdMessage,
  buildOwnRobloxIdMessage,
  buildRobloxIdMessage,
  buildRobloxUserInfoPanel,
  fetchRobloxUserInfoByUsername,
  getLinkedRobloxId,
  resolveDiscordTarget,
} from "./roblox.js";
import {
  refreshServerStatChannels,
  refreshServerStatChannelsForMember,
  startServerStatsTask,
} from "./serverstats.js";
import {
  addUserToTicket,
  canCloseTicket,
  handleTicketButtonInteraction,
  handleTicketMessageCreate,
  handleTicketModalSubmit,
  handleTicketSelectInteraction,
  isTicketChannel,
  postTicketPanelMessage,
  renameTicketChannel,
  removeUserFromTicket,
  requestTicketClose,
  requestClosePanel,
  switchTicketCategory,
} from "./tickets.js";
import {
  handleLogSetupPrefixCommand,
  logCommandFromMessage,
  logCommandFromSlash,
  logMessageCreate,
  logMessageDelete,
  logMessageEdit,
  logVoiceUpdate,
} from "./serverlogs.js";

const statusLines = [
  "Available Commands",
  "`-afk <duration> <reason>` - Mark yourself as AFK with a timer and reason.",
  "`-ping` - Check whether the bot is awake.",
  "`-hello` - Get a friendly welcome from the bot.",
  "`-status` - Show the bot command list.",
  "`-application-panel` - Post the application panel in the current channel.",
  "`-ingame-ban-appeal-panel` - Post the in-game ban appeal panel in the current channel.",
  "`-partnerships-panel` - Post the partnerships panel in the current channel.",
  "`-side-applications-panel` - Post the side applications panel in the current channel.",
  "`-self roles` - Post the self-role panel in the current channel.",
  "`-ticket-panel` - Post the ticket panel in the current channel.",
  "`-session info` - Post the permanent session information panel in the current channel.",
  "`-antiraid enable` - Enable anti-raid protection.",
  "`-antiraid disable` - Disable anti-raid protection.",
  "`-antiraid status` - Show anti-raid settings.",
  "`-set-antiraid-log #channel` - Set the anti-raid log channel.",
  "`-set-antiraid-quarantine-role @role` - Set the quarantine role used during raid mode.",
  "`-lockdown <reason>` - Enable server lockdown.",
  "`-end lockdown <reason>` - Lift server lockdown.",
  "`-set-approved-link-role @role` - Set the link permission role.",
  "`-set-spam-bypass-role @role` - Set the spam bypass role.",
  "`-set-automod-bypass-role @role` - Set the automod bypass role.",
  "`-set-punishment-log #channel` - Set the punishment log channel.",
  "`-set-undone-log #channel` - Set the undone log channel.",
  "`-set-link-block-log #channel` - Set the link-block log channel.",
  "`-set-message-log #channel` - Set the message log channel.",
  "`-set-voice-log #channel` - Set the voice log channel.",
  "`-set-command-log #channel` - Set the command log channel.",
  "`-set-automod-log #channel` - Set the automod log channel.",
  "`-set-message-spam-log #channel` - Set the message-spam log channel.",
  "`-set-ban-log #channel` - Set the ban log channel.",
  "`-set-kick-log #channel` - Set the kick log channel.",
  "`-ban <user_id or @user> <reason>` - Ban a user and log it.",
  "`-kick <user_id or @user> <reason>` - Kick a user and log it.",
  "`-watchlist <user_id> <info>` - Log a member to the watchlist channel.",
  "`-watchlistboard` - Post the paged watchlist board.",
  "`-queue` - Show the current ERLC queue in an embed.",
  "`-rp change` - Post the RP change button panel.",
  "`-rp info` - Show the current RP and when it was last changed.",
  "`-event log <title> | <details>` - Send an event log entry with the tracker link.",
  "`-evidence <title> | <details>` - Send links, photos, and notes to the evidence log channel.",
  "`-reason <6 digit id> <reason>` - Update a missing reason in a tracked staff panel.",
  "`-close` - Start the in-channel close flow and type the reason within 60 seconds.",
  "`-close request <reason>` - Send a close request panel in the current ticket.",
  "`-rename <new ticket channel name>` - Rename the current ticket channel.",
  "`-switch panel <category_id>` - Move the current ticket into a different category.",
  "`-add <user_id>` - Add a member to the current ticket.",
  "`-remove <user_id> <reason>` - Remove a member from the current ticket and DM them a reason.",
  gameCommandLines,
].join("\n");

const PANEL_MANAGER_ROLE_ID = "1490006597328699522";
const RP_CHANGE_ROLE_ID = "1490457006304399491";
const PROCESS_LOCK_FILE = join(process.cwd(), ".bot-process.lock");

function ensureSingleProcess(): void {
  try {
    if (existsSync(PROCESS_LOCK_FILE)) {
      const raw = readFileSync(PROCESS_LOCK_FILE, "utf8").trim();
      const existingPid = Number(raw);
      if (Number.isInteger(existingPid) && existingPid > 0) {
        try {
          process.kill(existingPid, 0);
          console.error(`Another Miami bot process is already running with PID ${existingPid}.`);
          process.exit(1);
        } catch {
          unlinkSync(PROCESS_LOCK_FILE);
        }
      } else {
        unlinkSync(PROCESS_LOCK_FILE);
      }
    }
  } catch {
    // Ignore lock read errors and continue with a fresh lock write below.
  }

  writeFileSync(PROCESS_LOCK_FILE, String(process.pid), "utf8");

  const cleanup = () => {
    try {
      if (existsSync(PROCESS_LOCK_FILE) && readFileSync(PROCESS_LOCK_FILE, "utf8").trim() === String(process.pid)) {
        unlinkSync(PROCESS_LOCK_FILE);
      }
    } catch {
      // Ignore cleanup errors on shutdown.
    }
  };

  process.once("exit", cleanup);
  process.once("SIGINT", () => {
    cleanup();
    process.exit(0);
  });
  process.once("SIGTERM", () => {
    cleanup();
    process.exit(0);
  });
}

function buildSimpleTicketPanel(title: string, lines: string[]) {
  return {
    components: [
      new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            `## ${title}`,
            "",
            ...lines,
            "",
            "-# Miami Roleplay © 2026 | Ticket Operations",
          ].join("\n"),
        ),
      ),
    ],
    flags: MessageFlags.IsComponentsV2,
  };
}

function buildBotDmPanel() {
  return {
    allowedMentions: {
      parse: [],
      roles: [],
      users: [],
    },
    components: [
      new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            "## DMs Are Not Monitored",
            "",
            "*You cannot DM this bot for support or staff help.*",
            "",
            "**What To Do Instead**",
            "*Please join the Miami City Roleplay server and open a ticket through the official support panel so the correct team can help you.*",
            "",
            "-# Miami Roleplay © 2026 | Support Notice",
          ].join("\n"),
        ),
      ),
    ],
    flags: MessageFlags.IsComponentsV2,
  };
}

function buildServerInfoPanel(
  serverName: string,
  serverId: string,
  ownerText: string,
  memberCount: number,
  channelCount: number,
  roleCount: number,
  createdTimestamp: number,
) {
  return {
    components: [
      new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            "## Server Information",
            "",
            `**Server Name** - *${serverName}*`,
            `**Server ID** - \`${serverId}\``,
            `**Owner** - *${ownerText}*`,
            `**Members** - *${memberCount.toLocaleString()}*`,
            `**Channels** - *${channelCount.toLocaleString()}*`,
            `**Roles** - *${roleCount.toLocaleString()}*`,
            `**Created** - <t:${createdTimestamp}:F>`,
            "",
            "-# Miami Roleplay © 2026 | Server Information",
          ].join("\n"),
        ),
      ),
    ],
    flags: MessageFlags.IsComponentsV2,
  };
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

ensureSingleProcess();

async function registerGuildSlashCommands(readyClient: Client<true>): Promise<void> {
  const applicationId = readyClient.application.id;
  const rest = new REST({ version: "10" }).setToken(config.token);

  const guildIds = config.guildId
    ? [config.guildId]
    : Array.from(readyClient.guilds.cache.keys());

  for (const guildId of guildIds) {
    await rest.put(Routes.applicationGuildCommands(applicationId, guildId), {
      body: commands,
    });
    console.log(`Registered ${commands.length} slash command(s) for guild ${guildId}.`);
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  try {
    await registerGuildSlashCommands(readyClient);
  } catch (error) {
    console.error("Failed to auto-register slash commands.");
    console.error(error);
  }

  startServerStatsTask(readyClient);
});

client.on(Events.MessageCreate, async (message: Message) => {
  if (message.author.bot) {
    return;
  }

  if (!message.inGuild()) {
    await message.channel.send(buildBotDmPanel() as any).catch(() => null);
    return;
  }

  if (!isAfkCommandMessage(message.content, config.prefix)) {
    await handleAfkReturn(message);
  }

  await handleAfkMentions(message);
  await logMessageCreate(message);
  await handleAutomodMessage(message);
  await handleAntiRaidMessage(message);
  await handleTicketMessageCreate(message);
  await handlePrefixCommand(message);
});

client.on(Events.MessageDelete, async (message) => {
  await logMessageDelete(message);
});

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  await logMessageEdit(oldMessage, newMessage);
});

client.on(Events.GuildMemberAdd, async (member) => {
  await handleAntiRaidMemberJoin(member);
  await refreshServerStatChannelsForMember(member);
});

client.on(Events.GuildMemberRemove, async (member) => {
  await refreshServerStatChannelsForMember(member);
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  await logVoiceUpdate(oldState, newState);
});

client.on(Events.ChannelCreate, async (channel: Channel) => {
  if (!("guild" in channel)) {
    return;
  }

  await handleAntiRaidChannelCreate(channel);
});

client.on(Events.ChannelDelete, async (channel: Channel) => {
  if (!("guild" in channel)) {
    return;
  }

  await handleAntiRaidChannelDelete(channel);
});

client.on(Events.GuildRoleCreate, async (role: Role) => {
  await handleAntiRaidRoleCreate(role);
});

client.on(Events.GuildRoleDelete, async (role: Role) => {
  await handleAntiRaidRoleDelete(role);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton()) {
    await handleButtonInteraction(interaction);
    return;
  }

  if (interaction.isStringSelectMenu()) {
    await handleSelectInteraction(interaction);
    return;
  }

  if (interaction.isModalSubmit()) {
    await handleModalInteraction(interaction);
    return;
  }

  if (interaction.isChatInputCommand()) {
    await handleChatInputCommand(interaction);
  }
});

async function handleButtonInteraction(
  interaction: ButtonInteraction,
): Promise<void> {
  if (!interaction.inCachedGuild()) {
    await interaction.reply({
      content: "This button only works inside a server.",
    });
    return;
  }

  if (await handleTicketButtonInteraction(interaction)) {
    return;
  }

  if (await handleIntelButtonInteraction(interaction)) {
    return;
  }

  if (await handleSelfRoleButtonInteraction(interaction)) {
    return;
  }

  if (await handleSessionButtonInteraction(interaction)) {
    return;
  }

  if (await handleCommunityButtonInteraction(interaction)) {
    return;
  }

  if (interaction.customId.startsWith("rpchange:")) {
    const hasAccess = interaction.member.roles.cache.has(RP_CHANGE_ROLE_ID);
    if (!hasAccess) {
      await interaction.deferUpdate().catch(() => null);
      return;
    }

    const result = await applyRpChange(interaction.customId.slice("rpchange:".length), interaction.user);
    if (!result.ok) {
      await interaction.reply({
        content: result.message,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      content: result.warning
        ? `RP changed to **${result.option.infoLabel}**. ${result.warning}`
        : `RP changed to **${result.option.infoLabel}** and the in-game message was sent.`,
      flags: MessageFlags.Ephemeral,
    });
    await refreshServerStatChannels(interaction.guild).catch(() => null);
    return;
  }
}

async function handleSelectInteraction(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  if (!interaction.inCachedGuild()) {
    await interaction.reply({
      content: "This menu only works inside a server.",
      ephemeral: true,
    });
    return;
  }

  if (await handleTicketSelectInteraction(interaction)) {
    return;
  }

  if (await handlePartnershipsSelectInteraction(interaction)) {
    return;
  }

  if (await handleSideApplicationsSelectInteraction(interaction)) {
    return;
  }

  if (interaction.customId === "rpchange:select") {
    const hasAccess = interaction.member.roles.cache.has(RP_CHANGE_ROLE_ID);
    if (!hasAccess) {
      await interaction.deferUpdate().catch(() => null);
      return;
    }

    const key = interaction.values[0];
    const result = await applyRpChange(key, interaction.user);
    if (!result.ok) {
      await interaction.reply({
        content: result.message,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      content: result.warning
        ? `RP changed to **${result.option.infoLabel}**. ${result.warning}`
        : `RP changed to **${result.option.infoLabel}** and the in-game message was sent.`,
      flags: MessageFlags.Ephemeral,
    });
    await refreshServerStatChannels(interaction.guild).catch(() => null);
    return;
  }
}

async function handleModalInteraction(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  if (!interaction.inCachedGuild()) {
    await interaction.reply({
      content: "This form only works inside a server.",
      ephemeral: true,
    });
    return;
  }

  try {
    await handleTicketModalSubmit(interaction);
  } catch (error) {
    console.error("Modal interaction failed.");
    console.error(error);

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "Something went wrong while submitting that form.",
        ephemeral: true,
      }).catch(() => null);
    }
  }
}

async function handleChatInputCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const { commandName } = interaction;
  await logCommandFromSlash(interaction);

  if (commandName === "ping") {
    await interaction.reply("Pong! Miami Bot is online.");
    return;
  }

  if (commandName === "hello") {
    await interaction.reply(
      `Hello, ${interaction.user.username}! Ready for Miami City Roleplay?`,
    );
    return;
  }

  if (commandName === "status") {
    await interaction.reply(statusLines);
    return;
  }

  if (await handleCommunityCommand(interaction)) {
    return;
  }

  if (await handleSessionCommand(interaction)) {
    return;
  }
}

async function handlePrefixCommand(message: Message): Promise<void> {
  const rawContent = message.content.startsWith("-")
    ? message.content.slice(1).trim()
    : "";

  if (!rawContent) {
    return;
  }

  const [commandName] = rawContent.split(/\s+/);
  const command = commandName.toLowerCase();
  const isPanelManager = message.member?.roles.cache.has(PANEL_MANAGER_ROLE_ID) ?? false;

  await logCommandFromMessage(message, rawContent);

  if (await handleAntiRaidPrefixCommand(message, rawContent)) {
    return;
  }

  if (await handleLockdownPrefixCommand(message, rawContent)) {
    return;
  }

  if (await handleModerationRoleSetupPrefixCommand(message, rawContent)) {
    return;
  }

  if (await handleLogSetupPrefixCommand(message, rawContent)) {
    return;
  }

  if (await handleModerationPrefixCommand(message, rawContent)) {
    return;
  }

  if (await handleIntelLogCommand(message, rawContent)) {
    return;
  }

  if (await handleGameCommand(message, rawContent)) {
    return;
  }

  if (command === "reason") {
    if (!isPanelManager) {
      await message.delete().catch(() => null);
      return;
    }

    const match = rawContent.match(/^reason\s+(\d{6})\s+(.+)$/i);
    if (!match) {
      const reply = await message.reply("Use `-reason <6 digit id> <reason>`.");
      setTimeout(() => {
        void reply.delete().catch(() => null);
      }, 10_000);
      return;
    }

    const [, reasonId, nextReason] = match;
    const result = await applyReasonUpdate(client, message.guildId!, reasonId, nextReason.trim());

    await message.delete().catch(() => null);

    const replyText =
      result === "updated"
        ? `Reason updated for \`${reasonId}\`.`
        : result === "unchanged"
          ? `I could not find a reason field to update for \`${reasonId}\`.`
          : `I could not find a tracked reason with ID \`${reasonId}\`.`;

    const reply = await message.channel.send(replyText).catch(() => null);
    if (reply) {
      setTimeout(() => {
        void reply.delete().catch(() => null);
      }, 10_000);
    }
    return;
  }

  if (["close", "switch", "add", "remove", "rename"].includes(command)) {
    if (!(message.channel instanceof TextChannel) || !isTicketChannel(message.channel)) {
      await message.delete().catch(() => null);
      return;
    }

    if (!message.member || !canCloseTicket(message.channel, message.member)) {
      await message.delete().catch(() => null);
      return;
    }
  }

  if (command === "ping") {
    await message.reply("Pong! Miami Bot is online.");
    return;
  }

  if (command === "myid") {
    await message.reply(`*Heres your \`${message.author.id}\`*`);
    return;
  }

  if (command === "myrobloxid") {
    await message.reply(buildOwnRobloxIdMessage(message.author.id));
    return;
  }

  if (command === "discordid") {
    if (!message.guild) {
      return;
    }

    const targetInput = rawContent.slice("discordid".length).trim();
    if (!targetInput) {
      await message.reply("Use `-discordid <user>`.");
      return;
    }

    const targetUser = await resolveDiscordTarget(message.guild, targetInput);
    if (!targetUser) {
      await message.reply("I could not find that Discord user.");
      return;
    }

    await message.reply(buildDiscordIdMessage(targetUser));
    return;
  }

  if (command === "robloxid") {
    const targetInput = rawContent.slice("robloxid".length).trim();
    if (!targetInput) {
      await message.reply("Use `-robloxid <user_id>`.");
      return;
    }

    const robloxId = getLinkedRobloxId(targetInput);
    await message.reply(buildRobloxIdMessage(targetInput, robloxId));
    return;
  }

  if (command === "robloxuserinfo") {
    const username = rawContent.slice("robloxuserinfo".length).trim();
    if (!username) {
      await message.reply("Use `-robloxuserinfo <robloxuser>`.");
      return;
    }

    const result = await fetchRobloxUserInfoByUsername(username);
    if (!result.ok) {
      await message.reply(result.message);
      return;
    }

    await message.channel.send(buildRobloxUserInfoPanel(result) as any);
    return;
  }

  if (command === "server" && rawContent.toLowerCase() === "server info") {
    if (!message.guild) {
      return;
    }

    const owner = await message.guild.fetchOwner().catch(() => null);
    await message.channel.send(
      buildServerInfoPanel(
        message.guild.name,
        message.guild.id,
        owner?.user.tag ?? "Unknown Owner",
        message.guild.memberCount,
        message.guild.channels.cache.size,
        message.guild.roles.cache.size,
        Math.floor(message.guild.createdTimestamp / 1000),
      ) as any,
    );
    return;
  }

  if (command === "status") {
    await message.reply(statusLines);
    return;
  }

  if (command === "ticket") {
    await message.delete().catch(() => null);
    return;
  }

  if (command === "queue") {
    if (!(message.channel instanceof TextChannel)) {
      return;
    }

    await handleQueueCommand(message.channel);
    return;
  }

  if (command === "rp") {
    const subcommand = rawContent.slice("rp".length).trim().toLowerCase();

    if (subcommand === "change") {
      const canRunRpChange = message.member?.roles.cache.has(RP_CHANGE_ROLE_ID) ?? false;
      if (!canRunRpChange) {
        return;
      }

      if (!(message.channel instanceof TextChannel)) {
        return;
      }

      await postRpChangeMessage(message.channel);
      await message.delete().catch(() => null);
      return;
    }

    if (subcommand === "info") {
      if (!(message.channel instanceof TextChannel)) {
        return;
      }

      await message.channel.send(await buildRpInfoMessage());
      return;
    }
  }

  if (command === "application-panel" || command === "applicationpanel" || command === "applypanel") {
    if (!isPanelManager) {
      await message.delete().catch(() => null);
      return;
    }

    if (!(message.channel instanceof TextChannel)) {
      await message.reply("Run this command in a text channel.");
      return;
    }

    await postApplicationPanelMessage(message.channel);
    await message.reply("Application panel posted in this channel.");
    return;
  }

  if (
    command === "ingame-ban-appeal-panel" ||
    command === "ingamebanappealpanel" ||
    command === "ban-appeal-panel" ||
    command === "banappealpanel" ||
    command === "ingameappeal"
  ) {
    if (!isPanelManager) {
      await message.delete().catch(() => null);
      return;
    }

    if (!(message.channel instanceof TextChannel)) {
      await message.reply("Run this command in a text channel.");
      return;
    }

    await postIngameBanAppealPanelMessage(message.channel);
    await message.reply("In-game ban appeal panel posted in this channel.");
    return;
  }

  if (command === "partnerships-panel" || command === "partnershipspanel" || command === "partnerships") {
    if (!isPanelManager) {
      await message.delete().catch(() => null);
      return;
    }

    if (!(message.channel instanceof TextChannel)) {
      await message.reply("Run this command in a text channel.");
      return;
    }

    await postPartnershipsPanelMessage(message.channel);
    await message.reply("Partnerships panel posted in this channel.");
    return;
  }

  if (
    command === "side-applications-panel" ||
    command === "sideapplicationspanel" ||
    command === "side-applications" ||
    command === "sideapplications" ||
    command === "sideapplicationpanel"
  ) {
    if (!isPanelManager) {
      await message.delete().catch(() => null);
      return;
    }

    if (!(message.channel instanceof TextChannel)) {
      await message.reply("Run this command in a text channel.");
      return;
    }

    await postSideApplicationsPanelMessage(message.channel);
    await message.reply("Side applications panel posted in this channel.");
    return;
  }

  if (rawContent.toLowerCase() === "self roles" || rawContent.toLowerCase() === "self-roles") {
    if (!isPanelManager) {
      await message.delete().catch(() => null);
      return;
    }

    if (!(message.channel instanceof TextChannel)) {
      await message.reply("Run this command in a text channel.");
      return;
    }

    await postSelfRolePanelMessage(message.channel);
    await message.reply("Self-role panel posted in this channel.");
    return;
  }

  if (rawContent.toLowerCase() === "session info") {
    if (!isPanelManager) {
      await message.delete().catch(() => null);
      return;
    }

    if (!(message.channel instanceof TextChannel)) {
      await message.reply("Run this command in a text channel.");
      return;
    }

    try {
      await postSessionInfoPanelMessage(message.channel);
      await message.reply("Session information panel posted in this channel.");
    } catch (error) {
      console.error("Failed to post session information panel.");
      console.error(error);
      await message.reply("I could not post the session information panel right now.");
    }
    return;
  }

  if (command === "session") {
    if (!isPanelManager) {
      await message.delete().catch(() => null);
      return;
    }

    if (!(message.channel instanceof TextChannel) || !message.member) {
      return;
    }

    if (rawContent.toLowerCase() === "session vote start") {
      await postSessionVotePanelMessage(message.channel, message.author.id);
      return;
    }

    const sessionStartMatch = rawContent.match(/^session\s+start\s+(.+)$/i);
    if (sessionStartMatch) {
      const link = sessionStartMatch[1]?.trim();
      if (!link) {
        await message.reply("Use `-session start <join_link>`.");
        return;
      }

      await postSessionStartPanelMessage(message.channel, link);
      return;
    }

    if (rawContent.toLowerCase() === "session reminder") {
      await postSessionReminderPanelMessage(message.channel);
      return;
    }

    if (rawContent.toLowerCase() === "session end") {
      await endSessionChannel(message.channel);
      return;
    }

    if (rawContent.toLowerCase() === "session info") {
      return;
    }

    await message.reply(
      "Use `-session info`, `-session vote start`, `-session start <join_link>`, `-session reminder`, or `-session end`.",
    );
    return;
  }

  if (command === "afk") {
    if (!message.member) {
      return;
    }

    const [, durationInput, ...reasonParts] = rawContent.split(/\s+/);
    const reason = reasonParts.join(" ").trim();
    const result = await setAfk(message.member, durationInput ?? "", reason);

    if (!result.ok) {
      await message.reply(result.error);
      return;
    }

    await message.reply(
      `You are now marked as AFK until <t:${Math.floor(result.until / 1000)}:R>.`,
    );
    return;
  }

  if (command === "hello") {
    await message.reply(
      `Hello, ${message.author.username}! Ready for Miami City Roleplay?`,
    );
    return;
  }

  if (command === "ticket-panel") {
    if (!isPanelManager) {
      await message.delete().catch(() => null);
      return;
    }

    if (!(message.channel instanceof TextChannel)) {
      await message.reply("Run this command in a text channel.");
      return;
    }

    await postTicketPanelMessage(message.channel);
    await message.reply("Ticket panel posted in this channel.");
    return;
  }

  if (command === "close") {
    if (!(message.channel instanceof TextChannel) || !message.member) {
      await message.delete().catch(() => null);
      return;
    }

    if (/^close$/i.test(rawContent)) {
      await requestTicketClose(message.channel, message.member, null);
      await message.delete().catch(() => null);
      return;
    }

    const closeRequestMatch = rawContent.match(/^close\s+request(?:\s+(.*))?$/i);
    if (closeRequestMatch) {
      const reason = closeRequestMatch[1]?.trim() || "No reason provided.";
      await requestClosePanel(message.channel, message.member, reason);
      await message.delete().catch(() => null);
      return;
    }

    await message.delete().catch(() => null);
    return;
  }

  if (command === "rename") {
    if (!(message.channel instanceof TextChannel)) {
      await message.delete().catch(() => null);
      return;
    }

    const nextName = rawContent.slice("rename".length).trim();
    if (!nextName) {
      await message.delete().catch(() => null);
      return;
    }

    try {
      const renamedChannel = await renameTicketChannel(message.channel, nextName);
      await message.channel.send(
        buildSimpleTicketPanel("Ticket Renamed", [
          `*This ticket was renamed to \`${renamedChannel}\`.*`,
        ]) as any,
      );
    } catch {
      await message.delete().catch(() => null);
      return;
    }

    await message.delete().catch(() => null);
    return;
  }

  if (command === "switch") {
    if (!(message.channel instanceof TextChannel)) {
      await message.delete().catch(() => null);
      return;
    }

    const match = rawContent.match(/^switch\s+panel\s+(\d+)$/i);
    if (!match) {
      await message.delete().catch(() => null);
      return;
    }

    await switchTicketCategory(message.channel, match[1]);
    await message.channel.send(
      buildSimpleTicketPanel("Ticket Moved", [
        `*This ticket was moved to category \`${match[1]}\`.*`,
      ]) as any,
    );
    await message.delete().catch(() => null);
    return;
  }

  if (command === "add") {
    if (!(message.channel instanceof TextChannel)) {
      await message.delete().catch(() => null);
      return;
    }

    const [, userIdInput] = rawContent.split(/\s+/);
    if (!userIdInput) {
      await message.delete().catch(() => null);
      return;
    }

    try {
      const addedUser = await addUserToTicket(message.channel, userIdInput);
      await message.channel.send(
        buildSimpleTicketPanel("User Added", [
          `*${addedUser} was added to this ticket.*`,
        ]) as any,
      );
    } catch {
      await message.delete().catch(() => null);
      return;
    }

    await message.delete().catch(() => null);
    return;
  }

  if (command === "remove") {
    if (!(message.channel instanceof TextChannel)) {
      await message.delete().catch(() => null);
      return;
    }

    const [, userIdInput, ...reasonParts] = rawContent.split(/\s+/);
    if (!userIdInput) {
      await message.delete().catch(() => null);
      return;
    }

    const reason = reasonParts.join(" ").trim() || "No reason provided.";

    try {
      const removedUser = await removeUserFromTicket(message.channel, userIdInput, reason);
      await message.channel.send(
        buildSimpleTicketPanel("User Removed", [
          `*${removedUser} was removed from this ticket.*`,
          `> **Reason** - *${reason}*`,
        ]) as any,
      );
    } catch {
      await message.delete().catch(() => null);
      return;
    }

    await message.delete().catch(() => null);
    return;
  }
}

client.login(config.token).catch((error: unknown) => {
  console.error("Discord login failed.");
  console.error(error);
  process.exitCode = 1;
});
