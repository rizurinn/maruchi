import pino from "pino";

export const log = pino({
    level: Bun.env.LOG_LEVEL || "silent",
    transport: {
        target: "pino-pretty",
        options: {
            colorize: true,
            translateTime: Bun.env.LOG_TIME_FORMAT,
            ignore: Bun.env.LOG_IGNORE,
        },
    },
});
