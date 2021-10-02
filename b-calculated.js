'use strict';

// Interface definition

class Transaction {
	constructor(data, calcProp) {
		this.delta = {};
		this.data = data;
		this.calcProp = calcProp;

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

	static start(data, calcProp) {
		const transaction = new Transaction(data, calcProp);
		const obj = transaction.createProxy();
		return [obj, transaction];
	}

	createProxy() {
		if (!this.isCreated) {
			this.isCreated = true;
			const { delta, emit, emitBeforeEvent, calcProp } = this;
			const { proxy, revoke } = Proxy.revocable(data, {
				get(target, key) {
					emitBeforeEvent('get');
					if (key === 'delta') return delta;
					if (calcProp.hasOwnProperty(key)) return calcProp[key]();
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
			for (const key of Object.keys(this.calcProp)) {
				this.calcProp[key] = this.calcProp[key].bind(proxy);
			}

			return proxy;
		}
	}

	commit() {
		this.emitBeforeEvent('commit');
		console.log('\ncommit transaction');
		Object.assign(this.data, this.delta);
		for (const key in this.delta) {
			delete this.delta[key]
		}
		this.emit('commit');
	}

	rollback() {
		this.emitBeforeEvent('rollback');
		console.log('\nrollback transaction');
		for (const key in this.delta) {
			delete this.delta[key]
		}
		this.emit('rollback');
	}

	revoke() {
		if (this._revoke) {
			this.emitBeforeEvent('revoke');
			this._revoke();
			this.emit('revoke')
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

const data = { name: 'Marcus Aurelius', born: 121, city: 'Rome' };

const cities = {
	'Roman Empire': ['Rome']
};

const [obj, transaction] = Transaction.start(data, {
	age() {
		return (
			new Date().getFullYear() -
			new Date(this.born + '').getFullYear()
		);
	},
	country() {
		let result;
		for (const [key, values] of Object.entries(cities)) {
			values.forEach(val => {
				if (val === this.city) result = key;
			})
		}
		return result;
	}
});

console.dir({ age: obj.age, country: obj.country });