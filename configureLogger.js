const winston = require('winston');

const LOGGER = require('./constants/logger.js');

/* custom formats */

// winston.format.padLevels() seems to be broken, so this is a custom version
const customPadLevels = winston.format(info => {
	const maxLength = Math.max(...Object.keys(LOGGER.LEVELS).map(e => e.length));
	info.message = ' '.repeat(maxLength - info[Symbol.for('level')].length) + info.message;
	return info;
});

// makes sure errors are printed as their stacktrace instead of just their message
const printErrorStacktrace = winston.format(info => {
	if (info.message instanceof Error) {
		info.message = info.message.stack;
	} else if (info instanceof Error) {
		info.message = info.stack;
	}
	return info;
});

const validLoggingLevel = Object.keys(LOGGER.LEVELS).includes(process.env.LOGGING_LEVEL);

const logger = winston.loggers.add('default', {
	level: validLoggingLevel ? process.env.LOGGING_LEVEL : LOGGER.DEFAULT_LEVEL,
	levels: LOGGER.LEVELS,
	format: winston.format.combine(
		winston.format.colorize({
			level: true,
			colors: LOGGER.COLORS,
		}),
		printErrorStacktrace(),
		customPadLevels(),
		winston.format.timestamp(),
		winston.format.printf(info => `${info.timestamp} - ${info.level}: ${info.message}`)
	),
	transports: [
		// always log everything to stdout
		new winston.transports.Console(),
		// in production, log all errors also separatly to stderr
		new winston.transports.Console({
			level: 'error',
			silent: process.env.NODE_ENV !== 'production',
			stderrLevels: [
				'fatal',
				'error',
			],
		}),
	],
});

if (!validLoggingLevel) {
	logger.error(`Invalid logging level, defaulting to "${LOGGER.DEFAULT_LEVEL}".`);
}
