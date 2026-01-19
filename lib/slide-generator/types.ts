// ========================================
// Types
// ========================================

import type { SlideDefinition } from "./schemas";

/** 生成されたスライド */
export interface GeneratedSlide {
	html: string;
	sources?: string[];
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

export type SlideGeneratingEvent = SlideBaseEvent & {
	type: "slide:generating";
	data: GeneratedSlide;
};

export type SlideEndEvent = SlideBaseEvent & {
	type: "slide:end";
	data: {
		slide: GeneratedSlide;
	};
};

export type SlideEvent =
	| SlideStartEvent
	| SlideGeneratingEvent
	| SlideEndEvent;

export type EndEvent = BaseEvent & {
	type: "end";
	data: GeneratedSlide[];
};

export type ErrorEvent = BaseEvent & {
	type: "error";
	message: string;
};

/** トークン使用量 */
export interface UsageInfo {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
}

export type UsageEvent = BaseEvent & {
	type: "usage";
	usage: UsageInfo;
	step: string;
};

/** ストリーム接続維持用のheartbeatイベント */
export type HeartbeatEvent = BaseEvent & {
	type: "heartbeat";
	timestamp: number;
};

export type Event =
	| StartEvent
	| PlanEvent
	| SlideEvent
	| EndEvent
	| ErrorEvent
	| UsageEvent
	| HeartbeatEvent;
