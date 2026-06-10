import fs from "node:fs";
import path from "node:path";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ContainerBuilder,
  Message,
  MessageFlags,
  PermissionsBitField,
  SeparatorBuilder,
  TextBasedChannel,
  TextDisplayBuilder,
} from "discord.js";
import { config } from "./config.js";
import { logAutomodByKind } from "./serverlogs.js";
import { logPunishmentAction } from "./serverlogs.js";

const MODERATION_MANAGER_ROLE_ID = "1490006597328699522";
const MODERATION_SETTINGS_PATH = path.join(process.cwd(), "moderation-role-settings.json");
const BLOCKED_WORD_ALERT_CHANNEL_ID = "1491984772908711988";
const BLOCKED_WORD_ALERT_ROLE_ID = "1490529045425684651";
const punctuationPattern = /[^a-z0-9\s]/g;
const invitePattern =
  /(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)\/[a-z0-9-]+/i;
const urlPattern = /https?:\/\/[^\s<]+|www\.[^\s<]+/gi;
const warningCache = new Map<string, number[]>();
const spamCache = new Map<
  string,
  Array<{ content: string; createdAt: number }>
>();

type ViolationType =
  | "blocked_word"
  | "invite"
  | "link"
  | "mention_spam"
  | "caps_spam"
  | "rapid_spam"
  | "duplicate_spam";

type Violation = {
  type: ViolationType;
  reason: string;
  details: string;
  shouldDelete: boolean;
  shouldWarn: boolean;
  shouldTimeout: boolean;
  shouldBan: boolean;
};

type GuildModerationRoleSettings = {
  approvedLinkRoleId: string | null;
  spamBypassRoleId: string | null;
  automodBypassRoleId: string | null;
};

type SettingsStore = Record<string, GuildModerationRoleSettings>;

const defaultRoleSettings: GuildModerationRoleSettings = {
  approvedLinkRoleId: null,
  spamBypassRoleId: null,
  automodBypassRoleId: null,
};

function loadRoleSettings(): SettingsStore {
  try {
    if (!fs.existsSync(MODERATION_SETTINGS_PATH)) {
      return {};
    }

    const raw = fs.readFileSync(MODERATION_SETTINGS_PATH, "utf8");
    return (JSON.parse(raw) as SettingsStore) ?? {};
  } catch {
    return {};
  }
}

const roleSettingsStore = loadRoleSettings();

function saveRoleSettings(): void {
  fs.writeFileSync(MODERATION_SETTINGS_PATH, JSON.stringify(roleSettingsStore, null, 2), "utf8");
}

function getRoleSettings(guildId: string): GuildModerationRoleSettings {
  if (!roleSettingsStore[guildId]) {
    roleSettingsStore[guildId] = { ...defaultRoleSettings };
  }

  return roleSettingsStore[guildId];
}

function hasManagerRole(message: Message): boolean {
  return (
    !!message.member &&
    (message.member.roles.cache.has(MODERATION_MANAGER_ROLE_ID) ||
      message.member.permissions.has(PermissionsBitField.Flags.Administrator))
  );
}

function extractRoleId(input: string): string | null {
  const match = input.match(/^<@&(\d{15,25})>$|^(\d{15,25})$/);
  return match?.[1] ?? match?.[2] ?? null;
}

function normalizeContent(content: string): string {
  return content.toLowerCase().replace(punctuationPattern, " ");
}

function getCacheKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength
    ? `${value.slice(0, maxLength - 3)}...`
    : value;
}

function hasAutomodBypass(message: Message): boolean {
  if (!message.member) {
    return false;
  }

  if (message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
    return true;
  }

  if (!config.automod.exemptRoleIds.length) {
    const settings = getRoleSettings(message.guildId!);
    return !!settings.automodBypassRoleId && message.member.roles.cache.has(settings.automodBypassRoleId);
  }

  const envBypass = message.member.roles.cache.some((role) =>
    config.automod.exemptRoleIds.includes(role.id),
  );
  if (envBypass) {
    return true;
  }

  const settings = getRoleSettings(message.guildId!);
  return !!settings.automodBypassRoleId && message.member.roles.cache.has(settings.automodBypassRoleId);
}

