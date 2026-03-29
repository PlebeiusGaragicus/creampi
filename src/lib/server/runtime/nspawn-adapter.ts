import { execFile, execFileSync, spawn, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import { createInterface } from "node:readline";
import {
	existsSync,
	mkdirSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { config } from "../config";
import type { RuntimeAdapter, AgentTurnRequest, AgentEventCallback } from "./types";

const execFileAsync = promisify(execFile);

const MACHINES_DIR = "/var/lib/machines";
const OVERLAYS_DIR = join(MACHINES_DIR, "overlays");
const NSPAWN_DIR = "/etc/systemd/nspawn";
const IPC_HOST = "10.100.0.1";

interface ContainerState {
	machineName: string;
	ip: string;
	running: boolean;
	token: string;
}

/**
 * Nspawn adapter: runs Pi inside systemd-nspawn containers.
 * Derived from MyClaw's ContainerManager and PiRpc patterns.
 */
export class NspawnAdapter implements RuntimeAdapter {
	private containers = new Map<string, ContainerState>();
	private activeTurns = new Map<string, ChildProcess>();
	private ipCounter = 10;

	private machineName(agentId: string): string {
		return `creampi-${agentId}`;
	}

	private assignIp(): string {
		return `10.100.0.${this.ipCounter++}`;
	}

	async ensureContainer(agentId: string): Promise<ContainerState> {
		const existing = this.containers.get(agentId);
		if (existing?.running) {
			const alive = await this.checkAlive(agentId);
			if (alive) return existing;
		}

		const machine = this.machineName(agentId);
		const token = existing?.token ?? randomBytes(32).toString("hex");
		const ip = existing?.ip ?? this.assignIp();

		this.ensureOverlay(agentId);
		this.writeNspawnConfig(agentId, token);

		await execFileAsync("systemctl", ["daemon-reload"], { timeout: 10_000 });
		await this.bootMachine(machine);
		await this.configureNetwork(machine, ip);

		const state: ContainerState = { machineName: machine, ip, running: true, token };
		this.containers.set(agentId, state);
		console.log(`[nspawn] container "${agentId}" running at ${ip}`);
		return state;
	}

	async executeTurn(
		request: AgentTurnRequest,
		onEvent: AgentEventCallback,
	): Promise<void> {
		if (this.activeTurns.has(request.sessionId)) {
			onEvent({ type: "error", data: { message: "Turn already active" } });
			return;
		}

		const agentId = "default";
		await this.ensureContainer(agentId);

		const machine = this.machineName(agentId);
		const piArgs = ["--mode", "rpc", "--no-session"];

		const model = request.model || config.lmStudio.defaultModel;
		if (model) piArgs.push("--model", model);
		if (request.provider) piArgs.push("--provider", request.provider);

		const spawnArgs = [
			"--machine", machine,
			"--pipe", "--wait", "--collect", "--quiet",
			"--uid", "agent",
			"--working-directory", "/home/agent",
		];

		if (config.lmStudio.apiKey) {
			spawnArgs.push("--setenv", `LLM_API_KEY=${config.lmStudio.apiKey}`);
		}

		spawnArgs.push("--", "pi", ...piArgs);

		const proc = spawn("systemd-run", spawnArgs, {
			stdio: ["pipe", "pipe", "pipe"],
		});

		this.activeTurns.set(request.sessionId, proc);

		const rl = createInterface({ input: proc.stdout! });

		rl.on("line", (line) => {
			try {
				const event = JSON.parse(line);
				this.dispatchPiEvent(event, onEvent);
			} catch {
				// non-JSON Pi output
			}
		});

		proc.stderr?.on("data", (chunk: Buffer) => {
			const text = chunk.toString().trim();
			if (text) {
				onEvent({ type: "error", data: { message: text } });
			}
		});

		return new Promise<void>((resolve, reject) => {
			proc.on("exit", (code) => {
				this.activeTurns.delete(request.sessionId);
				if (code !== 0 && code !== null) {
					onEvent({ type: "error", data: { message: `Pi exited with code ${code}` } });
				}
				resolve();
			});

			proc.on("error", (err) => {
				this.activeTurns.delete(request.sessionId);
				onEvent({ type: "error", data: { message: err.message } });
				reject(err);
			});

			const prompt = JSON.stringify({ type: "prompt", message: request.message }) + "\n";
			proc.stdin!.write(prompt);
		});
	}

	abortTurn(sessionId: string): void {
		const proc = this.activeTurns.get(sessionId);
		if (!proc) return;

		try {
			proc.stdin!.write(JSON.stringify({ type: "abort" }) + "\n");
		} catch {
			// stdin may already be closed
		}

		setTimeout(() => {
			if (this.activeTurns.has(sessionId)) {
				proc.kill("SIGTERM");
				this.activeTurns.delete(sessionId);
			}
		}, 3000);
	}

	async shutdown(): Promise<void> {
		for (const [sessionId, proc] of this.activeTurns) {
			proc.kill("SIGTERM");
			this.activeTurns.delete(sessionId);
		}

		for (const [agentId] of this.containers) {
			await this.stopContainer(agentId);
		}
	}

	private async checkAlive(agentId: string): Promise<boolean> {
		const machine = this.machineName(agentId);
		try {
			const { stdout } = await execFileAsync(
				"machinectl",
				["show", machine, "--property=State"],
				{ timeout: 5_000 },
			);
			const running = stdout.trim().includes("running");
			const state = this.containers.get(agentId);
			if (state) state.running = running;
			return running;
		} catch {
			const state = this.containers.get(agentId);
			if (state) state.running = false;
			return false;
		}
	}

	private async stopContainer(agentId: string): Promise<void> {
		const machine = this.machineName(agentId);
		try {
			await execFileAsync("machinectl", ["poweroff", machine], { timeout: 30_000 });
		} catch {
			try {
				await execFileAsync("machinectl", ["terminate", machine], { timeout: 10_000 });
			} catch {
				// already stopped
			}
		}
		const state = this.containers.get(agentId);
		if (state) state.running = false;
	}

	private ensureOverlay(agentId: string): void {
		const machine = this.machineName(agentId);
		const upperDir = join(OVERLAYS_DIR, `creampi-${agentId}`, "upper");
		const workDir = join(OVERLAYS_DIR, `creampi-${agentId}`, "work");
		const mergedDir = join(MACHINES_DIR, machine);

		mkdirSync(upperDir, { recursive: true });
		mkdirSync(workDir, { recursive: true });
		mkdirSync(mergedDir, { recursive: true });

		try {
			const out = execFileSync(
				"findmnt", ["-n", "-o", "FSTYPE", mergedDir],
				{ timeout: 5_000, encoding: "utf-8" },
			);
			if (out.toString().trim() === "overlay") return;
		} catch {
			// Not mounted, proceed
		}

		const opts = `lowerdir=${config.sandbox.baseImage},upperdir=${upperDir},workdir=${workDir}`;
		execFileSync(
			"mount", ["-t", "overlay", "overlay", "-o", opts, mergedDir],
			{ timeout: 10_000 },
		);
	}

	private writeNspawnConfig(agentId: string, token: string): void {
		mkdirSync(NSPAWN_DIR, { recursive: true });
		const machine = this.machineName(agentId);
		const cubicleDir = join(config.sandbox.cubiclesDir, agentId);
		mkdirSync(cubicleDir, { recursive: true });

		const envVars = [
			`Environment=CREAMPI_AGENT_ID=${agentId}`,
			`Environment=CREAMPI_TOKEN=${token}`,
		];

		if (config.lmStudio.apiKey) {
			envVars.push(`Environment=LLM_API_KEY=${config.lmStudio.apiKey}`);
		}

		const nspawnContent = `# Auto-generated by creampi-bff NspawnAdapter
[Exec]
Boot=yes
${envVars.join("\n")}
Capability=CAP_NET_BIND_SERVICE CAP_DAC_OVERRIDE CAP_CHOWN CAP_FOWNER CAP_SETUID CAP_SETGID CAP_SYS_CHROOT
SystemCallFilter=~@swap @reboot @raw-io @clock @module @obsolete

[Files]
Bind=${cubicleDir}:/home/agent

[Network]
Bridge=${config.sandbox.bridge}
`;

		writeFileSync(join(NSPAWN_DIR, `${machine}.nspawn`), nspawnContent);

		const overrideDir = `/etc/systemd/system/systemd-nspawn@${machine}.service.d`;
		mkdirSync(overrideDir, { recursive: true });
		writeFileSync(
			join(overrideDir, "creampi.conf"),
			`[Service]
ExecStart=
ExecStart=systemd-nspawn --quiet --keep-unit --boot --link-journal=try-guest --network-veth --settings=override --machine=%i
MemoryMax=1G
CPUQuota=100%
TasksMax=200
`,
		);
	}

	private async bootMachine(machine: string): Promise<void> {
		try {
			const { stdout } = await execFileAsync(
				"machinectl",
				["show", machine, "--property=State"],
				{ timeout: 5_000 },
			);
			if (stdout.trim().includes("running")) return;
		} catch {
			// not running
		}

		await execFileAsync("machinectl", ["start", machine], { timeout: 60_000 });

		for (let i = 0; i < 30; i++) {
			await new Promise((r) => setTimeout(r, 1000));
			try {
				const { stdout } = await execFileAsync(
					"machinectl",
					["show", machine, "--property=State"],
					{ timeout: 5_000 },
				);
				if (stdout.trim().includes("running")) return;
			} catch {
				// still starting
			}
		}
		throw new Error(`Machine "${machine}" failed to reach running state`);
	}

	private async configureNetwork(machine: string, ip: string): Promise<void> {
		const cmd = `ip addr add ${ip}/24 dev host0 2>/dev/null; ip link set host0 up; ip route add default via ${IPC_HOST} 2>/dev/null; true`;

		for (let attempt = 0; attempt < 3; attempt++) {
			try {
				await execFileAsync(
					"systemd-run",
					[
						"--machine", machine,
						"--pipe", "--wait", "--quiet",
						"--", "/bin/bash", "-c", cmd,
					],
					{ timeout: 15_000 },
				);
				return;
			} catch {
				if (attempt < 2) {
					await new Promise((r) => setTimeout(r, (attempt + 1) * 1000));
				} else {
					throw new Error(`Failed to configure network for "${machine}"`);
				}
			}
		}
	}

	private dispatchPiEvent(event: any, onEvent: AgentEventCallback): void {
		switch (event.type) {
			case "message_update": {
				const ae = event.assistantMessageEvent;
				if (ae?.type === "text_delta") {
					onEvent({ type: "text_delta", data: { delta: ae.delta } });
				}
				break;
			}
			case "tool_call_start":
				onEvent({
					type: "tool_call",
					data: { name: event.name ?? "unknown", args: event.arguments ?? {} },
				});
				break;
			case "tool_result":
				onEvent({
					type: "tool_result",
					data: { name: event.name ?? "unknown", result: event.result ?? "" },
				});
				break;
			case "agent_end":
				onEvent({
					type: "agent_end",
					data: { messages: event.messages ?? [] },
				});
				break;
		}
	}
}
