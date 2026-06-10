"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const DEFAULT_BLOCKED_WORDS = [
    "anal",
    "anus",
    "arse",
    "arsed",
    "arses",
    "asshole",
    "assholes",
    "bastard",
    "bastards",
    "beaner",
    "beaners",
    "bitch",
    "bitches",
    "blowjob",
    "blowjobs",
    "bollocks",
    "boner",
    "boners",
    "boob",
    "boobs",
    "brothel",
    "brothels",
    "bullshit",
    "chink",
    "chinks",
    "clit",
    "clits",
    "cock",
    "cocks",
    "coon",
    "coons",
    "crackhead",
    "crackheads",
    "cum",
    "cunt",
    "cunts",
    "damn",
    "dick",
    "dicks",
    "dildo",
    "dildos",
    "dipshit",
    "dipshits",
    "dogshit",
    "dyke",
    "dykes",
    "fag",
    "faggot",
    "faggots",
    "fags",
    "femboy",
    "femboys",
    "fuck",
    "fucker",
    "fuckers",
    "fucking",
    "fucks",
    "goddamn",
    "handjob",
    "handjobs",
    "hell",
    "hoe",
    "hoes",
    "horny",
    "jackass",
    "jackasses",
    "jerkoff",
    "jerkoffs",
    "jizz",
    "kike",
    "kikes",
    "knobhead",
    "knobheads",
    "motherfucker",
    "motherfuckers",
    "nigga",
    "niggas",
    "nigger",
    "niggers",
    "nutsack",
    "nutsacks",
    "penis",
    "penises",
    "piss",
    "pissed",
    "porn",
    "porno",
    "pussy",
    "pussies",
    "queef",
    "queefs",
    "retard",
    "retards",
    "scumbag",
    "scumbags",
    "sex",
    "sexy",
    "shag",
    "shags",
    "shit",
    "shits",
    "shitty",
    "slut",
    "sluts",
    "spic",
    "spics",
    "taint",
    "taints",
    "tit",
    "tits",
    "tosser",
    "tossers",
    "twat",
    "twats",
    "vagina",
    "vaginas",
    "wanker",
    "wankers",
    "whore",
    "whores",
];
function getRequiredEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}
function parseList(value) {
    return (value ?? "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
}
function parseBoolean(value, defaultValue) {
    if (value === undefined) {
        return defaultValue;
    }
    return value.toLowerCase() === "true";
}
function parseNumber(value, defaultValue) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : defaultValue;
}
exports.config = {
    token: getRequiredEnv("DISCORD_TOKEN"),
    clientId: process.env.DISCORD_CLIENT_ID?.trim() || null,
    guildId: process.env.DISCORD_GUILD_ID?.trim() || null,
    serverApiKey: process.env.SERVER_API_KEY?.trim() ||
        process.env.ERLC_API_KEY?.trim() ||
        process.env.API_KEY?.trim() ||
        null,
    prefix: process.env.PREFIX?.trim() || "-",
    supportRoleId: process.env.SUPPORT_ROLE_ID ?? null,
    ticketCategoryId: process.env.TICKET_CATEGORY_ID ?? null,
    logChannelId: process.env.LOG_CHANNEL_ID ?? null,
    automod: {
        enabled: parseBoolean(process.env.AUTOMOD_ENABLED, true),
        exemptRoleIds: parseList(process.env.AUTOMOD_EXEMPT_ROLE_IDS),
        blockedWords: parseList(process.env.BLOCKED_WORDS ?? DEFAULT_BLOCKED_WORDS.join(",")).map((word) => word.toLowerCase()),
        allowInvites: parseBoolean(process.env.ALLOW_DISCORD_INVITES, false),
        allowLinks: parseBoolean(process.env.ALLOW_EXTERNAL_LINKS, false),
        allowedLinkDomains: parseList(process.env.ALLOWED_LINK_DOMAINS).map((domain) => domain.toLowerCase()),
        maxMentions: parseNumber(process.env.AUTOMOD_MAX_MENTIONS, 5),
        maxWarningsBeforeTimeout: parseNumber(process.env.AUTOMOD_MAX_WARNINGS_BEFORE_TIMEOUT, 3),
        warningWindowMs: parseNumber(process.env.AUTOMOD_WARNING_WINDOW_MINUTES, 15) * 60 * 1000,
        warningMessageLifetimeMs: parseNumber(process.env.AUTOMOD_WARNING_MESSAGE_SECONDS, 10) * 1000,
        timeoutDurationMs: parseNumber(process.env.AUTOMOD_TIMEOUT_MINUTES, 10) * 60 * 1000,
        caps: {
            ratio: parseNumber(process.env.AUTOMOD_CAPS_RATIO, 0.7),
            minLetters: parseNumber(process.env.AUTOMOD_CAPS_MIN_LETTERS, 12),
        },
        spam: {
            windowMs: parseNumber(process.env.AUTOMOD_SPAM_WINDOW_SECONDS, 8) * 1000,
            maxMessages: parseNumber(process.env.AUTOMOD_SPAM_MAX_MESSAGES, 6),
            maxDuplicates: parseNumber(process.env.AUTOMOD_DUPLICATE_MAX_MESSAGES, 3),
            minDuplicateLength: parseNumber(process.env.AUTOMOD_DUPLICATE_MIN_LENGTH, 8),
        },
    },
};
