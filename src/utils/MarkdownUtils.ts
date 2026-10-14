export class MarkdownUtils {
	/** Quote a block of text so blank lines stay inside the quote. */
	static blockquote(text: string, depth = 1): string {
		const prefix = '>'.repeat(depth);
		return text
			.split(/\r\n|\r|\n/)
			.map(line => line.length > 0 ? `${prefix} ${line}` : prefix)
			.join('\n');
	}

	/** A quoted bullet list where wrapped item text stays aligned under its bullet. */
	static bulletList(items: string[], depth = 1, indent = 0): string {
		const prefix = '>'.repeat(depth);
		const pad = '    '.repeat(indent);
		return items
			.map(item => item
				.split(/\r\n|\r|\n/)
				.map((line, i) => i === 0 ? `${prefix} ${pad}- ${line}` : `${prefix} ${pad}  ${line}`)
				.join('\n'))
			.join('\n');
	}

	/** A quoted section: a bold bullet title followed by its (already quoted) body. */
	static section(title: string, body: string, depth = 1): string {
		return `${'>'.repeat(depth)} - **${title}**:\n${body}`;
	}
}
