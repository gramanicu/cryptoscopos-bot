import { SlashCommandBuilder } from "@discordjs/builders";
import { MessageEmbed } from "discord.js";
import { Command } from "../interfaces/Command";
import { create } from "./cryptothon/create";
import { join } from "./cryptothon/join";
import { list } from "./cryptothon/list";
import { view } from "./cryptothon/view";

export const cryptothon: Command = {
    data: new SlashCommandBuilder()
        .setName("cryptothon")
        .setDescription("Crypto trading competitions")
        .addSubcommand((subcommand) => {
            return subcommand
                .setName("create")
                .setDescription("Create a new Cryptothon")
                .addStringOption((option) => {
                    return option
                        .setName("name")
                        .setDescription("How will the competition be named?")
                        .setRequired(true);
                })
                .addIntegerOption((option) => {
                    return option
                        .setName("duration")
                        .setMinValue(1)
                        .setMaxValue(720)
                        .setDescription(
                            "How many hours will it last? (max 720h)"
                        )
                        .setRequired(true);
                })
                .addIntegerOption((option) => {
                    return option
                        .setName("starting_money")
                        .setMinValue(1)
                        .setMaxValue(100000)
                        .setDescription(
                            "How much money will each player have at the start of the game? (max 100.000$)"
                        )
                        .setRequired(true);
                });
        })
        .addSubcommand((subcommand) => {
            return subcommand
                .setName("list")
                .setDescription("List all ongoing cryptothons");
        })
        .addSubcommand((subcommand) => {
            return subcommand
                .setName("view")
                .setDescription("View information about a cryptothon")
                .addStringOption((option) => {
                    return option
                        .setName("id")
                        .setDescription("The id of the cryptothon")
                        .setRequired(true);
                });
        })
        .addSubcommand((subcommand) => {
            return subcommand
                .setName("join")
                .setDescription("List all ongoing cryptothons")
                .addStringOption((option) => {
                    return option
                        .setName("id")
                        .setDescription("The id of the cryptothon")
                        .setRequired(true);
                });
        }),

    run: async (interaction) => {
        if (!interaction.isCommand()) return;

        const cmd = interaction.options.getSubcommand();

        switch (cmd) {
            case "create":
                {
                    await interaction.deferReply();
                    await create(interaction);
                }
                break;
            case "list":
                {
                    await interaction.deferReply({ ephemeral: true });
                    await list(interaction);
                }
                break;
            case "view":
                {
                    await interaction.deferReply({ ephemeral: true });
                    await view(interaction);
                }
                break;
            case "join":
                {
                    await interaction.deferReply({ ephemeral: true });
                    await join(interaction);
                }
                break;
            default: {
                await interaction.editReply({
                    content: "Couldn't identify command",
                });
            }
        }
    },
};
