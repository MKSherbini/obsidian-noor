/** Central console logger, so diagnostic output is gated in one place. */
export class Logger {
	static debugEnabled = false;

	static error(message: string, error?: unknown) {
		if (!Logger.debugEnabled) return;
		console.error(`Noor: ${message}`, error);
	}
}
