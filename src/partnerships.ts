import {
  ActionRowBuilder,
  AttachmentBuilder,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SeparatorBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextChannel,
  TextDisplayBuilder,
} from "discord.js";

const PARTNERSHIPS_BANNER_FILENAME = "miami-partnerships-banner.png";
const PARTNERSHIPS_BANNER_PATH = "assets/miami-partnerships-banner.png";
const PARTNERSHIPS_SELECT_ID = "partnerships:type";

type PartnershipTier = "small" | "medium" | "large";

const tierLabels: Record<PartnershipTier, string> = {
  small: "Small Partnerships",
  medium: "Medium Partnerships",
  large: "Large Partnerships",
};

function buildPartnershipSelectRow() {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(PARTNERSHIPS_SELECT_ID)
      .setPlaceholder("Choose a partnership type")
      .addOptions(
        {
          label: "Small Partnerships",
          value: "small",
          emoji: "🌱",
        },
        {
          label: "Medium Partnerships",
          value: "medium",
          emoji: "📈",
        },
        {
          label: "Large Partnerships",
          value: "large",
          emoji: "🏆",
        },
      ),
  );
}

function buildPartnershipsPanel() {
  const container = new ContainerBuilder()
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder()
          .setURL(`attachment://${PARTNERSHIPS_BANNER_FILENAME}`)
          .setDescription("Miami Roleplay partnerships banner"),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "## Miami Roleplay Partnership Rules",
          "",
          "*Our partnership board is designed for servers, communities, and organizations that want a real, long-term relationship with Miami City Roleplay rather than a quick advertisement exchange.*",
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "**What We Expect From All Partners**",
          "• *Every partner must represent a respectful, active, and safe community with real ownership involvement and a stable server structure.*",
          "• *Your server should have a clean presentation, organized channels, visible rules, and an audience that aligns with roleplay, community growth, or shared interest spaces.*",
          "• *Miami Roleplay does not accept partnerships built on drama, mass advertising, low-effort server creation, botted growth, fake activity, or misleading member counts.*",
          "• *Partnerships are meant to support both communities long term, which means both sides should maintain professionalism and basic mutual respect after approval.*",
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addActionRowComponents(buildPartnershipSelectRow())
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "**General Partnership Rules**",
          "• *Servers applying must be fully set up before requesting review, including branding, moderation coverage, and a community that is already functioning.*",
          "• *Ownership or leadership should be reachable and responsive if our team has follow-up questions during the review process.*",
          "• *Partnership requests can be denied if the server appears inactive, unsafe, copied, abandoned, or heavily dependent on constant ad dumping for survival.*",
          "• *Acceptance is not permanent. Partnerships can be removed if the partner server becomes inactive, unprofessional, harmful to members, or stops meeting Miami standards.*",
          "• *Cross-promotion should stay respectful. We do not support spam pings, forced posting schedules, or misleading announcements made in Miami’s name.*",
          "• *If your server changes ownership, changes theme, or takes a major direction shift, you may be asked to undergo a new review.*",
        ].join("\n"),
      ),
      new TextDisplayBuilder().setContent(
        [
          "**Before You Select A Tier**",
          "*Choose the partnership size below to view the rules, expectations, and review notes for that exact category.*",
          "*Each tier has different scale expectations, and approval depends on both quality and long-term fit with Miami Roleplay.*",
          "",
          "-# Miami Roleplay © 2026 | Partnerships",
        ].join("\n"),
      ),
    );

  return {
    components: [container],
    files: [new AttachmentBuilder(PARTNERSHIPS_BANNER_PATH, { name: PARTNERSHIPS_BANNER_FILENAME })],
    flags: MessageFlags.IsComponentsV2,
  };
}

