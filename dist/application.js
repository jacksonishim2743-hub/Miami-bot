"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postApplicationPanelMessage = postApplicationPanelMessage;
const discord_js_1 = require("discord.js");
const APPLICATION_BANNER_FILENAME = "miami-application-banner.png";
const APPLICATION_BANNER_PATH = "assets/miami-application-banner.png";
const APPLICATION_LINK = "https://melonly.xyz/forms/7449857936102264832";
function buildApplicationPanel() {
    const applyButtonRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setLabel("Open Application")
        .setEmoji("📝")
        .setStyle(discord_js_1.ButtonStyle.Link)
        .setURL(APPLICATION_LINK));
    const container = new discord_js_1.ContainerBuilder()
        .addMediaGalleryComponents(new discord_js_1.MediaGalleryBuilder().addItems(new discord_js_1.MediaGalleryItemBuilder()
        .setURL(`attachment://${APPLICATION_BANNER_FILENAME}`)
        .setDescription("Miami Roleplay application banner")))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent([
        "## Miami Roleplay Applications",
        "",
        "*Ready to take the next step with Miami City Roleplay? Use the application board below to apply for the opportunities currently open through our community.*",
    ].join("\n")))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent([
        "**Before You Apply**",
        "• *Read every question carefully and answer with full detail.*",
        "• *Make sure your application reflects maturity, honesty, and effort.*",
        "• *Low-effort, joke, or copied responses may be denied without review.*",
        "• *Provide accurate contact and availability details when requested.*",
    ].join("\n")))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
        .addActionRowComponents(applyButtonRow)
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent([
        "**Application Rules**",
        "• *Only submit an application if you are genuinely interested in the position or opportunity listed.*",
        "• *Do not spam the form or submit duplicate applications for the same purpose unless staff tells you to retry.*",
        "• *Use respectful grammar and clear explanations so the reviewing team can evaluate your responses properly.*",
        "• *Do not provide false information, fake experience, or misleading claims inside your application.*",
        "• *Be patient after applying, as review times can vary depending on staff availability and application volume.*",
        "• *If accepted, be prepared to follow all Miami Roleplay rules, expectations, and training standards.*",
    ].join("\n")), new discord_js_1.TextDisplayBuilder().setContent("-# Miami Roleplay © 2026 | Application Operations"));
    return {
        components: [container],
        files: [new discord_js_1.AttachmentBuilder(APPLICATION_BANNER_PATH, { name: APPLICATION_BANNER_FILENAME })],
        flags: discord_js_1.MessageFlags.IsComponentsV2,
    };
}
async function postApplicationPanelMessage(channel) {
    await channel.send(buildApplicationPanel());
}
