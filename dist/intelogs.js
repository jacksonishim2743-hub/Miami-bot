"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.postWatchlistBoardMessage = postWatchlistBoardMessage;
exports.handleIntelButtonInteraction = handleIntelButtonInteraction;
exports.handleIntelLogCommand = handleIntelLogCommand;
exports.logSessionEvent = logSessionEvent;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const discord_js_1 = require("discord.js");
const INTEL_MANAGER_ROLE_ID = "1490006597328699522";
const WATCHLIST_LOG_CHANNEL_ID = "1511173320303841440";
const EVENTS_LOG_CHANNEL_ID = "1511172755255726210";
const EVIDENCE_LOG_CHANNEL_ID = "1511173042682990644";
const EVENTS_DOC_URL = "https://docs.google.com/spreadsheets/d/1B2Y31Cny4lGdLXD3wQEQlbmMF3uc3P-O93JLCYBQCM0/edit?usp=sharing";
const WATCHLIST_STORE_PATH = node_path_1.default.join(process.cwd(), "watchlist-store.json");
const WATCHLIST_PREV_ID = "watchlistboard:prev";
const WATCHLIST_NEXT_ID = "watchlistboard:next";
const WATCHLIST_PAGE_SIZE = 8;
function loadWatchlistStore() {
    try {
        if (!node_fs_1.default.existsSync(WATCHLIST_STORE_PATH)) {
            return {};
        }
        const raw = node_fs_1.default.readFileSync(WATCHLIST_STORE_PATH, "utf8");
        return JSON.parse(raw) ?? {};
    }
    catch {
        return {};
    }
}
const watchlistStore = loadWatchlistStore();
function saveWatchlistStore() {
    node_fs_1.default.writeFileSync(WATCHLIST_STORE_PATH, JSON.stringify(watchlistStore, null, 2), "utf8");
}
function getWatchlistEntries(guildId) {
    if (!watchlistStore[guildId]) {
        watchlistStore[guildId] = [];
    }
    return watchlistStore[guildId];
}
function appendWatchlistEntry(guildId, userId, info, loggedBy) {
    const entries = getWatchlistEntries(guildId);
    const entry = {
        entryId: `${Date.now()}${Math.floor(Math.random() * 1000)}`,
        userId,
        info,
        loggedBy,
        createdAt: Date.now(),
    };
    entries.unshift(entry);
    saveWatchlistStore();
    return entry;
}
function hasIntelRole(member) {
    if (!member) {
        return false;
    }
    return member.roles.cache.has(INTEL_MANAGER_ROLE_ID)
        || member.permissions.has("Administrator");
}
function buildPanel(title, lines, footer, buttonLabel, buttonUrl) {
    const container = new discord_js_1.ContainerBuilder()
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent([`## ${title}`, "", ...lines].join("\n")));
    if (buttonLabel && buttonUrl) {
        container
            .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
            .addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
            .setLabel(buttonLabel)
            .setStyle(discord_js_1.ButtonStyle.Link)
            .setEmoji("📄")
            .setURL(buttonUrl)));
    }
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(footer));
    return {
        allowedMentions: {
            parse: [],
            roles: [],
            users: [],
            repliedUser: false,
        },
        components: [container],
        flags: discord_js_1.MessageFlags.IsComponentsV2,
    };
}
function buildWatchlistBoardPanel(guildId, page) {
    const entries = getWatchlistEntries(guildId);
    const totalPages = Math.max(1, Math.ceil(entries.length / WATCHLIST_PAGE_SIZE));
    const safePage = Math.min(Math.max(page, 0), totalPages - 1);
    const pageEntries = entries.slice(safePage * WATCHLIST_PAGE_SIZE, (safePage + 1) * WATCHLIST_PAGE_SIZE);
    const lines = pageEntries.length > 0
        ? pageEntries.flatMap((entry) => [
            `**${entry.userId}** *-* **${entry.info}**`,
            `-# Logged by ${entry.loggedBy} • <t:${Math.floor(entry.createdAt / 1000)}:F>`,
            "",
        ])
        : ["*No watchlist entries have been logged yet.*"];
    const container = new discord_js_1.ContainerBuilder()
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent([
        "## Watchlist Board",
        "",
        ...lines,
        "",
        `-# Page ${safePage + 1} of ${totalPages}`,
    ].join("\n").trim()))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
        .addActionRowComponents(new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`${WATCHLIST_PREV_ID}:${safePage}`)
        .setLabel("Previous")
        .setEmoji("⬅️")
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setDisabled(safePage <= 0), new discord_js_1.ButtonBuilder()
        .setCustomId(`${WATCHLIST_NEXT_ID}:${safePage}`)
        .setLabel("Next")
        .setEmoji("➡️")
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setDisabled(safePage >= totalPages - 1)))
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent("-# Miami Roleplay © 2026 | Watchlist Board"));
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
async function resolveTextChannel(message, channelId) {
    const channel = message.guild?.channels.cache.get(channelId)
        ?? await message.guild?.channels.fetch(channelId).catch(() => null);
    return channel instanceof discord_js_1.TextChannel ? channel : null;
}
function extractUserId(input) {
    const match = input.match(/^<@!?(\d{15,25})>$|^(\d{15,25})$/);
    return match?.[1] ?? match?.[2] ?? null;
}
function extractLinks(text) {
    return [...text.matchAll(/https?:\/\/\S+/gi)].map((match) => match[0]);
}
async function postWatchlistBoardMessage(channel) {
    await channel.send(buildWatchlistBoardPanel(channel.guild.id, 0));
}
async function handleIntelButtonInteraction(interaction) {
    if (!interaction.inCachedGuild()) {
        return false;
    }
    if (!interaction.customId.startsWith(`${WATCHLIST_PREV_ID}:`)
        && !interaction.customId.startsWith(`${WATCHLIST_NEXT_ID}:`)) {
        return false;
    }
    if (!hasIntelRole(interaction.member)) {
        await interaction.reply({
            content: "This board is locked to foundership.",
            flags: discord_js_1.MessageFlags.Ephemeral,
        }).catch(() => null);
        return true;
    }
    const [, pageRaw] = interaction.customId.split(":").slice(-2);
    const currentPage = Number.parseInt(pageRaw ?? "0", 10) || 0;
    const nextPage = interaction.customId.startsWith(WATCHLIST_PREV_ID)
        ? currentPage - 1
        : currentPage + 1;
    await interaction.update(buildWatchlistBoardPanel(interaction.guildId, nextPage)).catch(() => null);
    return true;
}
async function handleIntelLogCommand(message, rawContent) {
    const normalized = rawContent.trim();
    const lower = normalized.toLowerCase();
    const isCommand = lower === "watchlistboard"
        || lower.startsWith("watchlist ")
        || lower.startsWith("event log ")
        || lower.startsWith("evidence ");
    if (!isCommand) {
        return false;
    }
    if (!message.inGuild() || !hasIntelRole(message.member)) {
        await message.delete().catch(() => null);
        return true;
    }
    if (lower === "watchlistboard") {
        if (!(message.channel instanceof discord_js_1.TextChannel)) {
            await message.delete().catch(() => null);
            return true;
        }
        await postWatchlistBoardMessage(message.channel);
        await message.delete().catch(() => null);
        return true;
    }
    if (lower.startsWith("watchlist ")) {
        const parts = normalized.split(/\s+/);
        const userId = extractUserId(parts[1] ?? "");
        const reason = parts.slice(2).join(" ").trim() || "No reason provided.";
        if (!userId) {
            await message.delete().catch(() => null);
            return true;
        }
        appendWatchlistEntry(message.guildId, userId, reason, message.author.tag);
        const logChannel = await resolveTextChannel(message, WATCHLIST_LOG_CHANNEL_ID);
        if (logChannel) {
            await logChannel.send(buildPanel("Watchlist Entry Logged", [
                `**Member** - *User ID:* \`${userId}\``,
                `**Handled By** - ${message.author.tag} (\`${message.author.id}\`)`,
                `**Info** - *${reason}*`,
                `**Source Channel** - ${message.channel}`,
                `**Timestamp** - <t:${Math.floor(Date.now() / 1000)}:F>`,
            ], "-# Miami Roleplay © 2026 | Watchlist Logs")).catch(() => null);
        }
        await message.delete().catch(() => null);
        return true;
    }
    if (lower.startsWith("event log ")) {
        const body = normalized.slice("event log ".length).trim();
        const [titlePart, ...detailParts] = body.split("|");
        const title = titlePart?.trim() || "Event Logged";
        const details = detailParts.join("|").trim() || "No additional event details were provided.";
        const logChannel = await resolveTextChannel(message, EVENTS_LOG_CHANNEL_ID);
        if (logChannel) {
            await logChannel.send(buildPanel(title, [
                `**Logged By** - ${message.author.tag} (\`${message.author.id}\`)`,
                `**Source Channel** - ${message.channel}`,
                "",
                details,
            ], "-# Miami Roleplay © 2026 | Event Logs", "Open Event Tracker", EVENTS_DOC_URL)).catch(() => null);
        }
        await message.delete().catch(() => null);
        return true;
    }
    if (lower.startsWith("evidence ")) {
        const body = normalized.slice("evidence ".length).trim();
        const [titlePart, ...detailParts] = body.split("|");
        const title = titlePart?.trim() || "Evidence Logged";
        const details = detailParts.join("|").trim() || "No additional evidence notes were provided.";
        const attachmentLines = [...message.attachments.values()].map((attachment) => `• [${attachment.name ?? "attachment"}](${attachment.url})`);
        const linkLines = extractLinks(body).map((link) => `• ${link}`);
        const extraEvidenceLines = [...attachmentLines, ...linkLines];
        const logChannel = await resolveTextChannel(message, EVIDENCE_LOG_CHANNEL_ID);
        if (logChannel) {
            await logChannel.send(buildPanel(title, [
                `**Logged By** - ${message.author.tag} (\`${message.author.id}\`)`,
                `**Source Channel** - ${message.channel}`,
                "",
                `**Notes** - *${details}*`,
                ...(extraEvidenceLines.length > 0
                    ? ["", "**Evidence Links**", ...extraEvidenceLines]
                    : ["", "*No attachments or links were included in this entry.*"]),
            ], "-# Miami Roleplay © 2026 | Evidence Logs")).catch(() => null);
        }
        await message.delete().catch(() => null);
        return true;
    }
    return false;
}
async function logSessionEvent(guildMember, title, lines) {
    const channel = guildMember.guild.channels.cache.get(EVENTS_LOG_CHANNEL_ID)
        ?? await guildMember.guild.channels.fetch(EVENTS_LOG_CHANNEL_ID).catch(() => null);
    if (!(channel instanceof discord_js_1.TextChannel)) {
        return;
    }
    await channel.send(buildPanel(title, [
        `**Handled By** - ${guildMember.user.tag} (\`${guildMember.id}\`)`,
        "",
        ...lines,
    ], "-# Miami Roleplay © 2026 | Event Logs", "Open Event Tracker", EVENTS_DOC_URL)).catch(() => null);
}
