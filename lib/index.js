//=======================================================//

import chalk from 'chalk';

console.log(chalk.whiteBright("\n• © 2026 Baileys Mod By - AL CRXYZZ88` OFC ☢️"));
console.log(chalk.cyan("• Telegram: ") + chalk.greenBright("https://t.me/aloffc_id"));
console.log(chalk.cyan("• Youtube: ") + chalk.greenBright("https://youtube.com/@sky_doo")); 

console.log(chalk.gray("------------------------------\n"));

import makeWASocket from "./Socket/index.js";
//=======================================================//
export * from "./Defaults/index.js";
export * from "./WABinary/index.js";
export * from "../WAProto/index.js";
export * from "./WAUSync/index.js";
export * from "./Store/index.js";
export * from "./Utils/index.js";
export * from "./Types/index.js";
export * from "./WAM/index.js";
//=======================================================//
export { makeWASocket };
export default makeWASocket;
//=======================================================//