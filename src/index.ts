import { Client } from "discord.js";
import { IntentOptions } from "./config/IntentOptions";
import { onGuildCreate, onGuildDelete } from "./events/onGuildAction";
import { onInteraction } from "./events/onInteraction";
import { onReady } from "./events/onReady";
import { callApi } from "./lib/api";

(async () => {
    const bot = new Client({ intents: IntentOptions });

    bot.on("ready", async () => await onReady(bot));
    bot.on(
        "interactionCreate",
        async (interaction) => await onInteraction(interaction)
    );
    bot.on("guildCreate", onGuildCreate);
    bot.on("guildDelete", onGuildDelete);

    await bot.login(process.env.BOT_TOKEN);

    // console.log(await callApi("GET", "/coins"));
})();
