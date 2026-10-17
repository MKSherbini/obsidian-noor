import {App, Modal, SearchComponent} from 'obsidian';
import {Logger} from '../utils/Logger';

/** A single search hit; `code` is handed back to build the quote. */
export interface QuoteSearchItem {
	/** Identifier expected by the plugin's quote builders (e.g. "2:255" or a Hadith id). */
	code: string;
	/** Primary line shown in the results list. */
	title: string;
	/** Secondary line shown under the title. */
	detail: string;
}

export type QuoteSearchAction = 'insert' | 'file' | 'file-popup' | 'file-append' | 'file-append-popup';

export interface QuoteSearchOptions {
	title: string;
	placeholder: string;
	emptyText: string;
	/** Namespace for the session cache, so different sources don't collide. */
	cacheKey: string;
	/** Queries shorter than this are never searched. Defaults to 1. */
	minQueryLength?: number;
	search: (query: string) => Promise<QuoteSearchItem[]>;
	/** Overrides the default no-results line; return undefined to keep it. */
	noResultsText?: (query: string) => string | undefined;
	onChoose: (item: QuoteSearchItem, action: QuoteSearchAction) => void | Promise<void>;
}

interface ActionDefinition {
	id: QuoteSearchAction;
	label: string;
	description: string;
}

const ACTIONS: ActionDefinition[] = [
	{id: 'insert', label: 'Insert at cursor', description: 'Insert this quote as a new block at the cursor'},
	{id: 'file', label: 'Generate Dhikr file (overwrite)', description: 'Write only this quote to the Dhikr file and open it'},
	{id: 'file-append', label: 'Append to Dhikr file', description: 'Append this quote to the Dhikr file and open it'},
	{id: 'file-popup', label: 'Generate Dhikr file (overwrite, popup)', description: 'Write only this quote to the Dhikr file and open it in a popup window'},
	{id: 'file-append-popup', label: 'Append to Dhikr file (popup)', description: 'Append this quote to the Dhikr file and open it in a popup window'},
];

const DEBOUNCE_MS = 300;
const DETAIL_MAX_LENGTH = 180;
const CACHE_MAX_ENTRIES = 200;
/** Invisible bidi controls that some arabic keyboards insert and the search APIs do not match. */
const BIDI_CONTROL = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

/** Session cache shared by every search modal, keyed by `cacheKey` + query. */
const cache = new Map<string, QuoteSearchItem[]>();

function cacheSet(key: string, items: QuoteSearchItem[]) {
	if (cache.size >= CACHE_MAX_ENTRIES) {
		const oldest = cache.keys().next().value;
		if (oldest !== undefined) cache.delete(oldest);
	}
	cache.set(key, items);
}

/**
 * Debounced, cancellable modal that renders a list of {@link QuoteSearchItem}s;
 * the search itself comes from the caller.
 */
export class QuoteSearchModal extends Modal {
	private readonly options: QuoteSearchOptions;
	private searchComponent!: SearchComponent;
	private bodyEl!: HTMLElement;

	private results: QuoteSearchItem[] = [];
	private resultRows: HTMLElement[] = [];
	private activeResult = -1;
	private lastQuery = '';

	private actionRows: HTMLElement[] = [];
	private activeAction = 0;
	private selected: QuoteSearchItem | null = null;
	private showingActions = false;

	private debounceTimer: number | undefined;
	/** Incremented per keystroke so a stale response can't overwrite a newer one. */
	private requestToken = 0;

	constructor(app: App, options: QuoteSearchOptions) {
		super(app);
		this.options = options;
	}

	onOpen() {
		this.setTitle(this.options.title);

		this.searchComponent = new SearchComponent(this.contentEl);
		this.searchComponent.setPlaceholder(this.options.placeholder);
		this.searchComponent.onChange(() => this.onQueryChanged(this.searchComponent.getValue()));
		this.searchComponent.inputEl.addEventListener('keydown', (evt) => this.onKeyDown(evt));

		this.bodyEl = this.contentEl.createDiv({cls: 'noor-search-body'});
		this.renderState(this.options.emptyText);

		this.searchComponent.inputEl.focus();

		// While the action list is open, Escape returns to the results instead of closing.
		this.scope.register([], 'Escape', (evt: KeyboardEvent) => {
			if (!this.showingActions) return;
			evt.preventDefault();
			this.showResults();
			return false;
		});
	}

