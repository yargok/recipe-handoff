module.exports = {
  apps: [
    {
      name: 'recipe-handoff',
      script: 'src/index.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '200M',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