function buildTierPanel(tier: PartnershipTier) {
  const header = (() => {
    switch (tier) {
      case "small":
        return [
          `## ${tierLabels[tier]}`,
          "",
          "*Small partnerships are for communities with **500 members and below** that still show real effort, strong leadership involvement, and room for future growth.*",
        ];
      case "medium":
        return [
          `## ${tierLabels[tier]}`,
          "",
          "*Medium partnerships are for communities with **7,000 members and below** that have a more developed structure, established activity, and a stable long-term direction.*",
        ];
      case "large":
        return [
          `## ${tierLabels[tier]}`,
          "",
          "*Large partnerships are for communities with **40,000 members and below** that bring major reach, stronger presentation standards, and a proven community identity.*",
        ];
    }
  })();

  const requirements = (() => {
    switch (tier) {
      case "small":
        return [
          "**Small Partnership Standards**",
          "• *Your server should already be active for its size and not feel empty, abandoned, or freshly assembled just to request promotion.*",
          "• *We look for clear ownership effort, clean formatting, respectful member culture, and genuine signs that the community is being built with care.*",
          "• *A smaller member count is completely fine, but the server should still feel alive, presentable, and worth introducing to Miami members.*",
          "• *Partnership approval at this tier depends heavily on quality over size, which means branding, trust, and consistency matter more than pure numbers.*",
        ];
      case "medium":
        return [
          "**Medium Partnership Standards**",
          "• *Your server should have visible structure, stronger moderation coverage, real community movement, and an audience that is not built through obvious inflation.*",
          "• *We expect medium communities to show consistency in announcements, branding, server upkeep, and leadership communication.*",
          "• *Miami looks for balance here: a respectable member base, decent engagement, and a server environment that feels established rather than experimental.*",
          "• *Your community should be able to maintain a partnership properly, respond to concerns, and continue representing itself professionally after approval.*",
        ];
      case "large":
        return [
          "**Large Partnership Standards**",
          "• *Large communities are held to a higher expectation because they bring broader visibility and a stronger direct reflection on Miami when partnered publicly.*",
          "• *Your server should have high presentation quality, active oversight, stable moderation, and a well-defined identity that is easy to verify on review.*",
          "• *We expect real activity, not inflated counts, and we will prioritize communities that clearly show trustworthiness, maturity, and long-term stability.*",
          "• *A large partnership should feel mutually beneficial, organized, and professionally managed from both the public-facing side and leadership side.*",
        ];
    }
  })();

  const reviewInfo = (() => {
    switch (tier) {
      case "small":
        return [
          "**Review Notes**",
          "• *Small partners are often reviewed more personally because Miami wants to support promising communities that still take quality seriously.*",
          "• *If your server is newer, include the strongest details you can about activity, goals, and why a partnership would help both sides grow in the right way.*",
          "• *Low-effort or copy-paste requests are likely to be denied quickly at this tier.*",
        ];
      case "medium":
        return [
          "**Review Notes**",
          "• *Medium partnership reviews focus on consistency, professionalism, and whether the community is genuinely sustainable.*",
          "• *Servers at this level should already understand how to maintain partner relations and not rely on constant outreach for basic activity.*",
          "• *General quality, leadership response time, and server presentation all play a major role in approval.*",
        ];
      case "large":
        return [
          "**Review Notes**",
          "• *Large partnership reviews are more selective because approval creates stronger public association between both communities.*",
          "• *We may look more closely at leadership presence, moderation quality, brand safety, and whether the partner server fits Miami’s image and standards.*",
          "• *A large community can still be denied if the structure, professionalism, or trust signals do not meet expectations.*",
        ];
    }
  })();

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(header.join("\n")),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(requirements.join("\n")),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(reviewInfo.join("\n")),
      new TextDisplayBuilder().setContent(
        [
          "**Final Reminder**",
          "*A partnership is not guaranteed just because a server fits the size range. Miami Roleplay still reviews overall quality, trust, stability, and long-term fit before approval.*",
          "",
          "-# Miami Roleplay © 2026 | Partnerships",
        ].join("\n"),
      ),
    );

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
}

export async function postPartnershipsPanelMessage(channel: TextChannel): Promise<void> {
  await channel.send(buildPartnershipsPanel());
}

export async function handlePartnershipsSelectInteraction(
  interaction: StringSelectMenuInteraction,
): Promise<boolean> {
  if (!interaction.inCachedGuild() || interaction.customId !== PARTNERSHIPS_SELECT_ID) {
    return false;
  }

  const tier = interaction.values[0] as PartnershipTier;
  await interaction.reply({
    ...buildTierPanel(tier),
    ephemeral: true,
  });
  return true;
}
