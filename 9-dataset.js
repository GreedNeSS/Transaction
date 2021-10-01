'use strict';

function Transaction() { }

Transaction.start = data => {
	console.log('\nstart transaction');
	const events = {
		commit: [], rollback: [], timeout: [], change: [], set: []
	};
	let delta = {};

	const emit = name => {
		const event = events[name];
		for (const listener of event) listener(delta);
	};

	const methods = {
		commit: () => {
			Object.assign(data, delta);
			delta = {};
			emit('commit');
		},
		rollback: () => {
			delta = {};
			emit('rollback');
		},
		clone: () => {
			const cloned = Transaction.start(data);
			Object.assign(cloned.delta, delta);
			return cloned;
		},
		on: (name, callback) => {
			const event = events[name];
			if (event) event.push(callback);
		}
	};

	return new Proxy(data, {
		get(target, key) {
			if (key === 'delta') return delta;
			if (methods.hasOwnProperty(key)) return methods[key];
			if (delta.hasOwnProperty(key)) return delta[key];
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
			console.log('set', key, val);
			if (target[key] === val) delete delta[key];
			else delta[key] = val;
			emit('set');
			return true;
		}
	});
};

class DatasetTransaction {
	constructor(dataset) {
		this.dataset = dataset;
		this.log = [];
		this.opetarions = ['set', 'commit', 'rollback'];

		this.log.push({ id: -1, time: new Date(), operation: 'start' });
		this.dataset.map((person, id) => {
			this.opetarions.map(operation => {
				person.on(operation, delta => {
					this.log.push({ id, time: new Date(), operation, delta });
				})
			})
		})
	}

	static start(dataset) {
		const proxedDataset = dataset.map((obj) => Transaction.start(obj));
		return new DatasetTransaction(proxedDataset);
	}

	commit() {
		this.dataset.map((person) => person.commit());
	}

	rollback(id) {
		const elem = this.dataset[id];
		if (elem) elem.rollback();
	}

	showLog() {
		return this.log;
	}

	timeout(msec, commit, listener) {
		if (msec === 0) return;
		let timer = setTimeout(() => {
			this.log.push({ id: -2, time: new Date(), operation: 'timeout' });

			if (commit) {
				this.commit();
			} else {
				this.dataset.map(person => {
					person.rollback();
				})
			}

			if (listener) listener();
			timer = null;
		}, msec);
	}
}

// Usage

const data = [
	{ name: 'Marcus Aurelius', born: 121 },
	{ name: 'Marcus Aurelius', born: 121 },
	{ name: 'Marcus Aurelius', born: 121 },
];

const transaction = DatasetTransaction.start(data);
transaction.timeout(1000, true, () => {
	console.log('timeout');
	console.log(transaction.showLog());
	console.log({ data });
});

for (const person of transaction.dataset) {
	person.city = 'Shaoshan';
}

transaction.rollback(1);

console.dir({ data });