	onClose() {
		if (this.debounceTimer !== undefined) window.clearTimeout(this.debounceTimer);
		this.contentEl.empty();
	}

	private onQueryChanged(rawQuery: string) {
		const query = rawQuery.replace(BIDI_CONTROL, '').trim();
		this.lastQuery = query;
		this.selected = null;

		if (this.debounceTimer !== undefined) {
			window.clearTimeout(this.debounceTimer);
			this.debounceTimer = undefined;
		}

		if (query.length < this.minQueryLength) {
			this.requestToken++; // invalidate any in-flight request
			this.renderState(this.stateText(query));
			return;
		}

		const cached = cache.get(this.cacheId(query));
		if (cached != null) {
			this.requestToken++;
			this.renderResults(cached, query);
			return;
		}

		this.renderState('Searching…');
		const token = ++this.requestToken;
		this.debounceTimer = window.setTimeout(() => void this.runSearch(query, token), DEBOUNCE_MS);
	}

	private async runSearch(query: string, token: number) {
		try {
			const results = await this.options.search(query);
			if (token !== this.requestToken) return; // superseded by a newer query
			cacheSet(this.cacheId(query), results);
			this.renderResults(results, query);
		} catch (error) {
			if (token !== this.requestToken) return;
			const message = error instanceof Error && error.message
				? error.message
				: 'The search failed. Please check your connection and try again.';
			this.renderState(message, true);
		}
	}

	private cacheId(query: string): string {
		return `${this.options.cacheKey}\u0000${query}`;
	}

	private get minQueryLength(): number {
		return this.options.minQueryLength ?? 1;
	}

	/** The text to show instead of results. */
	private stateText(query: string): string {
		if (query.length === 0) return this.options.emptyText;
		if (query.length < this.minQueryLength) return `Type at least ${this.minQueryLength} characters to search.`;
		return this.options.noResultsText?.(query) ?? `No results for “${query}”.`;
	}

	private renderState(message: string, isError = false) {
		this.showingActions = false;
		this.results = [];
		this.resultRows = [];
		this.activeResult = -1;
		this.bodyEl.empty();
		this.bodyEl.createDiv({cls: isError ? 'noor-search-state is-error' : 'noor-search-state', text: message});
	}

	/** Renders `results`, with `activeIndex` highlighted. */
	private renderResults(results: QuoteSearchItem[], query: string, activeIndex = 0) {
		this.showingActions = false;
		this.results = results;
		this.resultRows = [];
		this.activeResult = results.length > 0 ? activeIndex : -1;
		this.bodyEl.empty();

		if (results.length === 0) {
			this.bodyEl.createDiv({cls: 'noor-search-state', text: this.stateText(query)});
			return;
		}

		const list = this.bodyEl.createDiv({cls: 'noor-search-results'});
		results.forEach((item, index) => {
			const row = list.createDiv({cls: 'noor-search-result suggestion-item'});
			row.createDiv({cls: 'noor-search-result-title', text: item.title});
			row.createDiv({cls: 'noor-search-result-detail', text: truncate(item.detail)});
			row.addEventListener('click', () => this.selectItem(index));
			row.addEventListener('mouseenter', () => this.setActiveResult(index));
			this.resultRows.push(row);
		});
		this.highlightActiveResult();
	}

	private setActiveResult(index: number) {
		if (index < 0 || index >= this.resultRows.length) return;
		this.activeResult = index;
		this.highlightActiveResult();
	}

	private moveActiveResult(delta: number) {
		const count = this.resultRows.length;
		if (count === 0) return;
		this.activeResult = (this.activeResult + delta + count) % count;
		this.highlightActiveResult();
	}

