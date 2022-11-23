const express = require('express');
const router = express.Router();

const postRouter = require('./post/post.router.js');

router.use('/post', postRouter);

module.exports = router;
