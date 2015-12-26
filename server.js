var express = require('express');
var app = express();

app.use(express.static(__dirname + '/www'));
app.use(express.static(__dirname + '/node_modules'));

var getChords = require('./www/chords');

app.get('/chords', function (req, res) {
    var requiredNotes = (req.query.notes || '').trim().split(/\s+/);

    var chords = getChords({
        requiredNotes: requiredNotes
    });

    res.json(chords);
});

var server = app.listen(3000);
