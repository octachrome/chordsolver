var express = require('express');
var app = express();

app.use(express.static(__dirname + '/www'));
app.use(express.static(__dirname + '/node_modules'));

var getChords = require('./chords');

app.get('/chords', function (req, res) {
    var chords = getChords({
        requiredNotes: ['G', 'B', 'D']
    });

    res.json(chords);
});

var server = app.listen(3000);
