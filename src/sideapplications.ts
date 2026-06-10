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

const SIDE_APPLICATIONS_BANNER_FILENAME = "miami-side-applications-banner.png";
const SIDE_APPLICATIONS_BANNER_PATH = "assets/miami-side-applications-banner.png";
const SIDE_APPLICATIONS_SELECT_ID = "side-applications:type";

type SideApplicationType = "fishing_license" | "gun_permit" | "food_vendor_permit";

const sideApplicationMeta: Record<
  SideApplicationType,
  {
    label: string;
    emoji: string;
    url: string;
    overview: string;
    qualifications: string[];
    expectations: string[];
    reminders: string[];
  }
> = {
  fishing_license: {
    label: "Fishing License",
    emoji: "🎣",
    url: "https://melon.ly/form/7464818954691678208",
    overview:
      "*The fishing license application is for players who want legal access to fishing-related activity under Miami Roleplay expectations. This helps keep civilian roleplay cleaner, more structured, and easier for staff to review when questions come up in-game.*",
    qualifications: [
      "• *Applicants should understand that a fishing license is still a tracked privilege and may be removed if abused during roleplay.*",
      "• *Your responses should show that you understand how to use the permit responsibly rather than treat it like a shortcut around server rules.*",
      "• *If your account or in-game history already shows repeated trolling, unrealistic behavior, or poor roleplay standards, approval may be denied.*",
      "• *You should only apply if you genuinely plan to use the license in active roleplay and can follow all staff expectations tied to it.*",
    ],
    expectations: [
      "• *Use the permit only in ways that fit realistic civilian roleplay and the standards of the current server session.*",
      "• *Keep all information honest, especially your Roblox identity and anything asked about your purpose for applying.*",
      "• *Do not pressure staff for faster results after submitting. Reviews can take time depending on queue volume and staff coverage.*",
      "• *A fishing license can be revoked if it is used to troll, farm attention, evade discipline, or push unrealistic scenes.*",
    ],
    reminders: [
      "• *Submitting the form does not guarantee approval.*",
      "• *Low-effort answers may be denied without follow-up.*",
      "• *Keep your application respectful, clear, and realistic from start to finish.*",
    ],
  },
  gun_permit: {
    label: "Gun Permit",
    emoji: "🔫",
    url: "https://melonly.xyz/forms/7464814080478416896",
    overview:
      "*The gun permit application is for players requesting lawful weapon access under Miami Roleplay policy. Because this can directly affect scene quality, staff response, and realism, permit reviews are expected to be taken seriously.*",
    qualifications: [
      "• *Applicants should have a mature understanding of how weapon-related roleplay is handled and how quickly it can become unrealistic when abused.*",
      "• *You should be prepared to show that you can use a permit responsibly without turning normal scenes into unnecessary escalation.*",
      "• *A clean behavioral record, respectful conduct, and realistic civilian roleplay history will always help your review.*",
      "• *Applications may be denied if your recent activity shows poor judgment, baiting, unsafe scene creation, or repeated moderation issues.*",
    ],
    expectations: [
      "• *A gun permit is a roleplay responsibility, not a free pass to create conflict whenever you want.*",
      "• *Any approved permit holder is expected to follow all current Miami weapon guidelines, scene expectations, and staff instructions.*",
      "• *False information, misleading answers, or attempts to hide your intent can lead to denial or future removal.*",
      "• *If a permit is abused, it may be revoked and may affect future application reviews.*",
    ],
    reminders: [
      "• *Use full, honest explanations in your application.*",
      "• *Do not apply unless you actually understand the seriousness of the permit.*",
      "• *Approval is based on trust, realism, and overall fit with Miami standards.*",
    ],
  },
  food_vendor_permit: {
    label: "Food Vendor Permit",
    emoji: "🌭",
    url: "https://melon.ly/form/7464818054577262592",
    overview:
      "*The food vendor permit application is for players who want to operate food-based civilian roleplay in a recognized, organized way. This can include stands, vendor scenes, event-based sales, or other approved business-style interactions.*",
    qualifications: [
      "• *Applicants should understand how to keep vendor roleplay realistic, orderly, and appropriate for the server environment.*",
      "• *You should show enough effort in your application to prove that the permit would be used for actual scene-building, not random clutter or spam roleplay.*",
      "• *Good civilian creativity, patience, and realistic execution matter more than making the scene flashy for attention.*",
      "• *Applications may be denied if the request looks unserious, disruptive, or inconsistent with normal Miami standards.*",
    ],
    expectations: [
      "• *Vendor scenes should add to the roleplay environment instead of creating clutter, confusion, or unrealistic spam activity.*",
      "• *Permit holders are expected to cooperate with staff directions, event instructions, and any scene limitations set during active sessions.*",
      "• *Do not use a vendor permit to argue with staff, force public scenes, or sidestep other business or roleplay rules.*",
      "• *If the permit is misused, it may be removed and future approvals may become harder to obtain.*",
    ],
    reminders: [
      "• *Give detailed answers and explain your intended use clearly.*",
      "• *Respectful and creative applications stand out the most.*",
      "• *This permit exists to improve roleplay quality, not lower it.*",
    ],
  },
};

