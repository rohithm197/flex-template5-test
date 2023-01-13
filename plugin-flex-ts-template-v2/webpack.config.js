const path = require('path');

module.exports = (config, { isProd, isDev, isTest }) => {
  /**
   * Customize the webpack by modifying the config object.
   * Consult https://webpack.js.org/configuration for more information
   */

  return {
    ...config,
    performance: {
      ...config.performance,
      hints: false
    },
    module: {
      ...config.module,
      rules: [
        {
            test: /\.js$/,
            include: [
              path.join(__dirname, 'src/flex-hooks/')
            ],
            use: 'import-glob'
        },
        {
            test: /\.jsx$/,
            include: [
              path.join(__dirname, 'src/flex-hooks/')
            ],
            use: 'import-glob'
        },
        {
            test: /\.ts$/,
            include: [
              path.join(__dirname, 'src/flex-hooks/')
            ],
            use: 'import-glob'
        },
        {
            test: /\.tsx$/,
            include: [
              path.join(__dirname, 'src/flex-hooks/')
            ],
            use: 'import-glob'
        },
        ...config.module.rules,
      ]
    }
  };
}
