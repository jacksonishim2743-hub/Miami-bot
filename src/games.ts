import fs from "node:fs";
import path from "node:path";
import { Message, PermissionsBitField, TextChannel } from "discord.js";

const SETTINGS_PATH = path.resolve(process.cwd(), "game-settings.json");

type GameKey =
  | "trivia"
  | "scramble"
  | "mathchallenge"
  | "hangman"
  | "truefalse"
  | "quickdraw"
  | "memory"
  | "riddle"
  | "typingrace"
  | "wouldyourather";

type HangmanState = {
  word: string;
  masked: string[];
  guesses: Set<string>;
  remaining: number;
};

const hangmanStates = new Map<string, HangmanState>();
const configuredChannels = loadGameChannels();

const gameDefinitions: Record<
  GameKey,
  {
    label: string;
    setupCommand: string;
    playCommand: string;
    testCommand: string;
  }
> = {
  trivia: {
    label: "Trivia",
    setupCommand: "-set-trivia-channel",
    playCommand: "-trivia",
    testCommand: "-testgame trivia",
  },
  scramble: {
    label: "Word Scramble",
    setupCommand: "-set-scramble-channel",
    playCommand: "-scramble",
    testCommand: "-testgame scramble",
  },
  mathchallenge: {
    label: "Math Challenge",
    setupCommand: "-set-math-channel",
    playCommand: "-mathchallenge",
    testCommand: "-testgame mathchallenge",
  },
  hangman: {
    label: "Hangman",
    setupCommand: "-set-hangman-channel",
    playCommand: "-hangman start",
    testCommand: "-testgame hangman",
  },
  truefalse: {
    label: "True or False",
    setupCommand: "-set-truefalse-channel",
    playCommand: "-truefalse",
    testCommand: "-testgame truefalse",
  },
  quickdraw: {
    label: "Quickdraw",
    setupCommand: "-set-quickdraw-channel",
    playCommand: "-quickdraw",
    testCommand: "-testgame quickdraw",
  },
  memory: {
    label: "Memory Sequence",
    setupCommand: "-set-memory-channel",
    playCommand: "-memory",
    testCommand: "-testgame memory",
  },
  riddle: {
    label: "Riddle",
    setupCommand: "-set-riddle-channel",
    playCommand: "-riddle",
    testCommand: "-testgame riddle",
  },
  typingrace: {
    label: "Typing Race",
    setupCommand: "-set-typingrace-channel",
    playCommand: "-typingrace",
    testCommand: "-testgame typingrace",
  },
  wouldyourather: {
    label: "Would You Rather",
    setupCommand: "-set-wouldyourather-channel",
    playCommand: "-wouldyourather",
    testCommand: "-testgame wouldyourather",
  },
};

const triviaQuestions = [
  { question: "What city is known as the Magic City?", answer: "miami" },
  { question: "Which ocean borders Florida?", answer: "atlantic" },
  { question: "How many sides does an octagon have?", answer: "8" },
  { question: "What device do you use to browse the internet on a desk?", answer: "computer" },
  { question: "What color do you get when you mix blue and yellow?", answer: "green" },
];

const scrambleWords = [
  "community",
  "verification",
  "suburbs",
  "realistic",
  "moderation",
  "ownership",
  "support",
  "department",
];

const hangmanWords = [
  "miami",
  "ticket",
  "suburbs",
  "community",
  "support",
  "department",
  "realistic",
  "production",
];

const trueFalseQuestions = [
  { statement: "Miami is in Florida.", answer: true },
  { statement: "Discord is only for voice calls.", answer: false },
  { statement: "A pentagon has five sides.", answer: true },
  { statement: "The moon is bigger than Earth.", answer: false },
  { statement: "Water boils at 100 degrees Celsius.", answer: true },
];

const memorySequences = [
  ["🌴", "🚓", "🌆", "🎟️"],
  ["🩷", "💻", "👑", "📸"],
  ["🚨", "🤝", "🕵️", "🐞"],
  ["🎨", "🧰", "💡", "📑"],
];

const riddles = [
  { prompt: "I have keys but no locks. I have space but no room. You can enter, but you cannot go outside. What am I?", answer: "keyboard" },
  { prompt: "What gets wetter the more it dries?", answer: "towel" },
  { prompt: "What has hands but cannot clap?", answer: "clock" },
  { prompt: "The more of me you take, the more you leave behind. What am I?", answer: "footsteps" },
];

