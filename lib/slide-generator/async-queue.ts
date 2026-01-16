export class AsyncQueue<T> {
	private queue: T[] = [];
	private resolvers: ((value: IteratorResult<T>) => void)[] = [];
	private finished = false;

	// タスク側からイベントを送信
	push(value: T) {
		if (this.finished) return;
		const resolve = this.resolvers.shift();
		if (resolve) {
			resolve({ value, done: false });
		} else {
			this.queue.push(value);
		}
	}

	// すべてのタスクが完了したことを通知
	close() {
		this.finished = true;
		// 待機中のものがあれば終了を通知
		let resolve = this.resolvers.shift();
		while (resolve) {
			resolve({ value: undefined, done: true });
			resolve = this.resolvers.shift();
		}
	}

	// ジェネレーター側でこれを使用（for await...of で回せる）
	[Symbol.asyncIterator](): AsyncIterator<T> {
		return {
			next: (): Promise<IteratorResult<T>> => {
				const queue = this.queue.shift();
				if (queue) {
					return Promise.resolve({ value: queue, done: false });
				}
				if (this.finished) {
					return Promise.resolve({ value: undefined, done: true });
				}
				// 値が来るまで待機
				return new Promise((resolve) => {
					this.resolvers.push(resolve);
				});
			},
		};
	}
}
