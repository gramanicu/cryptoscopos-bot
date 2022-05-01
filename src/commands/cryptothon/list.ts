import { CommandInteraction, MessageEmbed } from "discord.js";
import config from "../../config/env";
import prisma from "../../lib/prismaClient";

export const list = async (interaction: CommandInteraction): Promise<void> => {
    try {
        const server = await prisma.server.findFirst({
            where: { discord_id: interaction.guildId as string },
        });

        if (server) {
            const competitions = await prisma.competition.findMany({
                where: {
                    serverId: server.id,
                },
            });

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