	private highlightActiveResult() {
		this.resultRows.forEach((row, index) => row.classList.toggle('is-selected', index === this.activeResult));
		this.resultRows[this.activeResult]?.scrollIntoView({block: 'nearest'});
	}

	private selectItem(index: number) {
		const item = this.results[index];
		if (item == null) return;
		this.selected = item;
		this.activeResult = index;
		this.showActions(item);
	}

	private showActions(item: QuoteSearchItem) {
		this.showingActions = true;
		this.actionRows = [];
		this.activeAction = 0;
		this.bodyEl.empty();

		const header = this.bodyEl.createDiv({cls: 'noor-search-result suggestion-item is-selected'});
		header.createDiv({cls: 'noor-search-result-title', text: item.title});
		header.createDiv({cls: 'noor-search-result-detail', text: truncate(item.detail)});

		ACTIONS.forEach((action, index) => {
			const row = this.bodyEl.createDiv({cls: 'noor-search-action suggestion-item'});
			row.createDiv({cls: 'noor-search-result-title', text: action.label});
			row.createDiv({cls: 'noor-search-result-detail', text: action.description});
			row.addEventListener('click', () => void this.choose(action.id));
			row.addEventListener('mouseenter', () => this.setActiveAction(index));
			this.actionRows.push(row);
		});

		const backIndex = this.actionRows.length;
		const back = this.bodyEl.createDiv({cls: 'noor-search-back suggestion-item'});
		back.setText('Back to results');
		back.addEventListener('click', () => this.showResults());
		back.addEventListener('mouseenter', () => this.setActiveAction(backIndex));
		this.actionRows.push(back);

		this.highlightActiveAction();
	}

	private setActiveAction(index: number) {
		if (index < 0 || index >= this.actionRows.length) return;
		this.activeAction = index;
		this.highlightActiveAction();
	}

	private moveActiveAction(delta: number) {
		const count = this.actionRows.length;
		if (count === 0) return;
		this.activeAction = (this.activeAction + delta + count) % count;
		this.highlightActiveAction();
	}

	private highlightActiveAction() {
		this.actionRows.forEach((row, index) => row.classList.toggle('is-selected', index === this.activeAction));
		this.actionRows[this.activeAction]?.scrollIntoView({block: 'nearest'});
	}

	private showResults() {
		this.selected = null;
		if (this.results.length > 0) {
			this.renderResults(this.results, this.lastQuery, this.activeResult);
		} else {
			this.renderState(this.stateText(this.lastQuery));
		}
		this.searchComponent.inputEl.focus();
	}

	private onKeyDown(evt: KeyboardEvent) {
		if (this.showingActions) {
			if (evt.key === 'ArrowDown' || evt.key === 'ArrowUp') {
				evt.preventDefault();
				this.moveActiveAction(evt.key === 'ArrowDown' ? 1 : -1);
			} else if (evt.key === 'Enter') {
				evt.preventDefault();
				this.activateAction();
			}
			return;
		}

		if (this.resultRows.length === 0) return;

		if (evt.key === 'ArrowDown') {
			evt.preventDefault();
			this.moveActiveResult(1);
		} else if (evt.key === 'ArrowUp') {
			evt.preventDefault();
			this.moveActiveResult(-1);
		} else if (evt.key === 'Enter') {
			evt.preventDefault();
			this.selectItem(this.activeResult);
		}
	}

	private activateAction() {
		// The row past the actions is "Back to results".
		const action = ACTIONS[this.activeAction];
		if (action == null) {
			this.showResults();
			return;
		}
		void this.choose(action.id);
	}

	private async choose(action: QuoteSearchAction) {
		const item = this.selected;
		if (item == null) return;
		this.close();
		try {
			await this.options.onChoose(item, action);
		} catch (error) {
			// `onChoose` surfaces its own errors; guard against an unhandled rejection.
			Logger.error('Quote action failed', error);
		}
	}
}

function truncate(text: string, maxLength = DETAIL_MAX_LENGTH): string {
	const singleLine = text.replace(/\s+/g, ' ').trim();
	return singleLine.length > maxLength ? `${singleLine.slice(0, maxLength - 1)}…` : singleLine;
}
