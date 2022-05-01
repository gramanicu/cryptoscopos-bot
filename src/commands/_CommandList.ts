import { Command } from "../interfaces/Command";
import { coininfo } from "./coininfo";
import { cryptothon } from "./cryptothon";

export const CommandList: Command[] = [coininfo, cryptothon];
