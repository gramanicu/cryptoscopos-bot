import { CommandInteraction, MessageEmbed } from "discord.js";
import prisma from "../../lib/prismaClient";

export const join = async (interaction: CommandInteraction): Promise<void> => {
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
            });

            if (competition) {
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

                    if (newUser !== null) {
                        await interaction.editReply({
                            content: `You have joined the ${competition.name} cryptothon`,
                        });
                        return;
                    }
                }
            }
        }
    } catch (err) {
        const embed = new MessageEmbed()
            .setTitle("Joining failed")
            .setColor("RED")
            .setDescription("There might be an issue with the bot")
            .setTimestamp(Date.now());

        await interaction.editReply({ embeds: [embed] });
    }

    const embed = new MessageEmbed()
        .setTitle("Joining failed")
        .setColor("RED")
        .setDescription(
            "You might have joined already or the competition doesn't exist"
        )
        .setTimestamp(Date.now());

    await interaction.editReply({ embeds: [embed] });
};
