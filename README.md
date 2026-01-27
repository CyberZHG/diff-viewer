# Diff Viewer

A browser-based text comparison tool that displays differences between two texts side by side with intuitive visual highlighting.

**Live Demo:** [https://cyberzhg.github.io/diff-viewer/](https://cyberzhg.github.io/diff-viewer/)

## Features

### Side-by-Side Comparison
- View original and modified text in parallel panels
- Line-level diff with clear visual distinction between additions, deletions, and modifications
- Character-level highlighting within modified lines to pinpoint exact changes
- Connector lines linking related changes across panels

### Tab Management
- Create multiple comparison tabs to organize different file comparisons
- Rename tabs by double-clicking the tab name
- Visual indicator (asterisk) for unsaved changes
- Scroll through tabs with arrow buttons or mouse wheel when space is limited

### File Handling
- **Drag & Drop**: Simply drag files onto either editor panel
- **Upload**: Select files through the upload button
- **Download**: Export content as text files
- **Save**: Persist content to browser local storage
- **Clear**: Reset editor content

### Display Options
- **Theme Toggle**: Switch between dark and light modes
- **Connector Lines**: Toggle visibility of lines connecting related changes
- **Soft Wrap**: Enable or disable text wrapping
- **Indentation**: Adjust tab width (2, 4, or 8 spaces)

### Privacy
All processing happens entirely in your browser. Your text and files are never uploaded to any server.

## Development

### Prerequisites
- cmake
- Node.js 18+
- npm or pnpm

### Build
```bash
cd wasm
npm run build
```

### Setup
```bash
cd web
npm install
npm run dev
```

## Technology Stack
- TypeScript
- Vite
- Tailwind CSS

## License

MIT License
