import { $ } from 'bun';

let handler = async (m, { loading }) => {
    try {
        await loading();

        const proc = await $`fastfetch --logo none --format json`;
        const raw = proc.stdout.toString().trim();

        const data = JSON.parse(raw);

        const get = (type) => data.find(x => x.type === type)?.result;

        const os = get("OS");
        const host = get("Host");
        const kernel = get("Kernel");
        const uptime = get("Uptime");
        const packages = get("Packages");
        const shell = get("Shell");
        const display = get("Display");
        const terminal = get("Terminal");
        const cpu = get("CPU");
        const gpu = get("GPU");
        const memory = get("Memory");

        const user = process.env.USER || "root";
        const hostname = os?.hostname || require("os").hostname();
        
        let speedTestResult;
        const speed = await Bun.spawn(["python3", "lib/python/speed.py"], { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' })
        if (speed.stderr && speed.stderr.includes("403")) {
            speedTestResult = null;
        } else { 
            speedTestResult = speed.stdout.text() || "";
        }

        let message = `\`\`\`
${user}@${hostname}
---------

OS: ${os?.name || "-"} ${os?.version || ""} ${os?.arch || ""}
Host: ${host?.name || "-"}
Kernel: ${kernel?.release || "-"}
Uptime: ${uptime?.pretty || "-"}
Packages: ${packages?.all || 0}
Shell: ${shell?.name || "-"} ${shell?.version || ""}
Resolution: ${display?.resolution || "-"}
Terminal: ${terminal?.tty || terminal?.name || "-"}
CPU: ${cpu?.name || "-"}
GPU: ${gpu?.name || "-"}
Memory: ${memory?.used || "-"} / ${memory?.total || "-"}
\`\`\``;
        if (speedTestResult) {
            message += `\n*Speedtest Result:*\n${speedTestResult}`;
        }

        return await m.reply(message);
    } finally {
        await loading(true);
    }
};

handler.command = ['neofetch'];
handler.category = ['info'];

export default handler;
