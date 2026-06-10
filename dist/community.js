"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCommunityCommand = handleCommunityCommand;
exports.handleCommunityButtonInteraction = handleCommunityButtonInteraction;
const discord_js_1 = require("discord.js");
const GIVEAWAY_PING_ROLE_ID = "1494862255958003743";
const POLL_PING_ROLE_ID = "1494862566675976202";
const COMMUNITY_MANAGER_ROLE_ID = "1490006597328699522";
const GIVEAWAY_ENTER_BUTTON_ID = "giveaway:enter";
const POLL_YES_BUTTON_ID = "poll:yes";
const POLL_NO_BUTTON_ID = "poll:no";
const POLL_UNSURE_BUTTON_ID = "poll:unsure";
const giveaways = new Map();
const activeGiveawayByChannel = new Map();
const polls = new Map();
const activePollByChannel = new Map();
function canManageCommunity(member) {
    return member.roles.cache.has(COMMUNITY_MANAGER_ROLE_ID);
}
function rolePing(roleId) {
    return `<@&${roleId}>`;
}
function roleAllowedMentions(roleId) {
    return { roles: [roleId] };
}
function buildGiveawayPanel(state) {
    const entries = state.entries.size;
    const enterRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(GIVEAWAY_ENTER_BUTTON_ID)
        .setLabel(state.status === "active" ? "Enter Giveaway" : "Giveaway Closed")
        .setEmoji(state.status === "active" ? "🎉" : "🔒")
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setDisabled(state.status !== "active"));
    const container = new discord_js_1.ContainerBuilder()
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent([
        "## Miami Giveaway",
        "",
        `**Prize** - ${state.prize}`,
        `**Hosted By** - <@${state.hostUserId}>`,
        `**Status** - ${state.status === "active" ? "Active" : "Closed"}`,
        `**Created** - <t:${Math.floor(state.createdAt / 1000)}:R>`,
    ].join("\n")))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent([
        "**Giveaway Details**",
        `• *Current Entries:* \`${entries}\``,
        `• *Winner Count:* \`${state.winnerId ? 1 : 0}\``,
        state.winnerId
            ? `• *Current Winner:* <@${state.winnerId}>`
            : "• *Current Winner:* *No winner has been selected yet.*",
    ].join("\n")))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(state.status === "active"
        ? [
            "**How To Join**",
            "*Press the button below to enter the giveaway.*",
            "*Each member only needs to enter once to be counted.*",
            "*Once staff ends the giveaway, entries will lock automatically and a winner can be selected.*",
        ].join("\n")
        : [
            "**Giveaway Closed**",
            "*This giveaway is now closed and no more entries can be accepted.*",
            "*Staff can still reroll the winner if needed after closure.*",
        ].join("\n")))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
        .addActionRowComponents(enterRow)
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent("-# Miami Roleplay © 2026 | Giveaway Operations"));
    return { components: [container], flags: discord_js_1.MessageFlags.IsComponentsV2 };
}
function buildPollPanel(state) {
    const yesCount = Array.from(state.votes.values()).filter((vote) => vote === "yes").length;
    const noCount = Array.from(state.votes.values()).filter((vote) => vote === "no").length;
    const unsureCount = Array.from(state.votes.values()).filter((vote) => vote === "unsure").length;
    const totalVotes = yesCount + noCount + unsureCount;
    const voteRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(POLL_YES_BUTTON_ID)
        .setLabel(`Yes ${yesCount}`)
        .setStyle(discord_js_1.ButtonStyle.Success)
        .setDisabled(state.status !== "active"), new discord_js_1.ButtonBuilder()
        .setCustomId(POLL_NO_BUTTON_ID)
        .setLabel(`No ${noCount}`)
        .setStyle(discord_js_1.ButtonStyle.Danger)
        .setDisabled(state.status !== "active"), new discord_js_1.ButtonBuilder()
        .setCustomId(POLL_UNSURE_BUTTON_ID)
        .setLabel(`Unsure ${unsureCount}`)
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setDisabled(state.status !== "active"));
    const container = new discord_js_1.ContainerBuilder()
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent([
        "## Miami Poll",
        "",
        `**Question** - ${state.question}`,
        `**Hosted By** - <@${state.hostUserId}>`,
        `**Status** - ${state.status === "active" ? "Open" : "Closed"}`,
        `**Started** - <t:${Math.floor(state.createdAt / 1000)}:R>`,
        "",
        `*${state.description}*`,
    ].join("\n")))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent([
        `**Total Votes** - \`${totalVotes}\``,
        `**Yes** - \`${yesCount}\``,
        `**No** - \`${noCount}\``,
        `**Unsure** - \`${unsureCount}\``,
    ].join("\n")))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(state.status === "active"
        ? [
            "**Voting Information**",
            "*Use the buttons below to cast your vote.*",
            "*You can change your vote at any time while the poll is still open.*",
            "*Once staff ends the poll, the final decision message can be posted for the community.*",
        ].join("\n")
        : [
            "**Poll Closed**",
            "*This poll is no longer accepting votes.*",
            "*The final results above reflect the last recorded vote totals.*",
        ].join("\n")))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
        .addActionRowComponents(voteRow)
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent("-# Miami Roleplay © 2026 | Poll Operations"));
    return { components: [container], flags: discord_js_1.MessageFlags.IsComponentsV2 };
}
function getActiveGiveaway(channelId) {
    const messageId = activeGiveawayByChannel.get(channelId);
    return messageId ? { messageId, state: giveaways.get(messageId) ?? null } : null;
}
function getActivePoll(channelId) {
    const messageId = activePollByChannel.get(channelId);
    return messageId ? { messageId, state: polls.get(messageId) ?? null } : null;
}
function chooseRandomWinner(entryIds, excludeId) {
    const eligible = entryIds.filter((id) => id !== excludeId);
    if (eligible.length === 0) {
        return null;
    }
    return eligible[Math.floor(Math.random() * eligible.length)] ?? null;
}
async function handleCommunityCommand(interaction) {
    if (!interaction.inCachedGuild() || !interaction.channel || !(interaction.channel instanceof discord_js_1.TextChannel)) {
        return false;
    }
    if (interaction.commandName === "giveaway") {
        if (!canManageCommunity(interaction.member)) {
            await interaction.deferReply({ ephemeral: true }).catch(() => null);
            await interaction.deleteReply().catch(() => null);
            return true;
        }
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === "start") {
            const existing = getActiveGiveaway(interaction.channel.id);
            if (existing?.state && existing.state.status === "active") {
                await interaction.reply({
                    content: "There is already an active giveaway in this channel.",
                    ephemeral: true,
                });
                return true;
            }
            const prize = interaction.options.getString("prize", true).trim();
            await interaction.channel.send({
                content: rolePing(GIVEAWAY_PING_ROLE_ID),
                allowedMentions: roleAllowedMentions(GIVEAWAY_PING_ROLE_ID),
            });
            const message = await interaction.channel.send(buildGiveawayPanel({
                hostUserId: interaction.user.id,
                prize,
                entries: new Set(),
                channelId: interaction.channel.id,
                status: "active",
                winnerId: null,
                createdAt: Date.now(),
            }));
            giveaways.set(message.id, {
                hostUserId: interaction.user.id,
                prize,
                entries: new Set(),
                channelId: interaction.channel.id,
                status: "active",
                winnerId: null,
                createdAt: Date.now(),
            });
            activeGiveawayByChannel.set(interaction.channel.id, message.id);
            await interaction.reply({
                content: "Giveaway posted.",
                ephemeral: true,
            });
            return true;
        }
        if (subcommand === "end") {
            const current = getActiveGiveaway(interaction.channel.id);
            if (!current?.state) {
                await interaction.reply({
                    content: "There is no active giveaway in this channel.",
                    ephemeral: true,
                });
                return true;
            }
            current.state.status = "ended";
            current.state.winnerId = chooseRandomWinner(Array.from(current.state.entries));
            activeGiveawayByChannel.delete(interaction.channel.id);
            const giveawayMessage = await interaction.channel.messages.fetch(current.messageId).catch(() => null);
            if (giveawayMessage) {
                await giveawayMessage.edit(buildGiveawayPanel(current.state));
            }
            if (current.state.winnerId) {
                await interaction.channel.send(`Hello <@${current.state.winnerId}> you won our most recent giveaway. The prize is **${current.state.prize}**.`);
            }
            await interaction.reply({
                content: "Giveaway ended.",
                ephemeral: true,
            });
            return true;
        }
        if (subcommand === "reroll") {
            const excludeUser = interaction.options.getUser("exclude_user");
            const current = Array.from(giveaways.entries())
                .find(([, state]) => state.channelId === interaction.channel.id && state.status === "ended");
            if (!current) {
                await interaction.reply({
                    content: "There is no ended giveaway to reroll in this channel.",
                    ephemeral: true,
                });
                return true;
            }
            const [messageId, state] = current;
            state.winnerId = chooseRandomWinner(Array.from(state.entries), excludeUser?.id ?? null);
            const giveawayMessage = await interaction.channel.messages.fetch(messageId).catch(() => null);
            if (giveawayMessage) {
                await giveawayMessage.edit(buildGiveawayPanel(state));
            }
            await interaction.reply({
                content: state.winnerId
                    ? `New giveaway winner: <@${state.winnerId}>`
                    : "No eligible giveaway winner could be selected.",
                ephemeral: true,
            });
            return true;
        }
        return false;
    }
    if (interaction.commandName === "poll") {
        if (!canManageCommunity(interaction.member)) {
            await interaction.deferReply({ ephemeral: true }).catch(() => null);
            await interaction.deleteReply().catch(() => null);
            return true;
        }
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === "start") {
            const existing = getActivePoll(interaction.channel.id);
            if (existing?.state && existing.state.status === "active") {
                await interaction.reply({
                    content: "There is already an active poll in this channel.",
                    ephemeral: true,
                });
                return true;
            }
            const question = interaction.options.getString("question", true).trim();
            const description = interaction.options.getString("description", true).trim();
            await interaction.channel.send({
                content: rolePing(POLL_PING_ROLE_ID),
                allowedMentions: roleAllowedMentions(POLL_PING_ROLE_ID),
            });
            const message = await interaction.channel.send(buildPollPanel({
                hostUserId: interaction.user.id,
                question,
                description,
                channelId: interaction.channel.id,
                status: "active",
                votes: new Map(),
                createdAt: Date.now(),
            }));
            polls.set(message.id, {
                hostUserId: interaction.user.id,
                question,
                description,
                channelId: interaction.channel.id,
                status: "active",
                votes: new Map(),
                createdAt: Date.now(),
            });
            activePollByChannel.set(interaction.channel.id, message.id);
            await interaction.reply({
                content: "Poll posted.",
                ephemeral: true,
            });
            return true;
        }
        if (subcommand === "end") {
            const current = getActivePoll(interaction.channel.id);
            if (!current?.state) {
                await interaction.reply({
                    content: "There is no active poll in this channel.",
                    ephemeral: true,
                });
                return true;
            }
            current.state.status = "ended";
            activePollByChannel.delete(interaction.channel.id);
            const decision = interaction.options.getString("decision")?.trim() || null;
            const pollMessage = await interaction.channel.messages.fetch(current.messageId).catch(() => null);
            if (pollMessage) {
                await pollMessage.edit(buildPollPanel(current.state));
            }
            await interaction.channel.send({
                content: `${rolePing(POLL_PING_ROLE_ID)} the final decision has been made.${decision ? ` This was the decision: **${decision}**` : ""}`,
                allowedMentions: roleAllowedMentions(POLL_PING_ROLE_ID),
            });
            await interaction.reply({
                content: "Poll ended.",
                ephemeral: true,
            });
            return true;
        }
        return false;
    }
    return false;
}
async function handleCommunityButtonInteraction(interaction) {
    if (!interaction.inCachedGuild()) {
        return false;
    }
    if (interaction.customId === GIVEAWAY_ENTER_BUTTON_ID) {
        const state = giveaways.get(interaction.message.id);
        if (!state || state.status !== "active") {
            await interaction.reply({
                content: "This giveaway is no longer active.",
                ephemeral: true,
            });
            return true;
        }
        state.entries.add(interaction.user.id);
        await interaction.update(buildGiveawayPanel(state));
        await interaction.followUp({
            content: "You have been entered into the giveaway.",
            ephemeral: true,
        });
        return true;
    }
    const pollState = polls.get(interaction.message.id);
    if (!pollState || pollState.status !== "active") {
        return false;
    }
    let vote = null;
    if (interaction.customId === POLL_YES_BUTTON_ID)
        vote = "yes";
    if (interaction.customId === POLL_NO_BUTTON_ID)
        vote = "no";
    if (interaction.customId === POLL_UNSURE_BUTTON_ID)
        vote = "unsure";
    if (!vote) {
        return false;
    }
    pollState.votes.set(interaction.user.id, vote);
    await interaction.update(buildPollPanel(pollState));
    await interaction.followUp({
        content: `Your vote has been set to **${vote}**.`,
        ephemeral: true,
    });
    return true;
}
