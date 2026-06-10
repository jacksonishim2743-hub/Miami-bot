"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleLogSetupPrefixCommand = handleLogSetupPrefixCommand;
exports.logMessageCreate = logMessageCreate;
exports.logMessageDelete = logMessageDelete;
exports.logMessageEdit = logMessageEdit;
exports.logVoiceUpdate = logVoiceUpdate;
exports.logCommandFromMessage = logCommandFromMessage;
exports.logCommandFromSlash = logCommandFromSlash;
exports.logPunishmentAction = logPunishmentAction;
exports.logAutomodByKind = logAutomodByKind;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const discord_js_1 = require("discord.js");
const reasontracker_js_1 = require("./reasontracker.js");
const LOG_MANAGER_ROLE_ID = "1490006597328699522";
const SETTINGS_PATH = node_path_1.default.join(process.cwd(), "server-log-settings.json");
const LOG_FALLBACKS = {
    "1489749624838295713": {
        punishment: "1511165913003462666",
        automod: "1491984772908711988",
        message_spam: "1496726010832355348",
    },
};
const defaultSettings = {
    punishment: null,
    undone: null,
    link_block: null,
    message: null,
    voice: null,
    command: null,
    automod: null,
    message_spam: null,
};
function loadSettings() {
    try {
        if (!node_fs_1.default.existsSync(SETTINGS_PATH)) {
            return {};
        }
        const raw = node_fs_1.default.readFileSync(SETTINGS_PATH, "utf8");
        return JSON.parse(raw) ?? {};
    }
    catch {
        return {};
    }
}
const settingsStore = loadSettings();
function saveSettings() {
    node_fs_1.default.writeFileSync(SETTINGS_PATH, JSON.stringify(settingsStore, null, 2), "utf8");
}
function getSettings(guildId) {
    if (!settingsStore[guildId]) {
        settingsStore[guildId] = { ...defaultSettings };
    }
    return settingsStore[guildId];
}
function hasManagerRole(member) {
    if (!member) {
        return false;
    }
    return member.roles.cache.has(LOG_MANAGER_ROLE_ID) || member.permissions.has("Administrator");
}
function extractChannelId(input) {
    const match = input.match(/^<?#?(\d{15,25})>?$/);
    return match?.[1] ?? null;
}
function truncate(value, maxLength) {
    return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}
function formatUserLabel(user) {
    return `${user.tag ?? user.username ?? "Unknown User"} (\`${user.id}\`)`;
}
function formatMemberLabel(member) {
    return `${member.user.tag} (\`${member.id}\`)`;
}
async function resolveLogChannel(guild, kind) {
    const settings = getSettings(guild.id);
    const channelId = settings[kind] ?? LOG_FALLBACKS[guild.id]?.[kind] ?? null;
    if (!channelId) {
        return null;
    }
    const channel = guild.channels.cache.get(channelId)
        ?? await guild.channels.fetch(channelId).catch(() => null);
    return channel instanceof discord_js_1.TextChannel ? channel : null;
}
function buildLogPanel(title, sections, actionLabel, emoji) {
    const row = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`log:${title}:${Date.now()}`)
        .setLabel(actionLabel)
        .setEmoji(emoji)
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setDisabled(true));
    const container = new discord_js_1.ContainerBuilder()
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(`## ${title}`))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
        .addTextDisplayComponents(...sections.map((section) => new discord_js_1.TextDisplayBuilder().setContent(section)))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
        .addActionRowComponents(row)
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent("-# Miami Roleplay © 2026 | Logs"));
    return {
        allowedMentions: {
            parse: [],
            roles: [],
            users: [],
        },
        components: [container],
        flags: discord_js_1.MessageFlags.IsComponentsV2,
    };
}
async function handleLogSetupPrefixCommand(message, rawContent) {
    const normalized = rawContent.trim();
    const lower = normalized.toLowerCase();
    const mappings = [
        { prefixes: ["set-punishment-log", "setpunishmentlog"], kind: "punishment", label: "Punishment log" },
        { prefixes: ["set-undone-log", "setundonelog"], kind: "undone", label: "Undone log" },
        { prefixes: ["set-link-block-log", "setlinkblocklog"], kind: "link_block", label: "Link-block log" },
        { prefixes: ["set-message-log", "setmessagelog"], kind: "message", label: "Message log" },
        { prefixes: ["set-voice-log", "setvoicelog", "set-vc-log", "setvclog"], kind: "voice", label: "Voice log" },
        { prefixes: ["set-command-log", "setcommandlog"], kind: "command", label: "Command log" },
        { prefixes: ["set-automod-log", "setautomodlog"], kind: "automod", label: "Automod log" },
        { prefixes: ["set-message-spam-log", "setmessagespamlog"], kind: "message_spam", label: "Message-spam log" },
    ];
    const matched = mappings.find((entry) => entry.prefixes.some((prefix) => lower.startsWith(prefix)));
    if (!matched) {
        return false;
    }
    if (!message.inGuild() || !message.member || !hasManagerRole(message.member)) {
        await message.delete().catch(() => null);
        return true;
    }
    const value = normalized.split(/\s+/).slice(1).join(" ").trim();
    const channelId = extractChannelId(value);
    if (!channelId) {
        await message.reply(`Use a channel mention or channel ID for the ${matched.label.toLowerCase()} channel.`);
        return true;
    }
    const settings = getSettings(message.guildId);
    settings[matched.kind] = channelId;
    saveSettings();
    await message.reply(`${matched.label} channel set to <#${channelId}>.`);
    return true;
}
async function logMessageCreate(message) {
    if (!message.inGuild() || message.author.bot) {
        return;
    }
    const channel = await resolveLogChannel(message.guild, "message");
    if (!channel) {
        return;
    }
    await channel.send(buildLogPanel("Message Logged", [
        `**Author** - ${message.author.tag} (\`${message.author.id}\`)\n**Channel** - ${message.channel}`,
        `**Content**\n*${truncate(message.content || "[no text content]", 1400)}*`,
    ], "Message Captured", "💬")).catch(() => null);
}
async function logMessageDelete(message) {
    if (!message.guild || message.author?.bot) {
        return;
    }
    const channel = await resolveLogChannel(message.guild, "undone");
    if (!channel) {
        return;
    }
    await channel.send(buildLogPanel("Message Deleted", [
        `**Author** - ${message.author ? `${message.author.tag} (\`${message.author.id}\`)` : "*Unknown or uncached*"}\n**Channel** - ${"channel" in message ? `${message.channel}` : "*Unknown*"}`,
        `**Deleted Content**\n*${truncate(message.content || "[no cached message content]", 1400)}*`,
    ], "Delete Captured", "🗑️")).catch(() => null);
}
async function logMessageEdit(oldMessage, newMessage) {
    if (!newMessage.guild || newMessage.author?.bot) {
        return;
    }
    if ((oldMessage.content ?? "") === (newMessage.content ?? "")) {
        return;
    }
    const channel = await resolveLogChannel(newMessage.guild, "undone");
    if (!channel) {
        return;
    }
    await channel.send(buildLogPanel("Message Edited", [
        `**Author** - ${newMessage.author ? `${newMessage.author.tag} (\`${newMessage.author.id}\`)` : "*Unknown or uncached*"}\n**Channel** - ${"channel" in newMessage ? `${newMessage.channel}` : "*Unknown*"}`,
        `**Before**\n*${truncate(oldMessage.content || "[no cached content]", 700)}*`,
        `**After**\n*${truncate(newMessage.content || "[no new content]", 700)}*`,
    ], "Edit Captured", "🔁")).catch(() => null);
}
async function logVoiceUpdate(oldState, newState) {
    const guild = newState.guild ?? oldState.guild;
    const member = newState.member ?? oldState.member;
    if (!guild || !member || member.user.bot) {
        return;
    }
    const before = oldState.channel;
    const after = newState.channel;
    if (before?.id === after?.id) {
        return;
    }
    const channel = await resolveLogChannel(guild, "voice");
    if (!channel) {
        return;
    }
    let title = "Voice Channel Updated";
    if (!before && after)
        title = "Voice Channel Joined";
    if (before && !after)
        title = "Voice Channel Left";
    if (before && after && before.id !== after.id)
        title = "Voice Channel Moved";
    await channel.send(buildLogPanel(title, [
        `**Member** - ${formatMemberLabel(member)}\n**Before** - ${before ? before.toString() : "*Not connected*"}\n**After** - ${after ? after.toString() : "*Disconnected*"}`,
    ], "Voice Logged", "🎙️")).catch(() => null);
}
async function logCommandFromMessage(message, rawContent) {
    if (!message.inGuild() || message.author.bot || !rawContent.trim()) {
        return;
    }
    const channel = await resolveLogChannel(message.guild, "command");
    if (!channel) {
        return;
    }
    await channel.send(buildLogPanel("Command Used", [
        `**Member** - ${message.author.tag} (\`${message.author.id}\`)\n**Channel** - ${message.channel}`,
        `**Command**\n\`-${truncate(rawContent, 1200)}\``,
    ], "Prefix Command", "🤖")).catch(() => null);
}
async function logCommandFromSlash(interaction) {
    if (!interaction.inCachedGuild()) {
        return;
    }
    const channel = await resolveLogChannel(interaction.guild, "command");
    if (!channel) {
        return;
    }
    const commandText = `/${interaction.commandName}`;
    await channel.send(buildLogPanel("Slash Command Used", [
        `**Member** - ${interaction.user.tag} (\`${interaction.user.id}\`)\n**Channel** - ${interaction.channel}`,
        `**Command**\n\`${commandText}\``,
    ], "Slash Command", "🤖")).catch(() => null);
}
async function logPunishmentAction(moderator, targetId, action, reason) {
    const channel = await resolveLogChannel(moderator.guild, "punishment");
    if (!channel) {
        return;
    }
    const trackedReason = (0, reasontracker_js_1.buildTrackedReasonField)("Reason", reason);
    const sentMessage = await channel.send(buildLogPanel(`${action} Logged`, [
        `**Moderator** - ${formatMemberLabel(moderator)}\n**Target** - *User ID:* \`${targetId}\``,
        trackedReason.text,
    ], `${action} Logged`, action === "Ban" ? "🔨" : action === "Unban" ? "🔓" : "👢")).catch(() => null);
    if (sentMessage) {
        (0, reasontracker_js_1.finalizeTrackedReason)(trackedReason.entryId, moderator.guild.id, channel.id, sentMessage.id, "Reason");
    }
}
async function logAutomodByKind(message, kind, title, bodySections, buttonLabel, emoji) {
    if (!message.inGuild()) {
        return;
    }
    const channel = await resolveLogChannel(message.guild, kind);
    if (!channel) {
        return;
    }
    await channel.send(buildLogPanel(title, bodySections, buttonLabel, emoji)).catch(() => null);
}
