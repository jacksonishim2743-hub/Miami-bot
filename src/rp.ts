import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
  TextChannel,
  TextDisplayBuilder,
  User,
} from "discord.js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fetchQueueStatus, runErlcServerCommand } from "./erlc.js";

const RP_STATE_FILE = resolve(process.cwd(), "rp-state.json");

type RpOption = {
  key: string;
  label: string;
  emoji: string;
  infoLabel: string;
  gameMessage: string;
};

type RpState = {
  currentKey: string;
  currentLabel: string;
  changedById: string;
  changedByTag: string;
  changedAt: number;
};

const RP_OPTIONS: RpOption[] = [
  {
    key: "lake_roleplay",
    label: "🏕️ Lake Roleplay",
    emoji: "🏕️",
    infoLabel: "Lake Roleplay",
    gameMessage: ":m 🏕️ RP Change: Lake RP is active. Head to the lake area now and stage up there.",
  },
  {
    key: "housing_suburbs",
    label: "🏘️ Housing Suburbs",
    emoji: "🏘️",
    infoLabel: "Housing Suburbs",
    gameMessage: ":m 🏘️ RP Change: Housing/Suburbs RP is active. Please move into the neighborhood area now.",
  },
  {
    key: "highway_55",
    label: "🛣️ Highway 55",
    emoji: "🛣️",
    infoLabel: "Highway 55",
    gameMessage: ":m 🛣️ RP Change: Highway 55 RP is active. Make your way to Highway 55 and patrol there.",
  },
  {
    key: "farms",
    label: "🌾 Farms",
    emoji: "🌾",
    infoLabel: "Farms",
    gameMessage: ":m 🌾 RP Change: Farms RP is active. Please head to the farm area and set your scenes there.",
  },
  {
    key: "springfield",
    label: "🏙️ Springfield",
    emoji: "🏙️",
    infoLabel: "Springfield",
    gameMessage: ":m 🏙️ RP Change: Springfield RP is active. Please move into Springfield and keep scenes there.",
  },
  {
    key: "miami",
    label: "🌴 Miami",
    emoji: "🌴",
    infoLabel: "Miami",
    gameMessage: ":m 🌴 RP Change: Miami RP is active. Head into Miami now and keep activity in that area.",
  },
  {
    key: "whole_map",
    label: "🗺️ Whole Map",
    emoji: "🗺️",
    infoLabel: "Whole Map",
    gameMessage: ":m 🗺️ RP Change: Whole Map RP is active. You may scene anywhere, keep it realistic and organized.",
  },
  {
    key: "server_restart",
    label: "🔁 Server Restart",
    emoji: "🔁",
    infoLabel: "Server Restart",
    gameMessage: ":m 🔁 Server restart RP is active. Please prepare for a restart and wrap scenes up safely now.",
  },
  {
    key: "high_rock_park",
    label: "🏞️ High Rock Park",
    emoji: "🏞️",
    infoLabel: "High Rock Park",
    gameMessage: ":m 🏞️ RP Change: High Rock Park RP is active. Please head to High Rock Park for scenes now.",
  },
];

function buildQueuePanel(queueValue: string, currentPlayersValue: string, statusLine?: string) {
  const lines = [
    "## Queue Size",
    "",
    "**Hello, welcome to Miami City Roleplay below will tell you the number of people that are in queue!**",
    "",
    `**Queue Size** \`-\` ${queueValue}`,
    `**Current Players** \`-\` ${currentPlayersValue}`,
  ];

  if (statusLine) {
    lines.push("", `*Status:* ${statusLine}`);
  }

  lines.push("", "-# Offical Miami City Roleplay | Queue Size");

  return {
    components: [
      new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent(lines.join("\n")),
      ),
    ],
    flags: MessageFlags.IsComponentsV2,
  };
}

async function readRpState(): Promise<RpState | null> {
  try {
    const raw = await readFile(RP_STATE_FILE, "utf8");
    return JSON.parse(raw) as RpState;
  } catch {
    return null;
  }
}

export async function readCurrentRpState(): Promise<RpState | null> {
  return readRpState();
}

async function writeRpState(state: RpState): Promise<void> {
  await mkdir(dirname(RP_STATE_FILE), { recursive: true });
  await writeFile(RP_STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

export function getRpOptionByKey(key: string): RpOption | null {
  return RP_OPTIONS.find((option) => option.key === key) ?? null;
}

export async function handleQueueCommand(channel: TextChannel): Promise<void> {
  const result = await fetchQueueStatus();
  if (result.ok) {
    await channel.send(buildQueuePanel(String(result.queueSize), String(result.currentPlayers)) as any);
    return;
  }

  await channel.send(buildQueuePanel("Unavailable right now", "Unavailable right now", result.message) as any);
}

export async function postRpChangeMessage(channel: TextChannel): Promise<void> {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("rpchange:select")
    .setPlaceholder("Choose the next Roleplay")
    .addOptions(
      RP_OPTIONS.map((option) => ({
        label: option.infoLabel,
        value: option.key,
        emoji: option.emoji,
      })),
    );

  await channel.send({
    content: "🔥 *Select the next Roleplay for the server.*",
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
  });
}

export async function applyRpChange(
  key: string,
  user: User,
): Promise<
  | { ok: true; option: RpOption; warning?: string }
  | { ok: false; message: string }
> {
  const option = getRpOptionByKey(key);
  if (!option) {
    return { ok: false, message: "That RP option is no longer valid." };
  }

  await writeRpState({
    currentKey: option.key,
    currentLabel: option.infoLabel,
    changedById: user.id,
    changedByTag: user.tag,
    changedAt: Date.now(),
  });

  const result = await runErlcServerCommand(option.gameMessage);
  if (!result.ok) {
    return {
      ok: true,
      option,
      warning: "The RP was updated, but the ERLC server did not accept the in-game message right now.",
    };
  }

  return { ok: true, option };
}

function formatElapsed(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours} hours, ${minutes} minutes, ${seconds} seconds`;
}

export async function buildRpInfoMessage(): Promise<string> {
  const state = await readRpState();
  if (!state) {
    return [
      `**Current RP:** \`🗺️ RP: Not Set Yet\``,
      `*RP has not been changed yet by any staff member.*`,
    ].join("\n");
  }

  const elapsed = formatElapsed(Date.now() - state.changedAt);

  return [
    `**Current RP:** \`${getRpOptionByKey(state.currentKey)?.emoji ?? "🗺️"} RP: ${state.currentLabel}\``,
    `*RP was changed* **${elapsed} ago** *by* **${state.changedByTag}**`,
  ].join("\n");
}
