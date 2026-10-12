# Glass Balance 3D

A 3D balancing-ball game where you guide a ball across a glass bridge, navigate turns, and try not to fall.

## Features

- 3D ball-balancing gameplay
- Glass bridge courses with turns and challenging paths
- Manual movement controls
- Camera view controls
- Falling, checkpoints, and level progression (where implemented in the current build)
- Browser-based interface built with React and TypeScript

## Tech Stack

- React
- TypeScript
- Vite
- pnpm workspace

## Getting Started

This repository is organized as a pnpm monorepo/workspace. Use a recent Node.js version and install pnpm first.

1. Clone the repository:

   ```bash
   git clone https://github.com/YOUR-USERNAME/glass-balance-3d.git
   cd glass-balance-3d
   ```

2. Install dependencies from the repository root:

   ```bash
   pnpm install
   ```

3. Start the game frontend:

   ```bash
   pnpm --filter @workspace/glass-balance-3d dev
   ```

4. Open the local URL printed in the terminal.

If the project depends on environment variables or external services in your copy, configure those before running it. Do not commit API keys, passwords, access tokens, or private environment files.

## Build and Type-check

From the repository root:

```bash
pnpm --filter @workspace/glass-balance-3d typecheck
pnpm --filter @workspace/glass-balance-3d build
```

The full workspace may have additional scripts; check the root `package.json` and package-specific `package.json` files for the commands supported by your copy.

## Controls

Controls may vary as the game is updated. In the intended manual-control design:

- **Front / Back:** Move forward or backward.
- **Left / Right:** Move sideways relative to the camera.
- **Camera:** Drag/swipe to change the view.
- **Objective:** Stay on the glass bridge and reach the finish.

Use the on-screen controls shown in the current build.

## Project Structure

The game frontend is located in:

```text
artifacts/glass-balance-3d/
```

The workspace also includes an API server package under:

```text
artifacts/api-server/
```

Other folders may contain shared workspace packages and build configuration.

## Contributing

Suggestions and bug reports are welcome. Before submitting changes, test the game in a browser and verify movement, camera controls, bridge collisions, falling, checkpoints, and level progression.

## License

The project package metadata currently lists the MIT license. Before publishing, confirm that this license applies to the complete repository and that all bundled assets and dependencies may be redistributed under their applicable licenses.
Explain
