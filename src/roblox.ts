import {
  ContainerBuilder,
  Guild,
  MessageFlags,
  TextDisplayBuilder,
  User,
} from "discord.js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROBLOX_LINKS_FILE = resolve(process.cwd(), "roblox-links.json");

type RobloxLinkStore = Record<string, string>;

type RobloxLookupResponse = {
  data?: Array<{
    id?: number;
    name?: string;
    displayName?: string;
  }>;
};

type RobloxUserResponse = {
  id: number;
  name: string;
  displayName: string;
  description: string;
  created: string;
  isBanned: boolean;
  hasVerifiedBadge?: boolean;
};

type RobloxThumbnailResponse = {
  data?: Array<{
    imageUrl?: string;
  }>;
};

function readRobloxLinks(): RobloxLinkStore {
  if (!existsSync(ROBLOX_LINKS_FILE)) {
    return {};
  }

  try {
    return JSON.parse(readFileSync(ROBLOX_LINKS_FILE, "utf8")) as RobloxLinkStore;
  } catch {
    return {};
  }
}

export function getLinkedRobloxId(discordUserId: string): string | null {
  const links = readRobloxLinks();
  return links[discordUserId] ?? null;
}

function extractDiscordId(input: string): string | null {
  const match = input.trim().match(/^<@!?(\d+)>$|^(\d+)$/);
  return match ? match[1] ?? match[2] ?? null : null;
}

export async function resolveDiscordTarget(
  guild: Guild,
  input: string,
): Promise<User | null> {
  const explicitId = extractDiscordId(input);
  if (explicitId) {
    const member = await guild.members.fetch(explicitId).catch(() => null);
    return member?.user ?? null;
  }

  const lowered = input.trim().toLowerCase();
  const cached = guild.members.cache.find((member) =>
    member.user.username.toLowerCase() === lowered ||
    member.displayName.toLowerCase() === lowered ||
    member.user.tag.toLowerCase() === lowered,
  );

  return cached?.user ?? null;
}

export type RobloxUserInfo =
  | {
      ok: true;
      userId: number;
      username: string;
      displayName: string;
      description: string;
      created: string;
      isBanned: boolean;
      verified: boolean;
      avatarUrl: string | null;
    }
  | { ok: false; message: string };

export async function fetchRobloxUserInfoByUsername(username: string): Promise<RobloxUserInfo> {
  const cleanedUsername = username.trim().replace(/^@/, "");
  if (!cleanedUsername) {
    return { ok: false, message: "Please provide a Roblox username." };
  }

  try {
    const lookupResponse = await fetch("https://users.roblox.com/v1/usernames/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        usernames: [cleanedUsername],
        excludeBannedUsers: false,
      }),
    });

    if (!lookupResponse.ok) {
      return { ok: false, message: `Roblox lookup failed with HTTP ${lookupResponse.status}.` };
    }

    const lookupData = await lookupResponse.json() as RobloxLookupResponse;
    const match = lookupData.data?.[0];
    if (!match?.id) {
      return { ok: false, message: "I could not find that Roblox user." };
    }

    const [userResponse, thumbnailResponse] = await Promise.all([
      fetch(`https://users.roblox.com/v1/users/${match.id}`),
      fetch(
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${match.id}&size=420x420&format=Png&isCircular=false`,
      ),
    ]);

    if (!userResponse.ok) {
      return { ok: false, message: `Roblox user info failed with HTTP ${userResponse.status}.` };
    }

    const userData = await userResponse.json() as RobloxUserResponse;
    const thumbnailData = thumbnailResponse.ok
      ? (await thumbnailResponse.json() as RobloxThumbnailResponse)
      : null;

    return {
      ok: true,
      userId: userData.id,
      username: userData.name,
      displayName: userData.displayName,
      description: userData.description || "No Roblox description was provided.",
      created: userData.created,
      isBanned: userData.isBanned,
      verified: Boolean(userData.hasVerifiedBadge),
      avatarUrl: thumbnailData?.data?.[0]?.imageUrl ?? null,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Unknown error while contacting Roblox.",
    };
  }
}

export function buildRobloxUserInfoPanel(info: Extract<RobloxUserInfo, { ok: true }>) {
  return {
    components: [
      new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          [
            "## Roblox User Information",
            "",
            `**Username** - *${info.username}*`,
            `**Display Name** - *${info.displayName}*`,
            `**Roblox ID** - \`${info.userId}\``,
            `**Created** - *${new Date(info.created).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}*`,
            `**Verified Badge** - *${info.verified ? "Yes" : "No"}*`,
            `**Banned** - *${info.isBanned ? "Yes" : "No"}*`,
            "",
            "**Description**",
            `*${info.description}*`,
            ...(info.avatarUrl ? ["", `**Avatar** - ${info.avatarUrl}`] : []),
            "",
            "-# Miami Roleplay © 2026 | Roblox Information",
          ].join("\n"),
        ),
      ),
    ],
    flags: MessageFlags.IsComponentsV2,
  };
}

export function buildDiscordIdMessage(user: User): string {
  return `*Heres their \`${user.id}\`*`;
}

export function buildRobloxIdMessage(userId: string, robloxId: string | null): string {
  return robloxId
    ? `*Heres their \`${robloxId}\`*`
    : `*No linked Roblox ID was found for Discord user \`${userId}\`.*`;
}

export function buildOwnRobloxIdMessage(discordUserId: string): string {
  const robloxId = getLinkedRobloxId(discordUserId);
  return robloxId
    ? `*Heres your \`${robloxId}\`*`
    : `*No linked Roblox ID was found for your Discord user \`${discordUserId}\`.*`;
}
