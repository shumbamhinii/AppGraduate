// db.js
const pgp = require('pg-promise')();
const db = pgp('postgres://postgres:123qwe@localhost:5432/UoZ');
module.exports = db;