const typingPrompts = [
  "Miami Roleplay keeps the city moving.",
  "Support teams help the server stay organized.",
  "Housing Suburbs is now the active roleplay.",
  "Verification unlocks the rest of the community.",
];

const wouldYouRatherPrompts = [
  "Would you rather patrol the city at night or work EMS during the day?",
  "Would you rather build liveries or design uniforms for the server?",
  "Would you rather win a giveaway or get a custom role?",
  "Would you rather lead a department or run server media?",
];

export const gameCommandLines = [
  "Game Setup Commands",
  "`-set-trivia-channel [#channel]`",
  "`-set-scramble-channel [#channel]`",
  "`-set-math-channel [#channel]`",
  "`-set-hangman-channel [#channel]`",
  "`-set-truefalse-channel [#channel]`",
  "`-set-quickdraw-channel [#channel]`",
  "`-set-memory-channel [#channel]`",
  "`-set-riddle-channel [#channel]`",
  "`-set-typingrace-channel [#channel]`",
  "`-set-wouldyourather-channel [#channel]`",
  "`-game-channels`",
  "`-games`",
  "`-testgame <game>`",
  "",
  "Game Commands",
  "`-trivia`",
  "`-scramble`",
  "`-mathchallenge`",
  "`-hangman start` / `-hangman <letter|word>`",
  "`-truefalse`",
  "`-quickdraw`",
  "`-memory`",
  "`-riddle`",
  "`-typingrace`",
  "`-wouldyourather`",
].join("\n");

