import { SlashCommandBuilder } from "@discordjs/builders";
import {
    MessageEmbed,
    CommandInteraction,
    MessagePayload,
    WebhookEditMessageOptions,
} from "discord.js";
import { Command } from "../interfaces/Command";

const selectAccountEmbed = async (
    serverId: string,
    userId: string
): Promise<WebhookEditMessageOptions> => {
    const embed = new MessageEmbed()
        .setTitle("First Page")
        .setDescription("This is the first page");

    return {
        embeds: [embed],
        components: [],
    };
};

export const accounts: Command = {
    data: new SlashCommandBuilder()
        .setName("accounts")
        .setDescription("The accounts used by cryptothons participants"),

    run: async (interaction) => {
        if (!interaction.isCommand()) return;
        await interaction.deferReply();

        const serverId = interaction.guildId as string;
        const userId = interaction.user.id;

        const selectEmbed = await selectAccountEmbed(serverId, userId);
        await interaction.editReply(selectEmbed);
    },
};
