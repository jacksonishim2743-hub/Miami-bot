"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commands = void 0;
const discord_js_1 = require("discord.js");
exports.commands = [
    new discord_js_1.SlashCommandBuilder()
        .setName("ping")
        .setDescription("Check whether the bot is online."),
    new discord_js_1.SlashCommandBuilder()
        .setName("hello")
        .setDescription("Get a friendly welcome from the bot."),
    new discord_js_1.SlashCommandBuilder()
        .setName("status")
        .setDescription("Show the bot command list."),
    new discord_js_1.SlashCommandBuilder()
        .setName("session")
        .setDescription("Manage session panels and voting.")
        .addSubcommandGroup((group) => group
        .setName("vote")
        .setDescription("Session vote commands.")
        .addSubcommand((subcommand) => subcommand
        .setName("start")
        .setDescription("Start the session vote panel.")))
        .addSubcommand((subcommand) => subcommand
        .setName("start")
        .setDescription("Post the session start panel.")
        .addStringOption((option) => option
        .setName("link")
        .setDescription("ERLC join link for the session.")
        .setRequired(true)))
        .addSubcommand((subcommand) => subcommand
        .setName("reminder")
        .setDescription("Post a session reminder for the community."))
        .addSubcommand((subcommand) => subcommand
        .setName("end")
        .setDescription("Post the session end panel.")),
    new discord_js_1.SlashCommandBuilder()
        .setName("giveaway")
        .setDescription("Manage Miami giveaway panels.")
        .addSubcommand((subcommand) => subcommand
        .setName("start")
        .setDescription("Start a giveaway.")
        .addStringOption((option) => option
        .setName("prize")
        .setDescription("The giveaway prize.")
        .setRequired(true)))
        .addSubcommand((subcommand) => subcommand
        .setName("end")
        .setDescription("End the active giveaway in this channel."))
        .addSubcommand((subcommand) => subcommand
        .setName("reroll")
        .setDescription("Reroll the last ended giveaway in this channel.")
        .addUserOption((option) => option
        .setName("exclude_user")
        .setDescription("Exclude a previous winner from the reroll.")
        .setRequired(false))),
    new discord_js_1.SlashCommandBuilder()
        .setName("poll")
        .setDescription("Manage Miami polls.")
        .addSubcommand((subcommand) => subcommand
        .setName("start")
        .setDescription("Start a poll.")
        .addStringOption((option) => option
        .setName("question")
        .setDescription("What the poll is about.")
        .setRequired(true))
        .addStringOption((option) => option
        .setName("description")
        .setDescription("Extra poll details.")
        .setRequired(true)))
        .addSubcommand((subcommand) => subcommand
        .setName("end")
        .setDescription("End the active poll in this channel.")
        .addStringOption((option) => option
        .setName("decision")
        .setDescription("Optional final decision text to post.")
        .setRequired(false))),
].map((command) => command.toJSON());