function buildSideApplicationsSelectRow() {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(SIDE_APPLICATIONS_SELECT_ID)
      .setPlaceholder("Choose a permit or license")
      .addOptions(
        {
          label: sideApplicationMeta.fishing_license.label,
          value: "fishing_license",
          emoji: sideApplicationMeta.fishing_license.emoji,
        },
        {
          label: sideApplicationMeta.gun_permit.label,
          value: "gun_permit",
          emoji: sideApplicationMeta.gun_permit.emoji,
        },
        {
          label: sideApplicationMeta.food_vendor_permit.label,
          value: "food_vendor_permit",
          emoji: sideApplicationMeta.food_vendor_permit.emoji,
        },
      ),
  );
}

function buildSideApplicationsPanel() {
  const container = new ContainerBuilder()
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder()
          .setURL(`attachment://${SIDE_APPLICATIONS_BANNER_FILENAME}`)
          .setDescription("Miami Roleplay side applications banner"),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "## Miami Roleplay Side Applications",
          "",
          "*This board is for side permits and license-style applications that support civilian realism, structured roleplay, and approved specialty access inside Miami City Roleplay.*",
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "**What These Applications Are For**",
          "• *These forms are used when a player wants approval for a specific type of regulated in-game activity rather than a main staff or department application.*",
          "• *Each side application is reviewed with the goal of protecting realism, preventing abuse, and making sure permit holders actually improve the server environment.*",
          "• *Approval depends on effort, maturity, honesty, and whether the requested permit makes sense for your roleplay style and server history.*",
          "• *These permits and licenses are privileges. They can be denied, limited, or removed if they are misused or if staff no longer feel they are being handled responsibly.*",
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addActionRowComponents(buildSideApplicationsSelectRow())
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "**Available Side Applications**",
          `• [Fishing License](${sideApplicationMeta.fishing_license.url})`,
          `• [Gun Permit](${sideApplicationMeta.gun_permit.url})`,
          `• [Food Vendor Permit](${sideApplicationMeta.food_vendor_permit.url})`,
        ].join("\n"),
      ),
      new TextDisplayBuilder().setContent(
        [
          "**General Rules**",
          "• *Only apply for permits or licenses you genuinely plan to use properly in roleplay.*",
          "• *Do not submit troll, duplicate, rushed, or low-effort applications.*",
          "• *All information should be truthful, readable, and respectful.*",
          "• *Staff may deny, close, or ignore applications that are misleading, unrealistic, or clearly not serious.*",
          "• *If a permit is approved, you are still expected to follow all Miami rules, active session limits, and staff instructions at all times.*",
          "",
          "-# Miami Roleplay © 2026 | Side Applications",
        ].join("\n"),
      ),
    );

  return {
    components: [container],
    files: [new AttachmentBuilder(SIDE_APPLICATIONS_BANNER_PATH, { name: SIDE_APPLICATIONS_BANNER_FILENAME })],
    flags: MessageFlags.IsComponentsV2,
  };
}

function buildSideApplicationDetailPanel(type: SideApplicationType) {
  const meta = sideApplicationMeta[type];

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `## ${meta.label}`,
          "",
          meta.overview,
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "**Application Link**",
          `• [${meta.label}](${meta.url})`,
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        ["**Who This Is Best For**", ...meta.qualifications].join("\n"),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        ["**Permit Expectations**", ...meta.expectations].join("\n"),
      ),
      new TextDisplayBuilder().setContent(
        [
          "**Final Reminders**",
          ...meta.reminders,
          "",
          "-# Miami Roleplay © 2026 | Side Applications",
        ].join("\n"),
      ),
    );

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
}

export async function postSideApplicationsPanelMessage(channel: TextChannel): Promise<void> {
  await channel.send(buildSideApplicationsPanel());
}

export async function handleSideApplicationsSelectInteraction(
  interaction: StringSelectMenuInteraction,
): Promise<boolean> {
  if (!interaction.inCachedGuild() || interaction.customId !== SIDE_APPLICATIONS_SELECT_ID) {
    return false;
  }

  const type = interaction.values[0] as SideApplicationType;
  await interaction.reply({
    ...buildSideApplicationDetailPanel(type),
    ephemeral: true,
  });
  return true;
}
