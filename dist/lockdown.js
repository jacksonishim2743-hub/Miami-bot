"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleLockdownPrefixCommand = handleLockdownPrefixCommand;
const discord_js_1 = require("discord.js");
const reasontracker_js_1 = require("./reasontracker.js");
const LOCKDOWN_MANAGER_ROLE_ID = "1490006597328699522";
function hasManagerRole(message) {
    return (!!message.member &&
        (message.member.roles.cache.has(LOCKDOWN_MANAGER_ROLE_ID) ||
            message.member.permissions.has(discord_js_1.PermissionsBitField.Flags.Administrator)));
}
function buildLockdownPanel(title, reasonText) {
    const container = new discord_js_1.ContainerBuilder()
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent([
        `## ${title}`,
        "",
        reasonText,
    ].join("\n")))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent("-# Miami Roleplay © 2026 | Server Lockdown"));
    return {
        components: [container],
        flags: discord_js_1.MessageFlags.IsComponentsV2,
    };
}
async function setGuildLockdown(message, locked) {
    const channels = Array.from(message.guild.channels.cache.values()).filter((channel) => channel.type === discord_js_1.ChannelType.GuildText ||
        channel.type === discord_js_1.ChannelType.GuildAnnouncement);
    await Promise.all(channels.map(async (channel) => {
        await channel.permissionOverwrites.edit(message.guild.roles.everyone, {
            SendMessages: locked ? false : null,
        }).catch(() => null);
    }));
}
async function handleLockdownPrefixCommand(message, rawContent) {
    const normalized = rawContent.trim();
    const lower = normalized.toLowerCase();
    const isLockdownCommand = lower.startsWith("lockdown ") ||
        lower === "lockdown" ||
        lower.startsWith("end lockdown");
    if (!isLockdownCommand) {
        return false;
    }
    if (!message.inGuild() || !hasManagerRole(message)) {
        await message.delete().catch(() => null);
        return true;
    }
    if (lower === "lockdown" || lower.startsWith("lockdown ")) {
        const reason = normalized.slice("lockdown".length).trim() || "No reason provided.";
        const trackedReason = (0, reasontracker_js_1.buildTrackedReasonField)("Reason", reason);
        await setGuildLockdown(message, true);
        await message.delete().catch(() => null);
        const panel = await message.channel.send(buildLockdownPanel("Server Lockdown Enabled", trackedReason.text)).catch(() => null);
        if (panel) {
            (0, reasontracker_js_1.finalizeTrackedReason)(trackedReason.entryId, message.guildId, panel.channelId, panel.id, "Reason");
            setTimeout(() => {
                void panel.delete().catch(() => null);
            }, 10_000);
        }
        return true;
    }
    const reason = normalized.slice("end lockdown".length).trim() || "No reason provided.";
    const trackedReason = (0, reasontracker_js_1.buildTrackedReasonField)("Reason", reason);
    await setGuildLockdown(message, false);
    await message.delete().catch(() => null);
    const panel = await message.channel.send(buildLockdownPanel("Server Lockdown Lifted", trackedReason.text)).catch(() => null);
    if (panel) {
        (0, reasontracker_js_1.finalizeTrackedReason)(trackedReason.entryId, message.guildId, panel.channelId, panel.id, "Reason");
        setTimeout(() => {
            void panel.delete().catch(() => null);
        }, 10_000);
    }
    return true;
}
