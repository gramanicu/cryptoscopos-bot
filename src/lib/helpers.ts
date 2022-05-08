import { Account, Coin, CoinStats, Transaction } from "../interfaces/Api";
import { callApi, callApiAsPrivateUser } from "./api";
import { getCoinFromStash } from "./stashes";
import prisma from "./prismaClient";
import { Participant } from "@prisma/client";
import { Client, TextChannel, MessageEmbed } from "discord.js";
import { DateTime } from "luxon";
import config from "../config/env";

export const checkForWinner = async (client: Client) => {
    // Run every 5 minutes
    const servers = await prisma.server.findMany();

    for (const server of servers) {
        const competitions = await prisma.competition.findMany({
            where: {
                serverId: server.id,
                ending: {
                    lt: DateTime.now().toJSDate(),
                },
                announcedFinish: false,
            },
        });

        for (const comp of competitions) {
            const participants = await computeCompetitionWinner(comp.id);

            participants.sort((p1, p2) => {
                return p2.finalBalance - p1.finalBalance;
            });

            const winner = participants.find((p) => {
                return p.isWinner;
            }) as ParticipantFinish;

            const channel = (await client.channels.fetch(
                comp.channelId
            )) as TextChannel;

            if (winner) {
                const winnerUser = await client.users.fetch(
                    winner.participant.user_id
                );

                if (channel) {
                    const embed = new MessageEmbed()
                        .setTitle(`The "${comp.name}" cryptothon ended`)
                        .setDescription(
                            `${winnerUser} won it, with a final balance of ${winner.finalBalance}$`
                        );

                    let leaderboard = "";
                    let place = 1;
                    for (const p of participants) {
                        const user = await client.users.fetch(
                            p.participant.user_id
                        );

                        leaderboard += `${place}. ${user} with ${p.finalBalance}$\n`;
                        place++;
                    }

                    embed
                        .addField("Leaderboard", leaderboard)
                        .setColor(config.accent_color);

                    const newComp = await prisma.competition.update({
                        where: {
                            id: comp.id,
                        },
                        data: {
                            announcedFinish: true,
                        },
                    });

                    if (newComp) {
                        channel.send({ embeds: [embed] });
                    }
                }
            }
        }
    }

    setTimeout(() => {
        checkForWinner(client);
    }, 1000 * 60 * 5);
};

interface ParticipantFinish {
    participant: Participant;
    isWinner: boolean;
    finalBalance: number;
}

/**
 *
 * @param competitionId The competition for which to check the winner
 * @returns The winner and his value
 */
export const computeCompetitionWinner = async (
    competitionId: string
): Promise<ParticipantFinish[]> => {
    const competitionAggregate = await prisma.competition.findFirst({
        where: {
            id: competitionId,
        },
        include: {
            participants: true,
        },
    });

    if (competitionAggregate) {
        let maxValue = 0;
        let winnerId = "";
        // eslint-disable-next-line prefer-const
        let finalParticipants: ParticipantFinish[] = [];

        for (const p of competitionAggregate.participants) {
            const final: ParticipantFinish = {
                participant: p,
                isWinner: false,
                finalBalance: p.balance,
            };

            const accounts = JSON.parse(
                await callApiAsPrivateUser(
                    "GET",
                    `/private-accounts`,
                    `${p.id}`
                )
            ) as Account[];

            for (const account of accounts) {
                const res = await callApiAsPrivateUser(
                    "GET",
                    `/private-accounts/${account.id}/transactions`,
                    `${p.id}`
                );

                const transactions = JSON.parse(res) as Transaction[];

                let amount = 0;
                for (const t of transactions) {
                    amount += t.amount;
                }

                const coin = await getCoinFromStash(account.coinId);

                const coininfo = JSON.parse(
                    await callApi("GET", `/coins/${coin?.coingeckoId}/stats`)
                ) as CoinStats;

                const coinValue = coininfo.value as number;
                final.finalBalance += coinValue * amount;
            }

            if (final.finalBalance > maxValue) {
                maxValue = final.finalBalance;
                winnerId = final.participant.id;
            }

            finalParticipants.push(final);
        }

        for (const p of finalParticipants) {
            if (p.participant.id === winnerId) {
                p.isWinner = true;
            }
        }
        return finalParticipants;
    }

    return [];
};

/**
 * Get the amount spent &  value in $ and the amount of crypto in the account
 * @param owner_id The owner of the account (internal id, private_id in the external db)
 * @param account_id The id of the account
 * @param account_id The gecko_id of the coin
 * @returns The current value and the amount(crypto) held inside the account
 */
export const computeAccountValue = async (
    owner_id: string,
    account_id: string,
    gecko_id: string
): Promise<[number, number]> => {
    const res = await callApiAsPrivateUser(
        "GET",
        `/private-accounts/${account_id}/transactions`,
        `${owner_id}`
    );

    const transactions = JSON.parse(res) as Transaction[];

    let amount = 0;
    for (const t of transactions) {
        amount += t.amount;
    }

    const coininfo = JSON.parse(
        await callApi("GET", `/coins/${gecko_id}/stats`)
    ) as CoinStats;

    const value = coininfo.value as number;

    return [value * amount, amount];
};

export const tradeAccount = async (
    accountId: string,
    amount: number,
    participantId: string
): Promise<Transaction | null> => {
    const participant = await prisma.participant.findFirst({
        where: {
            id: participantId,
        },
    });

    const transactions = JSON.parse(
        await callApiAsPrivateUser(
            "GET",
            `/private-accounts/${accountId}/transactions`,
            `${participantId}`
        )
    ) as Transaction[];

    let acc_amount = 0;
    for (const trans of transactions) {
        acc_amount += trans.amount;
    }

    const account = JSON.parse(
        await callApiAsPrivateUser(
            "GET",
            `/private-accounts/${accountId}`,
            `${participantId}`
        )
    ) as Account;

    if (participant && account) {
        const balance = participant.balance;

        const raw_trans = await callApiAsPrivateUser(
            "POST",
            `/private-accounts/${accountId}/transactions/create`,
            `${participantId}`,
            {
                comment: "comment",
                amount: amount,
            }
        );

        const transaction = JSON.parse(raw_trans) as Transaction;
        const price = transaction.amount * transaction.value;

        if (
            (transaction.amount > 0 && balance - price >= 0) ||
            (transaction.amount < 0 && acc_amount + transaction.amount >= 0)
        ) {
            await prisma.participant.update({
                where: {
                    id: participant.id,
                },
                data: {
                    balance: balance - price,
                },
            });

            const coin = await getCoinFromStash(account.coinId);
            account.coin = coin as Coin;
            transaction.account = account;

            return transaction;
        } else {
            await callApiAsPrivateUser(
                "DELETE",
                `/private-accounts/${accountId}/transactions/${transaction.id}`,
                `${participantId}`
            );
        }
    }

    return null;
};
