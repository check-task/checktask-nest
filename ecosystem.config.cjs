module.exports = {
  apps: [
    {
      name: 'checktask-nest',
      script: 'dist/main.js',
      instances: 'max',
      exec_mode: 'cluster',
      env_production: { NODE_ENV: 'production' },
    },
  ],
};
