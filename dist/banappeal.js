"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postIngameBanAppealPanelMessage = postIngameBanAppealPanelMessage;
const discord_js_1 = require("discord.js");
const BAN_APPEAL_BANNER_FILENAME = "miami-ingame-ban-appeal-banner.png";
const BAN_APPEAL_BANNER_PATH = "assets/miami-ingame-appeals-banner.png";
const BAN_APPEAL_LINK = "https://melon.ly/form/7464812249232707584";
function buildIngameBanAppealPanel() {
    const appealButtonRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder()
        .setLabel("Open Ban Appeal")
        .setEmoji("📄")
        .setStyle(discord_js_1.ButtonStyle.Link)
        .setURL(BAN_APPEAL_LINK));
    const container = new discord_js_1.ContainerBuilder()
        .addMediaGalleryComponents(new discord_js_1.MediaGalleryBuilder().addItems(new discord_js_1.MediaGalleryItemBuilder()
        .setURL(`attachment://${BAN_APPEAL_BANNER_FILENAME}`)
        .setDescription("Miami Roleplay in-game ban appeal banner")))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent([
        "## Miami Roleplay In-Game Ban Appeals",
        "",
        "*If you were removed from the game and believe the punishment should be reviewed, use the official appeal board below. This form is for in-game bans only and should be completed with honesty, detail, and respect.*",
    ].join("\n")))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent([
        "**What This Appeal Is For**",
        "• *Use this panel if you were banned in-game and want the Miami Roleplay team to review the decision.*",
        "• *Appeals are reviewed to confirm whether the punishment was correctly issued, whether context was missed, or whether the player has shown enough accountability to be considered for another opportunity.*",
        "• *Submitting an appeal does not guarantee unban access. It only guarantees that your case may be reviewed if the form is completed properly.*",
        "• *If your appeal is denied, repeated submissions without new information may be closed without another review.*",
    ].join("\n")))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
        .addActionRowComponents(appealButtonRow)
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent([
        "**Before You Submit**",
        "• *Be ready to provide your Roblox username, ban reason, and any useful context surrounding the incident.*",
        "• *Explain clearly what happened from your side without turning the appeal into an argument with staff.*",
        "• *If you made a mistake, own it directly. Honest accountability is taken far more seriously than excuses or blame shifting.*",
        "• *If you have screenshots, clips, or proof that supports your appeal, mention that in the form so the review team understands the full situation.*",
        "• *Keep your answers mature, readable, and respectful from beginning to end.*",
    ].join("\n")))
        .addSeparatorComponents(new discord_js_1.SeparatorBuilder())
        .addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent([
        "**Appeal Rules**",
        "• *Do not submit joke appeals, troll responses, copied responses, or low-effort one-line answers.*",
        "• *Do not lie, fake evidence, or hide important parts of the situation. Misleading staff during an appeal can lead to the appeal being denied immediately.*",
        "• *Do not spam multiple appeals for the same ban unless staff has told you to resubmit or update your response.*",
        "• *Do not attack, insult, or threaten staff members inside your appeal. Appeals must stay respectful even if you disagree with the punishment.*",
        "• *Do not ask friends or community members to pressure staff about your appeal. Appeals are reviewed by the proper team when available.*",
        "• *If you were banned for severe behavior, exploit use, repeated misconduct, or clear bad faith, your appeal may be denied even if it is submitted correctly.*",
    ].join("\n")), new discord_js_1.TextDisplayBuilder().setContent([
        "**Review Expectations**",
        "• *Appeal response times can vary depending on staff availability, evidence review, and current workload.*",
        "• *Submitting a clean, detailed, respectful form gives your appeal the best chance of being reviewed properly.*",
        "• *Final decisions are made by the Miami Roleplay team after reviewing the full context of the case.*",
        "",
        "-# Miami Roleplay © 2026 | In-Game Ban Appeals",
    ].join("\n")));
    return {
        components: [container],
        files: [new discord_js_1.AttachmentBuilder(BAN_APPEAL_BANNER_PATH, { name: BAN_APPEAL_BANNER_FILENAME })],
        flags: discord_js_1.MessageFlags.IsComponentsV2,
    };
}
async function postIngameBanAppealPanelMessage(channel) {
    await channel.send(buildIngameBanAppealPanel());
}
