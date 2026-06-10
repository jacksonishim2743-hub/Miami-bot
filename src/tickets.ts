import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  GuildMember,
  GuildTextBasedChannel,
  MessageFlags,
  Message,
  ModalBuilder,
  ModalSubmitInteraction,
  OverwriteType,
  PermissionFlagsBits,
  ContainerBuilder,
  SeparatorBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextChannel,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { buildTrackedReasonField, finalizeTrackedReason } from "./reasontracker.js";

const OPEN_TICKET_BUTTON_ID = "ticket:open";
const TICKET_PANEL_BANNER_FILENAME = "miami-ticket-support-banner.png";
const TICKET_PANEL_BANNER_PATH = "assets/miami-support-banner.png";
const TICKET_TOPIC_SELECT_ID = "ticket:topic";
const TICKET_PRODUCTION_SELECT_ID = "ticket:production";
const TICKET_MODAL_PREFIX = "ticket:modal:";
const TICKET_PREFIX = "ticket-";
const TICKET_LOG_CHANNEL_ID = "1495183869165572277";
const TICKET_TRANSCRIPT_LOG_CHANNEL_ID = "1495183925956448510";
const GENERAL_SUPPORT_TICKET_TRANSCRIPT_LOG_CHANNEL_ID = "1495184168361918624";
const TICKET_RETURN_CHANNEL_ID = "1491988513753923665";
const FOUNDERSHIP_ROLE_ID = "1490006597328699522";
const CLOSE_REASON_TIMEOUT_MS = 60_000;
const CLOSE_COUNTDOWN_INTERVAL_MS = 1_000;
const pendingTicketClosures = new Map<string, boolean>();
const closeRequestStates = new Map<
  string,
  {
    requesterId: string;
    ownerId: string;
    reason: string;
  }
>();

type TicketKey =
  | "general_support"
  | "partnerships"
  | "department_reports"
  | "department_assistance"
  | "internal_affairs_support"
  | "server_bugs"
  | "ingame_exploit_reports"
  | "server_blacklist"
  | "sponsership"
  | "media_and_content_help"
  | "tech_support"
  | "ownership_support"
  | "production_support"
  | "livery_design"
  | "uniform_design"
  | "els_design"
  | "logo_design"
  | "accessories";

type TicketMeta = {
  ownerId: string;
  ticketType: TicketKey;
  answers: string[];
};

const mainTicketOptions: Array<{ label: string; value: TicketKey | "productions"; emoji: { id: string } }> = [
  { label: "General Support", value: "general_support", emoji: { id: "1513613583509094609" } },
  { label: "Partnerships", value: "partnerships", emoji: { id: "1513615633055744130" } },
  { label: "Department Reports", value: "department_reports", emoji: { id: "1513613948438446091" } },
  { label: "Department Assistance", value: "department_assistance", emoji: { id: "1513613910496907459" } },
  { label: "Internal Affairs Support", value: "internal_affairs_support", emoji: { id: "1513613869715558601" } },
  { label: "Server Bugs", value: "server_bugs", emoji: { id: "1513614764855660624" } },
  { label: "Ingame Exploit Reports", value: "ingame_exploit_reports", emoji: { id: "1513614819465629696" } },
  { label: "Server Blacklist", value: "server_blacklist", emoji: { id: "1513615300019486811" } },
  { label: "Sponsership", value: "sponsership", emoji: { id: "1513615704077893852" } },
  { label: "Productions", value: "productions", emoji: { id: "1513615507230691489" } },
  { label: "Media and Content Help", value: "media_and_content_help", emoji: { id: "1513615447122116699" } },
  { label: "INT Support", value: "tech_support", emoji: { id: "1513613826388656218" } },
  { label: "Foundership Support", value: "ownership_support", emoji: { id: "1513613627410612414" } },
];

const productionTicketOptions: Array<{ label: string; value: TicketKey; emoji: string }> = [
  { label: "Production Support", value: "production_support", emoji: "🩷" },
  { label: "Livery Design", value: "livery_design", emoji: "🚓" },
  { label: "Uniform Design", value: "uniform_design", emoji: "👕" },
  { label: "ELS Design", value: "els_design", emoji: "💡" },
  { label: "Logo Design", value: "logo_design", emoji: "🪪" },
  { label: "Accessories", value: "accessories", emoji: "🧰" },
];

const ticketLabels: Record<TicketKey, string> = {
  general_support: "General Support",
  partnerships: "Partnerships",
  department_reports: "Department Reports",
  department_assistance: "Department Assistance",
  internal_affairs_support: "Internal Affairs Support",
  server_bugs: "Server Bugs",
  ingame_exploit_reports: "Ingame Exploit Reports",
  server_blacklist: "Server Blacklist",
  sponsership: "Sponsership",
  media_and_content_help: "Media and Content Help",
  tech_support: "INT Support",
  ownership_support: "Foundership Support",
  production_support: "Production Support",
  livery_design: "Livery Design",
  uniform_design: "Uniform Design",
  els_design: "ELS Design",
  logo_design: "Logo Design",
  accessories: "Accessories",
};

