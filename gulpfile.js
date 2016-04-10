'use strict';

/*
*
* Commands:
	* gulp default
		* "copy" images
		* "copy" fonts
		* js: eslint
		* css: scss-lint
		* WATCH FILES ABOVE
		* build html using Jekyll (& watch via browser sync)
	* gulp deploy
		* "copy" images
		* "copy" fonts
		* js: eslint
		* css: scss-lint
		* build html using Jekyll
* Flags:
	* --imagemin=true|false: Null, empty or not true ==> no imagemin (default)
	* --sassoutput=<value>: Null, empty or not one of ['nested', 'expanded', 'compact', 'compressed'] ==> expanded (default)
	* --sourcemaps=true|false: Null, empty or not true ==> sourcemaps (default)
*/

/* do NOT change the order of the pipes as this could cause unwanted effects */
var pkg = require('./package.json'),
	browserSync = require('browser-sync').create(),
	del = require('del'),
	gulp = require('gulp'),
	autoprefixer = require('gulp-autoprefixer'),
	bless = require('gulp-bless'),
	cached = require('gulp-cached'),
	child = require('child_process'),
	concat = require('gulp-concat'),
	copy = require('gulp-copy'),
	eslint = require('gulp-eslint'),
	imagemin = require('gulp-imagemin'),
	notify = require('gulp-notify'),
	plumber = require('gulp-plumber'),
	sass = require('gulp-sass'),
	scssLint = require('gulp-scss-lint'),
	shell = require('gulp-shell'),
	sourcemaps = require('gulp-sourcemaps'),
	uglify = require('gulp-uglify'),
	gUtil = require('gulp-util'),
	imageminPngquant = require('imagemin-pngquant');

// helper functions
function onError(err) {
	gUtil.log('\n', gUtil.colors.bold(gUtil.colors.red('Error ocurred: ') + err.message + ' @ ' + err.fileName + ':' + err.lineNumber), '\n');
	gUtil.beep();
	this.emit('end');
}

function getArgument(key) {
	return gUtil.env[key] ? gUtil.env[key] : null;
}

// clean folders
gulp.task('clean', function() {
	pkg.clean.forEach(function(path) {
		return del.sync(path, {
			'force': true
		});
	});
});

//  Images
gulp.task('imgbuild', function() {
	var imageminArg = getArgument('imagemin');

	if (imageminArg === 'true') {
		return gulp.src(pkg.img.src)
			.pipe(plumber({
				'errorHandler': onError
			}))
			.pipe(imagemin({
				'progressive': true,
				'use': [imageminPngquant()]
			}))
			.pipe(gulp.dest(pkg.img.dest))
			.pipe(notify({
				'message': 'IMG build complete',
				'onLast': true // otherwise the notify will be fired for each file in the pipe
			}));
	}

	return gulp.src(pkg.img.src)
		.pipe(copy(pkg.img.dest, {
			'prefix': 2
		})) // needs to be copy, not just ".dest" as mac often throws errors when the folder doesn't exist
		.pipe(notify({
			'message': 'IMG build complete',
			'onLast': true // otherwise the notify will be fired for each file in the pipe
		}));
});

// Fonts
gulp.task('fontsbuild', function() {
	return gulp.src(pkg.fonts.src)
		.pipe(copy(pkg.fonts.dest, {
			'prefix': 2
		})) // needs to be copy, not just ".dest" as mac often throws errors when the folder doesn't exist
		.pipe(notify({
			'message': 'Fonts build complete',
			'onLast': true // otherwise the notify will be fired for each file in the pipe
		}));
});

// Javascript
gulp.task('eslint', function() {
	return gulp.src(pkg.js.hint.src)
		.pipe(plumber({
			'errorHandler': onError
		}))
		.pipe(eslint())
		.pipe(eslint.format())
		.pipe(eslint.failAfterError());
});

gulp.task('js', ['eslint'], function() {
	gulp.start('jsbuild');
});

