// ========================================
// Types
// ========================================

import type { SlideDefinition } from "./schemas";

/** 生成されたスライド */
export interface GeneratedSlide {
	html: string;
	sources?: ResearchSource[];
}

/** リサーチの情報源 */
export interface ResearchSource {
	title?: string;
	url: string;
	excerpt?: string;
}

/** スライド単位のリサーチ結果 */
export interface SlideResearchResult {
	summary: string;
	keyFacts: Array<{ fact: string; sourceUrls: string[] }>;
	sources: ResearchSource[];
}

/** SlideGenerator Event Types */

interface BaseEvent {
	type: string;
}

export type StartEvent = BaseEvent & {
	type: "start";
};

export type PlanStartEvent = BaseEvent & {
	type: "plan:start";
};

export type PlanEndEvent = BaseEvent & {
	type: "plan:end";
	plan: SlideDefinition[];
};

export type PlanEvent = PlanStartEvent | PlanEndEvent;

type SlideBaseEvent = BaseEvent & {
	index: number;
	title: string;
};

export type SlideStartEvent = SlideBaseEvent & {
	type: "slide:start";
	title: string;
};

export type SlideResearchingEvent = SlideBaseEvent & {
	type: "slide:researching";
	data: SlideResearchResult;
};

export type SlideGeneratingEvent = SlideBaseEvent & {
	type: "slide:generating";
	data: GeneratedSlide;
};

export type SlideEndEvent = SlideBaseEvent & {
	type: "slide:end";
	data: {
		slide: GeneratedSlide;
		research: SlideResearchResult;
	};
};

export type SlideEvent =
	| SlideStartEvent
	| SlideResearchingEvent
	| SlideGeneratingEvent
	| SlideEndEvent;

export type EndEvent = BaseEvent & {
	type: "end";
	data: {
		slide: GeneratedSlide;
		research: SlideResearchResult;
	}[];
};

export type ErrorEvent = BaseEvent & {
	type: "error";
	message: string;
};

export type Event = StartEvent | PlanEvent | SlideEvent | EndEvent | ErrorEvent;
