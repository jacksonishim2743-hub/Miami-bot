"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postSessionInfoPanelMessage = postSessionInfoPanelMessage;
exports.postSessionVotePanelMessage = postSessionVotePanelMessage;
exports.postSessionStartPanelMessage = postSessionStartPanelMessage;
exports.postSessionReminderPanelMessage = postSessionReminderPanelMessage;
exports.endSessionChannel = endSessionChannel;
exports.handleSessionCommand = handleSessionCommand;
exports.handleSessionButtonInteraction = handleSessionButtonInteraction;
const discord_js_1 = require("discord.js");
const node_fs_1 = require("node:fs");
const intelogs_js_1 = require("./intelogs.js");
const SESSION_MANAGER_ROLE_ID = "1490006597328699522";
const SESSION_COMMUNITY_PING_ROLE_ID = "1490004451195490426";
const SESSION_VOTE_TARGET = 8;
const SESSION_VOTE_BUTTON_ID = "session:vote";
const SESSION_REMOVE_VOTE_PREFIX = "session:vote:remove:";
const SESSION_INFO_BANNER_FILENAME = "miami-session-information-banner.png";
const SESSION_INFO_BANNER_PATH = "assets/miami-session-information-banner.png";
const SESSION_SETTINGS_PATH = "session-settings.json";
const activeSessionVotes = new Map();
function loadSessionSettings() {
    if (!(0, node_fs_1.existsSync)(SESSION_SETTINGS_PATH)) {
        return { infoMessageIds: {} };
    }
    try {
        const raw = (0, node_fs_1.readFileSync)(SESSION_SETTINGS_PATH, "utf8");
        const parsed = JSON.parse(raw);
        return {
            infoMessageIds: parsed.infoMessageIds ?? {},
        };
    }
    catch {
        return { infoMessageIds: {} };
    }
}
function saveSessionSettings(settings) {
    (0, node_fs_1.writeFileSync)(SESSION_SETTINGS_PATH, JSON.stringify(settings, null, 2));
}
function getSessionInfoMessageId(channelId) {
    const settings = loadSessionSettings();
    return settings.infoMessageIds[channelId] ?? null;
}
function setSessionInfoMessageId(channelId, messageId) {
    const settings = loadSessionSettings();
    settings.infoMessageIds[channelId] = messageId;
    saveSessionSettings(settings);
}
function hasSessionRole(member) {
    return member.roles.cache.has(SESSION_MANAGER_ROLE_ID);
}
function buildSessionPingLine() {
    return `<@&${SESSION_COMMUNITY_PING_ROLE_ID}>`;
}
function buildSessionAllowedMentions() {
    return { roles: [SESSION_COMMUNITY_PING_ROLE_ID] };
}
function buildSessionVotePanel(voteCount) {
    const voteButtonRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(SESSION_VOTE_BUTTON_ID)
        .setLabel("Vote Session")
        .setEmoji("🗳️")
        .setStyle(discord_js_1.ButtonStyle.Secondary));
    const container = new discord_js_1.ContainerBuilder()
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent([
        "## Session Vote",
        "",
        "*Vote below if you are ready for the next Miami City Roleplay session to begin.*",
        "> **Once 8 votes are reached, this vote board will close automatically.**",
    ].join("\n")))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent([
        `**Current Votes** - \`${voteCount}/${SESSION_VOTE_TARGET}\``,
        "",
        "*Press the vote button once to count your vote.*",
        "*If you change your mind, a private remove-vote button will appear only for you after voting.*",
    ].join("\n")))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
        .addActionRowComponents(voteButtonRow)
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent("-# Miami Roleplay © 2026 | Session Vote"));
    return { components: [container], flags: discord_js_1.MessageFlags.IsComponentsV2 };
}
function buildSessionStartPanel(link) {
    const container = new discord_js_1.ContainerBuilder()
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent([
        "## Session Started",
        "",
        "*A new Miami City Roleplay session is now opening. Follow the steps below and join up as soon as possible.*",
    ].join("\n")))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent([
        "**Step 1** - [Emergency Response Liberty County](" + link + ")",
        "**Step 2** - *Join server using the ALWAYSMRP Code*",
        "**Step 3** - *Follow all rules at all times druing the session.*",
    ].join("\n")))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent([
        "**Session Rules**",
        "• *Listen to staff at all times during the session.*",
        "• *Keep the roleplay realistic, active, and respectful.*",
        "• *Do not interfere with official session instructions or organized scenes.*",
    ].join("\n")))
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent("-# Miami Roleplay © 2026 | Session Operations"));
    return { components: [container], flags: discord_js_1.MessageFlags.IsComponentsV2 };
}
function buildSessionReminderPanel() {
    const container = new discord_js_1.ContainerBuilder()
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent([
        "## Session Reminder",
        "",
        "**We are low on members in game right now and we need more people to join so we can boost the session.**",
        "",
        "> *If you are available, please join the session and help keep Miami active.*",
    ].join("\n")))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent([
        "**Why Join?**",
        "*More members means a better session, stronger scenes, and more activity across the whole server.*",
    ].join("\n")), new discord_js_1.TextDisplayBuilder().setContent("-# Miami Roleplay © 2026 | Session Reminder"));
    return { components: [container], flags: discord_js_1.MessageFlags.IsComponentsV2 };
}
function buildSessionInfoPanel() {
    const hasBanner = (0, node_fs_1.existsSync)(SESSION_INFO_BANNER_PATH);
    const container = new discord_js_1.ContainerBuilder();
    if (hasBanner) {
        container.addMediaGalleryComponents(new discord_js_1.MediaGalleryBuilder().addItems(new discord_js_1.MediaGalleryItemBuilder()
            .setURL(`attachment://${SESSION_INFO_BANNER_FILENAME}`)
            .setDescription("Miami Roleplay session information banner")));
        container.addSeparatorComponents(new discord_js_1.SeparatorBuilder());
    }
    container
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent([
        "## Miami City Roleplay Session Information",
        "",
        "*This information panel stays in the session channel so members can always find the active server details, join code, and session expectations in one place.*",
        "",
        "> **Server Name** - *Miami City Roleplay I Strict I Realistic*",
        "> **Server Join Code** - `ALWAYSMRP`",
        "> **Server Owner** - *whosduckhuh*",
    ].join("\n")))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent([
        "**How To Join Sessions**",
        "• *Watch for the official session start panel posted by staff.*",
        "• *Use the join instructions provided in the session announcement and enter the code exactly as posted.*",
        "• *If the server is full, stay alert for reminder messages or rejoin opportunities.*",
        "• *Keep your Discord open so you do not miss session updates, reminders, or end notices.*",
    ].join("\n")))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent([
        "**Session Expectations**",
        "• *Follow all staff instructions immediately and respectfully.*",
        "• *Keep roleplay serious, realistic, and community-friendly at all times.*",
        "• *Do not troll, interfere with scenes, or intentionally lower session quality.*",
        "• *Remain in the correct server and use the proper session code unless staff announces a change.*",
    ].join("\n")))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent([
        "**Helpful Notes**",
        "• *Session announcements, reminders, and vote boards may be cleared after a session ends so this information panel remains the main reference message in the channel.*",
        "• *If you disconnect, rejoin using the current session instructions and code.*",
        "• *Keep your in-game conduct professional and representative of Miami City Roleplay.*",
    ].join("\n")), new discord_js_1.TextDisplayBuilder().setContent("-# Miami Roleplay © 2026 | Session Information"));
    const payload = {
        components: [container],
        flags: discord_js_1.MessageFlags.IsComponentsV2,
    };
    if (hasBanner) {
        payload.files = [
            new discord_js_1.AttachmentBuilder(SESSION_INFO_BANNER_PATH, {
                name: SESSION_INFO_BANNER_FILENAME,
            }),
        ];
    }
    return payload;
}
async function postSessionInfoPanelMessage(channel) {
    return ensureSessionInfoPanel(channel);
}
async function postSessionPing(channel) {
    return channel.send({
        content: buildSessionPingLine(),
        allowedMentions: buildSessionAllowedMentions(),
    });
}
async function postSessionVotePanelMessage(channel, hostUserId) {
    await ensureSessionInfoPanel(channel);
    await postSessionPing(channel);
    const voteMessage = await channel.send(buildSessionVotePanel(0));
    activeSessionVotes.set(voteMessage.id, {
        hostUserId,
        voters: new Set(),
    });
    return voteMessage;
}
async function postSessionStartPanelMessage(channel, link) {
    await ensureSessionInfoPanel(channel);
    await postSessionPing(channel);
    return channel.send(buildSessionStartPanel(link));
}
async function postSessionReminderPanelMessage(channel) {
    await ensureSessionInfoPanel(channel);
    await postSessionPing(channel);
    return channel.send(buildSessionReminderPanel());
}
async function endSessionChannel(channel) {
    await ensureSessionInfoPanel(channel);
    await clearSessionChannelExceptInfo(channel);
}
async function ensureSessionInfoPanel(channel) {
    const existingId = getSessionInfoMessageId(channel.id);
    if (existingId) {
        const existingMessage = await channel.messages.fetch(existingId).catch(() => null);
        if (existingMessage) {
            await existingMessage.edit(buildSessionInfoPanel()).catch(() => null);
            return existingMessage;
        }
    }
    const postedMessage = await channel.send(buildSessionInfoPanel());
    setSessionInfoMessageId(channel.id, postedMessage.id);
    return postedMessage;
}
async function clearSessionChannelExceptInfo(channel) {
    const preservedMessageId = getSessionInfoMessageId(channel.id);
    let before;
    for (let i = 0; i < 5; i += 1) {
        const batch = await channel.messages.fetch({ limit: 100, before }).catch(() => null);
        if (!batch || batch.size === 0) {
            break;
        }
        const deletable = batch.filter((message) => message.id !== preservedMessageId);
        for (const message of deletable.values()) {
            await message.delete().catch(() => null);
        }
        before = batch.last()?.id;
        if (!before || batch.size < 100) {
            break;
        }
    }
}
async function handleSessionCommand(interaction) {
    if (interaction.commandName !== "session" || !interaction.inCachedGuild()) {
        return false;
    }
    if (!hasSessionRole(interaction.member)) {
        await interaction.deferReply({ ephemeral: true }).catch(() => null);
        await interaction.deleteReply().catch(() => null);
        return true;
    }
    if (!interaction.channel || !(interaction.channel instanceof discord_js_1.TextChannel)) {
        await interaction.reply({
            content: "Run this command in a text channel.",
            ephemeral: true,
        });
        return true;
    }
    const group = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand();
    if (group === "vote" && subcommand === "start") {
        await postSessionVotePanelMessage(interaction.channel, interaction.user.id);
        await interaction.reply({
            content: "Session vote panel posted.",
            ephemeral: true,
        });
        await (0, intelogs_js_1.logSessionEvent)(interaction.member, "Session Vote Started", [
            `**Channel** - ${interaction.channel}`,
            `**Vote Target** - \`${SESSION_VOTE_TARGET}\``,
        ]);
        return true;
    }
    if (subcommand === "start") {
        const link = interaction.options.getString("link", true).trim();
        await postSessionStartPanelMessage(interaction.channel, link);
        await interaction.reply({
            content: "Session start panel posted.",
            ephemeral: true,
        });
        await (0, intelogs_js_1.logSessionEvent)(interaction.member, "Session Started", [
            `**Channel** - ${interaction.channel}`,
            `**Join Link** - ${link}`,
            `**Join Code** - \`ALWAYSMRP\``,
        ]);
        return true;
    }
    if (subcommand === "reminder") {
        await postSessionReminderPanelMessage(interaction.channel);
        await interaction.reply({
            content: "Session reminder posted.",
            ephemeral: true,
        });
        await (0, intelogs_js_1.logSessionEvent)(interaction.member, "Session Reminder Sent", [
            `**Channel** - ${interaction.channel}`,
            "*Staff reminded the community that the current session needs more players in game.*",
        ]);
        return true;
    }
    if (subcommand === "end") {
        await endSessionChannel(interaction.channel);
        await interaction.reply({
            content: "Session channel cleaned and session information was preserved.",
            ephemeral: true,
        });
        await (0, intelogs_js_1.logSessionEvent)(interaction.member, "Session Ended", [
            `**Channel** - ${interaction.channel}`,
            "*The session channel was cleaned and the session information panel was preserved.*",
        ]);
        return true;
    }
    return false;
}
async function handleSessionButtonInteraction(interaction) {
    if (!interaction.inCachedGuild()) {
        return false;
    }
    if (interaction.customId === SESSION_VOTE_BUTTON_ID) {
        const voteState = activeSessionVotes.get(interaction.message.id);
        if (!voteState) {
            await interaction.reply({
                content: "This session vote is no longer active.",
                ephemeral: true,
            });
            return true;
        }
        const alreadyVoted = voteState.voters.has(interaction.user.id);
        if (!alreadyVoted) {
            voteState.voters.add(interaction.user.id);
        }
        if (voteState.voters.size >= SESSION_VOTE_TARGET) {
            activeSessionVotes.delete(interaction.message.id);
            await interaction.deferUpdate();
            await interaction.message.delete().catch(() => null);
            await interaction.channel?.send(`<@${voteState.hostUserId}> your session vote reached ${SESSION_VOTE_TARGET} votes. Start the next session.`);
            return true;
        }
        await interaction.update(buildSessionVotePanel(voteState.voters.size));
        await interaction.followUp({
            content: alreadyVoted ? "You already voted on this session." : "Your vote has been counted.",
            components: [
                new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
                    .setCustomId(`${SESSION_REMOVE_VOTE_PREFIX}${interaction.message.id}`)
                    .setLabel("Remove Vote")
                    .setEmoji("➖")
                    .setStyle(discord_js_1.ButtonStyle.Secondary)),
            ],
            ephemeral: true,
        });
        return true;
    }
    if (interaction.customId.startsWith(SESSION_REMOVE_VOTE_PREFIX)) {
        const messageId = interaction.customId.slice(SESSION_REMOVE_VOTE_PREFIX.length);
        const voteState = activeSessionVotes.get(messageId);
        if (!voteState) {
            await interaction.update({
                content: "This session vote is no longer active.",
                components: [],
            });
            return true;
        }
        voteState.voters.delete(interaction.user.id);
        const message = await interaction.channel?.messages.fetch(messageId).catch(() => null);
        if (message) {
            await message.edit(buildSessionVotePanel(voteState.voters.size)).catch(() => null);
        }
        await interaction.update({
            content: "Your vote has been removed.",
            components: [],
        });
        return true;
    }
    return false;
}
