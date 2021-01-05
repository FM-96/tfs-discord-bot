const mongoose = require('mongoose');

const schema = mongoose.Schema({
	guildId: String,
	userId: String,
	customRoleId: String,
});

module.exports = mongoose.model('CustomRole', schema, 'customRoles');
