import { Guild } from "discord.js";
import prisma from "../lib/prismaClient";

export const onGuildCreate = async (guild: Guild) => {
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
};

export const onGuildDelete = async (guild: Guild) => {
    const existing = await prisma.server.findFirst({
        where: {
            discord_id: guild.id,
        },
    });

    if (existing) {
        const deleted = await prisma.server.delete({
            where: {
                id: existing.id,
            },
        });

        console.log(
            `Removed ${guild.name} server from our DB (internal id: ${deleted.id})`
        );
    }
};
