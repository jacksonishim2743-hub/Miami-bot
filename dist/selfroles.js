"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postSelfRolePanelMessage = postSelfRolePanelMessage;
exports.handleSelfRoleButtonInteraction = handleSelfRoleButtonInteraction;
const discord_js_1 = require("discord.js");
const SELF_ROLE_BUTTON_PREFIX = "selfrole:";
const SELF_ROLE_BANNER_FILENAME = "miami-self-roles-banner.png";
const SELF_ROLE_BANNER_PATH = "assets/miami-self-roles-banner.png";
const selfRoleDefinitions = [
    { key: "reaction_roles", label: "Reaction Roles", roleName: "ㅤㅤㅤㅤㅤ→ Reaction Roles ←ㅤㅤㅤㅤㅤ", roleId: null, emoji: "🎭" },
    { key: "announcements", label: "Announcements", roleName: "Announcements", roleId: "1494862099862519920", emoji: "📢" },
    { key: "official_media", label: "Official Media", roleName: "Official Media", roleId: "1494862150219595917", emoji: "📸" },
    { key: "partnerships", label: "Partnerships", roleName: "Partnerships", roleId: "1494862212307877888", emoji: "🤝" },
    { key: "giveaways", label: "Giveaways", roleName: "Giveaways", roleId: "1494862255958003743", emoji: "🎉" },
    { key: "events", label: "Events", roleName: "Events", roleId: "1494862535407702137", emoji: "🎟️" },
    { key: "botchanglog", label: "Botchanglog", roleName: "Botchangelog", roleId: "1496364269606797392", emoji: "🤖" },
    { key: "polls", label: "Polls", roleName: "Poll", roleId: "1496364269606797392", emoji: "📊" },
    { key: "server_updates", label: "Server Updates", roleName: "Server Updates", roleId: "1494862566675976202", emoji: "🛠️" },
];
function buildSelfRoleRows() {
    const rows = [];
    for (let index = 0; index < selfRoleDefinitions.length; index += 3) {
        const slice = selfRoleDefinitions.slice(index, index + 3);
        rows.push(new discord_js_1.ActionRowBuilder().addComponents(...slice.map((role) => new discord_js_1.ButtonBuilder()
            .setCustomId(`${SELF_ROLE_BUTTON_PREFIX}${role.key}`)
            .setLabel(role.label)
            .setEmoji(role.emoji)
            .setStyle(discord_js_1.ButtonStyle.Secondary))));
    }
    return rows;
}
function buildSelfRolePanel() {
    const container = new discord_js_1.ContainerBuilder()
        .addMediaGalleryComponents(new discord_js_1.MediaGalleryBuilder().addItems(new discord_js_1.MediaGalleryItemBuilder()
        .setURL(`attachment://${SELF_ROLE_BANNER_FILENAME}`)
        .setDescription("Miami Roleplay self roles banner")))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent([
        "## Miami Role Notifications",
        "",
        "*Use the buttons below to manage the server update roles you want to receive.*",
    ].join("\n")))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent([
        "**How It Works**",
        "• *Press a button once to add the role to yourself.*",
        "• *Press the same button again to remove the role.*",
        "• *Only the matching notification role will be changed each time you press a button.*",
    ].join("\n")))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
        .addActionRowComponents(...buildSelfRoleRows())
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent("-# Miami Roleplay © 2026 | Self Roles"));
    return {
        components: [container],
        files: [new discord_js_1.AttachmentBuilder(SELF_ROLE_BANNER_PATH, { name: SELF_ROLE_BANNER_FILENAME })],
        flags: discord_js_1.MessageFlags.IsComponentsV2,
    };
}
function findSelfRole(key) {
    return selfRoleDefinitions.find((role) => role.key === key) ?? null;
}
async function postSelfRolePanelMessage(channel) {
    await channel.send(buildSelfRolePanel());
}
async function handleSelfRoleButtonInteraction(interaction) {
    if (!interaction.inCachedGuild() || !interaction.customId.startsWith(SELF_ROLE_BUTTON_PREFIX)) {
        return false;
    }
    const key = interaction.customId.slice(SELF_ROLE_BUTTON_PREFIX.length);
    const selfRole = findSelfRole(key);
    if (!selfRole) {
        await interaction.reply({
            content: "That self role could not be found.",
            ephemeral: true,
        });
        return true;
    }
    const guildRole = selfRole.roleId
        ? interaction.guild.roles.cache.get(selfRole.roleId)
        : interaction.guild.roles.cache.find((role) => role.name === selfRole.roleName);
    if (!guildRole) {
        await interaction.reply({
            content: `The role **${selfRole.roleName}** does not exist in this server yet.`,
            ephemeral: true,
        });
        return true;
    }
    const memberRoles = interaction.member.roles;
    const hasRole = memberRoles.cache.has(guildRole.id);
    if (hasRole) {
        await memberRoles.remove(guildRole);
        await interaction.reply({
            content: `Removed **${selfRole.label}** from your roles.`,
            ephemeral: true,
        });
        return true;
    }
    await memberRoles.add(guildRole);
    await interaction.reply({
        content: `Added **${selfRole.label}** to your roles.`,
        ephemeral: true,
    });
    return true;
}
