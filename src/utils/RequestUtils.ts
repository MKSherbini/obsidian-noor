import {requestUrl} from "obsidian";
import type {RequestUrlResponse} from "obsidian";

const DEFAULT_TIMEOUT_MS = 20000;

export class RequestUtils {
	/**
	 * `requestUrl` has no timeout and throws on 400+, which would hide a "no match" 404,
	 * so disable the throw and race a timer instead.
	 */
	static async requestUrlWithTimeout(url: string, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<RequestUrlResponse> {
		let timer: number | undefined;
		try {
			return await Promise.race([
				requestUrl({url, throw: false}),
				new Promise<never>((_resolve, reject) => {
					timer = window.setTimeout(
						() => reject(new Error(`The request timed out after ${timeoutMs} ms.`)),
						timeoutMs
					);
				}),
			]);
		} finally {
			if (timer !== undefined) window.clearTimeout(timer);
		}
	}
}
