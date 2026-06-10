import { EmbedBuilder } from "discord.js";
import { config } from "./config.js";

type ServerInfoResponse = {
  Name?: string;
  CurrentPlayers?: number | unknown[];
  MaxPlayers?: number;
  Queue?: unknown[] | { Players?: unknown[] };
  message?: string;
  code?: number;
};

type QueueResult =
  | { ok: true; embed: EmbedBuilder }
  | { ok: false; message: string };

export type QueueStatusResult =
  | { ok: true; queueSize: number; currentPlayers: number }
  | { ok: false; message: string };

function buildApiErrorMessage(status: number, code?: number, fallback?: string): string {
  if (status === 403) {
    if (code === 2000) {
      return "ERLC says the Server-Key is missing. Re-check your .env entry and restart the bot.";
    }
    if (code === 2001) {
      return "ERLC says the Server-Key format is invalid. Re-copy the private server API key and save it in .env.";
    }
    if (code === 2002) {
      return "ERLC says the Server-Key is invalid or expired. Generate a fresh server key in your private server settings.";
    }
    if (code === 2004) {
      return "ERLC says this Server-Key is banned from API access. You will need to contact ERLC support.";
    }
    return "ERLC rejected the request. Make sure your private server has the API pack and that the server key is correct.";
  }

  return fallback ?? `ERLC API request failed with HTTP ${status}.`;
}

function getQueueEntries(data: ServerInfoResponse): unknown[] {
  if (Array.isArray(data.Queue)) {
    return data.Queue;
  }

  if (data.Queue && typeof data.Queue === "object" && Array.isArray(data.Queue.Players)) {
    return data.Queue.Players;
  }

  return [];
}

function getCurrentPlayers(data: ServerInfoResponse): number {
  if (typeof data.CurrentPlayers === "number") {
    return data.CurrentPlayers;
  }

  if (Array.isArray(data.CurrentPlayers)) {
    return data.CurrentPlayers.length;
  }

  return 0;
}

export async function fetchQueueStatus(): Promise<QueueStatusResult> {
  if (!config.serverApiKey) {
    return {
      ok: false,
      message: "The ERLC API key is not set in the bot environment.",
    };
  }

  try {
    const response = await fetch("https://api.erlc.gg/v2/server?Queue=true", {
      headers: {
        "server-key": config.serverApiKey,
      },
    });

    const rawText = await response.text();
    const data = rawText
      ? (JSON.parse(rawText) as ServerInfoResponse)
      : {};

    if (!response.ok) {
      return {
        ok: false,
        message: buildApiErrorMessage(response.status, data.code, data.message),
      };
    }

    const queueEntries = getQueueEntries(data);
    const currentPlayers = getCurrentPlayers(data);

    return { ok: true, queueSize: queueEntries.length, currentPlayers };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Unknown error while contacting the ERLC API.",
    };
  }
}

export async function buildQueueEmbed(): Promise<QueueResult> {
  const result = await fetchQueueStatus();
  if (!result.ok) {
    return result;
  }

  const embed = new EmbedBuilder()
    .setDescription(
      "**Hello, welcome to Miami City Roleplay below will tell you the number of people that are in queue!**",
    )
    .setColor(0xf47fb8)
    .addFields(
      { name: "**Queue Size**", value: `\`-\` ${result.queueSize}`, inline: false },
      { name: "Current Players", value: `\`-\` ${result.currentPlayers}`, inline: false },
    )
    .setFooter({ text: "Offical Miami City Roleplay | Queue Size" });

  return { ok: true, embed };
}

export async function runErlcServerCommand(
  command: string,
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  if (!config.serverApiKey) {
    return { ok: false, message: "The ERLC API key is not set in the bot environment." };
  }

  try {
    const response = await fetch("https://api.erlc.gg/v2/server/command", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "server-key": config.serverApiKey,
      },
      body: JSON.stringify({ command }),
    });

    const rawText = await response.text();
    const data = rawText
      ? (JSON.parse(rawText) as ServerInfoResponse)
      : {};

    if (!response.ok) {
      return {
        ok: false,
        message: buildApiErrorMessage(response.status, data.code, data.message),
      };
    }

    return {
      ok: true,
      message: data.message ?? "Success",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Unknown error while contacting the ERLC API.",
    };
  }
}
