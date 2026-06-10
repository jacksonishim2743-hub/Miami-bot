"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLinkedRobloxId = getLinkedRobloxId;
exports.resolveDiscordTarget = resolveDiscordTarget;
exports.fetchRobloxUserInfoByUsername = fetchRobloxUserInfoByUsername;
exports.buildRobloxUserInfoPanel = buildRobloxUserInfoPanel;
exports.buildDiscordIdMessage = buildDiscordIdMessage;
exports.buildRobloxIdMessage = buildRobloxIdMessage;
exports.buildOwnRobloxIdMessage = buildOwnRobloxIdMessage;
const discord_js_1 = require("discord.js");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const ROBLOX_LINKS_FILE = (0, node_path_1.resolve)(process.cwd(), "roblox-links.json");
function readRobloxLinks() {
    if (!(0, node_fs_1.existsSync)(ROBLOX_LINKS_FILE)) {
        return {};
    }
    try {
        return JSON.parse((0, node_fs_1.readFileSync)(ROBLOX_LINKS_FILE, "utf8"));
    }
    catch {
        return {};
    }
}
function getLinkedRobloxId(discordUserId) {
    const links = readRobloxLinks();
    return links[discordUserId] ?? null;
}
function extractDiscordId(input) {
    const match = input.trim().match(/^<@!?(\d+)>$|^(\d+)$/);
    return match ? match[1] ?? match[2] ?? null : null;
}
async function resolveDiscordTarget(guild, input) {
    const explicitId = extractDiscordId(input);
    if (explicitId) {
        const member = await guild.members.fetch(explicitId).catch(() => null);
        return member?.user ?? null;
    }
    const lowered = input.trim().toLowerCase();
    const cached = guild.members.cache.find((member) => member.user.username.toLowerCase() === lowered ||
        member.displayName.toLowerCase() === lowered ||
        member.user.tag.toLowerCase() === lowered);
    return cached?.user ?? null;
}
async function fetchRobloxUserInfoByUsername(username) {
    const cleanedUsername = username.trim().replace(/^@/, "");
    if (!cleanedUsername) {
        return { ok: false, message: "Please provide a Roblox username." };
    }
    try {
        const lookupResponse = await fetch("https://users.roblox.com/v1/usernames/users", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                usernames: [cleanedUsername],
                excludeBannedUsers: false,
            }),
        });
        if (!lookupResponse.ok) {
            return { ok: false, message: `Roblox lookup failed with HTTP ${lookupResponse.status}.` };
        }
        const lookupData = await lookupResponse.json();
        const match = lookupData.data?.[0];
        if (!match?.id) {
            return { ok: false, message: "I could not find that Roblox user." };
        }
        const [userResponse, thumbnailResponse] = await Promise.all([
            fetch(`https://users.roblox.com/v1/users/${match.id}`),
            fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${match.id}&size=420x420&format=Png&isCircular=false`),
        ]);
        if (!userResponse.ok) {
            return { ok: false, message: `Roblox user info failed with HTTP ${userResponse.status}.` };
        }
        const userData = await userResponse.json();
        const thumbnailData = thumbnailResponse.ok
            ? await thumbnailResponse.json()
            : null;
        return {
            ok: true,
            userId: userData.id,
            username: userData.name,
            displayName: userData.displayName,
            description: userData.description || "No Roblox description was provided.",
            created: userData.created,
            isBanned: userData.isBanned,
            verified: Boolean(userData.hasVerifiedBadge),
            avatarUrl: thumbnailData?.data?.[0]?.imageUrl ?? null,
        };
    }
    catch (error) {
        return {
            ok: false,
            message: error instanceof Error
                ? error.message
                : "Unknown error while contacting Roblox.",
        };
    }
}
function buildRobloxUserInfoPanel(info) {
    return {
        components: [
            new discord_js_1.ContainerBuilder().addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent([
                "## Roblox User Information",
                "",
                `**Username** - *${info.username}*`,
                `**Display Name** - *${info.displayName}*`,
                `**Roblox ID** - \`${info.userId}\``,
                `**Created** - *${new Date(info.created).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}*`,
                `**Verified Badge** - *${info.verified ? "Yes" : "No"}*`,
                `**Banned** - *${info.isBanned ? "Yes" : "No"}*`,
                "",
                "**Description**",
                `*${info.description}*`,
                ...(info.avatarUrl ? ["", `**Avatar** - ${info.avatarUrl}`] : []),
                "",
                "-# Miami Roleplay © 2026 | Roblox Information",
            ].join("\n"))),
        ],
        flags: discord_js_1.MessageFlags.IsComponentsV2,
    };
}
function buildDiscordIdMessage(user) {
    return `*Heres their \`${user.id}\`*`;
}
function buildRobloxIdMessage(userId, robloxId) {
    return robloxId
        ? `*Heres their \`${robloxId}\`*`
        : `*No linked Roblox ID was found for Discord user \`${userId}\`.*`;
}
function buildOwnRobloxIdMessage(discordUserId) {
    const robloxId = getLinkedRobloxId(discordUserId);
    return robloxId
        ? `*Heres your \`${robloxId}\`*`
        : `*No linked Roblox ID was found for your Discord user \`${discordUserId}\`.*`;
}
