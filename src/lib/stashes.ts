import { Coin } from "../interfaces/Api";
import { callApi } from "./api";
import { redis } from "./redisClient";

const coinsRedisPrefix = "coin-stash-";

export const updateCoinStash = async () => {
    const raw_data = await callApi("GET", "/coins");
    const res: Coin[] = JSON.parse(raw_data);

    for (const coin of res) {
        await redis.set(`${coinsRedisPrefix}${coin.id}`, JSON.stringify(coin));
    }
};

export const getCoinFromStash = async (id: string): Promise<Coin | null> => {
    const raw_coin = await redis.get(`${coinsRedisPrefix}${id}`);

    if (raw_coin) {
        const coin = JSON.parse(raw_coin) as Coin;
        return coin;
    }
    return null;
};
