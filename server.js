var express = require('express');
var app = express();

app.use(express.static(__dirname + '/www'));
app.use(express.static(__dirname + '/node_modules'));

var chordSearch = require('./www/chords').chordSearch;

app.get('/chords', function (req, res) {
    var chords = chordSearch(req.query.query);
    res.json(chords);
});

var server = app.listen(3000);
