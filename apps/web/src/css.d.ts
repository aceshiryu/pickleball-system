// Ambient type for global CSS side-effect imports (e.g. `import './globals.css'`).
// Next 16 under Nx project-references doesn't provide this, so `next build`'s
// type-check fails with "Cannot find module or type declarations for ... .css".
declare module '*.css';
