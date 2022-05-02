import { SlashCommandBuilder } from "@discordjs/builders";
import {
    MessageEmbed,
    CommandInteraction,
    MessageActionRow,
    MessageButton,
    ButtonInteraction,
} from "discord.js";
import { DateTime } from "luxon";
import config from "../config/env";
import { Coin, CoinSearchResult, CoinStats } from "../interfaces/Api";
import { Command } from "../interfaces/Command";
import { callApi } from "../lib/api";
import { redis } from "../lib/redisClient";

/**
 * Searches for a specific coin (or multiple coins matching the search_term)
 * @param search_term What to search (null for all coins)
 * @returns The matching coins
 */
const getSearchResults = async (
    search_term: string | null,
    replyId: string
): Promise<CoinSearchResult[]> => {
    const redis_key = `search-result-${search_term}-${replyId}`;

    let raw_data = "";
    let data: CoinSearchResult[];

    if (await redis.exists(redis_key)) {
        raw_data = (await redis.get(redis_key)) as string;
        data = JSON.parse(raw_data);
    } else {
        if (search_term !== null) {
            raw_data = await callApi("GET", `/coins/search/${search_term}`);
            data = JSON.parse(raw_data);
            redis.set(redis_key, raw_data);
        } else {
            raw_data = await callApi("GET", "/coins");
            const res: Coin[] = JSON.parse(raw_data);
            data = res.map(
                (elem) =>
                    <CoinSearchResult>{
                        name: elem.name,
                        symbol: elem.symbol,
                        gecko_id: elem.coingeckoId,
                        is_internal: true,
                    }
            );

            raw_data = JSON.stringify(data);
            redis.set(redis_key, raw_data);
        }
    }

    return data;
};

/**
 * Computes the embed corresponding to a specific page of the search results
 * @param results The results array
 * @param currPage The current page
 * @returns The embed and the action row containing the pagination buttons
 */
const searchEmbed = async (
    results: CoinSearchResult[],
    currPage = 1,
    uniqueId: string
): Promise<[MessageEmbed, MessageActionRow | null]> => {
    const embed = new MessageEmbed()
        .setTitle("Search results")
        .setColor(config.accent_color)
        .setTimestamp(Date.now());

    const startIndex = (currPage - 1) * 5 + 1;
    const endIndex = Math.min(currPage * 5, results.length);
    let row: MessageActionRow | null = null;

    if (results.length > 5) {
        embed.setDescription(
            `${startIndex}-${endIndex} out of ${results.length}`
        );

        let prevButton: MessageButton;
        let nextButton: MessageButton;
        row = new MessageActionRow();

        if (currPage > 1) {
            prevButton = new MessageButton()
                .setCustomId(`info-prev-page${uniqueId}`)
                .setLabel("←")
                .setStyle("PRIMARY");
            row.addComponents(prevButton);
        }

        if (currPage < Math.ceil(results.length / 5.0)) {
            nextButton = new MessageButton()
                .setCustomId(`info-next-page${uniqueId}`)
                .setLabel("→")
                .setStyle("PRIMARY");
            row.addComponents(nextButton);
        }
    }

    const printedResults = results.splice(startIndex - 1, 5);
    for (const elem of printedResults) {
        embed.addField(
            elem.name,
            "Identifier: `" + elem.gecko_id + "`, Symbol: *" + elem.symbol + "*"
        );
    }

    return [embed, row];
};

const search = async (interaction: CommandInteraction): Promise<void> => {
    const search_term = interaction.options.getString("search_term");

    try {
        const searchId = interaction.id;
        const data = await getSearchResults(search_term, searchId);
        const [embed, row] = await searchEmbed(data, 1, searchId);

        if (row) {
            await interaction.editReply({
                embeds: [embed],
                components: [row],
            });
        } else {
            await interaction.editReply({
                embeds: [embed],
            });
        }

        // If was send in channel, we can add buttons for the pagination
        if (interaction.channel && data.length > 5) {
            const filter = (i: ButtonInteraction) => {
                return (
                    i.user.id === interaction.user.id &&
                    (i.customId === `info-next-page${searchId}` ||
                        i.customId === `info-prev-page${searchId}`)
                );
            };

            const collector =
                interaction.channel.createMessageComponentCollector({
                    filter,
                    time: 300000,
                    componentType: "BUTTON",
                });

            let page = 1;

            collector.on("end", async (_, reason) => {
                if (reason !== "messageDelete") {
                    interaction.editReply({ components: [] });
                }
            });

            collector.on("collect", async (i) => {
                if (i.replied === true) return;
                if (i.customId.startsWith("info-next-page")) {
                    if (!i.deferred) {
                        await i.deferUpdate();
                    }

                    page += 1;
                    const data = await getSearchResults(search_term, searchId);
                    const [embed, row] = await searchEmbed(
                        data,
                        page,
                        searchId
                    );

                    await i.editReply({
                        embeds: [embed],
                        components: [row as MessageActionRow],
                    });

                    collector.resetTimer();
                }

                if (i.customId.startsWith("info-prev-page")) {
                    if (!i.deferred) {
                        await i.deferUpdate();
                    }

                    page -= 1;
                    const data = await getSearchResults(search_term, searchId);
                    const [embed, row] = await searchEmbed(
                        data,
                        page,
                        searchId
                    );

                    await i.editReply({
                        embeds: [embed],
                        components: [row as MessageActionRow],
                    });

                    collector.resetTimer();
                }
            });
        }

        await interaction.editReply({ embeds: [embed] });
    } catch (err) {
        const embed = new MessageEmbed()
            .setTitle("Search failed")
            .setColor("RED")
            .setDescription(
                "Either the search term was wrong, or the coin doesn't exist in our database currently"
            )
            .setTimestamp(Date.now());

        await interaction.editReply({ embeds: [embed] });
    }
};

