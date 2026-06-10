"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshServerStatChannels = refreshServerStatChannels;
exports.refreshServerStatChannelsForMember = refreshServerStatChannelsForMember;
exports.startServerStatsTask = startServerStatsTask;
const erlc_js_1 = require("./erlc.js");
const rp_js_1 = require("./rp.js");
const STATS_GUILD_ID = "1489749624838295713";
const RP_STATUS_CHANNEL_ID = "1511502120392720424";
const QUEUE_STATUS_CHANNEL_ID = "1511502522022629617";
const PLAYER_COUNT_CHANNEL_ID = "1511502618281906246";
const MEMBER_COUNT_CHANNEL_ID = "1511501970178052146";
const REFRESH_INTERVAL_MS = 30_000;
let refreshTimer = null;
function isRenameableChannel(channel) {
    return Boolean(channel && "setName" in channel && typeof channel.setName === "function");
}
async function renameIfNeeded(channel, nextName) {
    if (!isRenameableChannel(channel)) {
        return;
    }
    if (channel.name === nextName) {
        return;
    }
    await channel.setName(nextName).catch(() => null);
}
async function updateMemberCountChannel(guild) {
    if (!MEMBER_COUNT_CHANNEL_ID) {
        return;
    }
    const channel = await guild.channels.fetch(MEMBER_COUNT_CHANNEL_ID).catch(() => null);
    await renameIfNeeded(channel, `𝐌𝐞𝐦𝐛𝐞𝐫𝐬: ${guild.memberCount}`);
}
async function updateRpChannel(guild) {
    const channel = await guild.channels.fetch(RP_STATUS_CHANNEL_ID).catch(() => null);
    const state = await (0, rp_js_1.readCurrentRpState)();
    const rpName = state?.currentLabel ?? "Not Set Yet";
    await renameIfNeeded(channel, `𝐂𝐮𝐫𝐫𝐞𝐧𝐭 𝐑𝐏: ${rpName}`);
}
async function updateQueueChannel(guild) {
    const channel = await guild.channels.fetch(QUEUE_STATUS_CHANNEL_ID).catch(() => null);
    const result = await (0, erlc_js_1.fetchQueueStatus)();
    if (!result.ok) {
        await renameIfNeeded(channel, "𝐐𝐮𝐞𝐮𝐞: --");
        return;
    }
    await renameIfNeeded(channel, `𝐐𝐮𝐞𝐮𝐞: ${result.queueSize}`);
}
async function updatePlayerCountChannel(guild) {
    if (!PLAYER_COUNT_CHANNEL_ID) {
        return;
    }
    const channel = await guild.channels.fetch(PLAYER_COUNT_CHANNEL_ID).catch(() => null);
    const result = await (0, erlc_js_1.fetchQueueStatus)();
    if (!result.ok) {
        await renameIfNeeded(channel, "𝐏𝐥𝐚𝐲𝐞𝐫𝐬 𝐈𝐧𝐠𝐚𝐦𝐞: --/40");
        return;
    }
    await renameIfNeeded(channel, `𝐏𝐥𝐚𝐲𝐞𝐫𝐬 𝐈𝐧𝐠𝐚𝐦𝐞: ${result.currentPlayers}/40`);
}
async function refreshServerStatChannels(guild) {
    if (guild.id !== STATS_GUILD_ID) {
        return;
    }
    await Promise.all([
        updateMemberCountChannel(guild),
        updateRpChannel(guild),
        updateQueueChannel(guild),
        updatePlayerCountChannel(guild),
    ]);
}
async function refreshServerStatChannelsForMember(member) {
    await refreshServerStatChannels(member.guild);
}
function startServerStatsTask(client) {
    if (refreshTimer) {
        clearInterval(refreshTimer);
    }
    const runRefresh = async () => {
        const guild = client.guilds.cache.get(STATS_GUILD_ID) ?? await client.guilds.fetch(STATS_GUILD_ID).catch(() => null);
        if (!guild) {
            return;
        }
        await refreshServerStatChannels(guild).catch(() => null);
    };
    void runRefresh();
    refreshTimer = setInterval(() => {
        void runRefresh();
    }, REFRESH_INTERVAL_MS);
}
