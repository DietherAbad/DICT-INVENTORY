module.exports = {
  apps: [
    {
      name: "backend",
      script: "index.js",
      cwd: "/home/dictr2-inventory/htdocs/inventory.dictr2.cloud/backend",
      env: {
        PORT: 4000,
        NODE_ENV: "production"
      },
      watch: false
    }
  ]
}
