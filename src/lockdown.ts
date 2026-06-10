import {
  ChannelType,
  ContainerBuilder,
  Message,
  MessageFlags,
  PermissionsBitField,
  SeparatorBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { buildTrackedReasonField, finalizeTrackedReason } from "./reasontracker.js";

const LOCKDOWN_MANAGER_ROLE_ID = "1490006597328699522";

function hasManagerRole(message: Message): boolean {
  return (
    !!message.member &&
    (message.member.roles.cache.has(LOCKDOWN_MANAGER_ROLE_ID) ||
      message.member.permissions.has(PermissionsBitField.Flags.Administrator))
  );
}

function buildLockdownPanel(title: string, reasonText: string) {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          `## ${title}`,
          "",
          reasonText,
        ].join("\n"),
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("-# Miami Roleplay © 2026 | Server Lockdown"),
    );

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
}

async function setGuildLockdown(message: Message, locked: boolean): Promise<void> {
  const channels = Array.from(message.guild!.channels.cache.values()).filter(
    (channel) =>
      channel.type === ChannelType.GuildText ||
      channel.type === ChannelType.GuildAnnouncement,
  );

  await Promise.all(
    channels.map(async (channel) => {
      await channel.permissionOverwrites.edit(message.guild!.roles.everyone, {
        SendMessages: locked ? false : null,
      }).catch(() => null);
    }),
  );
}

export async function handleLockdownPrefixCommand(message: Message, rawContent: string): Promise<boolean> {
  const normalized = rawContent.trim();
  const lower = normalized.toLowerCase();
  const isLockdownCommand =
    lower.startsWith("lockdown ") ||
    lower === "lockdown" ||
    lower.startsWith("end lockdown");

  if (!isLockdownCommand) {
    return false;
  }

  if (!message.inGuild() || !hasManagerRole(message)) {
    await message.delete().catch(() => null);
    return true;
  }

  if (lower === "lockdown" || lower.startsWith("lockdown ")) {
    const reason = normalized.slice("lockdown".length).trim() || "No reason provided.";
    const trackedReason = buildTrackedReasonField("Reason", reason);
    await setGuildLockdown(message, true);
    await message.delete().catch(() => null);
    const panel = await message.channel.send(
      buildLockdownPanel("Server Lockdown Enabled", trackedReason.text),
    ).catch(() => null);
    if (panel) {
      finalizeTrackedReason(trackedReason.entryId, message.guildId!, panel.channelId, panel.id, "Reason");
      setTimeout(() => {
        void panel.delete().catch(() => null);
      }, 10_000);
    }
    return true;
  }

  const reason = normalized.slice("end lockdown".length).trim() || "No reason provided.";
  const trackedReason = buildTrackedReasonField("Reason", reason);
  await setGuildLockdown(message, false);
  await message.delete().catch(() => null);
  const panel = await message.channel.send(
    buildLockdownPanel("Server Lockdown Lifted", trackedReason.text),
  ).catch(() => null);
  if (panel) {
    finalizeTrackedReason(trackedReason.entryId, message.guildId!, panel.channelId, panel.id, "Reason");
    setTimeout(() => {
      void panel.delete().catch(() => null);
    }, 10_000);
  }
  return true;
}