const printPercentage = (value: "unavailable" | number): string => {
    if (value == "unavailable") {
        return value;
    } else {
        const sign = value == 0 ? "" : value > 0 ? "+" : "-";
        return `${sign}${Math.abs(value).toFixed(2)}%`;
    }
};

const printValue = (value: "unavailable" | number): string => {
    if (value == "unavailable") {
        return value;
    } else {
        return `${value.toFixed(2)}$`;
    }
};

const printDate = (value: string): string => {
    if (value == "unavailable") {
        return value;
    } else {
        return DateTime.fromISO(value).toLocaleString(DateTime.DATETIME_SHORT);
    }
};

const view = async (interaction: CommandInteraction): Promise<void> => {
    const identifier = interaction.options.getString("identifier");
    try {
        if (identifier) {
            const coin: Coin = JSON.parse(
                await callApi("GET", `/coins/${identifier}`)
            );

            const stats: CoinStats = JSON.parse(
                await callApi("GET", `/coins/${identifier}/stats`)
            );

            const embed = new MessageEmbed()
                .setTitle(coin.name)
                .setColor(config.accent_color)
                .setTimestamp(Date.now());

            embed.addField("Identifier", coin.coingeckoId, true);
            embed.addField("Symbol", coin.symbol, true);
            embed.addField("Value", printValue(stats.value));
            embed.addField("Last update", printDate(stats.last_update));
            embed.addField("1h", printPercentage(stats.last_1h), true);
            embed.addField("24h", printPercentage(stats.last_24h), true);
            embed.addField("7d", printPercentage(stats.last_7day), true);

            await interaction.editReply({ embeds: [embed] });
        } else {
            const embed = new MessageEmbed()
                .setTitle("Identifier not specified")
                .setColor(config.accent_color)
                .setDescription(
                    `You must specify the identifier of the coin for which you want information`
                )
                .setTimestamp(Date.now());

            await interaction.editReply({ embeds: [embed] });
        }
    } catch (err) {
        const embed = new MessageEmbed()
            .setTitle("Not found")
            .setColor(config.accent_color)
            .setDescription(
                `No coin with the identifier "${identifier}" exists!`
            )
            .setTimestamp(Date.now());

        await interaction.editReply({ embeds: [embed] });
    }
};

export const coininfo: Command = {
    data: new SlashCommandBuilder()
        .setName("coininfo")
        .setDescription("Information about cryptocurrencies")
        .addSubcommand((subcommand) => {
            return subcommand
                .setName("search")
                .setDescription("Search a coin in the Cryptoscopos database")
                .addStringOption((option) => {
                    return option
                        .setName("search_term")
                        .setDescription(
                            "What coin to search for (identifier , name, symbol). If none specified, return all stored coins"
                        )
                        .setRequired(false);
                });
        })
        .addSubcommand((subcommand) => {
            return subcommand
                .setName("view")
                .setDescription("See information about a coin")
                .addStringOption((option) => {
                    return option
                        .setName("identifier")
                        .setDescription(
                            "The id of the coin that will be searched"
                        )
                        .setRequired(true);
                });
        }),

    run: async (interaction) => {
        if (!interaction.isCommand()) return;
        await interaction.deferReply({ ephemeral: true });

        const cmd = interaction.options.getSubcommand();

        switch (cmd) {
            case "search":
                {
                    await search(interaction);
                }
                break;
            case "view":
                {
                    await view(interaction);
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
