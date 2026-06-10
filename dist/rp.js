"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readCurrentRpState = readCurrentRpState;
exports.getRpOptionByKey = getRpOptionByKey;
exports.handleQueueCommand = handleQueueCommand;
exports.postRpChangeMessage = postRpChangeMessage;
exports.applyRpChange = applyRpChange;
exports.buildRpInfoMessage = buildRpInfoMessage;
const discord_js_1 = require("discord.js");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const erlc_js_1 = require("./erlc.js");
const RP_STATE_FILE = (0, node_path_1.resolve)(process.cwd(), "rp-state.json");
const RP_OPTIONS = [
    {
        key: "lake_roleplay",
        label: "🏕️ Lake Roleplay",
        emoji: "🏕️",
        infoLabel: "Lake Roleplay",
        gameMessage: ":m 🏕️ RP Change: Lake RP is active. Head to the lake area now and stage up there.",
    },
    {
        key: "housing_suburbs",
        label: "🏘️ Housing Suburbs",
        emoji: "🏘️",
        infoLabel: "Housing Suburbs",
        gameMessage: ":m 🏘️ RP Change: Housing/Suburbs RP is active. Please move into the neighborhood area now.",
    },
    {
        key: "highway_55",
        label: "🛣️ Highway 55",
        emoji: "🛣️",
        infoLabel: "Highway 55",
        gameMessage: ":m 🛣️ RP Change: Highway 55 RP is active. Make your way to Highway 55 and patrol there.",
    },
    {
        key: "farms",
        label: "🌾 Farms",
        emoji: "🌾",
        infoLabel: "Farms",
        gameMessage: ":m 🌾 RP Change: Farms RP is active. Please head to the farm area and set your scenes there.",
    },
    {
        key: "springfield",
        label: "🏙️ Springfield",
        emoji: "🏙️",
        infoLabel: "Springfield",
        gameMessage: ":m 🏙️ RP Change: Springfield RP is active. Please move into Springfield and keep scenes there.",
    },
    {
        key: "miami",
        label: "🌴 Miami",
        emoji: "🌴",
        infoLabel: "Miami",
        gameMessage: ":m 🌴 RP Change: Miami RP is active. Head into Miami now and keep activity in that area.",
    },
    {
        key: "whole_map",
        label: "🗺️ Whole Map",
        emoji: "🗺️",
        infoLabel: "Whole Map",
        gameMessage: ":m 🗺️ RP Change: Whole Map RP is active. You may scene anywhere, keep it realistic and organized.",
    },
    {
        key: "server_restart",
        label: "🔁 Server Restart",
        emoji: "🔁",
        infoLabel: "Server Restart",
        gameMessage: ":m 🔁 Server restart RP is active. Please prepare for a restart and wrap scenes up safely now.",
    },
    {
        key: "high_rock_park",
        label: "🏞️ High Rock Park",
        emoji: "🏞️",
        infoLabel: "High Rock Park",
        gameMessage: ":m 🏞️ RP Change: High Rock Park RP is active. Please head to High Rock Park for scenes now.",
    },
];
function buildQueuePanel(queueValue, currentPlayersValue, statusLine) {
    const lines = [
        "## Queue Size",
        "",
        "**Hello, welcome to Miami City Roleplay below will tell you the number of people that are in queue!**",
        "",
        `**Queue Size** \`-\` ${queueValue}`,
        `**Current Players** \`-\` ${currentPlayersValue}`,
    ];
    if (statusLine) {
        lines.push("", `*Status:* ${statusLine}`);
    }
    lines.push("", "-# Offical Miami City Roleplay | Queue Size");
    return {
        components: [
            new discord_js_1.ContainerBuilder().addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(lines.join("\n"))),
        ],
        flags: discord_js_1.MessageFlags.IsComponentsV2,
    };
}
async function readRpState() {
    try {
        const raw = await (0, promises_1.readFile)(RP_STATE_FILE, "utf8");
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
async function readCurrentRpState() {
    return readRpState();
}
async function writeRpState(state) {
    await (0, promises_1.mkdir)((0, node_path_1.dirname)(RP_STATE_FILE), { recursive: true });
    await (0, promises_1.writeFile)(RP_STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}
function getRpOptionByKey(key) {
    return RP_OPTIONS.find((option) => option.key === key) ?? null;
}
async function handleQueueCommand(channel) {
    const result = await (0, erlc_js_1.fetchQueueStatus)();
    if (result.ok) {
        await channel.send(buildQueuePanel(String(result.queueSize), String(result.currentPlayers)));
        return;
    }
    await channel.send(buildQueuePanel("Unavailable right now", "Unavailable right now", result.message));
}
async function postRpChangeMessage(channel) {
    const menu = new discord_js_1.StringSelectMenuBuilder()
        .setCustomId("rpchange:select")
        .setPlaceholder("Choose the next Roleplay")
        .addOptions(RP_OPTIONS.map((option) => ({
        label: option.infoLabel,
        value: option.key,
        emoji: option.emoji,
    })));
    await channel.send({
        content: "🔥 *Select the next Roleplay for the server.*",
        components: [new discord_js_1.ActionRowBuilder().addComponents(menu)],
    });
}
async function applyRpChange(key, user) {
    const option = getRpOptionByKey(key);
    if (!option) {
        return { ok: false, message: "That RP option is no longer valid." };
    }
    await writeRpState({
        currentKey: option.key,
        currentLabel: option.infoLabel,
        changedById: user.id,
        changedByTag: user.tag,
        changedAt: Date.now(),
    });
    const result = await (0, erlc_js_1.runErlcServerCommand)(option.gameMessage);
    if (!result.ok) {
        return {
            ok: true,
            option,
            warning: "The RP was updated, but the ERLC server did not accept the in-game message right now.",
        };
    }
    return { ok: true, option };
}
function formatElapsed(milliseconds) {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours} hours, ${minutes} minutes, ${seconds} seconds`;
}
async function buildRpInfoMessage() {
    const state = await readRpState();
    if (!state) {
        return [
            `**Current RP:** \`🗺️ RP: Not Set Yet\``,
            `*RP has not been changed yet by any staff member.*`,
        ].join("\n");
    }
    const elapsed = formatElapsed(Date.now() - state.changedAt);
    return [
        `**Current RP:** \`${getRpOptionByKey(state.currentKey)?.emoji ?? "🗺️"} RP: ${state.currentLabel}\``,
        `*RP was changed* **${elapsed} ago** *by* **${state.changedByTag}**`,
    ].join("\n");
}
