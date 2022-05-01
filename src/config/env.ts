import { HexColorString } from "discord.js";
import dotenv from "dotenv";

dotenv.config();

const config = {
    bot_token: process.env.BOT_TOKEN as string,
    redis_url: process.env.REDIS_URL as string,
    api_url: process.env.API_URL as string,
    api_domain: process.env.API_DOMAIN as string,
    api_client_id: process.env.API_CLIENT_ID as string,
    api_audience: process.env.API_AUDIENCE as string,
    api_secret: process.env.API_SECRET as string,
    accent_color: "#58407e" as HexColorString,
};

export default config;
