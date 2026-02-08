document.addEventListener('DOMContentLoaded', () => {
    const gallery = document.getElementById('gallery');
    const detailsPanel = document.getElementById('details-panel');
    const previewImage = document.getElementById('preview-image');
    const metadataContent = document.getElementById('metadata-content');
    const imageCount = document.getElementById('image-count');
    const searchInput = document.getElementById('search');

    let allImages = [];
    let selectedImage = null;

    // Fetch images list
    fetch('/api/images')
        .then(response => response.json())
        .then(images => {
            allImages = images;
            imageCount.textContent = `${images.length} images`;
            renderGallery(images);
        })
        .catch(err => {
            console.error('Error fetching images:', err);
            imageCount.textContent = 'Error loading images';
        });

    function renderGallery(images) {
        gallery.innerHTML = '';

        // Use IntersectionObserver for lazy loading
        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.remove('lazy');
                    observer.unobserve(img);
                }
            });
        });

        images.forEach(image => {
            const card = document.createElement('div');
            card.className = 'thumbnail-card';
            card.dataset.filename = image.filename;

            const img = document.createElement('img');
            img.dataset.src = `/api/thumbnail/${encodeURIComponent(image.filename)}`;
            img.src = ''; // Placeholder or empty initially
            img.alt = image.filename;
            img.loading = "lazy"; // Native lazy loading as backup

            observer.observe(img);

            card.appendChild(img);

            // Add Expand Button
            const btn = document.createElement('button');
            btn.className = 'expand-btn';
            btn.innerHTML = '🔍'; // Magnifying glass icon
            btn.title = 'View Full Size';

            // Prevent card selection when clicking button
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                selectImage(image.filename, card);
                openModal(image.filename);
            });

            card.appendChild(btn);

            card.addEventListener('click', () => selectImage(image.filename, card));
            card.addEventListener('dblclick', () => {
                selectImage(image.filename, card);
                openModal(image.filename);
            });

            gallery.appendChild(card);
        });
    }

    function openModal(filename) {
        const modal = document.getElementById('image-modal');
        const modalImg = document.getElementById("full-image");
        const captionText = document.getElementById("caption");

        modal.style.display = "block";
        modalImg.src = `/api/image/${encodeURIComponent(filename)}`;
        captionText.innerHTML = filename;
    }

    function selectImage(filename, cardElement) {
        // Update selection visual
        document.querySelectorAll('.thumbnail-card').forEach(el => el.classList.remove('selected'));
        if (cardElement) {
            cardElement.classList.add('selected');
        }

        selectedImage = filename;

        // Load preview
        previewImage.src = `/api/image/${encodeURIComponent(filename)}`;

        // Load metadata
        metadataContent.innerHTML = '<p>Loading metadata...</p>';

        fetch(`/api/metadata/${encodeURIComponent(filename)}`)
            .then(res => res.json())
            .then(data => {
                displayMetadata(data);
            })
            .catch(err => {
                console.error('Error loading metadata:', err);
                metadataContent.innerHTML = '<p class="error">Error loading metadata</p>';
            });
    }

    function displayMetadata(data) {
        metadataContent.innerHTML = '';

        if (Object.keys(data).length === 0) {
            metadataContent.innerHTML = '<p>No metadata found.</p>';
            return;
        }

        // --- Extraction Logic ---
        let summaryHtml = '';
        let extractionFound = false;

        if (data.prompt) {
            try {
                const promptData = typeof data.prompt === 'string' ? JSON.parse(data.prompt) : data.prompt;
                let ksampler = null;
                let positive = "";
                let negative = "";

                // Iterate over nodes to find KSampler and Prompts
                for (const key in promptData) {
                    const node = promptData[key];
                    if (node.class_type && node.class_type.includes('KSampler')) {
                        ksampler = node.inputs;
                    }
                    if (node.class_type && node.class_type.includes('CLIPTextEncode')) {
                        // This is a bit tricky without knowing connections, but usually:
                        // We can just list all found prompts or try to guess.
                        // For now, let's collect all text.
                        // Or we can try to rely on the KSampler connections if we want to be precise, 
                        // but that requires more complex graph traversal. 
                        // Let's just list all found CLIPTextEncode contents for now, maybe labeled "Text".
                        // A simple heuristic: usually positive is longer/first? No.
                        // Let's just append to a list.
                    }
                }

                // Better approach: start from KSampler and trace back if possible, 
                // OR just show found KSampler params and ALL CLIPTextEncode nodes.

                const texts = [];
                for (const key in promptData) {
                    const node = promptData[key];
                    if (node.class_type && node.class_type.includes('CLIPTextEncode')) {
                        if (node.inputs && node.inputs.text) {
                            texts.push(node.inputs.text);
                        }
                    }
                }

                if (ksampler || texts.length > 0) {
                    extractionFound = true;
                    summaryHtml += '<div class="metadata-section"><h3>Generation Info</h3>';

                    if (texts.length > 0) {
                        // Heuristic: If we have 2, maybe 1st is pos, 2nd is neg? NOT RELIABLE.
                        // Just list them.
                        summaryHtml += '<div class="metadata-item"><div class="metadata-label">Prompts Found</div><div class="metadata-value prompt-text">';
                        texts.forEach(t => {
                            summaryHtml += `<p style="margin-bottom: 0.5em;">${t}</p>`;
                        });
                        summaryHtml += '</div></div>';
                    }

                    if (ksampler) {
                        const params = [
                            { label: 'Seed', val: ksampler.seed || ksampler.noise_seed },
                            { label: 'Steps', val: ksampler.steps },
                            { label: 'CFG', val: ksampler.cfg },
                            { label: 'Sampler', val: ksampler.sampler_name },
                            { label: 'Scheduler', val: ksampler.scheduler },
                            { label: 'Denoise', val: ksampler.denoise }
                        ];

                        summaryHtml += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">';
                        params.forEach(p => {
                            if (p.val !== undefined) {
                                summaryHtml += `<div class="metadata-item" style="margin-bottom:0.5rem">
                                    <div class="metadata-label" style="font-size:0.8rem">${p.label}</div>
                                    <div class="metadata-value" style="padding:0.2rem 0.4rem">${p.val}</div>
                                </div>`;
                            }
                        });
                        summaryHtml += '</div>'; // End grid
                    }

                    summaryHtml += '</div>'; // End section
                }

            } catch (e) {
                console.error("Error parsing prompt for extraction", e);
            }
        }

        if (extractionFound) {
            metadataContent.innerHTML += summaryHtml;
            metadataContent.innerHTML += '<hr style="border-color: var(--border-color); margin: 1rem 0;">';
        }

        // --- End Extraction Logic ---

        // Helper to create metadata item
        const createItem = (label, value) => {
            const div = document.createElement('div');
            div.className = 'metadata-item';

            const labelEl = document.createElement('div');
            labelEl.className = 'metadata-label';
            labelEl.textContent = label;

            const valueEl = document.createElement('div');
            valueEl.className = 'metadata-value';

            if (typeof value === 'object') {
                valueEl.textContent = JSON.stringify(value, null, 2);
            } else {
                valueEl.textContent = value;
            }

            div.appendChild(labelEl);
            div.appendChild(valueEl);
            return div;
        };

        // Try to parse ComfyUI prompt specifically to show it nicely
        if (data.prompt) {
            // ComfyUI 'prompt' is the workflow execution graph usually. 
            // Actual user prompt might be hidden in nodes.
            // But usually 'prompt' key in png_info contains the API format prompt.
            // Let's just dump it as JSON for now, but maybe we can extract positive/negative if we knew the node types.

            // If we have 'workflow' (the UI graph), maybe we can use that too.
            // For now, just dump everything nicely.

            // Note: Often ComfyUI saves "prompt" (api json) and "workflow" (ui json).

            const promptDiv = createItem('Prompt (API)', data.prompt);
            // Initially collapsed or just added
            metadataContent.appendChild(promptDiv);
        }

        // Check for other keys
        for (const [key, value] of Object.entries(data)) {
            if (key !== 'prompt' && key !== 'workflow') {
                metadataContent.appendChild(createItem(key, value));
            }
        }

        if (data.workflow) {
            const workflowDiv = createItem('Workflow (UI)', data.workflow);
            metadataContent.appendChild(workflowDiv);
        }
    }

    // Search filter
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = allImages.filter(img => img.filename.toLowerCase().includes(query));
        renderGallery(filtered);
    });

    // Modal Logic
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById("full-image");
    const captionText = document.getElementById("caption");
    const closeModal = document.getElementsByClassName("close-modal")[0];

    // Click on preview image to open modal
    previewImage.style.cursor = 'pointer';
    previewImage.addEventListener('click', () => {
        if (selectedImage) {
            openModal(selectedImage);
        }
    });

    // Close modal actions
    closeModal.onclick = function () {
        modal.style.display = "none";
    }

    modal.onclick = function (event) {
        if (event.target === modal) {
            modal.style.display = "none";
        }
    }

    document.addEventListener('keydown', function (event) {
        if (event.key === "Escape") {
            modal.style.display = "none";
        }
    });
});
