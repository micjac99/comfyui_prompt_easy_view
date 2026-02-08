import os
import io
import json
import logging
from flask import Flask, render_template, send_from_directory, jsonify, abort, send_file
from PIL import Image

import configparser
import webbrowser
from threading import Timer

app = Flask(__name__)

# Configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(BASE_DIR, 'config.ini')

# Defaults
DEFAULT_IMAGE_PATH = os.path.join(BASE_DIR, '..', 'ComfyUI', 'output')
DEFAULT_PORT = 18001

# Read Config
config = configparser.ConfigParser()
config.read(CONFIG_FILE)

# Parse Path
if 'Settings' in config and 'Path' in config['Settings']:
    raw_path = config['Settings']['Path']
    if os.path.isabs(raw_path):
        IMAGE_DIR = raw_path
    else:
        IMAGE_DIR = os.path.abspath(os.path.join(BASE_DIR, raw_path))
else:
    IMAGE_DIR = DEFAULT_IMAGE_PATH

# Parse Port
if 'Settings' in config and 'Port' in config['Settings']:
    try:
        PORT = int(config['Settings']['Port'])
    except ValueError:
        PORT = DEFAULT_PORT
else:
    PORT = DEFAULT_PORT

THUMBNAIL_WIDTH = 300
CACHE_DIR = os.path.join(BASE_DIR, 'cache')
THUMBNAILS_DIR = os.path.join(CACHE_DIR, 'thumbnails')

# Ensure image directory exists
if not os.path.exists(IMAGE_DIR):
    logging.warning(f"Image directory not found: {IMAGE_DIR}")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/images')
def list_images():
    if not os.path.exists(IMAGE_DIR):
        return jsonify([])
    
    images = []
    # extensions to look for
    valid_exts = ('.png', '.jpg', '.jpeg', '.webp')
    
    try:
        for filename in os.listdir(IMAGE_DIR):
            if filename.lower().endswith(valid_exts):
                filepath = os.path.join(IMAGE_DIR, filename)
                try:
                    mtime = os.path.getmtime(filepath)
                    images.append({
                        'filename': filename,
                        'mtime': mtime
                    })
                except OSError:
                    continue
    except Exception as e:
        logging.error(f"Error listing images: {e}")
        return jsonify([])
        
    # Sort by mtime descending (newest first)
    images.sort(key=lambda x: x['mtime'], reverse=True)
    return jsonify(images)

@app.route('/api/image/<path:filename>')
def serve_image(filename):
    return send_from_directory(IMAGE_DIR, filename)

@app.route('/api/thumbnail/<path:filename>')
def serve_thumbnail(filename):
    filepath = os.path.join(IMAGE_DIR, filename)
    if not os.path.exists(filepath):
        abort(404)

    # Check cache
    cache_path = os.path.join(THUMBNAILS_DIR, filename)
    
    # If configured as JPEG, we might want to change extension, but for simplicity
    # we'll keep the original filename in the cache directory but content will be JPEG.
    # Alternatively, append .jpg to avoid confusion if you look at the file system.
    # Let's just keep the filename.
    
    if os.path.exists(cache_path):
        # Check mtime to invalidate cache if original image changed
        if os.path.getmtime(filepath) <= os.path.getmtime(cache_path):
             return send_file(cache_path, mimetype='image/jpeg')

    try:
        img = Image.open(filepath)
        # Convert to RGB if necessary (e.g. for RGBA -> JPEG)
        if img.mode in ('RGBA', 'P'):
            img = img.convert('RGB')
            
        # Calculate aspect ratio
        width, height = img.size
        aspect_ratio = height / width
        new_height = int(THUMBNAIL_WIDTH * aspect_ratio)
        
        img.thumbnail((THUMBNAIL_WIDTH, new_height))
        
        # Ensure cache directory exists
        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        
        # Save to cache
        img.save(cache_path, 'JPEG', quality=70)
        
        return send_file(cache_path, mimetype='image/jpeg')
    except Exception as e:
        logging.error(f"Error generating thumbnail for {filename}: {e}")
        abort(500)

@app.route('/api/metadata/<path:filename>')
def get_metadata(filename):
    filepath = os.path.join(IMAGE_DIR, filename)
    if not os.path.exists(filepath):
        abort(404)
        
    metadata = {}
    try:
        img = Image.open(filepath)
        img.load() # Load image data
        
        # Extract PNG info
        if img.info:
            # ComfyUI usually stores workflow in 'workflow' and prompt in 'prompt' or 'parameters'
            # But standard SD uses 'parameters'.
            # ComfyUI PNG metadata usually has 'prompt' (JSON) and 'workflow' (JSON).
            
            raw_info = img.info
            
            # Try to parse specific ComfyUI fields
            if 'prompt' in raw_info:
                try:
                    metadata['prompt'] = json.loads(raw_info['prompt'])
                except:
                    metadata['prompt'] = raw_info['prompt']
            
            if 'workflow' in raw_info:
                try:
                    metadata['workflow'] = json.loads(raw_info['workflow'])
                except:
                    metadata['workflow'] = raw_info['workflow']
                    
            # Also include everything else for completeness, skipping binary data if any
            for k, v in raw_info.items():
                if k not in ['prompt', 'workflow']:
                     # simple check if it's string-like
                     if isinstance(v, (str, int, float)):
                         metadata[k] = v

    except Exception as e:
        logging.error(f"Error reading metadata for {filename}: {e}")
        return jsonify({'error': str(e)}), 500
        
    return jsonify(metadata)

def open_browser():
    webbrowser.open_new(f'http://localhost:{PORT}')

if __name__ == '__main__':
    print(f"Starting server on port {PORT}...")
    print(f"Serving images from: {IMAGE_DIR}")
    
    # Open browser after short delay
    Timer(1, open_browser).start()
    
    app.run(host='0.0.0.0', port=PORT, debug=False)
