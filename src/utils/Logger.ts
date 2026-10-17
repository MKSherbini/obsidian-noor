/** Central console logger, so diagnostic output is gated in one place. */
export class Logger {
	/** On in dev builds; off in production ones. */
	static debugEnabled = __DEV__;

	/** Logs a diagnostic message; dev builds only. */
	static debug(message: string) {
		if (!Logger.debugEnabled) return;
		console.warn(`Noor: ${message}`);
	}

	/** Logs a failure for the dev console; user-facing failures are surfaced via `Notice`. */
	static error(message: string, error?: unknown) {
		if (!Logger.debugEnabled) return;
		console.error(`Noor: ${message}`, error);
	}
}
