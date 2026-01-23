// ========================================
// Types
// ========================================

import type { LanguageModelUsage } from "ai";
import type { SlideDefinition } from "./schemas";

/** SlideGenerator Event Types */

interface BaseEvent {
	type: string;
	data?: unknown;
}

export type StartEvent = BaseEvent & {
	type: "start";
};

export type PlanStartEvent = BaseEvent & {
	type: "plan:start";
};

export type PlanEndEvent = BaseEvent & {
	type: "plan:end";
	data: {
		plan: SlideDefinition[];
	};
};

export type PlanEvent = PlanStartEvent | PlanEndEvent;

export interface Slide {
	index: number;
	title: string;
	html: string;
	sources?: string[];
}

export type SlideStartEvent = {
	type: "slide:start";
	data: Slide;
};

export type SlideGeneratingEvent = {
	type: "slide:generating";
	data: Slide;
};

export type SlideEndEvent = {
	type: "slide:end";
	data: Slide;
};

export type SlideEvent = SlideStartEvent | SlideGeneratingEvent | SlideEndEvent;

export type EndEvent = BaseEvent & {
	type: "end";
	data: {
		plan: SlideDefinition[];
		slides: {
			index: number;
			title: string;
			html: string;
			sources?: string[];
		}[];
	};
};

export type ErrorEvent = BaseEvent & {
	type: "error";
	data: {
		message: string;
	};
};

/** Extra Event Types */

export type UsageEvent = BaseEvent & {
	type: "usage";
	data: {
		step: string;
		usage?: LanguageModelUsage;
	};
};

export type Event =
	| StartEvent
	| PlanEvent
	| SlideEvent
	| EndEvent
	| ErrorEvent
	| UsageEvent;