function hasApprovedLinkRole(message: Message): boolean {
  if (!message.member || !message.guildId) {
    return false;
  }

  const settings = getRoleSettings(message.guildId);
  return !!settings.approvedLinkRoleId && message.member.roles.cache.has(settings.approvedLinkRoleId);
}

function hasSpamBypassRole(message: Message): boolean {
  if (!message.member || !message.guildId) {
    return false;
  }

  const settings = getRoleSettings(message.guildId);
  return !!settings.spamBypassRoleId && message.member.roles.cache.has(settings.spamBypassRoleId);
}

function findBlockedWord(content: string): string | null {
  const normalizedContent = normalizeContent(content);
  const normalizedWords = normalizedContent.split(/\s+/).filter(Boolean);
  const rawWords = content
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ""))
    .filter(Boolean);
  const tokens = new Set([...normalizedWords, ...rawWords]);

  for (const blockedWord of config.automod.blockedWords) {
    const normalizedBlockedWord = blockedWord.toLowerCase().trim();

    if (!normalizedBlockedWord) {
      continue;
    }

    if (tokens.has(normalizedBlockedWord)) {
      return normalizedBlockedWord;
    }
  }

  return null;
}

function extractUrls(content: string): string[] {
  return content.match(urlPattern) ?? [];
}

