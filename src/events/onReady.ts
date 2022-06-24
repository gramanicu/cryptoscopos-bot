import { REST } from "@discordjs/rest";
import { Client } from "discord.js";
import { CommandList } from "../commands/_CommandList";
import { Routes } from "discord-api-types/v9";
import config from "../config/env";
import prisma from "../lib/prismaClient";
import { checkForWinner } from "../lib/helpers";
import { updateCoinStash } from "../lib/stashes";

export const onReady = async (BOT: Client) => {
    updateCoinStash();
    const rest = new REST({ version: "9" }).setToken(config.bot_token);
    const commandData = CommandList.map((command) => command.data.toJSON());

    await rest.put(Routes.applicationCommands(BOT.user?.id || "missing id"), {
        body: commandData,
    });

    checkForWinner(BOT);

    BOT.guilds.cache.map(async (guild) => {
        const existing = await prisma.server.findFirst({
            where: {
                discord_id: guild.id,
            },
        });

        if (existing === null) {
            const server = await prisma.server.create({
                data: {
                    discord_id: guild.id,
                },
            });

            console.log(
                `Added ${guild.name} server to our DB (internal id: ${server.id})`
            );
        }
    });

    console.log("Bot is running");
};
