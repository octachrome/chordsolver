var express = require('express');
var app = express();

app.use(express.static(__dirname));

var chordSearch = require('./chords').chordSearch;

app.get('/chords', function (req, res) {
    var chords = chordSearch(req.query.query);
    res.json(chords);
});

var server = app.listen(3000);
