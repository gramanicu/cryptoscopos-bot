import Redis from "ioredis";
import config from "../config/env";

export const redis = new Redis(config.redis_url);
