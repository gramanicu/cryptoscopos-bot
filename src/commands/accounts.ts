import {
    ModalBuilder,
    SlashCommandBuilder,
    TextInputBuilder,
} from "@discordjs/builders";
import {
    MessageEmbed,
    MessageSelectMenu,
    MessageActionRow,
    SelectMenuInteraction,
    MessageComponentInteraction,
    MessageButton,
} from "discord.js";
import { DateTime } from "luxon";
import config from "../config/env";
import { Command } from "../interfaces/Command";
import prisma from "../lib/prismaClient";
import { Competition, Participant } from "@prisma/client";
import { CommandInteraction, ButtonInteraction } from "discord.js";
import { callApi, callApiAsPrivateUser } from "../lib/api";
import { Account, Coin } from "../interfaces/Api";
import { getCoinFromStash } from "../lib/stashes";
import { computeAccountValue, tradeAccount } from "../lib/helpers";

const selectMenuName = "accounts-competition-select";

const addCommand = async (interaction: CommandInteraction): Promise<void> => {
    await interaction.deferReply({ ephemeral: true });
    const participant = interaction.options.getString("participant") as string;
    const identifier = interaction.options.getString("identifier");

    const serverId = interaction.guildId as string;
    const userId = interaction.user.id;
    try {
        const server = await prisma.server.findFirst({
            where: { discord_id: serverId },
        });

        if (server) {
            const res = await callApiAsPrivateUser(
                "GET",
                `/private-accounts/`,
                `${participant}`
            );

            const accounts = JSON.parse(res) as Account[];
            if (accounts) {
                for (let acc of accounts) {
                    const coin = (await getCoinFromStash(acc.coinId)) as Coin;
                    acc.coin = coin;
                }

                const existsAlready = accounts.some((account) => {
                    return account.coin?.coingeckoId === identifier;
                });

                const competition = await prisma.competition.findFirst({
                    where: {
                        participants: {
                            some: {
                                id: participant,
                            },
                        },
                        ending: {
                            lt: DateTime.now().toJSDate(),
                        },
                    },
                });

                if (!existsAlready && !competition) {
                    const res1 = await callApiAsPrivateUser(
                        "POST",
                        `/private-accounts/create`,
                        participant,
                        {
                            gecko_id: identifier,
                            name: `name`,
                            description: "description",
                        }
                    );

                    const acc = JSON.parse(res1) as Account;
                    const coinName = (
                        (await getCoinFromStash(acc.coinId)) as Coin
                    ).name;

                    if (acc) {
                        await interaction.editReply({
                            content: `You have created a new account for ${coinName}`,
                        });
                        return;
                    }
                } else {
                    const embed = new MessageEmbed()
                        .setTitle("Duplicate account")
                        .setColor("RED")
                        .setDescription(
                            "You already have an account with that currency"
                        )
                        .setTimestamp(Date.now());

                    if (competition) {
                        embed
                            .setTitle("Competition ended")
                            .setDescription(
                                "Accounts are now disabled for that competition"
                            );
                    }
                    await interaction.editReply({
                        embeds: [embed],
                        components: [],
                    });
                    return;
                }
            }
        }
    } catch (err) {
        const embed = new MessageEmbed()
            .setTitle("Adding failed")
            .setColor("RED")
            .setDescription("There might be an issue with the bot")
            .setTimestamp(Date.now());

        await interaction.editReply({ embeds: [embed], components: [] });
        return;
    }

    const embed = new MessageEmbed()
        .setTitle("Adding failed")
        .setColor("RED")
        .setDescription("Internal bot error")
        .setTimestamp(Date.now());

    await interaction.editReply({ embeds: [embed] });
};
const tradeCommand = async (interaction: CommandInteraction): Promise<void> => {
    await interaction.deferReply({ ephemeral: true });
    const participant = interaction.options.getString("participant") as string;
    const account = interaction.options.getString("account") as string;
    const amount = interaction.options.getNumber("amount") as number;

    const serverId = interaction.guildId as string;
    const userId = interaction.user.id;
    try {
        const server = await prisma.server.findFirst({
            where: { discord_id: serverId },
        });

        if (server) {
            const transaction = await tradeAccount(
                account,
                amount,
                participant
            );

            if (transaction) {
                const embed = new MessageEmbed()
                    .setColor(config.accent_color)
                    .setTimestamp(Date.now())
                    .setTitle("Transaction successful");
                if (transaction.amount > 0) {
                    embed.setDescription(
                        `You bought ${
                            transaction.amount
                        }${transaction.account?.coin?.symbol.toUpperCase()} for ${
                            transaction.value * transaction.amount
                        }$`
                    );
                } else {
                    embed.setDescription(
                        `You sold ${-transaction.amount} ${transaction.account?.coin?.symbol.toUpperCase()} for ${
                            -transaction.value * transaction.amount
                        }$`
                    );
                }

                await interaction.editReply({
                    embeds: [embed],
                    components: [],
                });
                return;
            }
        }
    } catch (err) {
        const embed = new MessageEmbed()
            .setTitle("Trading failed")
            .setColor("RED")
            .setDescription("There might be an issue with the bot")
            .setTimestamp(Date.now());

        await interaction.editReply({ embeds: [embed], components: [] });
        return;
    }

    const embed = new MessageEmbed()
        .setTitle("Trading failed")
        .setColor("RED")
        .setDescription(
            "Check you parameters and check that you have enough money/cryptocurrency for the trade"
        )
        .setTimestamp(Date.now());

    await interaction.editReply({ embeds: [embed] });
};

