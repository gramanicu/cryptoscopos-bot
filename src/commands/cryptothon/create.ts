import {
    CommandInteraction,
    MessageActionRow,
    MessageButton,
    MessageComponentInteraction,
    MessageEmbed,
} from "discord.js";
import { DateTime, Duration } from "luxon";
import config from "../../config/env";
import prisma from "../../lib/prismaClient";
import { ButtonInteraction } from "discord.js";
import { Competition } from "@prisma/client";
import { callApiAsPrivateUser } from "../../lib/api";
import { User } from "../../interfaces/Api";

const buttonName = "cryptothon-create-join-button";

const joinButtonInteraction = async (
    interaction: ButtonInteraction,
    competition: Competition
): Promise<void> => {
    if (interaction.customId.startsWith(buttonName)) {
        try {
            const participant = await prisma.participant.findFirst({
                where: {
                    competitionId: competition.id,
                    user_id: interaction.user.id,
                },
            });

            if (participant === null) {
                const newUser = await prisma.participant.create({
                    data: {
                        competition: {
                            connect: {
                                id: competition.id,
                            },
                        },
                        user_id: interaction.user.id,
                        balance: competition.startMoney,
                    },
                });

                if (newUser) {
                    const res = await callApiAsPrivateUser(
                        "POST",
                        `/private-user/create`,
                        newUser.id
                    );

                    const ext_user = JSON.parse(res) as User;

                    const final = await prisma.participant.update({
                        where: {
                            id: newUser.id,
                        },
                        data: {
                            external_id: ext_user.id,
                        },
                    });

                    if (final !== null) {
                        await interaction.reply({
                            content: `You have joined the ${competition.name} cryptothon`,
                            ephemeral: true,
                        });
                        return;
                    }
                }
            }
        } catch (err) {
            const embed = new MessageEmbed()
                .setTitle("Couldn't sign up")
                .setColor("RED")
                .setDescription("Internal bot error")
                .setTimestamp(Date.now());

            if (!interaction.replied) {
                await interaction.reply({ embeds: [embed], ephemeral: true });
            }
            return;
        }
    }

    if (!interaction.deferred) {
        await interaction.deferUpdate();
    }
};

export const create = async (
    interaction: CommandInteraction
): Promise<void> => {
    const name = interaction.options.getString("name") as string;
    const duration = interaction.options.getInteger("duration") as number;
    const starting_money = interaction.options.getInteger(
        "starting_money"
    ) as number;

    try {
        const server = await prisma.server.findFirst({
            where: { discord_id: interaction.guildId as string },
        });

        if (server) {
            const competition = await prisma.competition.create({
                data: {
                    name: name,
                    startMoney: starting_money,
                    hoursDuration: duration,
                    ending: DateTime.now().plus({ hours: duration }).toJSDate(),
                    server: {
                        connect: {
                            id: server.id,
                        },
                    },
                },
            });

            const joinButton = new MessageButton()
                .setCustomId(`${buttonName}${interaction.id}`)
                .setLabel("Join")
                .setStyle("PRIMARY");

            const embed = new MessageEmbed()
                .setTitle(`${competition.name}`)
                .setColor(config.accent_color)
                .addField("Competition ID: ", "`" + competition.id + "`")
                .addField("Starting funds: ", `${competition.startMoney}$`)
                .addField(
                    "Ends on: ",
                    DateTime.fromJSDate(competition.ending).toLocaleString(
                        DateTime.DATETIME_SHORT
                    )
                )
                .setTimestamp(Date.now());

            await interaction.editReply({
                embeds: [embed],
                components: [new MessageActionRow().addComponents(joinButton)],
                content: `New cryptothon created by ${interaction.user}`,
            });

            if (interaction.channel) {
                // All users should be allowed to join
                const filter = (i: MessageComponentInteraction) =>
                    i.customId === `${buttonName}${interaction.id}`;

                const collector =
                    interaction.channel.createMessageComponentCollector({
                        filter,
                        time: Math.min(
                            Duration.fromDurationLike({
                                hours: competition.hoursDuration,
                            }).toMillis(),
                            86400000
                        ),
                        componentType: "BUTTON",
                    });

                collector.on("end", async (_, reason) => {
                    if (reason !== "messageDelete") {
                        interaction.editReply({ components: [] });
                    }
                });

                collector.on("collect", async (i) => {
                    await joinButtonInteraction(i, competition);
                });
            }

            return;
        }
    } catch (err) {
        const embed = new MessageEmbed()
            .setTitle("Creation failed")
            .setColor("RED")
            .setDescription("Try again or check the parameters.")
            .setTimestamp(Date.now());

        await interaction.editReply({ embeds: [embed] });
    }

    const embed = new MessageEmbed()
        .setTitle("Creation failed")
        .setColor("RED")
        .setDescription("Internal bot error")
        .setTimestamp(Date.now());

    await interaction.editReply({ embeds: [embed] });
};
