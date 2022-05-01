interface CoinSearchResult {
    name: string;
    gecko_id: string;
    symbol: string;
    is_internal: true;
}

interface Coin {
    coingeckoId: string;
    symbol: string;
    name: string;
}

interface CoinStats {
    gecko_id: string;
    value: number | "unavailable";
    last_update: string;
    last_1h: number | "unavailable";
    last_24h: number | "unavailable";
    last_7day: number | "unavailable";
    last_30day: number | "unavailable";
}

export { CoinSearchResult, Coin, CoinStats };