const ticketQuestions: Record<TicketKey, [string, string, string]> = {
  general_support: [
    "What do you need help with?",
    "What happened?",
    "What outcome are you looking for?",
  ],
  partnerships: [
    "What is your server name?",
    "What kind of partnership are you seeking?",
    "Why should we partner with you?",
  ],
  department_reports: [
    "Who or what are you reporting?",
    "What happened in detail?",
    "Do you have proof or context to provide?",
  ],
  department_assistance: [
    "Which department do you need help with?",
    "What do you need access or help for?",
    "What result are you trying to achieve?",
  ],
  internal_affairs_support: [
    "Who is involved?",
    "What concern are you bringing forward?",
    "What proof or supporting details do you have?",
  ],
  server_bugs: [
    "What bug did you find?",
    "How can the bug be reproduced?",
    "What happened when you tested it?",
  ],
  ingame_exploit_reports: [
    "Who used the exploit?",
    "What exploit or abuse happened?",
    "What evidence do you have?",
  ],
  server_blacklist: [
    "Who or what is being blacklisted?",
    "Why should this blacklist be considered?",
    "What proof or history supports this request?",
  ],
  sponsership: [
    "What sponsorship are you requesting?",
    "What are you offering or looking for in return?",
    "Why is this sponsorship a good fit for Miami Roleplay?",
  ],
  media_and_content_help: [
    "What media/content do you need help with?",
    "What is the goal of the request?",
    "When do you need it by?",
  ],
  tech_support: [
    "What INT issue are you having?",
    "When did it start?",
    "What have you already tried so far?",
  ],
  ownership_support: [
    "What are you escalating?",
    "Why does this need foundership review?",
    "What final result are you seeking?",
  ],
  production_support: [
    "What production support do you need?",
    "What is the project about?",
    "When do you need it completed?",
  ],
  livery_design: [
    "What livery do you need?",
    "What references should be used?",
    "When do you need it by?",
  ],
  uniform_design: [
    "What uniform do you need?",
    "What style should be followed?",
    "When do you need it by?",
  ],
  els_design: [
    "What ELS setup do you need?",
    "What vehicle or pack is this for?",
    "What lighting style are you aiming for?",
  ],
  logo_design: [
    "What logo do you need?",
    "What wording or branding should be included?",
    "When do you need it by?",
  ],
  accessories: [
    "What accessory do you need made?",
    "What references should be followed?",
    "When do you need it by?",
  ],
};

const ticketTypeCategories: Partial<Record<TicketKey, string>> = {
  general_support: "1491990121938157588",
  partnerships: "1503567975209369630",
  department_reports: "1503566575859667117",
  department_assistance: "1503566642276208660",
  internal_affairs_support: "1503568125298217040",
  server_bugs: "1503568272216428676",
  ingame_exploit_reports: "1503568698907037849",
  server_blacklist: "1508267585853198496",
  sponsership: "1508267538155311296",
  media_and_content_help: "1503569016525164606",
  tech_support: "1503566475951345755",
  ownership_support: "1491990230415446067",
};

const productionCategoryId = "1503568865555120269";

const ticketTypeRoleIds: Partial<Record<TicketKey, string[]>> = {
  general_support: ["1495182870564573297"],
  partnerships: ["1507174494207344760"],
  department_reports: ["1490006597328699522"],
  department_assistance: ["1503525788757262367"],
  internal_affairs_support: ["1495566089382264903", "1495541260717391963", "1495541257924251692", "1495566654095102083"],
  server_bugs: ["1506111810984738916", "1505356877998067835"],
  ingame_exploit_reports: ["1490006597328699522"],
  server_blacklist: ["1490006597328699522"],
  sponsership: ["1503604417818132540"],
  media_and_content_help: ["1508258857653112832", "1508258860761092096", "1508258864045359104"],
  tech_support: ["1505356877998067835", "1506111810984738916"],
  ownership_support: ["1490006597328699522"],
  production_support: ["1495212878960005181"],
  livery_design: ["1495212879975158003"],
  uniform_design: ["1495212880713355485"],
  els_design: ["1495212881615257710"],
  logo_design: ["1495213100800934099"],
  accessories: ["1508258088795242516"],
};

const lockedTicketTypes = new Set<TicketKey>();
const openTickets = new Map<string, TicketMeta>();

function ticketLabelFor(ticketType: TicketKey): string {
  return ticketLabels[ticketType];
}

function modalLabel(value: string): string {
  return value.length <= 45 ? value : `${value.slice(0, 42).trimEnd()}...`;
}

function sanitizeTicketSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "ticket";
}

function ticketTopic(ownerId: string, ticketType: TicketKey): string {
  return `Ticket owner: ${ownerId} | Type: ${ticketType}`;
}

function parseTicketTopic(topic: string | null): TicketMeta | null {
  if (!topic) {
    return null;
  }

  const match = topic.match(/^Ticket owner:\s+(\d+)\s+\|\s+Type:\s+([a-z_]+)$/i);
  if (!match) {
    return null;
  }

  return {
    ownerId: match[1],
    ticketType: match[2] as TicketKey,
    answers: [],
  };
}

function getTicketMeta(channel: TextChannel): TicketMeta | null {
  return openTickets.get(channel.id) ?? parseTicketTopic(channel.topic);
}

function getCategoryIdFor(ticketType: TicketKey): string | null {
  if (productionTicketOptions.some((option) => option.value === ticketType)) {
    return productionCategoryId;
  }

  return ticketTypeCategories[ticketType] ?? null;
}

function getSupportRoleIdsFor(ticketType: TicketKey): string[] {
  return ticketTypeRoleIds[ticketType] ?? ticketTypeRoleIds.general_support ?? [];
}

function getTranscriptLogChannelId(ticketType: TicketKey): string {
  return ticketType === "general_support"
    ? GENERAL_SUPPORT_TICKET_TRANSCRIPT_LOG_CHANNEL_ID
    : TICKET_TRANSCRIPT_LOG_CHANNEL_ID;
}

function resolveGuildTextChannel(
  member: GuildMember,
  channelId: string,
): GuildTextBasedChannel | null {
  const channel = member.guild.channels.cache.get(channelId);
  return channel?.isTextBased() && "send" in channel ? (channel as GuildTextBasedChannel) : null;
}

function extractUserId(input: string): string | null {
  const match = input.trim().match(/^<@!?(\d+)>$|^(\d+)$/);
  return match ? match[1] ?? match[2] ?? null : null;
}

