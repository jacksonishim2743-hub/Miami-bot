import fs from "node:fs";
import path from "node:path";
import { Client, Message } from "discord.js";

const REASON_TRACKER_PATH = path.join(process.cwd(), "reason-tracker.json");

type ReasonEntry = {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string;
  fieldLabel: string;
  createdAt: number;
  updatedAt: number | null;
};

type ReasonStore = Record<string, ReasonEntry>;

function loadReasonStore(): ReasonStore {
  try {
    if (!fs.existsSync(REASON_TRACKER_PATH)) {
      return {};
    }

    const raw = fs.readFileSync(REASON_TRACKER_PATH, "utf8");
    return (JSON.parse(raw) as ReasonStore) ?? {};
  } catch {
    return {};
  }
}

const reasonStore = loadReasonStore();

function saveReasonStore(): void {
  fs.writeFileSync(REASON_TRACKER_PATH, JSON.stringify(reasonStore, null, 2), "utf8");
}

function normalizeReason(reason: string): string {
  const trimmed = reason.trim();
  return trimmed || "No reason provided.";
}

function generateReasonId(): string {
  let id = "";
  do {
    id = Math.floor(100000 + Math.random() * 900000).toString();
  } while (reasonStore[id]);

  return id;
}

export function buildTrackedReasonField(
  fieldLabel: string,
  reason: string,
): { entryId: string | null; text: string } {
  const normalizedReason = normalizeReason(reason);
  const needsTracking = normalizedReason === "No reason provided.";
  const entryId = needsTracking ? generateReasonId() : null;
  const lines = [`**${fieldLabel}** - *${normalizedReason}*`];

  if (entryId) {
    lines.push(`-# Reason ID: \`${entryId}\``);
  }

  return {
    entryId,
    text: lines.join("\n"),
  };
}

export function finalizeTrackedReason(
  entryId: string | null,
  guildId: string,
  channelId: string,
  messageId: string,
  fieldLabel: string,
): void {
  if (!entryId) {
    return;
  }

  reasonStore[entryId] = {
    id: entryId,
    guildId,
    channelId,
    messageId,
    fieldLabel,
    createdAt: Date.now(),
    updatedAt: null,
  };
  saveReasonStore();
}

function rewriteReasonContent(
  content: string,
  fieldLabel: string,
  reasonId: string,
  newReason: string,
): { content: string; updated: boolean } {
  const lines = content.split("\n");
  let updated = false;
  const nextLines: string[] = [];

  for (const line of lines) {
    if (line.trim() === `-# Reason ID: \`${reasonId}\``) {
      updated = true;
      continue;
    }

    if (line.startsWith(`**${fieldLabel}** - `)) {
      nextLines.push(`**${fieldLabel}** - *${newReason}*`);
      updated = true;
      continue;
    }

    nextLines.push(line);
  }

  return {
    content: nextLines.join("\n"),
    updated,
  };
}

function rewriteComponentPayload(
  value: unknown,
  fieldLabel: string,
  reasonId: string,
  newReason: string,
): { value: unknown; updated: boolean } {
  if (Array.isArray(value)) {
    let updated = false;
    const nextValue = value.map((entry) => {
      const result = rewriteComponentPayload(entry, fieldLabel, reasonId, newReason);
      updated = updated || result.updated;
      return result.value;
    });

    return { value: nextValue, updated };
  }

  if (!value || typeof value !== "object") {
    return { value, updated: false };
  }

  const nextValue: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  let updated = false;

  if (typeof nextValue.content === "string") {
    const result = rewriteReasonContent(nextValue.content, fieldLabel, reasonId, newReason);
    nextValue.content = result.content;
    updated = updated || result.updated;
  }

  if (Array.isArray(nextValue.components)) {
    const result = rewriteComponentPayload(nextValue.components, fieldLabel, reasonId, newReason);
    nextValue.components = result.value as Record<string, unknown>[];
    updated = updated || result.updated;
  }

  return {
    value: nextValue,
    updated,
  };
}

export async function applyReasonUpdate(
  client: Client,
  guildId: string,
  reasonId: string,
  newReason: string,
): Promise<"updated" | "not_found" | "message_missing" | "unchanged"> {
  const entry = reasonStore[reasonId];
  if (!entry || entry.guildId !== guildId) {
    return "not_found";
  }

  const guild = client.guilds.cache.get(entry.guildId)
    ?? await client.guilds.fetch(entry.guildId).catch(() => null);
  if (!guild) {
    return "message_missing";
  }

  const channel = guild.channels.cache.get(entry.channelId)
    ?? await guild.channels.fetch(entry.channelId).catch(() => null);
  if (!channel?.isTextBased() || !("messages" in channel)) {
    return "message_missing";
  }

  const message = await channel.messages.fetch(entry.messageId).catch(() => null);
  if (!message) {
    return "message_missing";
  }

  const serializedComponents = message.components.map((component) => component.toJSON());
  const result = rewriteComponentPayload(
    serializedComponents,
    entry.fieldLabel,
    reasonId,
    newReason.trim(),
  );

  if (!result.updated) {
    return "unchanged";
  }

  await message.edit({
    allowedMentions: {
      parse: [],
      roles: [],
      users: [],
    },
    components: result.value as Message["components"],
  }).catch(() => null);

  reasonStore[reasonId] = {
    ...entry,
    updatedAt: Date.now(),
  };
  saveReasonStore();
  return "updated";
}