function isAllowedDomain(rawUrl: string): boolean {
  const urlWithProtocol = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;

  try {
    const hostname = new URL(urlWithProtocol).hostname.replace(/^www\./, "");
    return config.automod.allowedLinkDomains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

function hasDisallowedLink(content: string): boolean {
  const urls = extractUrls(content);

  if (!urls.length) {
    return false;
  }

  return urls.some((url) => !isAllowedDomain(url));
}

function hasExcessiveCaps(content: string): boolean {
  const lettersOnly = content.replace(/[^a-z]/gi, "");

  if (lettersOnly.length < config.automod.caps.minLetters) {
    return false;
  }

  const uppercaseLetters = lettersOnly.replace(/[^A-Z]/g, "");
  const ratio = uppercaseLetters.length / lettersOnly.length;
  return ratio >= config.automod.caps.ratio;
}

function addWarning(guildId: string, userId: string): number {
  const key = getCacheKey(guildId, userId);
  const now = Date.now();
  const cutoff = now - config.automod.warningWindowMs;
  const activeWarnings = (warningCache.get(key) ?? []).filter(
    (timestamp) => timestamp >= cutoff,
  );

  activeWarnings.push(now);
  warningCache.set(key, activeWarnings);
  return activeWarnings.length;
}

function trackSpam(
  guildId: string,
  userId: string,
  content: string,
): { isRapidSpam: boolean; isDuplicateSpam: boolean } {
  const key = getCacheKey(guildId, userId);
  const now = Date.now();
  const cutoff = now - config.automod.spam.windowMs;
  const normalizedContent = normalizeContent(content).replace(/\s+/g, " ").trim();
  const history = (spamCache.get(key) ?? []).filter(
    (entry) => entry.createdAt >= cutoff,
  );

  history.push({ content: normalizedContent, createdAt: now });
  spamCache.set(key, history);

  const rapidMessages = history.length >= config.automod.spam.maxMessages;
  const duplicateMessages =
    normalizedContent.length >= config.automod.spam.minDuplicateLength &&
    history.filter((entry) => entry.content === normalizedContent).length >=
      config.automod.spam.maxDuplicates;

  return {
    isRapidSpam: rapidMessages,
    isDuplicateSpam: duplicateMessages,
  };
}

function evaluateViolation(message: Message): Violation | null {
  const spamBypass = hasSpamBypassRole(message);
  const blockedWord = findBlockedWord(message.content);

  if (blockedWord) {
    return {
      type: "blocked_word",
      reason: "blocked language",
      details: `Matched blocked word "${blockedWord}".`,
      shouldDelete: true,
      shouldWarn: false,
      shouldTimeout: false,
      shouldBan: false,
    };
  }

  if (!config.automod.allowInvites && invitePattern.test(message.content)) {
    return {
      type: "invite",
      reason: "server invite links are not allowed",
      details: "Detected a Discord invite link.",
      shouldDelete: true,
      shouldWarn: true,
      shouldTimeout: false,
      shouldBan: false,
    };
  }

  if (!config.automod.allowLinks && !hasApprovedLinkRole(message) && hasDisallowedLink(message.content)) {
    return {
      type: "link",
      reason: "external links are not allowed here",
      details: "Detected a disallowed link.",
      shouldDelete: true,
      shouldWarn: true,
      shouldTimeout: false,
      shouldBan: false,
    };
  }

  if (!spamBypass && message.mentions.users.size > config.automod.maxMentions) {
    return {
      type: "mention_spam",
      reason: "too many mentions in one message",
      details: `Detected ${message.mentions.users.size} user mentions.`,
      shouldDelete: true,
      shouldWarn: true,
      shouldTimeout: true,
      shouldBan: false,
    };
  }

  if (!spamBypass && hasExcessiveCaps(message.content)) {
    return {
      type: "caps_spam",
      reason: "excessive caps",
      details: "Detected a message with an excessive uppercase ratio.",
      shouldDelete: false,
      shouldWarn: true,
      shouldTimeout: false,
      shouldBan: false,
    };
  }

  const { isRapidSpam, isDuplicateSpam } = spamBypass
    ? { isRapidSpam: false, isDuplicateSpam: false }
    : trackSpam(
        message.guildId!,
        message.author.id,
        message.content,
      );

  if (isDuplicateSpam) {
    return {
      type: "duplicate_spam",
      reason: "repeated duplicate messages",
      details: "Detected repeated duplicate content in a short time window.",
      shouldDelete: true,
      shouldWarn: true,
      shouldTimeout: true,
      shouldBan: false,
    };
  }

  if (isRapidSpam) {
    return {
      type: "rapid_spam",
      reason: "sending messages too quickly",
      details: "Detected message burst spam in a short time window.",
      shouldDelete: true,
      shouldWarn: true,
      shouldTimeout: false,
      shouldBan: false,
    };
  }

  return null;
}

export async function handleModerationRoleSetupPrefixCommand(message: Message, rawContent: string): Promise<boolean> {
  const normalized = rawContent.trim();
  const lower = normalized.toLowerCase();
  const isCommand =
    lower.startsWith("set-approved-link-role") ||
    lower.startsWith("setapprovedlinkrole") ||
    lower.startsWith("set-spam-bypass-role") ||
    lower.startsWith("setspambypassrole") ||
    lower.startsWith("set-automod-bypass-role") ||
    lower.startsWith("setautomodbypassrole");

  if (!isCommand) {
    return false;
  }

  if (!message.inGuild() || !hasManagerRole(message)) {
    await message.delete().catch(() => null);
    return true;
  }

  const value = normalized.split(/\s+/).slice(1).join(" ").trim();
  const roleId = extractRoleId(value);
  if (!roleId) {
    await message.reply("Use a role mention or role ID.");
    return true;
  }

  const settings = getRoleSettings(message.guildId!);

  if (lower.startsWith("set-approved-link-role") || lower.startsWith("setapprovedlinkrole")) {
    settings.approvedLinkRoleId = roleId;
    saveRoleSettings();
    await message.reply(`Approved link role set to <@&${roleId}>.`);
    return true;
  }

  if (lower.startsWith("set-spam-bypass-role") || lower.startsWith("setspambypassrole")) {
    settings.spamBypassRoleId = roleId;
    saveRoleSettings();
    await message.reply(`Spam bypass role set to <@&${roleId}>.`);
    return true;
  }

  settings.automodBypassRoleId = roleId;
  saveRoleSettings();
  await message.reply(`Automod bypass role set to <@&${roleId}>.`);
  return true;
}

async function sendWarning(
  sourceMessage: Message,
  channel: TextBasedChannel,
  memberLabel: string,
  reason: string,
  warningCount: number,
  violationType?: Violation["type"],
): Promise<void> {
  const warningRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`automod:warning:${Date.now()}`)
      .setLabel(`Warning ${warningCount}/${config.automod.maxWarningsBeforeTimeout}`)
      .setEmoji("⚠️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
  );

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        violationType === "rapid_spam"
          ? [
              "## Slow Down",
              "",
              `😅 **Woah ${memberLabel} your sending messages a little to fast there.**`,
            ].join("\n")
          : [
              "## Automod Warning",
              "",
              `${memberLabel}, *your recent message was flagged by Miami automod.*`,
            ].join("\n"),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `**Reason** - *${reason}*`,
          `**Warning Count** - *${warningCount}/${config.automod.maxWarningsBeforeTimeout}*`,
          "*Please slow down, review the rules, and avoid repeating the same behavior.*",
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addActionRowComponents(warningRow)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("-# Miami Roleplay © 2026 | Automod"),
    );

  const response = await sourceMessage.reply({
    allowedMentions: {
      repliedUser: false,
      parse: [],
      roles: [],
      users: [],
    },
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  });

  setTimeout(() => {
    void response.delete().catch(() => undefined);
  }, config.automod.warningMessageLifetimeMs);
}

