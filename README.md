# ComfyUI Image Browser / Prompt Viewer

A lightweight, local web-based image browser for [ComfyUI](https://github.com/comfyanonymous/ComfyUI). 
Easily browse your generated images, view their prompts, workflow metadata, and inspect them in full detail.

## Features

- **Gallery View**: Browse all your ComfyUI generated images in a responsive grid.
- **Metadata Inspection**: View generation parameters (Prompt, Workflow) extracted directly from the image files.
- **Full Size Preview**: Click to view images in full resolution.
- **Search**: Filter images by filename.
- **Configuration**: Customizable image directory and server port.

## Installation

1. Clone or download this repository into your `ComfyUI` custom_nodes folder or anywhere you like (e.g. `ComfyUI/tools/image-browser`).
2. Ensure you have Python installed (or use the ComfyUI embedded python).
3. Install dependencies:
   ```bash
   pip install flask pillow
   ```

## Usage

### Quick Start (Windows)
Double-click `run_browser.bat`. 
This will start the server and automatically open your default web browser to the correct address (default: `http://localhost:18001`).

### Manual Start
Run the python script directly:
```bash
python app.py
```

## Configuration

The application uses `config.ini` for settings. 
Copy `config.ini.example` to `config.ini` to customize:

```ini
[Settings]
Path = ../ComfyUI/output  ; Path to your images (relative or absolute)
Port = 18001            ; Web server port
```

If `config.ini` is missing, it defaults to:
- Path: `../ComfyUI/output`
- Port: `18001`

## License

MIT
