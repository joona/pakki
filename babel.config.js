module.exports = {
  presets: [
    ['@babel/preset-env', {
      "targets": {
        "browsers": "> 1%, last 2 versions, safari > 9, ie >= 10, not dead"
      },
      "useBuiltIns": "entry",
      "modules": false,
      "loose": true,
      "corejs": 2
    }]
  ]
};
