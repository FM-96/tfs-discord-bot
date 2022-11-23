const express = require('express');
const multer = require('multer');

const router = express.Router();
const upload = multer();

const postController = require('./post.controller.js');

router.post('/:guildId', upload.any(), postController.postFiles);

module.exports = router;
