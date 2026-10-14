import {Editor} from "obsidian";

export class EditorUtils {
	/** Insert `content` as its own block, separated from surrounding text by blank lines. */
	static insertBlock(editor: Editor, content: string) {
		const text = editor.getValue();
		const start = editor.posToOffset(editor.getCursor("from"));
		const end = editor.posToOffset(editor.getCursor("to"));

		const charBefore = start > 0 ? text[start - 1] : "\n";
		const blankBefore = charBefore === "\n" && (start < 2 || text[start - 2] === "\n");
		const prefix = blankBefore ? "" : charBefore === "\n" ? "\n" : "\n\n";

		const charAfter = text[end] ?? "\n";
		const blankAfter = charAfter === "\n" && text[end + 1] === "\n";
		const suffix = blankAfter ? "" : charAfter === "\n" ? "\n" : "\n\n";

		editor.replaceSelection(prefix + content.replace(/\s+$/, '') + suffix);
	}
}
