"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAntiRaidPrefixCommand = handleAntiRaidPrefixCommand;
exports.handleAntiRaidMessage = handleAntiRaidMessage;
exports.handleAntiRaidMemberJoin = handleAntiRaidMemberJoin;
exports.handleAntiRaidChannelCreate = handleAntiRaidChannelCreate;
exports.handleAntiRaidChannelDelete = handleAntiRaidChannelDelete;
exports.handleAntiRaidRoleCreate = handleAntiRaidRoleCreate;
exports.handleAntiRaidRoleDelete = handleAntiRaidRoleDelete;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const discord_js_1 = require("discord.js");
const ANTI_RAID_MANAGER_ROLE_ID = "1490006597328699522";
const SETTINGS_PATH = node_path_1.default.join(process.cwd(), "antiraid-settings.json");
const JOIN_WINDOW_MS = 20_000;
const JOIN_THRESHOLD = 6;
const RAID_MODE_MS = 10 * 60 * 1000;
const ACTION_WINDOW_MS = 30_000;
const ACTION_THRESHOLD = 3;
const MESSAGE_LINK_THRESHOLD = 5;
const MESSAGE_MENTION_THRESHOLD = 8;
const ENFORCEMENT_TIMEOUT_MS = 60 * 60 * 1000;
const defaultSettings = {
    enabled: true,
    logChannelId: null,
    quarantineRoleId: null,
};
function loadSettings() {
    try {
        if (!node_fs_1.default.existsSync(SETTINGS_PATH)) {
            return {};
        }
        const raw = node_fs_1.default.readFileSync(SETTINGS_PATH, "utf8");
        const parsed = JSON.parse(raw);
        return parsed ?? {};
    }
    catch {
        return {};
    }
}
const settingsStore = loadSettings();
const joinCache = new Map();
const raidModeUntil = new Map();
const actionCache = new Map();
function saveSettings() {
    node_fs_1.default.writeFileSync(SETTINGS_PATH, JSON.stringify(settingsStore, null, 2), "utf8");
}
function getSettings(guildId) {
    if (!settingsStore[guildId]) {
        settingsStore[guildId] = { ...defaultSettings };
    }
    return settingsStore[guildId];
}
function buildSettingsStatus(settings) {
    const container = new discord_js_1.ContainerBuilder()
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent([
        "## Anti-Raid Status",
        "",
        "*Your Miami anti-raid protection settings are shown below.*",
    ].join("\n")))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent([
        `**Enabled** - ${settings.enabled ? "*Yes*" : "*No*"}`,
        `**Raid Log Channel** - ${settings.logChannelId ? `<#${settings.logChannelId}>` : "*Not set*"}`,
        `**Quarantine Role** - ${settings.quarantineRoleId ? `<@&${settings.quarantineRoleId}>` : "*Not set*"}`,
    ].join("\n")))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent([
        `**Join Protection** - *${JOIN_THRESHOLD} joins in ${Math.floor(JOIN_WINDOW_MS / 1000)} seconds will trigger raid mode.*`,
        `**Action Protection** - *${ACTION_THRESHOLD} destructive actions in ${Math.floor(ACTION_WINDOW_MS / 1000)} seconds will trigger enforcement.*`,
        `**Raid Mode Length** - *${Math.floor(RAID_MODE_MS / 60000)} minutes*`,
    ].join("\n")), new discord_js_1.TextDisplayBuilder().setContent("-# Miami Roleplay © 2026 | Anti-Raid"));
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
function buildRaidLogPanel(title, description) {
    const container = new discord_js_1.ContainerBuilder()
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent([
        `## ${title}`,
        "",
        description,
    ].join("\n")), new discord_js_1.TextDisplayBuilder().setContent("-# Miami Roleplay © 2026 | Anti-Raid"));
    return {
        components: [container],
        flags: discord_js_1.MessageFlags.IsComponentsV2,
    };
}
function isManager(member) {
    if (!member) {
        return false;
    }
    return (member.roles.cache.has(ANTI_RAID_MANAGER_ROLE_ID) ||
        member.permissions.has(discord_js_1.PermissionsBitField.Flags.Administrator));
}
function cleanupActionTimestamps(key) {
    const cutoff = Date.now() - ACTION_WINDOW_MS;
    const active = (actionCache.get(key) ?? []).filter((timestamp) => timestamp >= cutoff);
    actionCache.set(key, active);
    return active;
}
function pushAction(guildId, userId) {
    const key = `${guildId}:${userId}`;
    const active = cleanupActionTimestamps(key);
    active.push(Date.now());
    actionCache.set(key, active);
    return active.length;
}
function extractChannelId(input) {
    const match = input.match(/^<?#?(\d{15,25})>?$/);
    return match?.[1] ?? null;
}
function extractRoleId(input) {
    const match = input.match(/^<@&(\d{15,25})>$|^(\d{15,25})$/);
    return match?.[1] ?? match?.[2] ?? null;
}
function formatMemberLabel(member) {
    return `${member.user.tag} (\`${member.id}\`)`;
}
async function sendRaidLog(guildId, resolver, title, description) {
    const settings = getSettings(guildId);
    if (!settings.logChannelId) {
        return;
    }
    const logChannel = await resolver();
    if (!logChannel) {
        return;
    }
    await logChannel.send(buildRaidLogPanel(title, description)).catch(() => null);
}
async function resolveLogChannelFromGuildMember(member) {
    const settings = getSettings(member.guild.id);
    if (!settings.logChannelId) {
        return null;
    }
    const channel = member.guild.channels.cache.get(settings.logChannelId)
        ?? await member.guild.channels.fetch(settings.logChannelId).catch(() => null);
    return channel && channel.type === discord_js_1.ChannelType.GuildText ? channel : null;
}
async function resolveLogChannelFromChannel(channel) {
    const settings = getSettings(channel.guild.id);
    if (!settings.logChannelId) {
        return null;
    }
    const target = channel.guild.channels.cache.get(settings.logChannelId)
        ?? await channel.guild.channels.fetch(settings.logChannelId).catch(() => null);
    return target && target.type === discord_js_1.ChannelType.GuildText ? target : null;
}
async function resolveLogChannelFromRole(role) {
    const settings = getSettings(role.guild.id);
    if (!settings.logChannelId) {
        return null;
    }
    const target = role.guild.channels.cache.get(settings.logChannelId)
        ?? await role.guild.channels.fetch(settings.logChannelId).catch(() => null);
    return target && target.type === discord_js_1.ChannelType.GuildText ? target : null;
}
async function applyQuarantine(member, reason) {
    const settings = getSettings(member.guild.id);
    if (!settings.quarantineRoleId) {
        return false;
    }
    const role = member.guild.roles.cache.get(settings.quarantineRoleId)
        ?? await member.guild.roles.fetch(settings.quarantineRoleId).catch(() => null);
    if (!role || member.roles.cache.has(role.id)) {
        return false;
    }
    await member.roles.add(role, reason).catch(() => null);
    return true;
}
async function enforceAgainstMember(member, reason) {
    if (isManager(member) || !member.moderatable) {
        return false;
    }
    await member.timeout(ENFORCEMENT_TIMEOUT_MS, reason).catch(() => null);
    return true;
}
async function getAuditExecutor(guildChannelOrRole, type) {
    const audit = await guildChannelOrRole.guild.fetchAuditLogs({ type, limit: 5 }).catch(() => null);
    const entry = audit?.entries.find((candidate) => {
        const createdRecently = Date.now() - candidate.createdTimestamp < 15_000;
        return createdRecently;
    });
    const executorId = entry?.executorId;
    if (!executorId) {
        return null;
    }
    return guildChannelOrRole.guild.members.fetch(executorId).catch(() => null);
}
async function handleAntiRaidPrefixCommand(message, rawContent) {
    const normalized = rawContent.trim();
    if (!normalized) {
        return false;
    }
    const lower = normalized.toLowerCase();
    const isAntiRaidCommand = lower.startsWith("antiraid") ||
        lower.startsWith("set-antiraid-log") ||
        lower.startsWith("setantiraidlog") ||
        lower.startsWith("set-antiraid-quarantine-role") ||
        lower.startsWith("setantiraidquarantinerole");
    if (!isAntiRaidCommand) {
        return false;
    }
    if (!message.inGuild() || !message.member || !isManager(message.member)) {
        await message.delete().catch(() => null);
        return true;
    }
    const settings = getSettings(message.guildId);
    if (lower === "antiraid enable") {
        settings.enabled = true;
        saveSettings();
        await message.reply("Anti-raid protection is now enabled.");
        return true;
    }
    if (lower === "antiraid disable") {
        settings.enabled = false;
        saveSettings();
        await message.reply("Anti-raid protection is now disabled.");
        return true;
    }
    if (lower === "antiraid status") {
        await message.reply(buildSettingsStatus(settings));
        return true;
    }
    if (lower.startsWith("set-antiraid-log") || lower.startsWith("setantiraidlog")) {
        const value = normalized.split(/\s+/).slice(1).join(" ").trim();
        const channelId = extractChannelId(value);
        if (!channelId) {
            await message.reply("Use a channel mention or channel ID for the anti-raid log channel.");
            return true;
        }
        settings.logChannelId = channelId;
        saveSettings();
        await message.reply(`Anti-raid log channel set to <#${channelId}>.`);
        return true;
    }
    if (lower.startsWith("set-antiraid-quarantine-role") || lower.startsWith("setantiraidquarantinerole")) {
        const value = normalized.split(/\s+/).slice(1).join(" ").trim();
        const roleId = extractRoleId(value);
        if (!roleId) {
            await message.reply("Use a role mention or role ID for the quarantine role.");
            return true;
        }
        settings.quarantineRoleId = roleId;
        saveSettings();
        await message.reply(`Anti-raid quarantine role set to <@&${roleId}>.`);
        return true;
    }
    await message.reply("Use `-antiraid enable`, `-antiraid disable`, `-antiraid status`, `-set-antiraid-log`, or `-set-antiraid-quarantine-role`.");
    return true;
}
async function handleAntiRaidMessage(message) {
    if (!message.inGuild() || message.author.bot) {
        return;
    }
    const settings = getSettings(message.guildId);
    if (!settings.enabled || isManager(message.member)) {
        return;
    }
    const shouldDeleteForWebhook = Boolean(message.webhookId);
    const shouldDeleteForMentions = message.mentions.everyone || message.mentions.users.size >= MESSAGE_MENTION_THRESHOLD;
    const urlMatches = message.content.match(/https?:\/\/[^\s<]+|www\.[^\s<]+/gi) ?? [];
    const shouldDeleteForLinkFlood = urlMatches.length >= MESSAGE_LINK_THRESHOLD;
    if (!shouldDeleteForWebhook && !shouldDeleteForMentions && !shouldDeleteForLinkFlood) {
        return;
    }
    if (message.deletable) {
        await message.delete().catch(() => null);
    }
    const member = message.member;
    if (member) {
        await enforceAgainstMember(member, "Anti-raid protection triggered from message activity");
    }
    const reasons = [
        shouldDeleteForWebhook ? "webhook message detected" : null,
        shouldDeleteForMentions ? "mass mention spam detected" : null,
        shouldDeleteForLinkFlood ? "mass link spam detected" : null,
    ].filter(Boolean).join(", ");
    await sendRaidLog(message.guildId, async () => resolveLogChannelFromGuildMember(member ?? await message.guild.members.fetchMe()), "Anti-Raid Message Action", `**Member** - ${message.author.tag} (\`${message.author.id}\`)\n**Channel** - ${message.channel}\n**Reason** - ${reasons}\n**Content** - ${message.content || "*No message content*"}`);
}
async function handleAntiRaidMemberJoin(member) {
    const settings = getSettings(member.guild.id);
    if (!settings.enabled) {
        return;
    }
    const now = Date.now();
    const recent = (joinCache.get(member.guild.id) ?? []).filter((entry) => now - entry.joinedAt <= JOIN_WINDOW_MS);
    recent.push({ memberId: member.id, joinedAt: now });
    joinCache.set(member.guild.id, recent);
    const raidActive = (raidModeUntil.get(member.guild.id) ?? 0) > now;
    if (recent.length >= JOIN_THRESHOLD && !raidActive) {
        raidModeUntil.set(member.guild.id, now + RAID_MODE_MS);
        for (const entry of recent) {
            const recentMember = await member.guild.members.fetch(entry.memberId).catch(() => null);
            if (recentMember) {
                await applyQuarantine(recentMember, "Anti-raid burst join protection");
            }
        }
        await sendRaidLog(member.guild.id, async () => resolveLogChannelFromGuildMember(member), "Raid Mode Activated", `**Reason** - ${recent.length} members joined within ${Math.floor(JOIN_WINDOW_MS / 1000)} seconds.\n**Protection Window** - ${Math.floor(RAID_MODE_MS / 60000)} minutes\n**Action** - Recent joiners were moved into the quarantine role if it was configured.`);
        return;
    }
    if ((raidModeUntil.get(member.guild.id) ?? 0) > now) {
        const quarantined = await applyQuarantine(member, "Anti-raid raid mode still active");
        await sendRaidLog(member.guild.id, async () => resolveLogChannelFromGuildMember(member), "Raid Mode Join Captured", `**Member** - ${formatMemberLabel(member)}\n**Action** - ${quarantined ? "Quarantine role applied." : "Raid mode active, but no quarantine role was available."}`);
    }
}
async function handleDestructiveAction(source, executor, actionLabel, auditType, onThreshold) {
    const settings = getSettings(source.guild.id);
    if (!settings.enabled || !executor || isManager(executor)) {
        return;
    }
    const count = pushAction(source.guild.id, executor.id);
    if (count < ACTION_THRESHOLD) {
        return;
    }
    await onThreshold().catch(() => null);
    const timedOut = await enforceAgainstMember(executor, `Anti-raid triggered for ${actionLabel}`);
    await sendRaidLog(source.guild.id, async () => source instanceof discord_js_1.Role ? resolveLogChannelFromRole(source) : resolveLogChannelFromChannel(source), "Destructive Action Protection Triggered", `**Executor** - ${formatMemberLabel(executor)}\n**Action** - ${actionLabel}\n**Count** - ${count} actions within ${Math.floor(ACTION_WINDOW_MS / 1000)} seconds\n**Enforcement** - ${timedOut ? "Timed out for 1 hour." : "Could not time out automatically."}`);
    actionCache.delete(`${source.guild.id}:${executor.id}`);
}
async function handleAntiRaidChannelCreate(channel) {
    const settings = getSettings(channel.guild.id);
    if (!settings.enabled) {
        return;
    }
    const executor = await getAuditExecutor(channel, discord_js_1.AuditLogEvent.ChannelCreate);
    await handleDestructiveAction(channel, executor, `channel create (${channel.name})`, discord_js_1.AuditLogEvent.ChannelCreate, async () => {
        if (channel.deletable) {
            await channel.delete("Anti-raid channel creation flood protection");
        }
    });
}
async function handleAntiRaidChannelDelete(channel) {
    const settings = getSettings(channel.guild.id);
    if (!settings.enabled) {
        return;
    }
    const executor = await getAuditExecutor(channel, discord_js_1.AuditLogEvent.ChannelDelete);
    await handleDestructiveAction(channel, executor, `channel delete (${channel.name})`, discord_js_1.AuditLogEvent.ChannelDelete, async () => Promise.resolve());
}
async function handleAntiRaidRoleCreate(role) {
    const settings = getSettings(role.guild.id);
    if (!settings.enabled) {
        return;
    }
    const executor = await getAuditExecutor(role, discord_js_1.AuditLogEvent.RoleCreate);
    await handleDestructiveAction(role, executor, `role create (${role.name})`, discord_js_1.AuditLogEvent.RoleCreate, async () => {
        await role.delete("Anti-raid role creation flood protection").catch(() => null);
    });
}
async function handleAntiRaidRoleDelete(role) {
    const settings = getSettings(role.guild.id);
    if (!settings.enabled) {
        return;
    }
    const executor = await getAuditExecutor(role, discord_js_1.AuditLogEvent.RoleDelete);
    await handleDestructiveAction(role, executor, `role delete (${role.name})`, discord_js_1.AuditLogEvent.RoleDelete, async () => Promise.resolve());
}
