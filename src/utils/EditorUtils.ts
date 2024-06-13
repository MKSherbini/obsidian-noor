import {Editor} from "obsidian";

export class EditorUtils {

	static insertInNewLine(editor: Editor, content: string) {
		editor.setSelection({line: editor.getCursor().line, ch: editor.getCursor().ch});
		if (editor.getCursor().ch > 1)
			editor.replaceSelection("\n")
		editor.replaceSelection(content);
	}
}