function formatTicketUserLabel(user: { tag?: string; username?: string; id: string }): string {
  return `${user.tag ?? user.username ?? "Unknown User"} (\`${user.id}\`)`;
}

function buildTicketTopicText(): string {
  return "*Please select a topic for your ticket down below.*\n-# **You have now agreed to our Ticket Terms of Service.**";
}

function buildProductionTopicText(): string {
  return "*Choose a Prodcution type that matches the support that you need.*\n-# **You have now agreed to our Ticket Terms of Service.**";
}

function buildTopicSelect() {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(TICKET_TOPIC_SELECT_ID)
      .setPlaceholder("Choose a ticket category")
      .addOptions(
        mainTicketOptions.map((option) => ({
          label: option.label,
          value: option.value,
          emoji: option.emoji,
        })),
      ),
  );
}

function buildProductionSelect() {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(TICKET_PRODUCTION_SELECT_ID)
      .setPlaceholder("Choose a production category")
      .addOptions(
        productionTicketOptions.map((option) => ({
          label: option.label,
          value: option.value,
          emoji: option.emoji,
        })),
      ),
  );
}

function buildTicketQuestionsModal(ticketType: TicketKey): ModalBuilder {
  const [q1, q2, q3] = ticketQuestions[ticketType];

  return new ModalBuilder()
    .setCustomId(`${TICKET_MODAL_PREFIX}${ticketType}`)
    .setTitle("Ticket Information")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("question_one")
          .setLabel(modalLabel(q1))
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(200)
          .setPlaceholder("Type your answer here..."),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("question_two")
          .setLabel(modalLabel(q2))
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000)
          .setPlaceholder("Give us the full details..."),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("question_three")
          .setLabel(modalLabel(q3))
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000)
          .setPlaceholder("Anything else we should know?"),
      ),
    );
}

function buildTicketInfoLines(ticketType: TicketKey): string[] {
  switch (ticketType) {
    case "general_support":
      return [
        "**What This Ticket Is For** - *General questions, support concerns, and help requests that do not belong under a more specific department.*",
        "**How To Use This Ticket** - *Explain the issue clearly, reply with full details, and keep everything focused on the exact help you need from support.*",
        "**Support Reminder** - *Please avoid unrelated chat, unnecessary pings, or duplicate questions while staff review your request.*",
      ];
    case "partnerships":
      return [
        "**What This Ticket Is For** - *Partnership requests, affiliate discussions, and server-to-server collaboration inquiries.*",
        "**How To Use This Ticket** - *Share your server details, audience, and partnership goals so the team can review your request properly.*",
        "**Support Reminder** - *Be respectful, include accurate information, and do not spam repeated follow-ups while awaiting review.*",
      ];
    case "department_reports":
      return [
        "**What This Ticket Is For** - *Reports involving department conduct, internal behavior, or actions that require staff review.*",
        "**How To Use This Ticket** - *Provide names, context, and any proof that helps staff understand exactly what happened.*",
        "**Support Reminder** - *Keep reports factual, avoid arguments in the ticket, and do not tag outside members into the conversation.*",
      ];
    case "department_assistance":
      return [
        "**What This Ticket Is For** - *Department-related support, access issues, internal help, and operational questions.*",
        "**How To Use This Ticket** - *Explain which department you need help with and what result you are trying to reach so support can respond faster.*",
        "**Support Reminder** - *Use one clear thread of communication and be ready to answer follow-up questions from staff.*",
      ];
    case "internal_affairs_support":
      return [
        "**What This Ticket Is For** - *Internal Affairs matters that need confidential review, escalation, or sensitive handling.*",
        "**How To Use This Ticket** - *State the concern clearly, include all important context, and provide any relevant proof or timelines.*",
        "**Support Reminder** - *Keep the conversation professional and avoid involving unrelated members in the ticket.*",
      ];
    case "server_bugs":
      return [
        "**What This Ticket Is For** - *Bug reports, broken systems, and issues affecting the server experience.*",
        "**How To Use This Ticket** - *Describe what broke, how it happened, and how staff can reproduce the issue quickly.*",
        "**Support Reminder** - *Screenshots, steps, and clear descriptions help the team investigate much faster.*",
      ];
    case "ingame_exploit_reports":
      return [
        "**What This Ticket Is For** - *Exploit reports, abuse reports, and in-game activity that needs urgent review.*",
        "**How To Use This Ticket** - *Give exact names, explain what happened, and include evidence or timestamps whenever possible.*",
        "**Support Reminder** - *Keep this ticket focused on the exploit report only so it can be reviewed quickly and accurately.*",
      ];
    case "server_blacklist":
      return [
        "**What This Ticket Is For** - *Blacklist requests, appeals, or reviews that require leadership or staff evaluation.*",
        "**How To Use This Ticket** - *Include the person, reason, background, and proof that supports the blacklist request or review.*",
        "**Support Reminder** - *Stay factual and avoid emotional arguments so the case can be reviewed fairly.*",
      ];
    case "sponsership":
      return [
        "**What This Ticket Is For** - *Sponsorship opportunities, brand collaborations, and promotional support discussions.*",
        "**How To Use This Ticket** - *Explain what you are requesting, what you are offering, and why it benefits Miami Roleplay.*",
        "**Support Reminder** - *Make sure all details are complete so leadership can review your request without delays.*",
      ];
    case "media_and_content_help":
      return [
        "**What This Ticket Is For** - *Media requests, content support, graphics coordination, and promotional help.*",
        "**How To Use This Ticket** - *Share the project goal, deadline, and any references or style notes that support should follow.*",
        "**Support Reminder** - *Keep all requests organized in one place so the content team can assist efficiently.*",
      ];
    case "tech_support":
      return [
        "**What This Ticket Is For** - *INT support, technical issues, and help with systems, tools, or setup problems.*",
        "**How To Use This Ticket** - *Explain the issue clearly, mention when it started, and list anything you already tried before opening the ticket.*",
        "**Support Reminder** - *Technical tickets move faster when your details are specific and easy to follow.*",
      ];
    case "ownership_support":
      return [
        "**What This Ticket Is For** - *Foundership-level concerns, escalations, and situations that require leadership review.*",
        "**How To Use This Ticket** - *Explain why this needs foundership attention and what final outcome you are seeking from review.*",
        "**Support Reminder** - *Only use this category for true foundership matters and keep the ticket respectful and direct.*",
      ];
    case "production_support":
      return [
        "**What This Ticket Is For** - *General production board support and creative requests that do not fit a narrower production category.*",
        "**How To Use This Ticket** - *Explain the project, include references, and mention any deadline or delivery expectations.*",
        "**Support Reminder** - *Provide enough creative direction for the production team to understand the request right away.*",
      ];
    case "livery_design":
      return [
        "**What This Ticket Is For** - *Livery design requests for departments, fleets, and custom branded vehicles.*",
        "**How To Use This Ticket** - *Include department branding, reference images, and any exact text or colors the design should follow.*",
        "**Support Reminder** - *The more visual direction you provide, the smoother the design process will be.*",
      ];
    case "uniform_design":
      return [
        "**What This Ticket Is For** - *Uniform design requests for departments, teams, and organized staff groups.*",
        "**How To Use This Ticket** - *Describe the style, colors, branding, and any role-specific details that should be included.*",
        "**Support Reminder** - *Be clear about department identity and visual standards so revisions stay minimal.*",
      ];
    case "els_design":
      return [
        "**What This Ticket Is For** - *ELS setup requests, emergency lighting concepts, and related vehicle lighting support.*",
        "**How To Use This Ticket** - *Tell the team the vehicle, pack, and lighting style you want so the setup can be built correctly.*",
        "**Support Reminder** - *Specific references and examples help avoid back-and-forth on technical design details.*",
      ];
    case "logo_design":
      return [
        "**What This Ticket Is For** - *Logo requests, rebrands, branding support, and identity artwork for Miami-related projects.*",
        "**How To Use This Ticket** - *Include wording, theme, colors, and examples of the style you want the team to follow.*",
        "**Support Reminder** - *The more exact your branding notes are, the more precise the final design can be.*",
      ];
    case "accessories":
      return [
        "**What This Ticket Is For** - *Accessory requests, supporting design assets, and smaller production deliverables.*",
        "**How To Use This Ticket** - *Describe the item clearly, include references, and explain how it should match your project.*",
        "**Support Reminder** - *Please keep accessory requests organized and include every detail needed for completion.*",
      ];
  }
}

