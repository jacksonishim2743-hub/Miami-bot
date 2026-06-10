import fs from "node:fs";
import path from "node:path";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  GuildMember,
  Message,
  MessageFlags,
  SeparatorBuilder,
  TextChannel,
  TextDisplayBuilder,
} from "discord.js";
import { buildTrackedReasonField, finalizeTrackedReason } from "./reasontracker.js";
import { logPunishmentAction } from "./serverlogs.js";

const MOD_MANAGER_ROLE_ID = "1490006597328699522";
const SETTINGS_PATH = path.join(process.cwd(), "moderation-settings.json");

type GuildModerationSettings = {
  banLogChannelId: string | null;
  kickLogChannelId: string | null;
};

type SettingsStore = Record<string, GuildModerationSettings>;

const defaultSettings: GuildModerationSettings = {
  banLogChannelId: null,
  kickLogChannelId: null,
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

function getSettings(guildId: string): GuildModerationSettings {
  if (!settingsStore[guildId]) {
    settingsStore[guildId] = { ...defaultSettings };
  }

  return settingsStore[guildId];
}

function hasManagerRole(member: GuildMember | null): boolean {
  if (!member) {
    return false;
  }

  return (
    member.roles.cache.has(MOD_MANAGER_ROLE_ID) ||
    member.permissions.has("Administrator")
  );
}

function extractChannelId(input: string): string | null {
  const match = input.match(/^<?#?(\d{15,25})>?$/);
  return match?.[1] ?? null;
}

function extractUserId(input: string): string | null {
  const match = input.match(/^<@!?(\d{15,25})>$|^(\d{15,25})$/);
  return match?.[1] ?? match?.[2] ?? null;
}

function formatModeratorLabel(moderator: GuildMember): string {
  return `${moderator.user.tag} (\`${moderator.id}\`)`;
}

function buildModLogPanel(
  title: string,
  moderator: GuildMember,
  targetId: string,
  reasonText: string,
  actionLabel: string,
) {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`modlog:${actionLabel}:${targetId}`)
      .setLabel(actionLabel)
      .setEmoji(
        actionLabel === "Ban Issued"
          ? "🔨"
          : actionLabel === "Unban Issued"
            ? "🔓"
            : "👢",
      )
      .setStyle(
        actionLabel === "Ban Issued"
          ? ButtonStyle.Danger
          : ButtonStyle.Secondary,
      )
      .setDisabled(true),
  );

  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `## ${title}`,
          "",
          `**Target** - *User ID:* \`${targetId}\``,
          `**Moderator** - ${formatModeratorLabel(moderator)}`,
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          reasonText,
          `**Server** - *${moderator.guild.name}*`,
          `**Timestamp** - <t:${Math.floor(Date.now() / 1000)}:F>`,
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addActionRowComponents(row)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("-# Miami Roleplay © 2026 | Moderation"),
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

function buildUnbanDmPanel(
  guildName: string,
  moderator: GuildMember,
  reason: string,
) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "## Unban Notice",
          "",
          "*You have been unbanned and may rejoin the server if you choose to.*",
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `**Server** - *${guildName}*`,
          `**Handled By** - ${formatModeratorLabel(moderator)}`,
          `**Reason** - *${reason || "No reason provided."}*`,
        ].join("\n"),
      ),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("-# Miami Roleplay © 2026 | Moderation"),
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

async function sendLog(
  guildId: string,
  channelId: string | null,
  sourceGuildMember: GuildMember,
  panel: ReturnType<typeof buildModLogPanel>,
  entryId: string | null,
): Promise<void> {
  if (!channelId) {
    return;
  }

  const channel = sourceGuildMember.guild.channels.cache.get(channelId)
    ?? await sourceGuildMember.guild.channels.fetch(channelId).catch(() => null);

  if (!(channel instanceof TextChannel)) {
    return;
  }

  const sentMessage = await channel.send(panel).catch(() => null);
  if (sentMessage) {
    finalizeTrackedReason(entryId, guildId, channel.id, sentMessage.id, "Reason");
  }
}