function buildBlockedWordAlertPanel(
  message: Message,
  violation: Violation,
  purgedRecentMessages: number,
) {
  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`automod:blocked-word:${Date.now()}`)
      .setLabel("Blocked Word Removed")
      .setEmoji("🛡️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
  );

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "## Blocked Word Detected",
          "",
          "*Miami automod removed a message that matched the blocked-word list and cleaned up recent accessible messages from the same user.*",
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `**Member** - ${message.author.tag} (\`${message.author.id}\`)`,
          `**Channel** - ${message.channel}`,
          `**Reason** - *${violation.reason}*`,
          `**Details** - *${violation.details}*`,
        ].join("\n"),
      ),
      new TextDisplayBuilder().setContent(
        [
          `**Recent Messages Removed** - *${purgedRecentMessages}*`,
          `**Captured Content**`,
          `*${truncate(message.content || "[no text content]", 1000)}*`,
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addActionRowComponents(actionRow)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("-# Miami Roleplay © 2026 | Automod"),
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

async function sendBlockedWordAlert(
  message: Message,
  violation: Violation,
  purgedRecentMessages: number,
): Promise<void> {
  if (!message.guild) {
    return;
  }

  const alertChannel = message.guild.channels.cache.get(BLOCKED_WORD_ALERT_CHANNEL_ID)
    ?? await message.guild.channels.fetch(BLOCKED_WORD_ALERT_CHANNEL_ID).catch(() => null);

  if (!alertChannel?.isTextBased() || !("send" in alertChannel)) {
    return;
  }

  await alertChannel.send({
    content: `<@&${BLOCKED_WORD_ALERT_ROLE_ID}>`,
    allowedMentions: {
      parse: [],
      roles: [BLOCKED_WORD_ALERT_ROLE_ID],
      users: [],
    },
  }).catch(() => null);

  await alertChannel.send(
    buildBlockedWordAlertPanel(message, violation, purgedRecentMessages) as any,
  ).catch(() => null);
}

async function logViolation(
  message: Message,
  violation: Violation,
  warningCount: number,
  didTimeout: boolean,
): Promise<void> {
  const kind =
    violation.type === "invite" || violation.type === "link"
      ? "link_block"
      : violation.type === "mention_spam" ||
          violation.type === "caps_spam" ||
          violation.type === "rapid_spam" ||
          violation.type === "duplicate_spam"
        ? "message_spam"
        : "automod";

  await logAutomodByKind(
    message,
    kind,
    kind === "link_block"
      ? "Link Block Action"
      : kind === "message_spam"
        ? "Message Spam Action"
        : "Automod Action",
    [
      `**Member** - ${message.author.tag} (\`${message.author.id}\`)\n**Channel** - ${message.channel}\n**Rule** - *${violation.type}*`,
      `**Reason** - *${violation.reason}*\n**Warnings** - *${warningCount}*\n**Details** - *${violation.details}*`,
      `**Captured Content**\n*${truncate(message.content || "[no text content]", 1000)}*`,
      `**Timeout Status** - *${didTimeout ? "Member timed out by automod." : "No timeout was applied."}*`,
    ],
    didTimeout ? "Timed Out" : violation.shouldDelete ? "Message Removed" : "Message Flagged",
    didTimeout ? "🔇" : violation.shouldDelete ? "🗑️" : "📌",
  );
}

async function maybeTimeoutMember(
  message: Message,
  violation: Violation,
  warningCount: number,
): Promise<boolean> {
  if (!message.member || !violation.shouldTimeout) {
    return false;
  }

  if (warningCount < config.automod.maxWarningsBeforeTimeout) {
    return false;
  }

  if (!message.member.moderatable) {
    return false;
  }

  await message.member.timeout(
    config.automod.timeoutDurationMs,
    `Automod: ${violation.reason}`,
  );
  warningCache.delete(getCacheKey(message.guildId!, message.author.id));
  return true;
}

async function maybeBanMember(
  message: Message,
  violation: Violation,
): Promise<boolean> {
  if (!violation.shouldBan || !message.guild || !message.member) {
    return false;
  }

  if (!message.member.bannable) {
    return false;
  }

  let didBan = true;
  await message.guild.members.ban(message.author.id, {
    reason: `Automod: ${violation.reason}`,
    deleteMessageSeconds: 0,
  }).catch(() => {
    didBan = false;
    return null;
  });

  return didBan;
}

async function purgeRecentMessagesForMember(message: Message, days: number): Promise<number> {
  if (!message.guild) {
    return 0;
  }

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  let deletedCount = 0;

  for (const channel of message.guild.channels.cache.values()) {
    if (channel.type !== ChannelType.GuildText || !("messages" in channel)) {
      continue;
    }

    const me = message.guild.members.me;
    if (!me) {
      continue;
    }

    const permissions = channel.permissionsFor(me);
    if (!permissions?.has(PermissionsBitField.Flags.ManageMessages) || !permissions.has(PermissionsBitField.Flags.ViewChannel)) {
      continue;
    }

    const recentMessages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
    if (!recentMessages) {
      continue;
    }

    for (const entry of recentMessages.values()) {
      if (
        entry.author.id !== message.author.id ||
        entry.id === message.id ||
        entry.createdTimestamp < cutoff ||
        !entry.deletable
      ) {
        continue;
      }

      const deleted = await entry.delete().then(() => true).catch(() => false);
      if (deleted) {
        deletedCount += 1;
      }
    }
  }

  return deletedCount;
}

export async function handleAutomodMessage(message: Message): Promise<void> {
  if (
    message.author.bot ||
    !message.inGuild() ||
    !config.automod.enabled ||
    hasAutomodBypass(message)
  ) {
    return;
  }

  const violation = evaluateViolation(message);

  if (!violation) {
    return;
  }

  try {
    const warningCount = violation.shouldWarn
      ? addWarning(message.guildId!, message.author.id)
      : 0;

    if (violation.shouldWarn) {
      await sendWarning(
        message,
        message.channel,
        message.member?.displayName ?? message.author.username,
        violation.reason,
        warningCount,
        violation.type,
      );
    }

    if (violation.shouldDelete && message.deletable) {
      await message.delete().catch(() => null);
    }

    let purgedRecentMessages = 0;
    if (violation.type === "blocked_word") {
      purgedRecentMessages = await purgeRecentMessagesForMember(message, 30);
      violation.details = `${violation.details} Removed ${purgedRecentMessages} recent message(s) from accessible channels in the last 30 days.`;
      await sendBlockedWordAlert(message, violation, purgedRecentMessages);
    }

    const didBan = await maybeBanMember(message, violation);
    const didTimeout = await maybeTimeoutMember(message, violation, warningCount);

    await logViolation(message, violation, warningCount, didTimeout);
    if (didBan && message.member) {
      await logPunishmentAction(
        message.member,
        message.author.id,
        "Ban",
        `Automod: ${violation.reason}`,
      );
      await logAutomodByKind(
        message,
        "automod",
        "Automod Ban Issued",
        [
          `**Member** - ${message.author.tag} (\`${message.author.id}\`)`,
          `**Reason** - *${violation.reason}*`,
          `**Details** - *${violation.details}*`,
          `**Action** - *The message was deleted and the member was banned automatically.*`,
        ],
        "Ban Issued",
        "🔨",
      );
    }
  } catch (error: unknown) {
    console.error("Failed to enforce automod rule.");
    console.error(error);
  }
}