const selectCompetitionEmbed = async (
    interaction: SelectMenuInteraction,
    participant: Participant,
    competition: Competition
): Promise<void> => {
    if (interaction.customId.startsWith(selectMenuName)) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
        }

        try {
            const embed = new MessageEmbed()
                .setTitle(`Accounts for "${competition.name}" cryptothon`)
                .setColor(config.accent_color)
                .setTimestamp(Date.now())
                .addField("Participant ID: ", "`" + participant.id + "`")
                .addField("Balance", `${participant.balance}$`);

            const res = await callApiAsPrivateUser(
                "GET",
                `/private-accounts/`,
                `${participant.id}`
            );

            const accounts = JSON.parse(res) as Account[];

            let acc_string = "";
            for (const acc of accounts) {
                const coin = await getCoinFromStash(acc.coinId);

                const [value, amount] = await computeAccountValue(
                    participant.id,
                    acc.id,
                    coin?.coingeckoId as string
                );

                if (coin) {
                    acc.coin = coin;
                    acc_string +=
                        "`" +
                        acc.id +
                        "`" +
                        `, ${amount} ${coin.symbol.toUpperCase()}` +
                        `, with a value of ${value}$\n`;
                }
            }
            embed.addField(
                "Accounts",
                `${acc_string}${accounts.length} in total`
            );

            await interaction.editReply({
                embeds: [embed],
            });

            return;
        } catch (err) {
            const embed = new MessageEmbed()
                .setTitle("Couldn't get data")
                .setColor("RED")
                .setDescription("Internal bot error")
                .setTimestamp(Date.now());

            if (!interaction.replied) {
                await interaction.editReply({
                    embeds: [embed],
                    components: [],
                });
            }
            return;
        }
    }
};

