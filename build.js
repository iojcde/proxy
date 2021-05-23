 
const projectDirs = ["src"]
const projectMatchers = projectDirs.map((dirName) => {
  return new RegExp(`^${dirName}(/.*)?$`)
})

const makeNodeModulesExternal = {
  name: "make-node-modules-external",
  setup(build) {
    let filter = /^[^.\/]|^\.[^.\/]|^\.\.[^\/]/ // Must not start with "/" or "./" or "../"
    build.onResolve({ filter }, (args) => {
      const external = !projectMatchers.find((matcher) => args.path.match(matcher))
      if (external) {
        return { path: args.path, external: true }
      }
      return {
        external: false,
      }
    })
  },
}

require("esbuild")
  .build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    outfile: "./build/index.js",
    platform: "node",
    target: "node14",
    format: "cjs",
    plugins: [makeNodeModulesExternal],
  })
  .catch(() => process.exit(1))