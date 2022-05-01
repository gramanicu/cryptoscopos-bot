import { CommandInteraction, MessageEmbed } from "discord.js";
import { DateTime } from "luxon";
import config from "../../config/env";
import prisma from "../../lib/prismaClient";

export const view = async (interaction: CommandInteraction): Promise<void> => {
    const id = interaction.options.getString("id") as string;

    try {
        const server = await prisma.server.findFirst({
            where: { discord_id: interaction.guildId as string },
        });

        if (server) {
            const competition = await prisma.competition.findFirst({
                where: {
                    id,
                    serverId: server.id,
                },
                include: {
                    participants: true,
                },
            });

            if (competition) {
                const embed = new MessageEmbed()
                    .setTitle(competition.name)
                    .setColor(config.accent_color)
                    .setTimestamp(Date.now())
                    .addField("Competition ID: ", "`" + competition.id + "`")
                    .addField(
                        "Starting funds",
                        `${competition.startMoney}$`,
                        true
                    )
                    .addField(
                        "Participants",
                        `${competition.participants.length}`,
                        true
                    )
                    .addField(
                        "Ends on: ",
                        DateTime.now()
                            .plus({ hours: competition.hoursDuration })
                            .toLocaleString(DateTime.DATETIME_SHORT)
                    );

                await interaction.editReply({
                    embeds: [embed],
                });
                return;
            }
        }
    } catch (err) {
        const embed = new MessageEmbed()
            .setTitle("Viewing failed")
            .setColor("RED")
            .setDescription("There might be an issue with the bot")
            .setTimestamp(Date.now());

        await interaction.editReply({ embeds: [embed] });
    }

    const embed = new MessageEmbed()
        .setTitle("Viewing failed")
        .setColor("RED")
        .setDescription("Internal bot error")
        .setTimestamp(Date.now());

    await interaction.editReply({ embeds: [embed] });
};