function buildTicketInfoPanel(member: GuildMember, ticketType: TicketKey) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `## ${ticketLabelFor(ticketType)}`,
          "",
          "*Your ticket has been created and routed to the correct Miami support team. Please review the information below while waiting for staff.*",
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `**Opened By** - ${member}`,
          `**Support Type** - ${ticketLabelFor(ticketType)}`,
          "**Current Status** - *Waiting for a staff response.*",
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(buildTicketInfoLines(ticketType).join("\n")),
      new TextDisplayBuilder().setContent("-# Miami Roleplay © 2026 | Ticket Support"),
    );

  return {
    allowedMentions: {
      parse: [],
      roles: [],
      users: [],
    },
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
}

function buildTicketLifecycleLogPanel(
  action: "opened" | "closed",
  openerText: string,
  ticketType: TicketKey,
  ticketName: string,
  extraLine: string,
) {
  const title = action === "opened" ? "Ticket Opened" : "Ticket Closed";
  return buildTicketNoticePanel(title, [
    `**Ticket** - \`${ticketName}\``,
    `**Opened By** - ${openerText}`,
    `**Support Type** - ${ticketLabelFor(ticketType)}`,
    extraLine,
  ], "-# Miami Roleplay © 2026 | Ticket Logs");
}

function buildTranscriptPanel(
  openerText: string,
  ticketType: TicketKey,
  ticketName: string,
  closeReasonText: string,
  answers: string[],
  transcriptLines: string[],
) {
  const questions = ticketQuestions[ticketType];
  const answerLines = questions.flatMap((question, index) => [
    `**${question}**`,
    `*${answers[index] || "No response provided"}*`,
    "",
  ]);

  return buildTicketNoticePanel(
    `${ticketLabelFor(ticketType)} Transcript`,
    [
      `**Ticket** - \`${ticketName}\``,
      `**Opened By** - ${openerText}`,
      `**Support Type** - ${ticketLabelFor(ticketType)}`,
      closeReasonText,
      "",
      "**Submitted Answers**",
      ...answerLines,
      "",
      "**Recent Ticket Messages**",
      ...(transcriptLines.length > 0 ? transcriptLines : ["*No recent messages were captured before closure.*"]),
    ],
    "-# Miami Roleplay © 2026 | Ticket Transcripts",
  );
}

async function buildTranscriptLines(channel: TextChannel): Promise<string[]> {
  const fetched = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  if (!fetched) {
    return [];
  }

  return [...fetched.values()]
    .reverse()
    .filter((entry) => !entry.author.bot || entry.components.length === 0)
    .map((entry) => {
      const authorText = `${entry.author.tag}`;
      const content = entry.content.trim() || "[No text content]";
      return `> **${authorText}** - ${content.slice(0, 300)}`;
    })
    .slice(-25);
}

