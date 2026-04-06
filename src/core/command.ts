import { spawn } from "node:child_process";

export interface CommandOptions {
	cwd?: string;
	env?: NodeJS.ProcessEnv;
	timeoutMs?: number;
}

export interface CommandResult {
	ok: boolean;
	exitCode: number | null;
	stdout: string;
	stderr: string;
	timedOut: boolean;
}

export async function runCommand(
	command: string,
	args: string[],
	options: CommandOptions = {},
): Promise<CommandResult> {
	const timeoutMs = options.timeoutMs ?? 20_000;

	return await new Promise<CommandResult>((resolve) => {
		const child = spawn(command, args, {
			cwd: options.cwd,
			env: {
				...process.env,
				...options.env,
			},
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";
		let settled = false;
		let timedOut = false;

		const settle = (exitCode: number | null): void => {
			if (settled) {
				return;
			}

			settled = true;
			clearTimeout(timer);
			resolve({
				ok: exitCode === 0 && !timedOut,
				exitCode,
				stdout,
				stderr,
				timedOut,
			});
		};

		const timer = setTimeout(() => {
			timedOut = true;
			child.kill("SIGTERM");
			setTimeout(() => {
				if (!settled) {
					child.kill("SIGKILL");
				}
			}, 1_000);
		}, timeoutMs);

		child.stdout.setEncoding("utf8");
		child.stderr.setEncoding("utf8");
		child.stdout.on("data", (chunk: string) => {
			stdout += chunk;
		});
		child.stderr.on("data", (chunk: string) => {
			stderr += chunk;
		});
		child.on("error", (error: Error) => {
			stderr += error.message;
			settle(1);
		});
		child.on("close", (code: number | null) => {
			settle(code);
		});
	});
}
