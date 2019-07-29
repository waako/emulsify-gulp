/* globals require */

module.exports = (gulp, config) => {
  // General
  // eslint-disable-next-line no-redeclare, no-var
  var gulp = require('gulp-help')(gulp);
  const _ = require('lodash');
  const portscanner = require('portscanner');
  const browserSync = require('browser-sync').create();
  const babel = require('gulp-babel');
  const sourcemaps = require('gulp-sourcemaps');
  const defaultConfig = require('./gulp-config');
  const pa11y = require('./gulp-tasks/pa11y');

  // eslint-disable-next-line no-redeclare, no-var
  var config = _.defaultsDeep(config, defaultConfig);

  // Image Minification
  const imagemin = require('gulp-imagemin');

  // icons
  const svgSprite = require('gulp-svg-sprite');

  // deploy
  const ghpages = require('gh-pages');

  const tasks = {
    compile: [],
    watch: [],
    validate: [],
    default: [],
  };

  // SCSS/CSS
  require('./gulp-tasks/gulp-css.js')(gulp, config, tasks, browserSync);

  // Tests
  require('./gulp-tasks/gulp-tests.js')(gulp, config, tasks);

  /**
   * Script Task
   */
  gulp.task('scripts', () => {
    return gulp
      .src(config.paths.js)
      .pipe(sourcemaps.init())
      .pipe(
        babel({
          presets: ['env', 'minify'],
        })
      )
      .pipe(sourcemaps.write(config.themeDir))
      .pipe(gulp.dest(config.paths.dist_js));
  });

  /**
   * Task for minifying images.
   */
  gulp.task('imagemin', () => {
    return gulp
      .src(config.paths.img)
      .pipe(
        imagemin([
          imagemin.jpegtran({ progressive: true }),
          imagemin.svgo({
            plugins: [{ removeViewBox: false }, { cleanupIDs: false }, { removeTitle: false }],
          }),
        ])
      )
      .pipe(gulp.dest(file => file.base));
  });

  tasks.compile.push('imagemin');

  /**
   * Task for generating icon colors/png fallbacks from svg.
   */
  gulp.task('icons', () => {
    return gulp
      .src('**/*.svg', { cwd: `${config.paths.icons}` })
      .pipe(svgSprite(config.iconConfig))
      .pipe(gulp.dest('.'));
  });

  tasks.compile.push('icons');

  // Find open port using portscanner.
  let openPort = '';
  portscanner.findAPortNotInUse(3000, 3010, '127.0.0.1', (error, port) => {
    openPort = port;
  });

  // Pattern Lab
  require('./gulp-tasks/gulp-pattern-lab.js')(gulp, config, tasks, browserSync, openPort);

  /**
   * Task for running browserSync.
   */
  gulp.task('serve', ['css', 'scripts', 'watch:pl'], () => {
    if (config.browserSync.domain) {
      browserSync.init({
        injectChanges: true,
        open: config.browserSync.openBrowserAtStart,
        proxy: config.browserSync.domain,
        startPath: config.browserSync.startPath,
        ghostMode: config.browserSync.ghostMode
      });
    } else {
      browserSync.init({
        injectChanges: true,
        server: {
          baseDir: config.browserSync.baseDir,
        },
        startPath: config.browserSync.startPath,
        notify: config.browserSync.notify,
        ui: config.browserSync.ui,
        open: config.browserSync.openBrowserAtStart,
        reloadOnRestart: config.browserSync.reloadOnRestart,
        port: openPort,
        ghostMode: config.browserSync.ghostMode
      });
    }
    gulp.watch(config.paths.js, ['scripts']);
    gulp.watch(`${config.paths.sass}/**/*.scss`, ['css']).on('change', (event) => {
      pa11y.pa11yTest(event.path, browserSync, config);
    });
    gulp.watch(config.patternLab.scssToYAML[0].src, ['pl:scss-to-yaml']);
  });

  /**
   * Theme task declaration
   */
  gulp.task('theme', ['serve']);

  gulp.task('compile', tasks.compile);
  gulp.task('validate', tasks.validate);
  gulp.task('watch', tasks.watch);
  tasks.default.push('watch');
  gulp.task('default', tasks.default);

  /**
   * Theme task declaration
   */
  gulp.task('build', ['compile', 'scripts', 'css']);

  /**
   * Deploy
   */
  gulp.task('createBuild', () => {
    gulp
      .src(
        [
          `${config.paths.dist_js}/**/*`,
          `${config.paths.pattern_lab}/**/*`,
          `${config.paths.theme_images}/**/*`,
          `!${config.paths.theme_images}/{icons,icons/**/*}`,
          `${config.paths.logo}`,
          `${config.themeDir}/CNAME`,
        ],
        { base: config.themeDir }
      )
      .pipe(gulp.dest('build'));
  });

  gulp.task('githubPublish', () => {
    // Publish the build directory to github pages.
    ghpages.publish(`${config.themeDir}build`, (err) => {
      if (err === undefined) {
        // eslint-disable-next-line no-console
        console.log('Successfully deployed!');
      } else {
        // eslint-disable-next-line no-console
        console.log(err);
      }
    });
  });

  gulp.task('ghpages-deploy', ['createBuild', 'githubPublish']);
};