async function sendTicketOpenedLog(
  member: GuildMember,
  channel: TextChannel,
  ticketType: TicketKey,
): Promise<void> {
  const logChannel = resolveGuildTextChannel(member, TICKET_LOG_CHANNEL_ID);
  if (!logChannel) {
    return;
  }

  await logChannel.send(
    buildTicketLifecycleLogPanel(
      "opened",
      formatTicketUserLabel(member.user),
      ticketType,
      channel.name,
      "**Status** - *Ticket created successfully.*",
    ) as any,
  ).catch(() => null);
}

async function sendTicketCloseOutputs(
  channel: TextChannel,
  meta: TicketMeta,
  closeReason: string,
): Promise<void> {
  const guild = channel.guild;
  const ownerMember = await guild.members.fetch(meta.ownerId).catch(() => null);
  const ownerUser = ownerMember?.user ?? await guild.client.users.fetch(meta.ownerId).catch(() => null);
  const openerText = ownerUser
    ? formatTicketUserLabel(ownerUser)
    : `Unknown User (\`${meta.ownerId}\`)`;
  const logChannel = guild.channels.cache.get(TICKET_LOG_CHANNEL_ID);
  const transcriptChannel = guild.channels.cache.get(getTranscriptLogChannelId(meta.ticketType));
  const transcriptLines = await buildTranscriptLines(channel);
  const normalizedCloseReason = normalizeCloseReason(closeReason) || "No reason provided.";
  const plainCloseReasonText = `**Close Reason** - *${normalizedCloseReason}*`;

  if (logChannel?.isTextBased() && "send" in logChannel) {
    const trackedLogReason = buildTrackedReasonField("Close Reason", normalizedCloseReason);
    const sentLogMessage = await logChannel.send(
      buildTicketLifecycleLogPanel(
        "closed",
        openerText,
        meta.ticketType,
        channel.name,
        trackedLogReason.text,
      ) as any,
    ).catch(() => null);

    if (sentLogMessage) {
      finalizeTrackedReason(
        trackedLogReason.entryId,
        guild.id,
        sentLogMessage.channelId,
        sentLogMessage.id,
        "Close Reason",
      );
    }
  }

  if (transcriptChannel?.isTextBased() && "send" in transcriptChannel) {
    const trackedTranscriptReason = buildTrackedReasonField("Close Reason", normalizedCloseReason);
    const sentTranscriptMessage = await transcriptChannel.send(
      buildTranscriptPanel(
        openerText,
        meta.ticketType,
        channel.name,
        trackedTranscriptReason.text,
        meta.answers,
        transcriptLines,
      ) as any,
    ).catch(() => null);

    if (sentTranscriptMessage) {
      finalizeTrackedReason(
        trackedTranscriptReason.entryId,
        guild.id,
        sentTranscriptMessage.channelId,
        sentTranscriptMessage.id,
        "Close Reason",
      );
    }
  }

  if (ownerMember) {
    await ownerMember.send(
      buildTicketClosedDmPanel(guild.id, meta.ticketType, channel.name, plainCloseReasonText) as any,
    ).catch(() => null);
  }
}

function buildTicketAnswersPanel(ticketType: TicketKey, answers: string[]) {
  const questions = ticketQuestions[ticketType];
  const answerLines = questions.flatMap((question, index) => [
    `**${question}**`,
    `*${answers[index] || "No response provided"}*`,
    "",
  ]);

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `## ${ticketLabelFor(ticketType)} Submission`,
          "",
          "*Below is the information that was submitted with this ticket.*",
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "## Submitted Ticket Information",
          "",
          ...answerLines,
        ].join("\n").trim(),
      ),
      new TextDisplayBuilder().setContent("-# Miami Roleplay © 2026 | Ticket Support"),
    );

  return {
    allowedMentions: {
      parse: [],
      roles: [],
      users: [],
    },
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
}

function buildTicketNoticePanel(
  title: string,
  lines: string[],
  footer = "-# Miami Roleplay © 2026 | Ticket Operations",
) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `## ${title}`,
          "",
          ...lines,
        ].join("\n"),
      ),
    )
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer));

  return {
    allowedMentions: {
      parse: [],
      roles: [],
      users: [],
    },
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
}

function buildTicketClosedDmPanel(
  guildId: string,
  ticketType: TicketKey,
  ticketName: string,
  closeReasonText: string,
) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "## Ticket Closed",
          "",
          "*Your Miami support ticket has been closed. If you still need help, use the button below to head back to the support channel and open a fresh ticket.*",
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `**Ticket** - \`${ticketName}\``,
          `**Support Type** - ${ticketLabelFor(ticketType)}`,
          closeReasonText,
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel("Back to Tickets")
          .setEmoji("🎫")
          .setStyle(ButtonStyle.Link)
          .setURL(`https://discord.com/channels/${guildId}/${TICKET_RETURN_CHANNEL_ID}`),
      ),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("-# Miami Roleplay © 2026 | Ticket Support"),
    );

  return {
    allowedMentions: {
      parse: [],
      roles: [],
      users: [],
    },
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
}

function buildCloseReasonPromptPanel(remainingSeconds: number) {
  return buildTicketNoticePanel("Ticket Closure Pending", [
    "*Please type a reason for the closure of this ticket within the next 60 seconds*",
    `\`${remainingSeconds}\``,
  ]);
}

function buildCloseRequestPanel(
  requestedByText: string,
  reasonText: string,
  statusText = "*Waiting for a response from the ticket opener.*",
  includeButtons = true,
) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "## Close Request",
          "",
          "*A request has been made to close this ticket. Support can review the request below.*",
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `**Requested By** - ${requestedByText}`,
          reasonText,
          `**Status** - ${statusText}`,
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder());

  if (includeButtons) {
    container.addActionRowComponents(buildCloseRequestRow());
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent("-# Miami Roleplay © 2026 | Ticket Operations"),
  );

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
}

function buildCloseRequestRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket:close-request:approve")
      .setLabel("Close Ticket")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("ticket:close-request:cancel")
      .setLabel("Cancel")
      .setEmoji("✖️")
      .setStyle(ButtonStyle.Secondary),
  );
}

function buildTicketPanel() {
  const openButtonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(OPEN_TICKET_BUTTON_ID)
      .setLabel("Open Ticket Menu")
      .setEmoji("🎫")
      .setStyle(ButtonStyle.Secondary),
  );

  const container = new ContainerBuilder()
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder()
          .setURL(`attachment://${TICKET_PANEL_BANNER_FILENAME}`)
          .setDescription("Miami Roleplay ticket support banner"),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "## Miami City Roleplay Ticket Operations",
          "",
          "*Select the support option that best matches your request and we will route it to the correct team.*",
          "-# **By opening a ticket, you agree to our Ticket Terms of Service.**",
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "**Support Board**",
          "*General support, reports, productions, blacklist requests, foundership concerns, and department-related help are all handled through this panel.*",
          "",
          "**Before You Open**",
          "*Have your details, evidence, references, and a clear explanation ready so the support team can move faster once your ticket is created.*",
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "**Ticket Terms**",
          "• *Open the ticket under the correct support option so your request reaches the right team without unnecessary delay.*",
          "• *Do not open multiple tickets for the same issue, because repeated tickets can slow support for everyone else waiting.*",
          "• *Explain your situation clearly, include the full context, and avoid making staff ask several follow-up questions for basic details.*",
          "• *Do not ping members inside tickets. Tagging users in ticket channels can result in the ticket being closed automatically.*",
        ].join("\n"),
      ),
      new TextDisplayBuilder().setContent(
        [
          "**More Terms**",
          "• *Keep every ticket professional and respectful, even if your issue is urgent, frustrating, or involves another member.*",
          "• *Only use foundership, blacklist, or internal affairs support when the issue truly requires that level of review.*",
          "• *Use production tickets only for real creative work and include references, branding notes, or deadlines whenever possible.*",
          "• *Do not use tickets for jokes, trolling, unrelated chat, advertising, or anything outside legitimate Miami support requests.*",
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addActionRowComponents(openButtonRow)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("-# Miami Roleplay © 2026 | Ticket Operations"),
    );

  return {
    components: [container],
    files: [new AttachmentBuilder(TICKET_PANEL_BANNER_PATH, { name: TICKET_PANEL_BANNER_FILENAME })],
    flags: MessageFlags.IsComponentsV2,
  };
}

export async function postTicketPanelMessage(channel: TextChannel): Promise<void> {
  await channel.send(buildTicketPanel());
}

export function isTicketChannelName(name: string): boolean {
  return name.startsWith(TICKET_PREFIX);
}

export function isTicketChannel(channel: TextChannel): boolean {
  return isTicketChannelName(channel.name) || getTicketMeta(channel) !== null;
}

export function isTicketOwner(channel: TextChannel, userId: string): boolean {
  const meta = getTicketMeta(channel);
  return meta?.ownerId === userId;
}

export function canCloseTicket(channel: TextChannel, member: GuildMember): boolean {
  const meta = getTicketMeta(channel);
  if (!meta) {
    return false;
  }

  if (
    member.roles.cache.has(FOUNDERSHIP_ROLE_ID) ||
    member.permissions.has(PermissionFlagsBits.ManageChannels) ||
    member.permissions.has(PermissionFlagsBits.Administrator)
  ) {
    return true;
  }

  const supportRoleIds = getSupportRoleIdsFor(meta.ticketType);
  return supportRoleIds.some((roleId) => member.roles.cache.has(roleId));
}

export async function createTicketChannel(
  member: GuildMember,
  ticketType: TicketKey,
  answers: string[],
): Promise<TextChannel> {
  const categoryId = getCategoryIdFor(ticketType);
  if (!categoryId) {
    throw new Error(`This ticket type category is not configured yet for ${ticketType}.`);
  }

  const supportRoleIds = getSupportRoleIdsFor(ticketType);
  const channel = await member.guild.channels.create({
    name: sanitizeTicketSlug(`${member.user.username}-${ticketType}`),
    type: ChannelType.GuildText,
    parent: categoryId,
    topic: ticketTopic(member.id, ticketType),
    permissionOverwrites: [
      {
        id: member.guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
        type: OverwriteType.Role,
      },
      {
        id: member.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
        ],
        type: OverwriteType.Member,
      },
      ...supportRoleIds.map((roleId) => ({
        id: roleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageChannels,
        ],
        type: OverwriteType.Role,
      })),
    ],
  });

  openTickets.set(channel.id, { ownerId: member.id, ticketType, answers });

  const pingLine = [...supportRoleIds.map((roleId) => `<@&${roleId}>`), `${member}`].join(" | ");
  await channel.send({ content: pingLine });
  await channel.send(buildTicketInfoPanel(member, ticketType));
  await channel.send(buildTicketAnswersPanel(ticketType, answers));
  await sendTicketOpenedLog(member, channel, ticketType);

  return channel;
}

export async function closeTicketChannel(channel: TextChannel, reason = "No reason provided"): Promise<void> {
  const meta = getTicketMeta(channel);

  if (meta) {
    try {
      const owner = await channel.guild.members.fetch(meta.ownerId);
      await channel.permissionOverwrites.edit(owner.id, {
        SendMessages: false,
        AddReactions: false,
        SendMessagesInThreads: false,
      });
    } catch {
      // Ignore owner permission cleanup failures.
    }

    await sendTicketCloseOutputs(channel, meta, reason);
  }

  await channel.delete(`Ticket closed: ${reason}`);
}