gulp.task('jsbuild', function() {
	var sourcemapsArg = getArgument('sourcemaps'),
		writeSourcemaps = sourcemapsArg === null || sourcemapsArg === 'true';

	pkg.js.files.forEach(function(o) {
		return gulp.src(o.src)
			.pipe(plumber({
				'errorHandler': onError
			}))
			.pipe(writeSourcemaps ? sourcemaps.init() : gUtil.noop())
			.pipe(concat(o.file))
			.pipe(uglify({
				'compress': {
					'hoist_funs': false // hoist function declarations - otherwise functions are alphabetized, which can cause errors
				}
			}))
			.pipe(writeSourcemaps ? sourcemaps.write('maps') : gUtil.noop())
			.pipe(gulp.dest(o.dest))
			.pipe(notify({
				'message': 'JS: ' + o.file + ' build complete',
				'onLast': true // otherwise the notify will be fired for each file in the pipe
			}));
	});
});

// CSS
gulp.task('scsslint', function() {
	return gulp.src(pkg.sass.hint.src)
		.pipe(cached('scssLint'))
		.pipe(scssLint());
});

gulp.task('sass', ['scsslint'], function() {
	gulp.start('sassbuild');
});

gulp.task('sassbuild', function() {
	var sassoutputArg = getArgument('sassoutput');

	pkg.sass.files.forEach(function(o) {
		return gulp.src(o.src)
			.pipe(plumber({
				'errorHandler': onError
			}))

            // .pipe(writeSourcemaps ? sourcemaps.init() : gUtil.noop()) // can't get them to work in conjunction with bless
			.pipe(sass({
				'outputStyle': sassoutputArg === null || ['nested', 'expanded', 'compact', 'compressed'].indexOf(sassoutputArg) < 0 ? 'expanded' : sassoutputArg
			}))
			.pipe(autoprefixer({
				'browsers': pkg.sass.autoprefixer.browsers
			}))

            // .pipe(writeSourcemaps ? sourcemaps.write('maps') : gUtil.noop()) // can't get them to work in conjunction with bless
			.pipe(bless())
			.pipe(gulp.dest(o.dest))
			.pipe(notify({
				'message': 'SASS: ' + o.file + ' build complete',
				'onLast': true // otherwise the notify will be fired for each file in the pipe
			}));
	});
});

// html
gulp.task('htmlbuild', function() {
	var jekyll = child.exec('jekyll build'),
		jekyllLogger = function (buffer) {
			buffer.toString()
				.split(/\n/)
				.forEach(function (message) {
					gUtil.log('Jekyll: ' + message);
				});
		};

	jekyll.stdout.on('data', jekyllLogger);
	jekyll.stderr.on('data', jekyllLogger);
});

// browsersync
gulp.task('browsersync', function() {
	browserSync.init({
		files: [pkg.html.dest + '/**'],
		port: 4000,
		server: {
			baseDir: pkg.html.dest
		}
	});
});

// default task
gulp.task('default', ['clean'], function() {
	// pay attention when upgrading gulp: https://github.com/gulpjs/gulp/issues/505#issuecomment-45379280
	gulp.start('imgbuild');
	gulp.start('fontsbuild');
	gulp.start('js');
	gulp.start('sass');
	gulp.start('htmlbuild');
	gulp.start('browsersync');

	// watch
	gulp.watch(pkg.img.watch, ['imgbuild']);
	gulp.watch(pkg.fonts.watch, ['fontsbuild']);
	gulp.watch(pkg.js.watch, ['js']);
	gulp.watch(pkg.sass.watch, ['sass']);
	gulp.watch(pkg.html.watch, ['htmlbuild']);
});

// deploy task
gulp.task('deploy', function() {
	// pay attention when upgrading gulp: https://github.com/gulpjs/gulp/issues/505#issuecomment-45379280
	gulp.start('imgbuild');
	gulp.start('fontsbuild');
	gulp.start('jsbuild');
	gulp.start('sassbuild');
	gulp.start('htmlbuild');
});
