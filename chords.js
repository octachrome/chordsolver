'use strict';

var STANDARD_TUNING = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];
var MAX_SPAN = 4;
var MAX_FRET = 12;
var MAX_FINGERS = 4;
var MIN_NOTES = 3;
var NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
var STRINGS_TO_DROP = 2;

module.exports = getChords;

if (require.main === module) {
    console.log(getChords({
        requiredNotes: process.argv.slice(2)
    }));
}

/**
 * inputs:
 *   chord name (shortcut for notes, e.g., G7 = G, B, [D], A)
 *   requiredNotes
 *   optionalNotes
 *   permitted roots (e.g., G)
 *   exclude open chords
 *   exclude movable chords
 *   max span (frets)
 *   max fret
 *   max fingers
 *   min notes (e.g., triad)
 *   tuning
 * returns:
 *   [{
 *       // evaluated at given position
 *       strings: [3, 2, 0, null, null, null],
 *       position: 0,
 *       movable: true,
 *       notes: ['G', 'B', 'D'],
 *       inversion: 1,
 *
 *       names: ['G'],
 *
 *       // alternative interpretations
 *       alt: [{
 *           names: ['Em7'],
 *       }]
 *   }];
 */
function getChords(opts) {
    if (!opts.requiredNotes && !opts.optionalNotes) {
        throw new Error('Must specify requiredNotes or optionalNotes');
    }

    var options = {
        requiredNotes: [],
        optionalNotes: [],
        tuning: STANDARD_TUNING,
        maxSpan: MAX_SPAN,
        maxFret: MAX_FRET,
        maxFingers: MAX_FINGERS,
        minNotes: MIN_NOTES
    };

    for (var o in opts) {
        if (['requiredNotes', 'optionalNotes', 'tuning'].indexOf(o) >= 0) {
            options[o] = opts[o].map(normNote);
        } else {
            options[o] = opts[o];
        }
    }

    var frets = getValidFrets(options);
    var chords = [];

    for (var i = 0; i < options.maxFret; i++) {
        var range = getFretsInRange(frets, i, options);
        if (range.length) {
            chords = chords.concat(getChordsInRange(range, i, options));
        }
    }

    chords = removeDuplicates(chords);

    return chords.map(function (chord) {
        var obj = {
            strings: chord,
            notes: getNotes(chord, options),
            noteNames: getNoteNames(chord, options)
        };
        obj.baseFret = chord.reduce(function (a, b) {
            if (a === null) {
                return b;
            } else if (b == null) {
                return a;
            } else {
                return Math.min(a, b);
            }
        }) || 0;
        return obj;
    });
}

function removeDuplicates(chords) {
    var results = [];
    var last = [];
    for (var i = 0; i < chords.length; i++) {
        if (!chordEquals(chords[i], last)) {
            results.push(chords[i]);
            last = chords[i];
        }
    }
    return results;
}

function chordEquals(c1, c2) {
    for (var i = 0; i < Math.max(c1.length, c2.length); i++) {
        if (c1[i] !== c2[i]) {
            return false;
        }
    }
    return true;
}

function getValidFrets(options) {
    var valid = [];
    for (var string = 0; string < options.tuning.length; string++) {
        var validForString = [];
        valid.push(validForString);
        for (var fret = 0; fret <= options.maxFret; fret++) {
            var note = getNoteName(string, fret, options);
            if (isNoteAllowed(note, options)) {
                validForString.push(fret);
            }
        }
    }
    return valid;
}

function getFretsInRange(frets, start, options) {
    var range = [];
    var found = 0;
    for (var string = 0; string < frets.length; string++) {
        range.push([]);
        var stringFrets = frets[string];
        var i = 0;
        while (i < stringFrets.length && stringFrets[i] < start) {
            i++;
        }
        while (i < stringFrets.length && stringFrets[i] < start + options.maxSpan) {
            range[string].push(stringFrets[i]);
            if (stringFrets[i] === start) {
                found = true;
            }
            i++;
        }
    }
    // Don't bother searching ranges that don't contain the starting fret.
    return found ? range : [];
}

function getChordsInRange(range, start, options) {
    var chords = getChordsInRangeRecur(0, [], range, start, options);

    var practical = getPracticalChords(chords, options);

    return practical.filter(function (chord) {
        // Remove duplicates by only finding chords that include the starting fret.
        if (chord.indexOf(start) === -1) {
            return false;
        }
        // Filter out chords not containing all required notes.
        var notes = getNoteNames(chord, options);
        for (var i = 0; i < options.requiredNotes.length; i++) {
            if (notes.indexOf(options.requiredNotes[i]) === -1) {
                return false;
            }
        }
        return true;
    });
}