function normalizeCloseReason(content: string): string {
  const trimmed = content.trim();
  const ticketClosePattern = /^-close\s*/i;

  if (!ticketClosePattern.test(trimmed)) {
    return trimmed;
  }

  return trimmed.replace(ticketClosePattern, "").trim();
}

async function runCloseCountdown(
  channel: TextChannel,
  closingUserId: string,
  reminderMessage: Message,
): Promise<string | null> {
  const startedAt = Date.now();
  let lastShownSeconds = Math.ceil(CLOSE_REASON_TIMEOUT_MS / 1000);

  const countdownTimer = setInterval(() => {
    const elapsedMs = Date.now() - startedAt;
    const remainingMs = Math.max(CLOSE_REASON_TIMEOUT_MS - elapsedMs, 0);
    const remainingSeconds = Math.ceil(remainingMs / 1000);

    if (remainingSeconds === lastShownSeconds || remainingSeconds <= 0) {
      return;
    }

    lastShownSeconds = remainingSeconds;
    void reminderMessage.edit(buildCloseReasonPromptPanel(remainingSeconds) as any).catch(() => null);
  }, CLOSE_COUNTDOWN_INTERVAL_MS);

  try {
    const collected = await channel.awaitMessages({
      filter: (message) =>
        message.author.id === closingUserId &&
        !message.author.bot &&
        normalizeCloseReason(message.content).length > 0 &&
        message.id !== reminderMessage.id,
      max: 1,
      time: CLOSE_REASON_TIMEOUT_MS,
      errors: ["time"],
    });

    return normalizeCloseReason(collected.first()?.content ?? "");
  } catch {
    return null;
  } finally {
    clearInterval(countdownTimer);
  }
}

export async function requestTicketClose(
  channel: TextChannel,
  closer: GuildMember,
  reason: string | null,
): Promise<void> {
  if (pendingTicketClosures.get(channel.id)) {
    await channel.send(
      `${closer}, a ticket close request is already waiting for a reason in this channel.`,
    );
    return;
  }

  pendingTicketClosures.set(channel.id, true);

  try {
    let closeReason = normalizeCloseReason(reason ?? "");

    if (!closeReason) {
      const reminderMessage = await channel.send(
        buildCloseReasonPromptPanel(60) as any,
      );

      const collectedReason = await runCloseCountdown(channel, closer.id, reminderMessage);
      if (!collectedReason) {
        await reminderMessage.edit(
          buildTicketNoticePanel("Ticket Closure Expired", [
            "*The close timer expired before a reason was provided.*",
          ]) as any,
        ).catch(() => null);
        return;
      }

      closeReason = collectedReason;
      await reminderMessage.delete().catch(() => null);
    }

    await closeTicketChannel(channel, closeReason);
  } finally {
    pendingTicketClosures.delete(channel.id);
  }
}

export async function requestClosePanel(channel: TextChannel, closer: GuildMember, reason: string): Promise<void> {
  const meta = getTicketMeta(channel);
  if (!meta) {
    return;
  }

  const supportRoleIds = getSupportRoleIdsFor(meta.ticketType);
  const pingLine = [...supportRoleIds.map((roleId) => `<@&${roleId}>`), `<@${meta.ownerId}>`].join(" | ");
  const ownerMember = await channel.guild.members.fetch(meta.ownerId).catch(() => null);
  if (!ownerMember) {
    return;
  }

  await channel.permissionOverwrites.edit(ownerMember, {
    SendMessages: false,
    AddReactions: false,
    SendMessagesInThreads: false,
  });

  await channel.send({ content: pingLine });
  const trackedReason = buildTrackedReasonField("Reason", reason);
  const requestMessage = await channel.send(
    buildCloseRequestPanel(`${closer}`, trackedReason.text) as any,
  );
  closeRequestStates.set(requestMessage.id, {
    requesterId: closer.id,
    ownerId: meta.ownerId,
    reason,
  });
  finalizeTrackedReason(
    trackedReason.entryId,
    channel.guild.id,
    requestMessage.channelId,
    requestMessage.id,
    "Reason",
  );
  await requestMessage.pin().catch(() => null);
}

export async function switchTicketCategory(
  channel: TextChannel,
  categoryId: string,
): Promise<void> {
  await channel.setParent(categoryId, { lockPermissions: false });
}

export async function renameTicketChannel(
  channel: TextChannel,
  nextName: string,
): Promise<string> {
  const normalized = nextName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!normalized) {
    throw new Error("Please provide a valid ticket name.");
  }

  const finalName = normalized.startsWith(TICKET_PREFIX)
    ? normalized
    : `${TICKET_PREFIX}${normalized}`;

  await channel.setName(finalName);
  return finalName;
}

export async function addUserToTicket(
  channel: TextChannel,
  userIdInput: string,
): Promise<string> {
  const userId = extractUserId(userIdInput);
  if (!userId) {
    throw new Error("Please provide a valid user ID.");
  }

  const member = await channel.guild.members.fetch(userId);
  await channel.permissionOverwrites.edit(member.id, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
    AttachFiles: true,
  });
  return member.toString();
}

export async function removeUserFromTicket(
  channel: TextChannel,
  userIdInput: string,
  reason: string,
): Promise<string> {
  const userId = extractUserId(userIdInput);
  if (!userId) {
    throw new Error("Please provide a valid user ID.");
  }

  const meta = getTicketMeta(channel);
  if (meta?.ownerId === userId) {
    throw new Error("You cannot remove the ticket opener with this command.");
  }

  const member = await channel.guild.members.fetch(userId);
  await channel.permissionOverwrites.edit(member.id, {
    ViewChannel: false,
    SendMessages: false,
    ReadMessageHistory: false,
  });

  await member.send(
    `You were removed from ${channel.guild.name}'s ticket \`${channel.name}\`.\nReason: ${reason || "No reason provided."}`,
  ).catch(() => null);

  return member.toString();
}

