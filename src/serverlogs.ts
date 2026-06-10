import fs from "node:fs";
import path from "node:path";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  Guild,
  GuildMember,
  Message,
  MessageFlags,
  PartialMessage,
  SeparatorBuilder,
  TextChannel,
  TextDisplayBuilder,
  VoiceState,
  ChatInputCommandInteraction,
} from "discord.js";
import { buildTrackedReasonField, finalizeTrackedReason } from "./reasontracker.js";

const LOG_MANAGER_ROLE_ID = "1490006597328699522";
const SETTINGS_PATH = path.join(process.cwd(), "server-log-settings.json");
const LOG_FALLBACKS: Partial<Record<string, Partial<Record<LogKind, string>>>> = {
  "1489749624838295713": {
    punishment: "1511165913003462666",
    automod: "1491984772908711988",
    message_spam: "1496726010832355348",
  },
};

type LogKind =
  | "punishment"
  | "undone"
  | "link_block"
  | "message"
  | "voice"
  | "command"
  | "automod"
  | "message_spam";

type GuildLogSettings = Record<LogKind, string | null>;
type SettingsStore = Record<string, GuildLogSettings>;

const defaultSettings: GuildLogSettings = {
  punishment: null,
  undone: null,
  link_block: null,
  message: null,
  voice: null,
  command: null,
  automod: null,
  message_spam: null,
};

function loadSettings(): SettingsStore {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) {
      return {};
    }

    const raw = fs.readFileSync(SETTINGS_PATH, "utf8");
    return (JSON.parse(raw) as SettingsStore) ?? {};
  } catch {
    return {};
  }
}

const settingsStore = loadSettings();

function saveSettings(): void {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settingsStore, null, 2), "utf8");
}

function getSettings(guildId: string): GuildLogSettings {
  if (!settingsStore[guildId]) {
    settingsStore[guildId] = { ...defaultSettings };
  }

  return settingsStore[guildId];
}

function hasManagerRole(member: GuildMember | null): boolean {
  if (!member) {
    return false;
  }

  return member.roles.cache.has(LOG_MANAGER_ROLE_ID) || member.permissions.has("Administrator");
}

