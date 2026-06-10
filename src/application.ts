import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SeparatorBuilder,
  TextChannel,
  TextDisplayBuilder,
} from "discord.js";

const APPLICATION_BANNER_FILENAME = "miami-application-banner.png";
const APPLICATION_BANNER_PATH = "assets/miami-application-banner.png";
const APPLICATION_LINK = "https://melonly.xyz/forms/7449857936102264832";

function buildApplicationPanel() {
  const applyButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("Open Application")
      .setEmoji("📝")
      .setStyle(ButtonStyle.Link)
      .setURL(APPLICATION_LINK),
  );

  const container = new ContainerBuilder()
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder()
          .setURL(`attachment://${APPLICATION_BANNER_FILENAME}`)
          .setDescription("Miami Roleplay application banner"),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "## Miami Roleplay Applications",
          "",
          "*Ready to take the next step with Miami City Roleplay? Use the application board below to apply for the opportunities currently open through our community.*",
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "**Before You Apply**",
          "• *Read every question carefully and answer with full detail.*",
          "• *Make sure your application reflects maturity, honesty, and effort.*",
          "• *Low-effort, joke, or copied responses may be denied without review.*",
          "• *Provide accurate contact and availability details when requested.*",
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addActionRowComponents(applyButtonRow)
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "**Application Rules**",
          "• *Only submit an application if you are genuinely interested in the position or opportunity listed.*",
          "• *Do not spam the form or submit duplicate applications for the same purpose unless staff tells you to retry.*",
          "• *Use respectful grammar and clear explanations so the reviewing team can evaluate your responses properly.*",
          "• *Do not provide false information, fake experience, or misleading claims inside your application.*",
          "• *Be patient after applying, as review times can vary depending on staff availability and application volume.*",
          "• *If accepted, be prepared to follow all Miami Roleplay rules, expectations, and training standards.*",
        ].join("\n"),
      ),
      new TextDisplayBuilder().setContent(
        "-# Miami Roleplay © 2026 | Application Operations",
      ),
    );

  return {
    components: [container],
    files: [new AttachmentBuilder(APPLICATION_BANNER_PATH, { name: APPLICATION_BANNER_FILENAME })],
    flags: MessageFlags.IsComponentsV2,
  };
}

export async function postApplicationPanelMessage(channel: TextChannel): Promise<void> {
  await channel.send(buildApplicationPanel());
}