export async function handleModerationPrefixCommand(message: Message, rawContent: string): Promise<boolean> {
  const normalized = rawContent.trim();
  if (!normalized) {
    return false;
  }

  const lower = normalized.toLowerCase();
  const isCommand =
    lower.startsWith("set-ban-log") ||
    lower.startsWith("setbanlog") ||
    lower.startsWith("set-kick-log") ||
    lower.startsWith("setkicklog") ||
    lower.startsWith("ban ") ||
    lower === "ban" ||
    lower.startsWith("unban ") ||
    lower === "unban" ||
    lower.startsWith("kick ") ||
    lower === "kick";

  if (!isCommand) {
    return false;
  }

  if (!message.inGuild() || !message.member || !hasManagerRole(message.member)) {
    await message.delete().catch(() => null);
    return true;
  }

  const settings = getSettings(message.guildId!);

  if (lower.startsWith("set-ban-log") || lower.startsWith("setbanlog")) {
    const channelId = extractChannelId(normalized.split(/\s+/).slice(1).join(" ").trim());
    if (!channelId) {
      await message.reply("Use a channel mention or channel ID for the ban log channel.");
      return true;
    }

    settings.banLogChannelId = channelId;
    saveSettings();
    await message.reply(`Ban log channel set to <#${channelId}>.`);
    return true;
  }

  if (lower.startsWith("set-kick-log") || lower.startsWith("setkicklog")) {
    const channelId = extractChannelId(normalized.split(/\s+/).slice(1).join(" ").trim());
    if (!channelId) {
      await message.reply("Use a channel mention or channel ID for the kick log channel.");
      return true;
    }

    settings.kickLogChannelId = channelId;
    saveSettings();
    await message.reply(`Kick log channel set to <#${channelId}>.`);
    return true;
  }

  if (lower === "ban" || lower.startsWith("ban ")) {
    const [, targetRaw, ...reasonParts] = normalized.split(/\s+/);
    const targetId = extractUserId(targetRaw ?? "");
    const reason = reasonParts.join(" ").trim() || "No reason provided.";

    if (!targetId) {
      await message.reply("Use `-ban <user_id or @user> <reason>`.");
      return true;
    }

    if (targetId === message.author.id) {
      await message.reply("You cannot ban yourself.");
      return true;
    }

    let didBan = true;
    await message.guild.members.ban(targetId, {
      reason: `${reason} | By ${message.author.tag}`,
      deleteMessageSeconds: 0,
    }).catch(async (error) => {
      didBan = false;
      console.error("Failed to ban member.");
      console.error(error);
      await message.reply("I could not ban that user. Check my permissions and role position.");
    });

    if (!didBan) {
      return true;
    }

    const trackedReason = buildTrackedReasonField("Reason", reason);
    await sendLog(
      message.guildId!,
      settings.banLogChannelId,
      message.member,
      buildModLogPanel("Member Banned", message.member, targetId, trackedReason.text, "Ban Issued"),
      trackedReason.entryId,
    );
    await logPunishmentAction(message.member, targetId, "Ban", reason);
    await message.delete().catch(() => null);
    return true;
  }

  if (lower === "unban" || lower.startsWith("unban ")) {
    const [, targetRaw, ...reasonParts] = normalized.split(/\s+/);
    const targetId = extractUserId(targetRaw ?? "");
    const reason = reasonParts.join(" ").trim() || "No reason provided.";

    if (!targetId) {
      await message.reply("Use `-unban <user_id> <reason>`.");
      return true;
    }

    const bannedUser = await message.client.users.fetch(targetId).catch(() => null);
    await bannedUser?.send(
      buildUnbanDmPanel(message.guild.name, message.member, reason) as any,
    ).catch(() => null);

    let didUnban = true;
    await message.guild.members.unban(targetId, `${reason} | By ${message.author.tag}`).catch(async (error) => {
      didUnban = false;
      console.error("Failed to unban member.");
      console.error(error);
      await message.reply("I could not unban that user. Check the ID and my permissions.");
    });

    if (!didUnban) {
      return true;
    }

    const trackedReason = buildTrackedReasonField("Reason", reason);
    await sendLog(
      message.guildId!,
      settings.banLogChannelId,
      message.member,
      buildModLogPanel("Member Unbanned", message.member, targetId, trackedReason.text, "Unban Issued"),
      trackedReason.entryId,
    );
    await logPunishmentAction(message.member, targetId, "Unban", reason);
    await message.delete().catch(() => null);
    return true;
  }

  if (lower === "kick" || lower.startsWith("kick ")) {
    const [, targetRaw, ...reasonParts] = normalized.split(/\s+/);
    const targetId = extractUserId(targetRaw ?? "");
    const reason = reasonParts.join(" ").trim() || "No reason provided.";

    if (!targetId) {
      await message.reply("Use `-kick <user_id or @user> <reason>`.");
      return true;
    }

    if (targetId === message.author.id) {
      await message.reply("You cannot kick yourself.");
      return true;
    }

    const memberToKick = await message.guild.members.fetch(targetId).catch(() => null);
    if (!memberToKick) {
      await message.reply("That member is not currently in the server.");
      return true;
    }

    if (!memberToKick.kickable) {
      await message.reply("I could not kick that member. Check my permissions and role position.");
      return true;
    }

    let didKick = true;
    await memberToKick.kick(`${reason} | By ${message.author.tag}`).catch(async (error) => {
      didKick = false;
      console.error("Failed to kick member.");
      console.error(error);
      await message.reply("I could not kick that member. Check my permissions and role position.");
    });

    if (!didKick) {
      return true;
    }

    const trackedReason = buildTrackedReasonField("Reason", reason);
    await sendLog(
      message.guildId!,
      settings.kickLogChannelId,
      message.member,
      buildModLogPanel("Member Kicked", message.member, targetId, trackedReason.text, "Kick Issued"),
      trackedReason.entryId,
    );
    await logPunishmentAction(message.member, targetId, "Kick", reason);
    await message.delete().catch(() => null);
    return true;
  }

  return false;
}
