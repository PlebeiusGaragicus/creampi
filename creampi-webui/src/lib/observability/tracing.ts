let counter = 0;

export function generateCorrelationId(): string {
	return `${Date.now().toString(36)}-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export class Span {
	readonly id: string;
	readonly name: string;
	private startTime: number;
	private attributes: Record<string, unknown> = {};

	constructor(name: string, correlationId?: string) {
		this.id = correlationId ?? generateCorrelationId();
		this.name = name;
		this.startTime = performance.now();
	}

	setAttribute(key: string, value: unknown) {
		this.attributes[key] = value;
	}

	end(): { name: string; durationMs: number; attributes: Record<string, unknown> } {
		return {
			name: this.name,
			durationMs: performance.now() - this.startTime,
			attributes: { ...this.attributes },
		};
	}
}
