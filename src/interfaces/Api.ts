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
    id?: string;
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

interface User {
    private_id: string;
    id: string;
}

interface Account {
    coinId: string;
    userId: string;
    id: string;

    coin?: Coin;
}

interface Transaction {
    id: string;
    timestamp: string;
    amount: number;
    value: number;
    accountId: string;

    account?: Account;
}

export { CoinSearchResult, Coin, CoinStats, User, Account, Transaction };
