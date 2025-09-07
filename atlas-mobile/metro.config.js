const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Workaround for Metro TerminalReporter export issue
config.reporter = {
  update: () => {},
};

module.exports = config;
