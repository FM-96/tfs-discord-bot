require('dotenv').config();
const jwt = require('jsonwebtoken');

const argv = process.argv.slice(2);

const payload = {
	clear: argv[0] === 'true',
	channels: argv.slice(1),
};

let token;
try {
	token = jwt.sign(payload, process.env.JWT_SECRET, {algorithm: 'HS256'});
} catch (err) {
	console.error('Could not create jwt:');
	console.error(err);
}
console.log(payload);
console.log(token);
