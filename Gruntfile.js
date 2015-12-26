module.exports = function (grunt) {
    grunt.loadNpmTasks('grunt-contrib-copy');

    grunt.initConfig({
        copy: {
            lib: {
                expand: true,
                flatten: true,
                cwd: 'node_modules',
                src: [
                    'jquery/dist/jquery.js',
                    'knockout/build/output/knockout-latest.debug.js',
                    'snapsvg/dist/snap.svg.js',
                    'timbre/timbre.dev.js'
                ],
                dest: 'lib'
            }
        }
    });

    grunt.registerTask('default', ['copy:lib']);
};
