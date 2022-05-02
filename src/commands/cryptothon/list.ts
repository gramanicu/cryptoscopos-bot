import { Competition } from "@prisma/client";
import { CommandInteraction, MessageEmbed } from "discord.js";
import { DateTime } from "luxon";
import config from "../../config/env";
import prisma from "../../lib/prismaClient";

export const list = async (interaction: CommandInteraction): Promise<void> => {
    const include_ended = interaction.options.getBoolean(
        "include_ended"
    ) as boolean;

    try {
        const server = await prisma.server.findFirst({
            where: { discord_id: interaction.guildId as string },
        });

        if (server) {
            let competitions: Competition[];

            if (include_ended) {
                competitions = await prisma.competition.findMany({
                    where: {
                        serverId: server.id,
                    },
                });
            } else {
                competitions = await prisma.competition.findMany({
                    where: {
                        serverId: server.id,
                        ending: {
                            gt: DateTime.now().toJSDate(),
                        },
                    },
                });
            }

            const embed = new MessageEmbed()
                .setTitle(`The cryptothons of this server are:`)
                .setColor(config.accent_color)
                .setTimestamp(Date.now());
            competitions.forEach((competition) => {
                embed.addField(
                    competition.name,
                    "ID: `" + competition.id + "`"
                );
            });

            if (competitions.length === 0) {
                embed.setTitle("No competitions");
            }

            await interaction.editReply({
                embeds: [embed],
            });

            return;
        }
    } catch (err) {
        const embed = new MessageEmbed()
            .setTitle("Listing failed")
            .setColor("RED")
            .setDescription("There might be an issue with the bot")
            .setTimestamp(Date.now());

        await interaction.editReply({ embeds: [embed] });
    }

    const embed = new MessageEmbed()
        .setTitle("Listing failed")
        .setColor("RED")
        .setDescription("Internal bot error")
        .setTimestamp(Date.now());

    await interaction.editReply({ embeds: [embed] });
};
