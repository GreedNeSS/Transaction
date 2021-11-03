'use strict';

function Transaction() { }

Transaction.start = data => {
	console.log('\nstart transaction');
	const events = {
		commit: [], rollback: [], timeout: [], change: []
	};
	let delta = {};
	const deleteDelta = new Set();

	const emit = name => {
		const event = events[name];
		for (const listener of event) {
			listener(data);
		}
	};

	const methods = {
		commit: () => {
			console.log('\ncommit transaction');
			for (const key of deleteDelta) {
				delete data[key];
				delete delta[key];
			}
			Object.assign(data, delta);
			delta = {};
			emit('commit');
		},
		rollback: () => {
			console.log('\nrollback transaction');
			delta = {};
			deleteDelta.clear();
			emit('rollback');
		},
		clone: () => {
			console.log('\nclone transaction');
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
			deleteDelta.delete(key);
			return true;
		},
		deleteProperty(target, prop) {
			if (deleteDelta.has(prop)) return false;
			deleteDelta.add(prop);
			return true;
		},
	});
};

// Usage

const data = { name: 'Marcus Aurelius', born: 121 };

const transaction = Transaction.start(data);
console.dir({ data });

transaction.on('commit', () => {
	console.log('\nevent commit');
});

transaction.on('rollback', () => {
	console.log('\nevent rollback');
});

transaction.city = 'Beijing';
transaction.born = 1212;
delete transaction.born;

console.dir({
	keys: Object.keys(transaction),
	delta: transaction.delta
});

console.dir({ data });
transaction.commit();
console.dir({ data });

transaction.born = 1212;
transaction.rollback();