function getChordsInRangeRecur(string, chordBase, range, start, options) {
    if (string < range.length) {
        var validFrets = range[string].concat();
        var chords = [];
        for (var i = 0; i < validFrets.length; i++) {
            chords = chords.concat(getChordsInRangeRecur(string + 1, chordBase.concat([validFrets[i]]), range, start, options));
        }
        // No valid frets on this string.
        if (i == 0) {
            chords = getChordsInRangeRecur(string + 1, chordBase.concat([null]), range, start, options);
        }
        return chords;
    } else {
        return [chordBase];
    }
}

// Filter out chords that cannot be practically fingered.
function getPracticalChords(chords, options) {
    var practical = [];
    for (var i = 0; i < chords.length; i++) {
        if (isPracticalChord(chords[i], options)) {
            practical.push(chords[i]);
        } else {
            // Drop lower strings from the chord to see if it becomes practical.
            var alt = chords[i];
            var j;
            for (j = 0; j < Math.min(STRINGS_TO_DROP, alt.length); j++) {
                alt = alt.slice();
                alt[j] = null;
                if (isPracticalChord(alt, options)) {
                    practical.push(alt);
                    break;
                }
            }
            // Drop upper strings from the chord to see if it becomes practical.
            alt = chords[i];
            for (j = alt.length - 1; j >= Math.max(0, alt.length - STRINGS_TO_DROP); j--) {
                alt = alt.slice();
                alt[j] = null;
                if (isPracticalChord(alt, options)) {
                    practical.push(alt);
                    break;
                }
            }
        }
    }
    return practical;
}

function isPracticalChord(chord, options) {
    return isSimpleChord(chord, options) || isBarChord(chord, options);
}

// One finger per fretted string is simple.
function isSimpleChord(chord, options) {
    return chord.filter(function (fret) {
        return fret != null && fret > 0;
    }).length <= options.maxFingers;
}

function isBarChord(chord, options) {
    // A partial bar allows consecutive lower strings to be open.
    var openStringsAllowed = true;
    var barChord = [];
    for (var i = 0; i < chord.length; i++) {
        // Open strings are not allowed above the first fretted note.
        if (!openStringsAllowed && chord[i] === 0) {
            return false;
        }
        if (chord[i]) {
            openStringsAllowed = false;
            // Collect the non-open, non-muted frets.
            barChord.push(chord[i]);
        }
    }

    // The lowest fret must be barred, using up one finger.
    var barFret = Math.min.apply(null, barChord);
    // The other frets get one finger each (this is an over-simplification).
    return barChord.filter(function (fret) {
        return fret != barFret;
    }).length <= options.maxFingers - 1;
}

function isNoteAllowed(note, options) {
    return options.requiredNotes.indexOf(note) >= 0 || options.optionalNotes.indexOf(note) >= 0;
}

function normNote(note) {
    var acc = 0;
    for (var i = 1; i < note.length; i++) {
        if (note[i] === '#') {
            acc++;
        } else if (note[i] === 'b') {
            acc--;
        } else {
            throw new Error('Invalid note: ' + note);
        }
    }
    var baseIndex = NOTES.indexOf(note[0]);
    if (baseIndex === -1) {
        throw new Error('Invalid note: ' + note);
    }
    var index = baseIndex + acc;
    while (index < 0) {
        index += NOTES.length;
    }
    return NOTES[index % NOTES.length];
}

function getNoteName(string, fret, options) {
    var baseNoteName = options.tuning[string];
    var basePlainName = baseNoteName.match(/[A-Gb#]+/)[0];
    var baseIndex = NOTES.indexOf(basePlainName);
    return NOTES[(baseIndex + fret) % NOTES.length];
}

function getNoteNames(chord, options) {
    return chord.map(function (fret, string) {
        return fret === null ? null : getNoteName(string, fret, options);
    });
}

/**
 * Gets the MIDI note number for a give string and fret.
 */
function getNote(string, fret, options) {
    var baseNoteName = options.tuning[string];
    var components = baseNoteName.match(/([A-Gb#]+)([0-9]+)/);
    var baseOctave = parseInt(components[2]);
    // C4 = 48
    var baseIndex = 48 + (baseOctave - 4) * 12 + NOTES.indexOf(components[1]);
    return baseIndex + fret;
}

function getNotes(chord, options) {
    return chord.map(function (fret, string) {
        return fret === null ? null : getNote(string, fret, options);
    });
}
