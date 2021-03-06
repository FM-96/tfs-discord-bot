const mongoose = require('mongoose');

const levelUpRole = mongoose.Schema({
	_id: false,
	level: {
		type: Number,
		min: 0,
		validate: {
			validator: v => Math.floor(v) === v,
			message: 'Must be a whole number.',
		},
	},
	role: {
		type: String,
		validate: {
			validator: v => /^\d+$/.test(v),
			message: 'Must be a valid role ID.',
		},
		get: getRole,
		set: setRole,
	},
});

const schema = mongoose.Schema({
	guildId: String,
	// prefixes: [String],
	modRoles: {
		type: [{
			type: String,
			validate: {
				validator: v => /^\d+$/.test(v),
				message: 'Must be a valid role ID.',
			},
			// get: getRole, // does not work, see https://github.com/Automattic/mongoose/issues/4964
			set: setRole,
		}],
		set: setArray,
	},
	youtubeGuildIconSync: {
		type: Boolean,
		default: false,
	},
	youtubeAvatarHash: String,
	rememberRoles: {
		type: Boolean,
		default: false,
	},
	loggingChannel: {
		type: String,
		default: null,
		validate: {
			validator: v => v === null || /^\d+$/.test(v),
			message: 'Must be a valid channel ID.',
		},
		get: getChannel,
		set: setChannel,
	},
	autoPublishChannels: {
		type: [{
			type: String,
			validate: {
				validator: v => /^\d+$/.test(v),
				message: 'Must be a valid channel ID.',
			},
			// get: getChannel, // does not work, see https://github.com/Automattic/mongoose/issues/4964
			set: setChannel,
		}],
		set: setArray,
	},
	suggestionsEnabled: {
		type: Boolean,
		default: false,
	},
	suggestionChannel: {
		type: String,
		default: null,
		validate: {
			validator: v => v === null || /^\d+$/.test(v),
			message: 'Must be a valid channel ID.',
		},
		get: getChannel,
		set: setChannel,
	},
	suggestionRoles: {
		type: [{
			type: String,
			validate: {
				validator: v => /^\d+$/.test(v),
				message: 'Must be a valid role ID.',
			},
			// get: getRole, // does not work, see https://github.com/Automattic/mongoose/issues/4964
			set: setRole,
		}],
		set: setArray,
	},
	suggestionVoteHours: {
		type: Number,
		default: 72,
		min: 0,
		validate: {
			validator: v => Math.floor(v) === v,
			message: 'Must be a whole number.',
		},
	},
	levelUpEnabled: {
		type: Boolean,
		default: false,
	},
	levelUpBot: {
		type: String,
		default: '159985870458322944',
		validate: {
			validator: v => v === null || /^\d+$/.test(v),
			message: 'Must be a valid user ID.',
		},
		set: setUser,
	},
	levelUpMessage: {
		type: String,
		default: '^GG <@!?(\\d+)>, you just advanced to level (\\d+)!$',
		validate: {
			validator: v => new RegExp(v),
			message: 'Must be a valid regular expression.',
		},
	},
	levelUpExcludedRoles: {
		type: [{
			type: String,
			validate: {
				validator: v => /^\d+$/.test(v),
				message: 'Must be a valid role ID.',
			},
			// get: getRole, // does not work, see https://github.com/Automattic/mongoose/issues/4964
			set: setRole,
		}],
		set: setArray,
	},
	levelUpRoles: {
		type: [levelUpRole],
		set: setLevelUpRoles,
	},
	suggestionCount: Number,
	customRoleRoles: {
		type: [{
			type: String,
			validate: {
				validator: v => /^\d+$/.test(v),
				message: 'Must be a valid role ID.',
			},
			// get: getRole, // does not work, see https://github.com/Automattic/mongoose/issues/4964
			set: setRole,
		}],
		set: setArray,
	},
	customRoleIsAboveRoles: {
		type: [{
			type: String,
			validate: {
				validator: v => /^\d+$/.test(v),
				message: 'Must be a valid role ID.',
			},
			// get: getRole, // does not work, see https://github.com/Automattic/mongoose/issues/4964
			set: setRole,
		}],
		set: setArray,
	},
});

schema.virtual('settableKeys').get(function () {
	return Object.keys(this.toJSON());
});

schema.set('toJSON', {
	versionKey: false,
	transform: (doc, ret, options) => {
		delete ret._id;
		delete ret.guildId;
		delete ret.youtubeAvatarHash;
		delete ret.suggestionCount;
		return ret;
	},
});

module.exports = mongoose.model('GuildConfig', schema, 'guildConfigs');

function getChannel(v) {
	const guild = global.client.guilds.cache.get(this.guildId);
	if (!guild) {
		return null;
	}
	return guild.channels.cache.get(v);
}

function getRole(v) {
	const guild = global.client.guilds.cache.get(this.guildId || this.parent().guildId);
	if (!guild) {
		return null;
	}
	return guild.roles.cache.get(v);
}

function setChannel(v) {
	if (!(this instanceof mongoose.Document)) {
		return v;
	}
	if (!v || (typeof v === 'string' && ['none', 'null'].includes(v.trim().toLowerCase()))) {
		return null;
	}
	if (typeof v === 'object' && typeof v.id === 'string') {
		return v.id;
	}
	if (typeof v === 'string') {
		const match = /^<#(\d+)>$/.exec(v.trim());
		if (match) {
			return match[1];
		}
	}
	return v;
}

function setRole(v) {
	if (!(this instanceof mongoose.Document)) {
		return v;
	}
	if (!v || (typeof v === 'string' && ['none', 'null'].includes(v.trim().toLowerCase()))) {
		return null;
	}
	if (typeof v === 'object' && typeof v.id === 'string') {
		return v.id;
	}
	if (typeof v === 'string') {
		const match = /^<@&(\d+)>$/.exec(v.trim());
		if (match) {
			return match[1];
		}
	}
	return v;
}

function setUser(v) {
	if (!(this instanceof mongoose.Document)) {
		return v;
	}
	if (!v || (typeof v === 'string' && ['none', 'null'].includes(v.trim().toLowerCase()))) {
		return null;
	}
	if (typeof v === 'object' && typeof v.id === 'string') {
		return v.id;
	}
	if (typeof v === 'string') {
		const match = /^<@!?(\d+)>$/.exec(v.trim());
		if (match) {
			return match[1];
		}
	}
	return v;
}

function setArray(v) {
	if (!(this instanceof mongoose.Document)) {
		return v;
	}
	if (!v || (typeof v === 'string' && ['none', 'null'].includes(v.trim().toLowerCase()))) {
		return [];
	}
	if (Array.isArray(v)) {
		return v;
	}
	if (typeof v === 'string') {
		if (/^\[.*\]$/.test(v.trim())) {
			return JSON.parse(v);
		} else {
			return v.split(' ');
		}
	}
}

function setLevelUpRoles(v) {
	if (!(this instanceof mongoose.Document)) {
		return v;
	}
	const arr = setArray.call(this, v);
	return arr.map(e => {
		if (Array.isArray(e)) {
			return {level: e[0], role: e[1]};
		}
		if (typeof e === 'object') {
			return e;
		}
		if (typeof e === 'string' && e.includes('=')) {
			const [key, value] = e.split('=');
			return {level: key, role: value};
		}
		if (typeof e === 'string' && e.includes(':')) {
			const [key, value] = e.split(':');
			return {level: key, role: value};
		}
	}).sort((a, b) => a.level - b.level);
}