function extractChannelId(input: string): string | null {
  const match = input.match(/^<?#?(\d{15,25})>?$/);
  return match?.[1] ?? null;
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function formatUserLabel(user: { tag?: string; username?: string; id: string }): string {
  return `${user.tag ?? user.username ?? "Unknown User"} (\`${user.id}\`)`;
}

function formatMemberLabel(member: GuildMember): string {
  return `${member.user.tag} (\`${member.id}\`)`;
}

async function resolveLogChannel(guild: Guild, kind: LogKind): Promise<TextChannel | null> {
  const settings = getSettings(guild.id);
  const channelId = settings[kind] ?? LOG_FALLBACKS[guild.id]?.[kind] ?? null;
  if (!channelId) {
    return null;
  }

  const channel = guild.channels.cache.get(channelId)
    ?? await guild.channels.fetch(channelId).catch(() => null);

  return channel instanceof TextChannel ? channel : null;
}

function buildLogPanel(
  title: string,
  sections: string[],
  actionLabel: string,
  emoji: string,
) {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`log:${title}:${Date.now()}`)
      .setLabel(actionLabel)
      .setEmoji(emoji)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
  );

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## ${title}`),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      ...sections.map((section) => new TextDisplayBuilder().setContent(section)),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addActionRowComponents(row)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("-# Miami Roleplay © 2026 | Logs"),
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

export async function handleLogSetupPrefixCommand(message: Message, rawContent: string): Promise<boolean> {
  const normalized = rawContent.trim();
  const lower = normalized.toLowerCase();

  const mappings: Array<{ prefixes: string[]; kind: LogKind; label: string }> = [
    { prefixes: ["set-punishment-log", "setpunishmentlog"], kind: "punishment", label: "Punishment log" },
    { prefixes: ["set-undone-log", "setundonelog"], kind: "undone", label: "Undone log" },
    { prefixes: ["set-link-block-log", "setlinkblocklog"], kind: "link_block", label: "Link-block log" },
    { prefixes: ["set-message-log", "setmessagelog"], kind: "message", label: "Message log" },
    { prefixes: ["set-voice-log", "setvoicelog", "set-vc-log", "setvclog"], kind: "voice", label: "Voice log" },
    { prefixes: ["set-command-log", "setcommandlog"], kind: "command", label: "Command log" },
    { prefixes: ["set-automod-log", "setautomodlog"], kind: "automod", label: "Automod log" },
    { prefixes: ["set-message-spam-log", "setmessagespamlog"], kind: "message_spam", label: "Message-spam log" },
  ];

  const matched = mappings.find((entry) => entry.prefixes.some((prefix) => lower.startsWith(prefix)));
  if (!matched) {
    return false;
  }

  if (!message.inGuild() || !message.member || !hasManagerRole(message.member)) {
    await message.delete().catch(() => null);
    return true;
  }

  const value = normalized.split(/\s+/).slice(1).join(" ").trim();
  const channelId = extractChannelId(value);
  if (!channelId) {
    await message.reply(`Use a channel mention or channel ID for the ${matched.label.toLowerCase()} channel.`);
    return true;
  }

  const settings = getSettings(message.guildId!);
  settings[matched.kind] = channelId;
  saveSettings();
  await message.reply(`${matched.label} channel set to <#${channelId}>.`);
  return true;
}

export async function logMessageCreate(message: Message): Promise<void> {
  if (!message.inGuild() || message.author.bot) {
    return;
  }

  const channel = await resolveLogChannel(message.guild, "message");
  if (!channel) {
    return;
  }

  await channel.send(
    buildLogPanel(
      "Message Logged",
      [
        `**Author** - ${message.author.tag} (\`${message.author.id}\`)\n**Channel** - ${message.channel}`,
        `**Content**\n*${truncate(message.content || "[no text content]", 1400)}*`,
      ],
      "Message Captured",
      "💬",
    ),
  ).catch(() => null);
}

export async function logMessageDelete(message: Message | PartialMessage): Promise<void> {
  if (!message.guild || message.author?.bot) {
    return;
  }

  const channel = await resolveLogChannel(message.guild, "undone");
  if (!channel) {
    return;
  }

  await channel.send(
    buildLogPanel(
      "Message Deleted",
      [
        `**Author** - ${message.author ? `${message.author.tag} (\`${message.author.id}\`)` : "*Unknown or uncached*"}\n**Channel** - ${"channel" in message ? `${message.channel}` : "*Unknown*"}`,
        `**Deleted Content**\n*${truncate(message.content || "[no cached message content]", 1400)}*`,
      ],
      "Delete Captured",
      "🗑️",
    ),
  ).catch(() => null);
}

export async function logMessageEdit(oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage): Promise<void> {
  if (!newMessage.guild || newMessage.author?.bot) {
    return;
  }

  if ((oldMessage.content ?? "") === (newMessage.content ?? "")) {
    return;
  }

  const channel = await resolveLogChannel(newMessage.guild, "undone");
  if (!channel) {
    return;
  }

  await channel.send(
    buildLogPanel(
      "Message Edited",
      [
        `**Author** - ${newMessage.author ? `${newMessage.author.tag} (\`${newMessage.author.id}\`)` : "*Unknown or uncached*"}\n**Channel** - ${"channel" in newMessage ? `${newMessage.channel}` : "*Unknown*"}`,
        `**Before**\n*${truncate(oldMessage.content || "[no cached content]", 700)}*`,
        `**After**\n*${truncate(newMessage.content || "[no new content]", 700)}*`,
      ],
      "Edit Captured",
      "🔁",
    ),
  ).catch(() => null);
}

export async function logVoiceUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
  const guild = newState.guild ?? oldState.guild;
  const member = newState.member ?? oldState.member;
  if (!guild || !member || member.user.bot) {
    return;
  }

  const before = oldState.channel;
  const after = newState.channel;
  if (before?.id === after?.id) {
    return;
  }

  const channel = await resolveLogChannel(guild, "voice");
  if (!channel) {
    return;
  }

  let title = "Voice Channel Updated";
  if (!before && after) title = "Voice Channel Joined";
  if (before && !after) title = "Voice Channel Left";
  if (before && after && before.id !== after.id) title = "Voice Channel Moved";

  await channel.send(
    buildLogPanel(
      title,
      [
        `**Member** - ${formatMemberLabel(member)}\n**Before** - ${before ? before.toString() : "*Not connected*"}\n**After** - ${after ? after.toString() : "*Disconnected*"}`,
      ],
      "Voice Logged",
      "🎙️",
    ),
  ).catch(() => null);
}

export async function logCommandFromMessage(message: Message, rawContent: string): Promise<void> {
  if (!message.inGuild() || message.author.bot || !rawContent.trim()) {
    return;
  }

  const channel = await resolveLogChannel(message.guild, "command");
  if (!channel) {
    return;
  }

  await channel.send(
    buildLogPanel(
      "Command Used",
      [
        `**Member** - ${message.author.tag} (\`${message.author.id}\`)\n**Channel** - ${message.channel}`,
        `**Command**\n\`-${truncate(rawContent, 1200)}\``,
      ],
      "Prefix Command",
      "🤖",
    ),
  ).catch(() => null);
}

export async function logCommandFromSlash(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) {
    return;
  }

  const channel = await resolveLogChannel(interaction.guild, "command");
  if (!channel) {
    return;
  }

  const commandText = `/${interaction.commandName}`;
  await channel.send(
    buildLogPanel(
      "Slash Command Used",
      [
        `**Member** - ${interaction.user.tag} (\`${interaction.user.id}\`)\n**Channel** - ${interaction.channel}`,
        `**Command**\n\`${commandText}\``,
      ],
      "Slash Command",
      "🤖",
    ),
  ).catch(() => null);
}

export async function logPunishmentAction(
  moderator: GuildMember,
  targetId: string,
  action: "Ban" | "Kick" | "Unban",
  reason: string,
): Promise<void> {
  const channel = await resolveLogChannel(moderator.guild, "punishment");
  if (!channel) {
    return;
  }

  const trackedReason = buildTrackedReasonField("Reason", reason);
  const sentMessage = await channel.send(
    buildLogPanel(
      `${action} Logged`,
      [
        `**Moderator** - ${formatMemberLabel(moderator)}\n**Target** - *User ID:* \`${targetId}\``,
        trackedReason.text,
      ],
      `${action} Logged`,
      action === "Ban" ? "🔨" : action === "Unban" ? "🔓" : "👢",
    ),
  ).catch(() => null);

  if (sentMessage) {
    finalizeTrackedReason(
      trackedReason.entryId,
      moderator.guild.id,
      channel.id,
      sentMessage.id,
      "Reason",
    );
  }
}

export async function logAutomodByKind(
  message: Message,
  kind: LogKind,
  title: string,
  bodySections: string[],
  buttonLabel: string,
  emoji: string,
): Promise<void> {
  if (!message.inGuild()) {
    return;
  }

  const channel = await resolveLogChannel(message.guild, kind);
  if (!channel) {
    return;
  }

  await channel.send(
    buildLogPanel(title, bodySections, buttonLabel, emoji),
  ).catch(() => null);
}
