module.exports = {
	addReactionListener,
	removeReactionListener,
	runReactionListeners,
};

const logger = require('winston').loggers.get('default');

const reactionListeners = new Map();

function addReactionListener(name, handler) {
	if (reactionListeners.has(name)) {
		throw new Error(`Reaction listener "${name}" already exists`);
	}
	reactionListeners.set(name, handler);
}

function removeReactionListener(name) {
	if (reactionListeners.has(name)) {
		reactionListeners.delete(name);
	} else {
		throw new Error(`Reaction listener "${name}" does not exist`);
	}
}

async function runReactionListeners(reaction, user) {
	for (const [name, handler] of reactionListeners.entries()) {
		try {
			await handler(reaction, user);
		} catch (err) {
			logger.error(`Error in reaction listener "${name}"`);
			logger.error(err);
		}
	}
}
