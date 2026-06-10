"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTrackedReasonField = buildTrackedReasonField;
exports.finalizeTrackedReason = finalizeTrackedReason;
exports.applyReasonUpdate = applyReasonUpdate;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const REASON_TRACKER_PATH = node_path_1.default.join(process.cwd(), "reason-tracker.json");
function loadReasonStore() {
    try {
        if (!node_fs_1.default.existsSync(REASON_TRACKER_PATH)) {
            return {};
        }
        const raw = node_fs_1.default.readFileSync(REASON_TRACKER_PATH, "utf8");
        return JSON.parse(raw) ?? {};
    }
    catch {
        return {};
    }
}
const reasonStore = loadReasonStore();
function saveReasonStore() {
    node_fs_1.default.writeFileSync(REASON_TRACKER_PATH, JSON.stringify(reasonStore, null, 2), "utf8");
}
function normalizeReason(reason) {
    const trimmed = reason.trim();
    return trimmed || "No reason provided.";
}
function generateReasonId() {
    let id = "";
    do {
        id = Math.floor(100000 + Math.random() * 900000).toString();
    } while (reasonStore[id]);
    return id;
}
function buildTrackedReasonField(fieldLabel, reason) {
    const normalizedReason = normalizeReason(reason);
    const needsTracking = normalizedReason === "No reason provided.";
    const entryId = needsTracking ? generateReasonId() : null;
    const lines = [`**${fieldLabel}** - *${normalizedReason}*`];
    if (entryId) {
        lines.push(`-# Reason ID: \`${entryId}\``);
    }
    return {
        entryId,
        text: lines.join("\n"),
    };
}
function finalizeTrackedReason(entryId, guildId, channelId, messageId, fieldLabel) {
    if (!entryId) {
        return;
    }
    reasonStore[entryId] = {
        id: entryId,
        guildId,
        channelId,
        messageId,
        fieldLabel,
        createdAt: Date.now(),
        updatedAt: null,
    };
    saveReasonStore();
}
function rewriteReasonContent(content, fieldLabel, reasonId, newReason) {
    const lines = content.split("\n");
    let updated = false;
    const nextLines = [];
    for (const line of lines) {
        if (line.trim() === `-# Reason ID: \`${reasonId}\``) {
            updated = true;
            continue;
        }
        if (line.startsWith(`**${fieldLabel}** - `)) {
            nextLines.push(`**${fieldLabel}** - *${newReason}*`);
            updated = true;
            continue;
        }
        nextLines.push(line);
    }
    return {
        content: nextLines.join("\n"),
        updated,
    };
}
function rewriteComponentPayload(value, fieldLabel, reasonId, newReason) {
    if (Array.isArray(value)) {
        let updated = false;
        const nextValue = value.map((entry) => {
            const result = rewriteComponentPayload(entry, fieldLabel, reasonId, newReason);
            updated = updated || result.updated;
            return result.value;
        });
        return { value: nextValue, updated };
    }
    if (!value || typeof value !== "object") {
        return { value, updated: false };
    }
    const nextValue = { ...value };
    let updated = false;
    if (typeof nextValue.content === "string") {
        const result = rewriteReasonContent(nextValue.content, fieldLabel, reasonId, newReason);
        nextValue.content = result.content;
        updated = updated || result.updated;
    }
    if (Array.isArray(nextValue.components)) {
        const result = rewriteComponentPayload(nextValue.components, fieldLabel, reasonId, newReason);
        nextValue.components = result.value;
        updated = updated || result.updated;
    }
    return {
        value: nextValue,
        updated,
    };
}
async function applyReasonUpdate(client, guildId, reasonId, newReason) {
    const entry = reasonStore[reasonId];
    if (!entry || entry.guildId !== guildId) {
        return "not_found";
    }
    const guild = client.guilds.cache.get(entry.guildId)
        ?? await client.guilds.fetch(entry.guildId).catch(() => null);
    if (!guild) {
        return "message_missing";
    }
    const channel = guild.channels.cache.get(entry.channelId)
        ?? await guild.channels.fetch(entry.channelId).catch(() => null);
    if (!channel?.isTextBased() || !("messages" in channel)) {
        return "message_missing";
    }
    const message = await channel.messages.fetch(entry.messageId).catch(() => null);
    if (!message) {
        return "message_missing";
    }
    const serializedComponents = message.components.map((component) => component.toJSON());
    const result = rewriteComponentPayload(serializedComponents, entry.fieldLabel, reasonId, newReason.trim());
    if (!result.updated) {
        return "unchanged";
    }
    await message.edit({
        allowedMentions: {
            parse: [],
            roles: [],
            users: [],
        },
        components: result.value,
    }).catch(() => null);
    reasonStore[reasonId] = {
        ...entry,
        updatedAt: Date.now(),
    };
    saveReasonStore();
    return "updated";
}
