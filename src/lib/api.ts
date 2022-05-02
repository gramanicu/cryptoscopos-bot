import axios, { AxiosResponse } from "axios";
import { redis } from "./redisClient";
import config from "../config/env";

const tokenKey = "discordManageToken";

const updateManageToken = async () => {
    let res: AxiosResponse;
    try {
        res = await axios.request({
            method: "POST",
            url: "/oauth/token",
            baseURL: `https://${config.api_domain}`,
            headers: { "content-type": "application/json" },
            data: {
                grant_type: "client_credentials",
                client_id: config.api_client_id,
                client_secret: config.api_secret,
                audience: config.api_audience,
            },
        });

        redis.set(
            tokenKey,
            res.data.access_token,
            "PX",
            res.data.expires_in * 0.95
        );
    } catch (err) {
        console.error(err);
    }
};

const callApi = async (
    method: string,
    url: string,
    data?: object
): Promise<string> => {
    let manageToken = "";
    if (await redis.exists(tokenKey)) {
        manageToken = String(await redis.get(tokenKey));
    } else {
        await updateManageToken();
        manageToken = String(await redis.get(tokenKey));
    }

    let res: AxiosResponse;
    try {
        res = await axios.request({
            method,
            url,
            baseURL: `https://${config.api_url}`,
            headers: {
                authorization: `Bearer ${manageToken}`,
            },
            data,
        });

        return JSON.stringify(res.data);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            // or just re-throw the error
            throw error;
        } else {
            throw new Error("different error than axios");
        }
    }
};

const callApiAsPrivateUser = async (
    method: string,
    url: string,
    user_id: string,
    data?: object
): Promise<string> => {
    let manageToken = "";
    if (await redis.exists(tokenKey)) {
        manageToken = String(await redis.get(tokenKey));
    } else {
        await updateManageToken();
        manageToken = String(await redis.get(tokenKey));
    }

    let res: AxiosResponse;
    try {
        res = await axios.request({
            method,
            url,
            baseURL: `https://${config.api_url}`,
            headers: {
                private_id: user_id,
                authorization: `Bearer ${manageToken}`,
            },
            data,
        });

        return JSON.stringify(res.data);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            // or just re-throw the error
            throw error;
        } else {
            throw new Error("different error than axios");
        }
    }
};

export { callApi, callApiAsPrivateUser };
