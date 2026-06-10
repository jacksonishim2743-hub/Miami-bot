"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAfkCommandMessage = isAfkCommandMessage;
exports.setAfk = setAfk;
exports.handleAfkReturn = handleAfkReturn;
exports.handleAfkMentions = handleAfkMentions;
const AFK_PREFIX = "[AFK] ";
const afkEntries = new Map();
function parseAfkDuration(duration) {
    const match = duration.trim().toLowerCase().match(/^(\d+)([smhdy])$/);
    if (!match) {
        return null;
    }
    const amount = Number(match[1]);
    const unit = match[2];
    if (!Number.isFinite(amount) || amount <= 0) {
        return null;
    }
    const multipliers = {
        s: 1_000,
        m: 60_000,
        h: 3_600_000,
        d: 86_400_000,
        y: 31_536_000_000,
    };
    return amount * multipliers[unit];
}
function isAfkExpired(entry) {
    return Date.now() >= entry.expiresAt;
}
function buildAfkNickname(displayName) {
    const cleanName = displayName.startsWith(AFK_PREFIX)
        ? displayName.slice(AFK_PREFIX.length)
        : displayName;
    return `${AFK_PREFIX}${cleanName}`.slice(0, 32);
}
async function applyAfkNickname(member) {
    if (!member.manageable) {
        return;
    }
    const nickname = buildAfkNickname(member.displayName);
    if (member.nickname === nickname) {
        return;
    }
    await member.setNickname(nickname, "Member marked as AFK");
}
async function restoreNickname(member, previousNickname) {
    if (!member.manageable) {
        return;
    }
    const currentNickname = member.nickname;
    if (currentNickname === previousNickname) {
        return;
    }
    await member.setNickname(previousNickname, "Member returned from AFK");
}
function isAfkCommandMessage(content, prefix) {
    const trimmed = content.trim().toLowerCase();
    return (trimmed.startsWith(`${prefix.toLowerCase()}afk `) ||
        trimmed === `${prefix.toLowerCase()}afk`);
}
async function setAfk(member, durationInput, reason) {
    const durationMs = parseAfkDuration(durationInput);
    if (!durationMs) {
        return {
            ok: false,
            error: "Use `-afk <duration> <reason>` with durations like `1s`, `1m`, `1h`, `1d`, or `1y`.",
        };
    }
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
        return {
            ok: false,
            error: "Include a reason after the duration, like `-afk 1h Eating dinner`.",
        };
    }
    afkEntries.set(member.id, {
        reason: trimmedReason,
        expiresAt: Date.now() + durationMs,
        previousNickname: member.nickname,
    });
    try {
        await applyAfkNickname(member);
    }
    catch {
        // If nickname permissions are missing we still keep AFK active.
    }
    return { ok: true, until: Date.now() + durationMs };
}
async function handleAfkReturn(message) {
    if (!message.member) {
        return false;
    }
    const entry = afkEntries.get(message.author.id);
    if (!entry) {
        return false;
    }
    afkEntries.delete(message.author.id);
    try {
        await restoreNickname(message.member, entry.previousNickname);
    }
    catch {
        // Ignore nickname restore failures and still clear AFK state.
    }
    await message.channel.send(`${message.author}, welcome back.`);
    return true;
}
async function handleAfkMentions(message) {
    if (!message.inGuild() || !message.mentions.members.size) {
        return;
    }
    const responses = [];
    for (const [, mentionedMember] of message.mentions.members) {
        if (mentionedMember.id === message.author.id) {
            continue;
        }
        const entry = afkEntries.get(mentionedMember.id);
        if (!entry) {
            continue;
        }
        if (isAfkExpired(entry)) {
            afkEntries.delete(mentionedMember.id);
            try {
                await restoreNickname(mentionedMember, entry.previousNickname);
            }
            catch {
                // Ignore restore failures for expired AFK entries.
            }
            continue;
        }
        responses.push(`${mentionedMember} is afk please do not bother only if an emergency has occured\n**Reason:** ${entry.reason}`);
    }
    if (!responses.length) {
        return;
    }
    await message.channel.send(responses.join("\n\n"));
}
