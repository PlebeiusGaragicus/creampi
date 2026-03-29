import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { config } from "../config";
import type { RuntimeAdapter, AgentTurnRequest, AgentEventCallback } from "./types";

/**
 * Direct adapter: runs `pi --mode rpc` as a subprocess on the host.
 * Suitable for development and single-tenant setups without nspawn.
 */
export class DirectAdapter implements RuntimeAdapter {
	private activeTurns = new Map<string, ChildProcess>();

	async executeTurn(
		request: AgentTurnRequest,
		onEvent: AgentEventCallback,
	): Promise<void> {
		const existing = this.activeTurns.get(request.sessionId);
		if (existing) {
			onEvent({ type: "error", data: { message: "A turn is already active for this session" } });
			return;
		}

		const piArgs = ["--mode", "rpc", "--no-session"];

		const model = request.model || config.lmStudio.defaultModel;
		if (model) piArgs.push("--model", model);
		if (request.provider) piArgs.push("--provider", request.provider);

		const env: Record<string, string> = { ...process.env as Record<string, string> };
		if (config.lmStudio.apiKey) {
			env["LLM_API_KEY"] = config.lmStudio.apiKey;
		}

		const proc = spawn("pi", piArgs, {
			stdio: ["pipe", "pipe", "pipe"],
			env,
		});

		this.activeTurns.set(request.sessionId, proc);

		const rl = createInterface({ input: proc.stdout! });

		rl.on("line", (line) => {
			try {
				const event = JSON.parse(line);
				this.dispatchPiEvent(event, onEvent);
			} catch {
				// non-JSON output from Pi, ignore
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
			// stdin may be closed
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
	}

	private dispatchPiEvent(event: any, onEvent: AgentEventCallback): void {
		switch (event.type) {
			case "message_update": {
				const assistantEvent = event.assistantMessageEvent;
				if (assistantEvent?.type === "text_delta") {
					onEvent({ type: "text_delta", data: { delta: assistantEvent.delta } });
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