function loadGameChannels(): Record<GameKey, string | null> {
  const defaults: Record<GameKey, string | null> = {
    trivia: null,
    scramble: null,
    mathchallenge: null,
    hangman: null,
    truefalse: null,
    quickdraw: null,
    memory: null,
    riddle: null,
    typingrace: null,
    wouldyourather: null,
  };

  try {
    const raw = fs.readFileSync(SETTINGS_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<Record<GameKey, string | null>>;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

function saveGameChannels(): void {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(configuredChannels, null, 2), "utf8");
}

function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getConfiguredChannelId(game: GameKey): string | null {
  return configuredChannels[game];
}

function isAllowedGameChannel(message: Message, game: GameKey): boolean {
  return message.inGuild() && getConfiguredChannelId(game) === message.channelId;
}

async function ensureAllowedGameChannel(message: Message, game: GameKey): Promise<boolean> {
  if (isAllowedGameChannel(message, game)) {
    return true;
  }

  const configuredId = getConfiguredChannelId(game);
  const suffix = configuredId
    ? ` Please use <#${configuredId}> for ${gameDefinitions[game].label}.`
    : ` An admin still needs to run ${gameDefinitions[game].setupCommand}.`;

  await message.reply(`This game can only be played in its assigned game channel.${suffix}`);
  return false;
}

async function collectReply(message: Message, timeoutMs = 20_000): Promise<Message | null> {
  const collected = await message.channel.awaitMessages({
    filter: (reply) =>
      !reply.author.bot &&
      reply.author.id === message.author.id &&
      reply.channelId === message.channelId,
    max: 1,
    time: timeoutMs,
  });

  return collected.first() ?? null;
}

function shuffleWord(word: string): string {
  const letters = word.split("");
  do {
    for (let i = letters.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
  } while (letters.join("") === word && word.length > 1);
  return letters.join("");
}

function resolveTargetTextChannel(message: Message): TextChannel | null {
  const mentioned = message.mentions.channels.first();
  if (mentioned instanceof TextChannel) {
    return mentioned;
  }
  return message.channel instanceof TextChannel ? message.channel : null;
}

async function setGameChannel(message: Message, game: GameKey): Promise<boolean> {
  if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
    await message.reply("You need the Manage Channels permission to set game channels.");
    return true;
  }

  const targetChannel = resolveTargetTextChannel(message);
  if (!targetChannel) {
    await message.reply("Use this inside a text channel or mention the text channel you want to assign.");
    return true;
  }

  configuredChannels[game] = targetChannel.id;
  saveGameChannels();
  await message.reply(`${targetChannel} is now the ${gameDefinitions[game].label} channel.`);
  return true;
}

async function showGameChannels(message: Message): Promise<boolean> {
  const lines = (Object.keys(gameDefinitions) as GameKey[]).map((game) => {
    const channelId = configuredChannels[game];
    return `**${gameDefinitions[game].label}:** ${channelId ? `<#${channelId}>` : "Not set"}`;
  });
  await message.reply(`Configured game channels:\n${lines.join("\n")}`);
  return true;
}

async function showGames(message: Message): Promise<boolean> {
  const lines = (Object.keys(gameDefinitions) as GameKey[]).map(
    (game) => `• **${gameDefinitions[game].label}** — ${gameDefinitions[game].playCommand}`,
  );
  await message.reply(`Available games:\n${lines.join("\n")}`);
  return true;
}

async function testGame(message: Message, args: string[]): Promise<boolean> {
  const key = normalizeAnswer(args.join(" ")) as GameKey;
  if (!(key in gameDefinitions)) {
    await message.reply("Use `-testgame <game>` with a listed game name like `trivia`, `typingrace`, or `hangman`.");
    return true;
  }

  const game = gameDefinitions[key];
  await message.reply(
    `Test **${game.label}** with ${game.testCommand} and play it with ${game.playCommand}. Set its channel first with ${game.setupCommand}.`,
  );
  return true;
}

async function playTrivia(message: Message): Promise<boolean> {
  if (!(await ensureAllowedGameChannel(message, "trivia"))) return true;
  const item = triviaQuestions[Math.floor(Math.random() * triviaQuestions.length)];
  await message.reply(`🧠 **Trivia Time**\n${item.question}\n*Reply in the next 20 seconds.*`);
  const reply = await collectReply(message);
  if (!reply) {
    await message.reply(`⏰ Time is up. The answer was **${item.answer}**.`);
    return true;
  }
  await message.reply(
    normalizeAnswer(reply.content) === item.answer
      ? "✅ Correct answer!"
      : `❌ Not quite. The answer was **${item.answer}**.`,
  );
  return true;
}

async function playScramble(message: Message): Promise<boolean> {
  if (!(await ensureAllowedGameChannel(message, "scramble"))) return true;
  const word = scrambleWords[Math.floor(Math.random() * scrambleWords.length)];
  const scrambled = shuffleWord(word);
  await message.reply(`🔀 **Word Scramble**\nUnscramble: **${scrambled}**\n*Reply in the next 20 seconds.*`);
  const reply = await collectReply(message);
  if (!reply) {
    await message.reply(`⏰ Time is up. The word was **${word}**.`);
    return true;
  }
  await message.reply(
    normalizeAnswer(reply.content) === word
      ? "✅ You unscrambled it!"
      : `❌ The word was **${word}**.`,
  );
  return true;
}

async function playMathChallenge(message: Message): Promise<boolean> {
  if (!(await ensureAllowedGameChannel(message, "mathchallenge"))) return true;
  const a = Math.floor(Math.random() * 25) + 1;
  const b = Math.floor(Math.random() * 25) + 1;
  const operators = ["+", "-", "*"] as const;
  const operator = operators[Math.floor(Math.random() * operators.length)];
  const answer = operator === "+" ? a + b : operator === "-" ? a - b : a * b;
  await message.reply(`➗ **Math Challenge**\nSolve: **${a} ${operator} ${b}**\n*Reply in the next 20 seconds.*`);
  const reply = await collectReply(message);
  if (!reply) {
    await message.reply(`⏰ Time is up. The answer was **${answer}**.`);
    return true;
  }
  await message.reply(
    Number(reply.content.trim()) === answer
      ? "✅ Correct answer!"
      : `❌ The correct answer was **${answer}**.`,
  );
  return true;
}

async function playHangman(message: Message, args: string[]): Promise<boolean> {
  if (!(await ensureAllowedGameChannel(message, "hangman"))) return true;
  const subcommand = normalizeAnswer(args[0] ?? "");

  if (subcommand === "start") {
    const word = hangmanWords[Math.floor(Math.random() * hangmanWords.length)];
    hangmanStates.set(message.channelId, {
      word,
      masked: Array.from(word, () => "_"),
      guesses: new Set(),
      remaining: 6,
    });
    await message.reply(`🎯 **Hangman Started**\n\`${Array.from(word, () => "_").join(" ")}\`\nUse \`-hangman <letter|word>\`.`);
    return true;
  }

  const state = hangmanStates.get(message.channelId);
  if (!state) {
    await message.reply("There is no active Hangman round here. Start one with `-hangman start`.");
    return true;
  }

  const guess = normalizeAnswer(args.join(" "));
  if (!guess) {
    await message.reply("Use `-hangman <letter|word>`.");
    return true;
  }

  if (guess.length === state.word.length && guess === state.word) {
    hangmanStates.delete(message.channelId);
    await message.reply(`🎉 You solved it! The word was **${state.word}**.`);
    return true;
  }

  if (guess.length !== 1 || !/^[a-z]$/.test(guess)) {
    await message.reply("Guess a single letter or the full word.");
    return true;
  }

  if (state.guesses.has(guess)) {
    await message.reply("You already guessed that letter.");
    return true;
  }

  state.guesses.add(guess);
  if (state.word.includes(guess)) {
    state.word.split("").forEach((char, index) => {
      if (char === guess) {
        state.masked[index] = guess;
      }
    });
  } else {
    state.remaining -= 1;
  }

  if (!state.masked.includes("_")) {
    hangmanStates.delete(message.channelId);
    await message.reply(`🎉 You solved it! The word was **${state.word}**.`);
    return true;
  }

  if (state.remaining <= 0) {
    hangmanStates.delete(message.channelId);
    await message.reply(`💀 Game over. The word was **${state.word}**.`);
    return true;
  }

  await message.reply(`\`${state.masked.join(" ")}\`\nWrong guesses left: **${state.remaining}**`);
  return true;
}

async function playTrueFalse(message: Message): Promise<boolean> {
  if (!(await ensureAllowedGameChannel(message, "truefalse"))) return true;
  const item = trueFalseQuestions[Math.floor(Math.random() * trueFalseQuestions.length)];
  await message.reply(`⚖️ **True or False**\n${item.statement}\n*Reply with true or false in the next 20 seconds.*`);
  const reply = await collectReply(message);
  if (!reply) {
    await message.reply(`⏰ Time is up. The answer was **${item.answer ? "true" : "false"}**.`);
    return true;
  }
  const normalized = normalizeAnswer(reply.content);
  const guessed = normalized === "true" ? true : normalized === "false" ? false : null;
  if (guessed === null) {
    await message.reply(`❌ That was not a valid true/false answer. The answer was **${item.answer ? "true" : "false"}**.`);
    return true;
  }
  await message.reply(
    guessed === item.answer
      ? "✅ Correct!"
      : `❌ The correct answer was **${item.answer ? "true" : "false"}**.`,
  );
  return true;
}

async function playQuickdraw(message: Message): Promise<boolean> {
  if (!(await ensureAllowedGameChannel(message, "quickdraw"))) return true;
  await message.reply("🤠 **Quickdraw**\nWait for **DRAW!** and be the first to reply with `draw`.");
  const delay = 3000 + Math.floor(Math.random() * 5000);
  await new Promise((resolve) => setTimeout(resolve, delay));
  await message.channel.send("🎯 **DRAW!**");
  const collected = await message.channel.awaitMessages({
    filter: (reply) => !reply.author.bot && normalizeAnswer(reply.content) === "draw",
    max: 1,
    time: 15_000,
  });
  const winner = collected.first();
  await message.channel.send(
    winner
      ? `🏆 ${winner.author} was the fastest draw in the channel!`
      : "⏰ Nobody drew in time.",
  );
  return true;
}

async function playMemory(message: Message): Promise<boolean> {
  if (!(await ensureAllowedGameChannel(message, "memory"))) return true;
  const sequence = memorySequences[Math.floor(Math.random() * memorySequences.length)];
  await message.reply(`🧠 **Memory Sequence**\nRemember: **${sequence.join(" ")}**\n*You have 5 seconds.*`);
  await new Promise((resolve) => setTimeout(resolve, 5000));
  await message.channel.send("Now type the emoji sequence back in the same order, separated by spaces.");
  const reply = await collectReply(message);
  if (!reply) {
    await message.reply(`⏰ Time is up. The sequence was **${sequence.join(" ")}**.`);
    return true;
  }
  await message.reply(
    reply.content.trim() === sequence.join(" ")
      ? "✅ Perfect memory!"
      : `❌ The sequence was **${sequence.join(" ")}**.`,
  );
  return true;
}

async function playRiddle(message: Message): Promise<boolean> {
  if (!(await ensureAllowedGameChannel(message, "riddle"))) return true;
  const item = riddles[Math.floor(Math.random() * riddles.length)];
  await message.reply(`🕵️ **Riddle Time**\n${item.prompt}\n*Reply in the next 20 seconds.*`);
  const reply = await collectReply(message);
  if (!reply) {
    await message.reply(`⏰ Time is up. The answer was **${item.answer}**.`);
    return true;
  }
  await message.reply(
    normalizeAnswer(reply.content) === item.answer
      ? "✅ Correct riddle answer!"
      : `❌ The answer was **${item.answer}**.`,
  );
  return true;
}

async function playTypingRace(message: Message): Promise<boolean> {
  if (!(await ensureAllowedGameChannel(message, "typingrace"))) return true;
  const prompt = typingPrompts[Math.floor(Math.random() * typingPrompts.length)];
  await message.reply(`⌨️ **Typing Race**\nType this exactly:\n**${prompt}**`);
  const collected = await message.channel.awaitMessages({
    filter: (reply) => !reply.author.bot && reply.channelId === message.channelId,
    max: 1,
    time: 20_000,
  });
  const winner = collected.first();
  if (!winner) {
    await message.reply("⏰ Nobody finished the typing race in time.");
    return true;
  }
  await message.reply(
    winner.content.trim() === prompt
      ? `🏁 ${winner.author} won the typing race!`
      : `❌ That did not match exactly. The prompt was **${prompt}**.`,
  );
  return true;
}

async function playWouldYouRather(message: Message): Promise<boolean> {
  if (!(await ensureAllowedGameChannel(message, "wouldyourather"))) return true;
  const prompt = wouldYouRatherPrompts[Math.floor(Math.random() * wouldYouRatherPrompts.length)];
  await message.reply(`🤔 **Would You Rather**\n${prompt}\n*Reply with your choice in the next 30 seconds.*`);
  const reply = await collectReply(message, 30_000);
  if (!reply) {
    await message.reply("⏰ Nobody answered in time.");
    return true;
  }
  await message.reply(`🗳️ Choice locked in for ${reply.author}: **${reply.content.trim()}**`);
  return true;
}

export async function handleGameCommand(message: Message, rawContent: string): Promise<boolean> {
  const [commandName, ...args] = rawContent.split(/\s+/);
  const command = commandName.toLowerCase();

  if (command === "set-trivia-channel") return setGameChannel(message, "trivia");
  if (command === "set-scramble-channel") return setGameChannel(message, "scramble");
  if (command === "set-math-channel") return setGameChannel(message, "mathchallenge");
  if (command === "set-hangman-channel") return setGameChannel(message, "hangman");
  if (command === "set-truefalse-channel") return setGameChannel(message, "truefalse");
  if (command === "set-quickdraw-channel") return setGameChannel(message, "quickdraw");
  if (command === "set-memory-channel") return setGameChannel(message, "memory");
  if (command === "set-riddle-channel") return setGameChannel(message, "riddle");
  if (command === "set-typingrace-channel") return setGameChannel(message, "typingrace");
  if (command === "set-wouldyourather-channel") return setGameChannel(message, "wouldyourather");
  if (command === "game-channels") return showGameChannels(message);
  if (command === "games") return showGames(message);
  if (command === "testgame") return testGame(message, args);
  if (command === "trivia") return playTrivia(message);
  if (command === "scramble") return playScramble(message);
  if (command === "mathchallenge") return playMathChallenge(message);
  if (command === "hangman") return playHangman(message, args);
  if (command === "truefalse") return playTrueFalse(message);
  if (command === "quickdraw") return playQuickdraw(message);
  if (command === "memory") return playMemory(message);
  if (command === "riddle") return playRiddle(message);
  if (command === "typingrace") return playTypingRace(message);
  if (command === "wouldyourather") return playWouldYouRather(message);

  return false;
}