const selectCommand = async (
    interaction: CommandInteraction
): Promise<void> => {
    await interaction.deferReply({ ephemeral: true });

    const serverId = interaction.guildId as string;
    const userId = interaction.user.id;

    try {
        const server = await prisma.server.findFirst({
            where: { discord_id: serverId },
        });

        if (server) {
            const competitions = await prisma.competition.findMany({
                where: {
                    serverId: server.id,
                    participants: {
                        some: {
                            user_id: userId,
                        },
                    },
                    ending: {
                        gt: DateTime.now().toJSDate(),
                    },
                },
            });

            const embed = new MessageEmbed()
                .setTitle(
                    `Select a competition for which you want to manage your accounts`
                )
                .setColor(config.accent_color)
                .setTimestamp(Date.now());

            const select = new MessageSelectMenu().setCustomId(
                `${selectMenuName}${interaction.id}`
            );

            if (competitions.length > 0) {
                select.setPlaceholder(`${competitions.length} competitions`);

                for (const competition of competitions) {
                    select.addOptions({
                        label: competition.name,
                        value: competition.id,
                        description: `Ends on ${DateTime.fromJSDate(
                            competition.ending
                        ).toLocaleString(DateTime.DATETIME_SHORT)}`,
                    });
                }

                const row = new MessageActionRow().addComponents(select);

                await interaction.editReply({
                    embeds: [embed],
                    components: [row],
                });

                if (interaction.channel) {
                    const filter = (i: MessageComponentInteraction) =>
                        i.user.id === interaction.user.id &&
                        i.customId === `${selectMenuName}${interaction.id}`;

                    const collector =
                        interaction.channel.createMessageComponentCollector({
                            filter,
                            time: 60000,
                            componentType: "SELECT_MENU",
                        });

                    collector.on("end", async (_, reason) => {
                        if (reason !== "messageDelete") {
                            interaction.editReply({ components: [] });
                        }
                    });

                    collector.on("collect", async (i) => {
                        if (!i.replied) {
                            if (!i.deferred) {
                                await i.deferUpdate();
                            }
                            const competitionId = i.values[0];

                            const competition =
                                await prisma.competition.findFirst({
                                    where: {
                                        id: competitionId,
                                    },
                                });

                            const participant =
                                await prisma.participant.findFirst({
                                    where: {
                                        user_id: i.user.id,
                                        competitionId: competition?.id,
                                    },
                                });

                            if (competition && participant) {
                                await selectCompetitionEmbed(
                                    i,
                                    participant,
                                    competition
                                );
                                collector.resetTimer();
                            }
                        }
                    });
                }
            } else {
                embed.setTitle(`You are not participating in any competition`);

                await interaction.editReply({ embeds: [embed] });
            }
            return;
        }
    } catch (err) {
        const embed = new MessageEmbed()
            .setTitle("Listing failed")
            .setColor("RED")
            .setDescription("There might be an issue with the bot")
            .setTimestamp(Date.now());

        await interaction.editReply({ embeds: [embed], components: [] });
        return;
    }

    const embed = new MessageEmbed()
        .setTitle("Listing failed")
        .setColor("RED")
        .setDescription("Internal bot error")
        .setTimestamp(Date.now());

    await interaction.editReply({ embeds: [embed] });
};

export const accounts: Command = {
    data: new SlashCommandBuilder()
        .setName("accounts")
        .setDescription("The accounts used by cryptothons participants")
        .addSubcommand((subcommand) => {
            return subcommand
                .setName("view")
                .setDescription(
                    "View all accounts used on a specific cryptothon"
                );
        })
        .addSubcommand((subcommand) => {
            return subcommand
                .setName("new")
                .setDescription("Create a new account for a cryptothon")
                .addStringOption((option) => {
                    return option
                        .setName("participant")
                        .setDescription(
                            "The id of the participant this account will be used by. Is displayed when viewing your accounts."
                        )
                        .setRequired(true);
                })
                .addStringOption((option) => {
                    return option
                        .setName("identifier")
                        .setDescription(
                            "The identifier of the coin used by the new account"
                        )
                        .setRequired(true);
                });
        })
        .addSubcommand((subcommand) => {
            return subcommand
                .setName("trade")
                .setDescription("Do trades on one of your accounts")
                .addStringOption((option) => {
                    return option
                        .setName("participant")
                        .setDescription(
                            "The id of the participant this account will be used by. Is displayed when viewing your accounts."
                        )
                        .setRequired(true);
                })
                .addStringOption((option) => {
                    return option
                        .setName("account")
                        .setDescription(
                            "The id of the account which will be used for trading"
                        )
                        .setRequired(true);
                })
                .addNumberOption((option) => {
                    return option
                        .setName("amount")
                        .setDescription(
                            "How much would you like to Buy/Sell. To sell, enter a negative value."
                        )
                        .setRequired(true);
                });
        }),

    run: async (interaction) => {
        if (!interaction.isCommand()) return;

        const cmd = interaction.options.getSubcommand();

        switch (cmd) {
            case "view":
                {
                    await selectCommand(interaction);
                }
                break;
            case "new":
                {
                    await addCommand(interaction);
                }
                break;
            case "trade":
                {
                    await tradeCommand(interaction);
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
