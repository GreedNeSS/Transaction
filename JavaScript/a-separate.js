'use strict';

// Interface definition

class Transaction {
	constructor(data) {
		this.delta = {};
		this.data = data;
		this.events = {
			commit: [], rollback: [], timeout: [], set: [], get: [], revoke: []
		};
		this.arrayBeforeEvents = {
			commit: [], rollback: [], timeout: [], set: [], get: [], revoke: []
		};
		this.arrayAfterEvents = {
			commit: [], rollback: [], timeout: [], set: [], get: [], revoke: []
		};
		this.isCreated = false;
		this.emit = this.emit.bind(this);
		this.emitBeforeEvent = this.emitBeforeEvent.bind(this);
	}

	static start(data) {
		const transaction = new Transaction(data);
		const obj = transaction.createProxy();
		return [obj, transaction];
	}

	createProxy() {
		if (!this.isCreated) {
			this.isCreated = true;
			const { delta, emit, emitBeforeEvent, data } = this;
			const { proxy, revoke } = Proxy.revocable(data, {
				get(target, key) {
					emitBeforeEvent('get');
					if (key === 'delta') return delta;
					if (delta.hasOwnProperty(key)) return delta[key];
					emit('get');
					return target[key];
				},
				getOwnPropertyDescriptor: (target, key) => (
					Object.getOwnPropertyDescriptor(
						delta.hasOwnProperty(key) ? delta : target, key
					)
				),
				ownKeys() {
					const changes = Object.keys(delta);
					const keys = Object.keys(data).concat(changes);
					return keys.filter((x, i, a) => a.indexOf(x) === i);
				},
				set(target, key, val) {
					emitBeforeEvent('set');
					console.log('set', key, val);
					if (target[key] === val) delete delta[key];
					else delta[key] = val;
					emit('set');
					return true;
				},
			});

			this._revoke = revoke;

			return proxy;
		}
	}

	commit() {
		this.emitBeforeEvent('commit');
		console.log('\ncommit transaction');
		Object.assign(this.data, this.delta);
		for (const key in this.delta) {
			delete this.delta[key];
		}
		this.emit('commit');
	}

	rollback() {
		this.emitBeforeEvent('rollback');
		console.log('\nrollback transaction');
		for (const key in this.delta) {
			delete this.delta[key];
		}
		this.emit('rollback');
	}

	revoke() {
		if (this._revoke) {
			this.emitBeforeEvent('revoke');
			this._revoke();
			this.emit('revoke');
		}
	}

	timeout(msec, commit, listener) {
		if (msec === 0) return;
		let timer = setTimeout(() => {
			this.emitBeforeEvent('timeout');
			if (commit) {
				this.commit();
			} else {
				this.rollback();
			}

			if (listener) listener();
			this.emit('timeout');
			timer = null;
		}, msec);
	}

	before(name, listener) {
		const event = this.arrayBeforeEvents[name];
		if (event) event.push(listener);
	}

	after(name, listener) {
		const event = this.arrayAfterEvents[name];
		if (event) event.push(listener);
	}

	on(name, callback) {
		const event = this.events[name];
		if (event) event.push(callback);
	}

	emitBeforeEvent(name) {
		const before = this.arrayBeforeEvents[name];
		for (const listener of before) {
			listener();
		}
	}

	emit(name) {
		const event = this.events[name];
		for (const listener of event) {
			listener();
		}
		const after = this.arrayAfterEvents[name];
		for (const listener of after) {
			listener();
		}
	}
}

// Usage

const data = { name: 'Marcus Aurelius', born: 121 };

const [obj, transaction] = Transaction.start(data);
console.dir({ data });

transaction.before('set', () => {
	console.log('before set');
});

obj.name = 'Mao Zedong';
obj.born = 1893;
obj.city = 'Shaoshan';
obj.age = (
	new Date().getFullYear() -
	new Date(obj.born + '').getFullYear()
);

transaction.before('rollback', () => {
	console.log('befor rollback');
});

transaction.on('rollback', () => {
	console.log('event rollback');
});

transaction.after('rollback', () => {
	console.log('after rollback');
});

console.dir({ obj });
console.dir({ delta: transaction.delta });
transaction.timeout(1000, true, () => {
	console.log('\ntimeout\n');
	console.log(transaction.data);
});

transaction.commit();
console.dir({ data });
console.dir({ obj });
console.dir({ delta: transaction.delta });

obj.born = 1976;
console.dir({ obj });
console.dir({ delta: transaction.delta });

transaction.rollback();
console.dir({ data });
console.dir({ delta: transaction.delta });

obj.born = 1999;

// transaction.revoke();
// console.dir({ obj });
