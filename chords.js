'use strict';

var STANDARD_TUNING = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];
var MAX_SPAN = 4;
var MAX_FRET = 12;
var MAX_FINGERS = 4;
var MIN_NOTES = 3;
var NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
var STRINGS_TO_DROP = 2;

// Intervals
var MI_2ND = 1;
var MA_2ND = 2;
var MI_3RD = 3;
var MA_3RD = 4;
var P_4TH = 5;
var TRI = 6;
var P_5TH = 7;
var MI_6TH = 8;
var MA_6TH = 9;
var MI_7TH = 10;
var MA_7TH = 11;

var CHORD_PATTERN = new RegExp(
    '^\\s*' +
    '([A-Ga-g][b#]?)' +
    '\\s*' +
    '(ma|maj|major|m|-|mi|min|minor|aug|augmented|\\+|dim|diminished|[oO0])?' +
    '\\s*' +
    '(seven|seventh|7|7th|nine|ninth|9|9th|eleven|eleventh|11|11th|thirteen|thirteenth|13|13th|sixth|six|6|6th)?' +
    '\\s*' +
    '(sus|sus\\s?2|sus\\s?4)?' +
    '\\s*' +
    '(#5|b5|#9|b9|#11)?' +
    '\\s*$');
var CP_ROOT = 1;
var CP_TRIAD = 2;
var CP_EXT = 3;
var CP_SUS = 4;
var CP_ALT = 5;

if (typeof module === 'object' && module.exports) {
    // Node.
    module.exports.getChords = getChords;
    module.exports.chordSearch = chordSearch;

    // Testing.
    if (require.main === module) {
        var arg = process.argv.slice(2).join(' ');
        console.log(chordSearch(arg));
    }
} else if (!this.document) {
    // Web worker.
    onmessage = function (e) {
        var chords = chordSearch(e.data.query);
        postMessage({
            id: e.data.id,
            chords: chords
        });
    }
}

/**
 * query:
 * G (G major chord)
 * G 7 (G7 chord)
 *
 * 'G (note G)
 * 'G 7 (notes G and A)
 *
 * todo:
 * G / A (A must be the root note)
 * G \ A (A must be the top note)
 */
function chordSearch(query) {
    var query = (query || '').trim();
    var opts;
    if (query[0].match(/^['"]/)) {
        query = query.replace(/['"]/g, '').trim();
        opts = {
            requiredNotes: query.split(/\s+/)
        };
    } else {
        opts = parseChord(query);
        if (opts === null) {
            opts = {
                requiredNotes: query.split(/\s+/)
            };
        }
    }
    return getChords(opts);
}

function parseChord(query) {
    var match = CHORD_PATTERN.exec(query);
    if (!match) {
        return null;
    }
    var root = match[CP_ROOT];
    var triad = match[CP_TRIAD];
    var ext = match[CP_EXT];
    var sus = match[CP_SUS];
    var alt = match[CP_ALT];
    var required = {};
    var optional = {};

    root = root[0].toUpperCase() + root.substr(1);

    if (!triad || triad.match(/^ma/)) {
        triad = 'ma';
        required[MA_3RD] = true;
        optional[P_5TH] = true;
    } else if (triad.match(/^-$|^m$|^mi/)) {
        triad = 'mi';
        required[MI_3RD] = true;
        optional[P_5TH] = true;
    } else if (triad.match(/^aug|^\+/)) {
        triad = 'aug';
        required[MA_3RD] = true;
        required[MI_6TH] = true;
    } else if (triad.match(/^dim|^[oO0]/)) {
        triad = 'dim';
        required[MI_3RD] = true;
        required[TRI] = true;
    }

    function seventh() {
        if (match[CP_TRIAD] && match[CP_TRIAD].match(/^ma/)) {
            // Major seventh
            required[MA_7TH] = true;
        } else if (triad === 'dim' && match[CP_TRIAD] !== '0') {
            // Diminished seventh
            required[MA_6TH] = true;
        } else {
            required[MI_7TH] = true;
        }
    }

    function ninth() {
        seventh();
        required[MA_2ND] = true;
    }

    function eleventh() {
        ninth();
        required[P_4TH] = true;

        if (required[MA_3RD]) {
            optional[MA_3RD] = true;
            delete required[MA_3RD];
        }

        if (required[MI_3RD]) {
            optional[MI_3RD] = true;
            delete required[MI_3RD];
        }
    }

    function thirteenth() {
        ninth();
        required[MA_6TH] = true;
    }

    if (!ext) {
        // No extension
    } else if (ext.match(/^se|^7/)) {
        seventh();
    } else if (ext.match(/^si|^6/)) {
        required[MA_6TH] = true;
        // Minor 6th is not typically used.
    } else if (ext.match(/^ni|^9/)) {
        ninth();
    } else if (ext.match(/^el|^11/)) {
        eleventh();
    } else if (ext.match(/^th|^13/)) {
        thirteenth();
    }

    if (sus) {
        delete required[MA_3RD];
        delete required[MI_3RD];
        if (sus === 'sus2') {
            required[MA_2ND] = true;
        } else {
            required[P_4TH] = true;
        }
    }

    if (alt === 'b5') {
        delete optional[P_5TH];
        required[TRI] = true;
    } else if (alt === '#5') {
        delete optional[P_5TH];
        required[MI_6TH] = true;
    } else if (alt === '#9') {
        required[MI_3RD] = true;
    } else if (alt === 'b9') {
        required[MI_2ND] = true;
    } else if (alt === '#11') {
        required[TRI] = true;
    }

    var requiredNotes = [root];
    var add;
    for (add in required) {
        requiredNotes.push(noteAdd(root, parseInt(add)));
    }

    var optionalNotes = [];
    for (add in optional) {
        optionalNotes.push(noteAdd(root, parseInt(add)));
    }

    return {
        requiredNotes: requiredNotes,
        optionalNotes: optionalNotes
    };
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

function noteAdd(noteName, add) {
    var baseIndex = NOTES.indexOf(noteName);
    return NOTES[(baseIndex + add) % NOTES.length];
}

function getNoteName(string, fret, options) {
    var baseNoteName = options.tuning[string];
    var basePlainName = baseNoteName.match(/[A-Gb#]+/)[0];
    return noteAdd(basePlainName, fret);
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