export async function handleTicketMessageCreate(message: Message): Promise<void> {
  if (!(message.channel instanceof TextChannel) || !isTicketChannel(message.channel)) {
    return;
  }

  const meta = getTicketMeta(message.channel);
  if (!meta || message.author.id !== meta.ownerId) {
    return;
  }

  if (
    message.mentions.everyone ||
    message.mentions.users.size > 0 ||
    message.mentions.roles.size > 0 ||
    message.mentions.channels.size > 0
  ) {
    await message.channel.send(
      buildTicketNoticePanel("Ticket Closed Automatically", [
        "*This ticket was closed because the ticket opener pinged another user or role inside the ticket.*",
      ]) as any,
    ).catch(() => null);
    await closeTicketChannel(
      message.channel,
      "Ticket opener pinged another user or role in the ticket.",
    );
  }
}

export async function handleTicketButtonInteraction(interaction: ButtonInteraction): Promise<boolean> {
  if (!interaction.inCachedGuild()) {
    return false;
  }

  if (interaction.customId === OPEN_TICKET_BUTTON_ID) {
    await interaction.reply({
      content: buildTicketTopicText(),
      components: [buildTopicSelect()],
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (
    interaction.customId === "ticket:close-request:approve" ||
    interaction.customId === "ticket:close-request:cancel"
  ) {
    if (!interaction.channel || !(interaction.channel instanceof TextChannel)) {
      await interaction.reply({ content: "This close request is no longer valid.", flags: MessageFlags.Ephemeral });
      return true;
    }

    const state = closeRequestStates.get(interaction.message.id);
    if (!state) {
      await interaction.reply({ content: "This close request is no longer valid.", flags: MessageFlags.Ephemeral });
      return true;
    }

    if (interaction.customId === "ticket:close-request:cancel") {
      if (interaction.user.id !== state.ownerId) {
        await interaction.reply({ content: "Only the ticket opener can cancel this close request.", flags: MessageFlags.Ephemeral });
        return true;
      }

      await interaction.channel.permissionOverwrites.edit(state.ownerId, {
        SendMessages: true,
        AddReactions: true,
        SendMessagesInThreads: true,
      });

      await interaction.update(
        buildCloseRequestPanel(
          `<@${state.requesterId}>`,
          state.reason,
          "*The ticket opener denied this close request.*",
          false,
        ) as any,
      );
      closeRequestStates.delete(interaction.message.id);
      await interaction.channel.send({
        content: `<@${state.requesterId}> | <@${state.ownerId}> has denied the close request and can chat again.`,
      });
      return true;
    }

    if (!interaction.member || !canCloseTicket(interaction.channel, interaction.member)) {
      await interaction.reply({ content: "Only staff can close this ticket.", flags: MessageFlags.Ephemeral });
      return true;
    }

    await interaction.update(
      buildCloseRequestPanel(
        `<@${state.requesterId}>`,
        state.reason,
        "*This close request was approved and the ticket is closing.*",
        false,
      ) as any,
    );
    closeRequestStates.delete(interaction.message.id);
    await closeTicketChannel(interaction.channel, "Close request approved");
    return true;
  }

  return false;
}

export async function handleTicketSelectInteraction(interaction: StringSelectMenuInteraction): Promise<boolean> {
  if (!interaction.inCachedGuild()) {
    return false;
  }

  if (interaction.customId === TICKET_TOPIC_SELECT_ID) {
    const selected = interaction.values[0];
    if (selected === "productions") {
      await interaction.reply({
        content: buildProductionTopicText(),
        components: [buildProductionSelect()],
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    const ticketType = selected as TicketKey;
    if (lockedTicketTypes.has(ticketType)) {
      await interaction.reply({
        content: `*${ticketLabelFor(ticketType)} is currently closed check back later for more updates.*`,
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    await interaction.showModal(buildTicketQuestionsModal(ticketType));
    return true;
  }

  if (interaction.customId === TICKET_PRODUCTION_SELECT_ID) {
    const ticketType = interaction.values[0] as TicketKey;
    if (lockedTicketTypes.has(ticketType)) {
      await interaction.reply({
        content: `*${ticketLabelFor(ticketType)} is currently closed check back later for more updates.*`,
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    await interaction.showModal(buildTicketQuestionsModal(ticketType));
    return true;
  }

  return false;
}

export async function handleTicketModalSubmit(interaction: ModalSubmitInteraction): Promise<boolean> {
  if (!interaction.inCachedGuild()) {
    return false;
  }

  if (!interaction.customId.startsWith(TICKET_MODAL_PREFIX)) {
    return false;
  }

  const ticketType = interaction.customId.slice(TICKET_MODAL_PREFIX.length) as TicketKey;
  const answers = [
    interaction.fields.getTextInputValue("question_one").trim(),
    interaction.fields.getTextInputValue("question_two").trim(),
    interaction.fields.getTextInputValue("question_three").trim(),
  ];

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const channel = await createTicketChannel(interaction.member, ticketType, answers);
    await interaction.editReply({
      content: `Your ticket has been created: ${channel}`,
    });
  } catch (error) {
    console.error("Ticket modal submit failed.");
    console.error(error);

    const failureMessage =
      error instanceof Error
        ? `I could not create your ticket: ${error.message}`
        : "I could not create your ticket right now.";

    if (interaction.deferred) {
      await interaction.editReply({
        content: failureMessage,
      }).catch(() => null);
    } else if (interaction.replied) {
      await interaction.followUp({
        content: failureMessage,
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
    } else {
      await interaction.reply({
        content: failureMessage,
        flags: MessageFlags.Ephemeral,
      }).catch(() => null);
    }
  }

  return true;
}

export const ticketButtonIds = {
  open: OPEN_TICKET_BUTTON_ID,
};
