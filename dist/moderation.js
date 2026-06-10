"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleModerationRoleSetupPrefixCommand = handleModerationRoleSetupPrefixCommand;
exports.handleAutomodMessage = handleAutomodMessage;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const discord_js_1 = require("discord.js");
const config_js_1 = require("./config.js");
const serverlogs_js_1 = require("./serverlogs.js");
const serverlogs_js_2 = require("./serverlogs.js");
const MODERATION_MANAGER_ROLE_ID = "1490006597328699522";
const MODERATION_SETTINGS_PATH = node_path_1.default.join(process.cwd(), "moderation-role-settings.json");
const BLOCKED_WORD_ALERT_CHANNEL_ID = "1491984772908711988";
const BLOCKED_WORD_ALERT_ROLE_ID = "1490529045425684651";
const punctuationPattern = /[^a-z0-9\s]/g;
const invitePattern = /(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)\/[a-z0-9-]+/i;
const urlPattern = /https?:\/\/[^\s<]+|www\.[^\s<]+/gi;
const warningCache = new Map();
const spamCache = new Map();
const defaultRoleSettings = {
    approvedLinkRoleId: null,
    spamBypassRoleId: null,
    automodBypassRoleId: null,
};
function loadRoleSettings() {
    try {
        if (!node_fs_1.default.existsSync(MODERATION_SETTINGS_PATH)) {
            return {};
        }
        const raw = node_fs_1.default.readFileSync(MODERATION_SETTINGS_PATH, "utf8");
        return JSON.parse(raw) ?? {};
    }
    catch {
        return {};
    }
}
const roleSettingsStore = loadRoleSettings();
function saveRoleSettings() {
    node_fs_1.default.writeFileSync(MODERATION_SETTINGS_PATH, JSON.stringify(roleSettingsStore, null, 2), "utf8");
}
function getRoleSettings(guildId) {
    if (!roleSettingsStore[guildId]) {
        roleSettingsStore[guildId] = { ...defaultRoleSettings };
    }
    return roleSettingsStore[guildId];
}
function hasManagerRole(message) {
    return (!!message.member &&
        (message.member.roles.cache.has(MODERATION_MANAGER_ROLE_ID) ||
            message.member.permissions.has(discord_js_1.PermissionsBitField.Flags.Administrator)));
}
function extractRoleId(input) {
    const match = input.match(/^<@&(\d{15,25})>$|^(\d{15,25})$/);
    return match?.[1] ?? match?.[2] ?? null;
}
function normalizeContent(content) {
    return content.toLowerCase().replace(punctuationPattern, " ");
}
function getCacheKey(guildId, userId) {
    return `${guildId}:${userId}`;
}
function truncate(value, maxLength) {
    return value.length > maxLength
        ? `${value.slice(0, maxLength - 3)}...`
        : value;
}
function hasAutomodBypass(message) {
    if (!message.member) {
        return false;
    }
    if (message.member.permissions.has(discord_js_1.PermissionsBitField.Flags.ManageMessages)) {
        return true;
    }
    if (!config_js_1.config.automod.exemptRoleIds.length) {
        const settings = getRoleSettings(message.guildId);
        return !!settings.automodBypassRoleId && message.member.roles.cache.has(settings.automodBypassRoleId);
    }
    const envBypass = message.member.roles.cache.some((role) => config_js_1.config.automod.exemptRoleIds.includes(role.id));
    if (envBypass) {
        return true;
    }
    const settings = getRoleSettings(message.guildId);
    return !!settings.automodBypassRoleId && message.member.roles.cache.has(settings.automodBypassRoleId);
}
function hasApprovedLinkRole(message) {
    if (!message.member || !message.guildId) {
        return false;
    }
    const settings = getRoleSettings(message.guildId);
    return !!settings.approvedLinkRoleId && message.member.roles.cache.has(settings.approvedLinkRoleId);
}
function hasSpamBypassRole(message) {
    if (!message.member || !message.guildId) {
        return false;
    }
    const settings = getRoleSettings(message.guildId);
    return !!settings.spamBypassRoleId && message.member.roles.cache.has(settings.spamBypassRoleId);
}
function findBlockedWord(content) {
    const normalizedContent = normalizeContent(content);
    const normalizedWords = normalizedContent.split(/\s+/).filter(Boolean);
    const rawWords = content
        .toLowerCase()
        .split(/\s+/)
        .map((word) => word.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ""))
        .filter(Boolean);
    const tokens = new Set([...normalizedWords, ...rawWords]);
    for (const blockedWord of config_js_1.config.automod.blockedWords) {
        const normalizedBlockedWord = blockedWord.toLowerCase().trim();
        if (!normalizedBlockedWord) {
            continue;
        }
        if (tokens.has(normalizedBlockedWord)) {
            return normalizedBlockedWord;
        }
    }
    return null;
}
function extractUrls(content) {
    return content.match(urlPattern) ?? [];
}
function isAllowedDomain(rawUrl) {
    const urlWithProtocol = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
    try {
        const hostname = new URL(urlWithProtocol).hostname.replace(/^www\./, "");
        return config_js_1.config.automod.allowedLinkDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
    }
    catch {
        return false;
    }
}
function hasDisallowedLink(content) {
    const urls = extractUrls(content);
    if (!urls.length) {
        return false;
    }
    return urls.some((url) => !isAllowedDomain(url));
}
function hasExcessiveCaps(content) {
    const lettersOnly = content.replace(/[^a-z]/gi, "");
    if (lettersOnly.length < config_js_1.config.automod.caps.minLetters) {
        return false;
    }
    const uppercaseLetters = lettersOnly.replace(/[^A-Z]/g, "");
    const ratio = uppercaseLetters.length / lettersOnly.length;
    return ratio >= config_js_1.config.automod.caps.ratio;
}
function addWarning(guildId, userId) {
    const key = getCacheKey(guildId, userId);
    const now = Date.now();
    const cutoff = now - config_js_1.config.automod.warningWindowMs;
    const activeWarnings = (warningCache.get(key) ?? []).filter((timestamp) => timestamp >= cutoff);
    activeWarnings.push(now);
    warningCache.set(key, activeWarnings);
    return activeWarnings.length;
}
function trackSpam(guildId, userId, content) {
    const key = getCacheKey(guildId, userId);
    const now = Date.now();
    const cutoff = now - config_js_1.config.automod.spam.windowMs;
    const normalizedContent = normalizeContent(content).replace(/\s+/g, " ").trim();
    const history = (spamCache.get(key) ?? []).filter((entry) => entry.createdAt >= cutoff);
    history.push({ content: normalizedContent, createdAt: now });
    spamCache.set(key, history);
    const rapidMessages = history.length >= config_js_1.config.automod.spam.maxMessages;
    const duplicateMessages = normalizedContent.length >= config_js_1.config.automod.spam.minDuplicateLength &&
        history.filter((entry) => entry.content === normalizedContent).length >=
            config_js_1.config.automod.spam.maxDuplicates;
    return {
        isRapidSpam: rapidMessages,
        isDuplicateSpam: duplicateMessages,
    };
}
function evaluateViolation(message) {
    const spamBypass = hasSpamBypassRole(message);
    const blockedWord = findBlockedWord(message.content);
    if (blockedWord) {
        return {
            type: "blocked_word",
            reason: "blocked language",
            details: `Matched blocked word "${blockedWord}".`,
            shouldDelete: true,
            shouldWarn: false,
            shouldTimeout: false,
            shouldBan: false,
        };
    }
    if (!config_js_1.config.automod.allowInvites && invitePattern.test(message.content)) {
        return {
            type: "invite",
            reason: "server invite links are not allowed",
            details: "Detected a Discord invite link.",
            shouldDelete: true,
            shouldWarn: true,
            shouldTimeout: false,
            shouldBan: false,
        };
    }
    if (!config_js_1.config.automod.allowLinks && !hasApprovedLinkRole(message) && hasDisallowedLink(message.content)) {
        return {
            type: "link",
            reason: "external links are not allowed here",
            details: "Detected a disallowed link.",
            shouldDelete: true,
            shouldWarn: true,
            shouldTimeout: false,
            shouldBan: false,
        };
    }
    if (!spamBypass && message.mentions.users.size > config_js_1.config.automod.maxMentions) {
        return {
            type: "mention_spam",
            reason: "too many mentions in one message",
            details: `Detected ${message.mentions.users.size} user mentions.`,
            shouldDelete: true,
            shouldWarn: true,
            shouldTimeout: true,
            shouldBan: false,
        };
    }
    if (!spamBypass && hasExcessiveCaps(message.content)) {
        return {
            type: "caps_spam",
            reason: "excessive caps",
            details: "Detected a message with an excessive uppercase ratio.",
            shouldDelete: false,
            shouldWarn: true,
            shouldTimeout: false,
            shouldBan: false,
        };
    }
    const { isRapidSpam, isDuplicateSpam } = spamBypass
        ? { isRapidSpam: false, isDuplicateSpam: false }
        : trackSpam(message.guildId, message.author.id, message.content);
    if (isDuplicateSpam) {
        return {
            type: "duplicate_spam",
            reason: "repeated duplicate messages",
            details: "Detected repeated duplicate content in a short time window.",
            shouldDelete: true,
            shouldWarn: true,
            shouldTimeout: true,
            shouldBan: false,
        };
    }
    if (isRapidSpam) {
        return {
            type: "rapid_spam",
            reason: "sending messages too quickly",
            details: "Detected message burst spam in a short time window.",
            shouldDelete: true,
            shouldWarn: true,
            shouldTimeout: false,
            shouldBan: false,
        };
    }
    return null;
}
async function handleModerationRoleSetupPrefixCommand(message, rawContent) {
    const normalized = rawContent.trim();
    const lower = normalized.toLowerCase();
    const isCommand = lower.startsWith("set-approved-link-role") ||
        lower.startsWith("setapprovedlinkrole") ||
        lower.startsWith("set-spam-bypass-role") ||
        lower.startsWith("setspambypassrole") ||
        lower.startsWith("set-automod-bypass-role") ||
        lower.startsWith("setautomodbypassrole");
    if (!isCommand) {
        return false;
    }
    if (!message.inGuild() || !hasManagerRole(message)) {
        await message.delete().catch(() => null);
        return true;
    }
    const value = normalized.split(/\s+/).slice(1).join(" ").trim();
    const roleId = extractRoleId(value);
    if (!roleId) {
        await message.reply("Use a role mention or role ID.");
        return true;
    }
    const settings = getRoleSettings(message.guildId);
    if (lower.startsWith("set-approved-link-role") || lower.startsWith("setapprovedlinkrole")) {
        settings.approvedLinkRoleId = roleId;
        saveRoleSettings();
        await message.reply(`Approved link role set to <@&${roleId}>.`);
        return true;
    }
    if (lower.startsWith("set-spam-bypass-role") || lower.startsWith("setspambypassrole")) {
        settings.spamBypassRoleId = roleId;
        saveRoleSettings();
        await message.reply(`Spam bypass role set to <@&${roleId}>.`);
        return true;
    }
    settings.automodBypassRoleId = roleId;
    saveRoleSettings();
    await message.reply(`Automod bypass role set to <@&${roleId}>.`);
    return true;
}
async function sendWarning(sourceMessage, channel, memberLabel, reason, warningCount, violationType) {
    const warningRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`automod:warning:${Date.now()}`)
        .setLabel(`Warning ${warningCount}/${config_js_1.config.automod.maxWarningsBeforeTimeout}`)
        .setEmoji("⚠️")
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setDisabled(true));
    const container = new discord_js_1.ContainerBuilder()
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(violationType === "rapid_spam"
        ? [
            "## Slow Down",
            "",
            `😅 **Woah ${memberLabel} your sending messages a little to fast there.**`,
        ].join("\n")
        : [
            "## Automod Warning",
            "",
            `${memberLabel}, *your recent message was flagged by Miami automod.*`,
        ].join("\n")))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent([
        `**Reason** - *${reason}*`,
        `**Warning Count** - *${warningCount}/${config_js_1.config.automod.maxWarningsBeforeTimeout}*`,
        "*Please slow down, review the rules, and avoid repeating the same behavior.*",
    ].join("\n")))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
        .addActionRowComponents(warningRow)
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent("-# Miami Roleplay © 2026 | Automod"));
    const response = await sourceMessage.reply({
        allowedMentions: {
            repliedUser: false,
            parse: [],
            roles: [],
            users: [],
        },
        components: [container],
        flags: discord_js_1.MessageFlags.IsComponentsV2,
    });
    setTimeout(() => {
        void response.delete().catch(() => undefined);
    }, config_js_1.config.automod.warningMessageLifetimeMs);
}
function buildBlockedWordAlertPanel(message, violation, purgedRecentMessages) {
    const actionRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`automod:blocked-word:${Date.now()}`)
        .setLabel("Blocked Word Removed")
        .setEmoji("🛡️")
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setDisabled(true));
    const container = new discord_js_1.ContainerBuilder()
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent([
        "## Blocked Word Detected",
        "",
        "*Miami automod removed a message that matched the blocked-word list and cleaned up recent accessible messages from the same user.*",
    ].join("\n")))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent([
        `**Member** - ${message.author.tag} (\`${message.author.id}\`)`,
        `**Channel** - ${message.channel}`,
        `**Reason** - *${violation.reason}*`,
        `**Details** - *${violation.details}*`,
    ].join("\n")), new discord_js_1.TextDisplayBuilder().setContent([
        `**Recent Messages Removed** - *${purgedRecentMessages}*`,
        `**Captured Content**`,
        `*${truncate(message.content || "[no text content]", 1000)}*`,
    ].join("\n")))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
        .addActionRowComponents(actionRow)
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent("-# Miami Roleplay © 2026 | Automod"));
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
async function sendBlockedWordAlert(message, violation, purgedRecentMessages) {
    if (!message.guild) {
        return;
    }
    const alertChannel = message.guild.channels.cache.get(BLOCKED_WORD_ALERT_CHANNEL_ID)
        ?? await message.guild.channels.fetch(BLOCKED_WORD_ALERT_CHANNEL_ID).catch(() => null);
    if (!alertChannel?.isTextBased() || !("send" in alertChannel)) {
        return;
    }
    await alertChannel.send({
        content: `<@&${BLOCKED_WORD_ALERT_ROLE_ID}>`,
        allowedMentions: {
            parse: [],
            roles: [BLOCKED_WORD_ALERT_ROLE_ID],
            users: [],
        },
    }).catch(() => null);
    await alertChannel.send(buildBlockedWordAlertPanel(message, violation, purgedRecentMessages)).catch(() => null);
}
async function logViolation(message, violation, warningCount, didTimeout) {
    const kind = violation.type === "invite" || violation.type === "link"
        ? "link_block"
        : violation.type === "mention_spam" ||
            violation.type === "caps_spam" ||
            violation.type === "rapid_spam" ||
            violation.type === "duplicate_spam"
            ? "message_spam"
            : "automod";
    await (0, serverlogs_js_1.logAutomodByKind)(message, kind, kind === "link_block"
        ? "Link Block Action"
        : kind === "message_spam"
            ? "Message Spam Action"
            : "Automod Action", [
        `**Member** - ${message.author.tag} (\`${message.author.id}\`)\n**Channel** - ${message.channel}\n**Rule** - *${violation.type}*`,
        `**Reason** - *${violation.reason}*\n**Warnings** - *${warningCount}*\n**Details** - *${violation.details}*`,
        `**Captured Content**\n*${truncate(message.content || "[no text content]", 1000)}*`,
        `**Timeout Status** - *${didTimeout ? "Member timed out by automod." : "No timeout was applied."}*`,
    ], didTimeout ? "Timed Out" : violation.shouldDelete ? "Message Removed" : "Message Flagged", didTimeout ? "🔇" : violation.shouldDelete ? "🗑️" : "📌");
}
async function maybeTimeoutMember(message, violation, warningCount) {
    if (!message.member || !violation.shouldTimeout) {
        return false;
    }
    if (warningCount < config_js_1.config.automod.maxWarningsBeforeTimeout) {
        return false;
    }
    if (!message.member.moderatable) {
        return false;
    }
    await message.member.timeout(config_js_1.config.automod.timeoutDurationMs, `Automod: ${violation.reason}`);
    warningCache.delete(getCacheKey(message.guildId, message.author.id));
    return true;
}
async function maybeBanMember(message, violation) {
    if (!violation.shouldBan || !message.guild || !message.member) {
        return false;
    }
    if (!message.member.bannable) {
        return false;
    }
    let didBan = true;
    await message.guild.members.ban(message.author.id, {
        reason: `Automod: ${violation.reason}`,
        deleteMessageSeconds: 0,
    }).catch(() => {
        didBan = false;
        return null;
    });
    return didBan;
}
async function purgeRecentMessagesForMember(message, days) {
    if (!message.guild) {
        return 0;
    }
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    let deletedCount = 0;
    for (const channel of message.guild.channels.cache.values()) {
        if (channel.type !== discord_js_1.ChannelType.GuildText || !("messages" in channel)) {
            continue;
        }
        const me = message.guild.members.me;
        if (!me) {
            continue;
        }
        const permissions = channel.permissionsFor(me);
        if (!permissions?.has(discord_js_1.PermissionsBitField.Flags.ManageMessages) || !permissions.has(discord_js_1.PermissionsBitField.Flags.ViewChannel)) {
            continue;
        }
        const recentMessages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
        if (!recentMessages) {
            continue;
        }
        for (const entry of recentMessages.values()) {
            if (entry.author.id !== message.author.id ||
                entry.id === message.id ||
                entry.createdTimestamp < cutoff ||
                !entry.deletable) {
                continue;
            }
            const deleted = await entry.delete().then(() => true).catch(() => false);
            if (deleted) {
                deletedCount += 1;
            }
        }
    }
    return deletedCount;
}
async function handleAutomodMessage(message) {
    if (message.author.bot ||
        !message.inGuild() ||
        !config_js_1.config.automod.enabled ||
        hasAutomodBypass(message)) {
        return;
    }
    const violation = evaluateViolation(message);
    if (!violation) {
        return;
    }
    try {
        const warningCount = violation.shouldWarn
            ? addWarning(message.guildId, message.author.id)
            : 0;
        if (violation.shouldWarn) {
            await sendWarning(message, message.channel, message.member?.displayName ?? message.author.username, violation.reason, warningCount, violation.type);
        }
        if (violation.shouldDelete && message.deletable) {
            await message.delete().catch(() => null);
        }
        let purgedRecentMessages = 0;
        if (violation.type === "blocked_word") {
            purgedRecentMessages = await purgeRecentMessagesForMember(message, 30);
            violation.details = `${violation.details} Removed ${purgedRecentMessages} recent message(s) from accessible channels in the last 30 days.`;
            await sendBlockedWordAlert(message, violation, purgedRecentMessages);
        }
        const didBan = await maybeBanMember(message, violation);
        const didTimeout = await maybeTimeoutMember(message, violation, warningCount);
        await logViolation(message, violation, warningCount, didTimeout);
        if (didBan && message.member) {
            await (0, serverlogs_js_2.logPunishmentAction)(message.member, message.author.id, "Ban", `Automod: ${violation.reason}`);
            await (0, serverlogs_js_1.logAutomodByKind)(message, "automod", "Automod Ban Issued", [
                `**Member** - ${message.author.tag} (\`${message.author.id}\`)`,
                `**Reason** - *${violation.reason}*`,
                `**Details** - *${violation.details}*`,
                `**Action** - *The message was deleted and the member was banned automatically.*`,
            ], "Ban Issued", "🔨");
        }
    }
    catch (error) {
        console.error("Failed to enforce automod rule.");
        console.error(error);
    }
}
