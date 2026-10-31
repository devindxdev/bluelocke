import type { Bluelink } from './bluelink-regions/base'
import { confirm, destructiveConfirm, quickOptions } from './scriptable-utils'
import {
  getCustomVehicleImage,
  getCustomVehicleImageSource,
  prepareVehicleImage,
  removeCustomVehicleImage,
  saveCustomVehicleImage,
} from './custom-vehicle-image'
import {
  getMaximumImageZoom,
  getVehicleImagePlacement,
  normalizeVehicleImageCrop,
  zoomVehicleImageAt,
  VEHICLE_IMAGE_SIZE,
  VehicleImageCrop,
  VehicleImageSize,
} from './vehicle-image-geometry'
import { createVehicleImageLivePreview } from './vehicle-image-preview'
import { DEFAULT_IMAGE_PREVIEW_OPTIONS, VehicleImagePreviewOptions } from './widget-preview-data'

// WKWebView rejects Promise return values even when Scriptable's completion callback is used.
export const VEHICLE_IMAGE_EDITOR_READY_SCRIPT = 'void window.vehicleImagePreviewReady.then(completion)'
export const VEHICLE_IMAGE_SAVE_URL = 'bluelocke-image://save?crop='

export function formatVehicleImageError(error: unknown): string {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error)
  return message
    .replace(/data:image\/[^,\s]*,[a-z0-9+/=]+/gi, '[image data]')
    .replace(/\s+/g, ' ')
    .slice(0, 300)
}

export function vehicleImageEditorHTML(
  base64: string,
  sourceSize: VehicleImageSize,
  crop?: VehicleImageCrop,
  options: VehicleImagePreviewOptions = DEFAULT_IMAGE_PREVIEW_OPTIONS,
): string {
  const initialCrop = normalizeVehicleImageCrop(sourceSize, crop)
  const preview = createVehicleImageLivePreview(options)
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
  <title>Vehicle Image</title>
  <style>
    :root { color-scheme: light dark; --bg: #f2f2f7; --card: #fff; --text: #17171b; --muted: #62626a; --accent: #007aff; --line: #d9d9e0; }
    * { box-sizing: border-box; }
    html, body { overscroll-behavior: none; }
    body { margin: 0; background: var(--bg); color: var(--text); font: 16px -apple-system, BlinkMacSystemFont, sans-serif; }
    main { max-width: 640px; margin: auto; padding: max(24px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left)); }
    h1 { font-size: 22px; letter-spacing: -.6px; margin: 0; }
    .editor-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; position: sticky; top: env(safe-area-inset-top, 0px); z-index: 3; padding: 12px 0; background: var(--bg); }
    #save-image { flex-shrink: 0; min-width: 80px; background: var(--accent); border-color: var(--accent); color: white; font-weight: 600; }
    #save-image:disabled { opacity: .5; }
    #save-status { min-height: 20px; font-size: 13px; margin: 0 0 12px; }
    p { color: var(--muted); line-height: 1.5; margin: 0 0 20px; }
    .preview-panel { position: sticky; top: calc(env(safe-area-inset-top, 0px) + 68px); z-index: 2; padding: 10px 0; background: var(--bg); }
    .widget-guide { position: relative; background: #fff; color: #000; border: 1px solid var(--line); border-radius: 24px; overflow: hidden; }
    .widget-guide.dark { background: #000; color: #fff; }
    .widget-data { width: 100%; height: 100%; display: block; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
    .widget-label { fill: currentColor; }
    .widget-image-slot { position: absolute; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
    canvas { position: absolute; display: block; touch-action: none; outline: 1px dashed #0a84ff; outline-offset: 2px; cursor: grab; }
    canvas.dragging { cursor: grabbing; }
    .caption { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin: 12px 0 20px; }
    .caption span { color: var(--muted); font-size: 12px; }
    .buttons { display: flex; gap: 8px; }
    button { min-height: 44px; border: 1px solid var(--line); border-radius: 10px; background: var(--card); color: var(--text); font: inherit; padding: 10px 14px; }
    button[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: white; }
    button:focus-visible, input:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }
    .resize-handle { position: absolute; width: 28px; height: 28px; min-height: 28px; padding: 4px; border: 0; border-radius: 6px; background: var(--accent); color: white; cursor: nwse-resize; touch-action: none; }
    .resize-handle svg { width: 100%; height: 100%; display: block; pointer-events: none; }
    .mode button { flex: 1; }
    details { margin-top: 16px; }
    summary { min-height: 44px; padding: 12px 0; color: var(--muted); }
    .controls { background: var(--card); padding: 18px; border-radius: 16px; margin-top: 16px; }
    label { display: flex; justify-content: space-between; gap: 8px; font-size: 14px; font-weight: 600; }
    output { color: var(--muted); font-variant-numeric: tabular-nums; font-weight: 400; }
    input[type="range"] { display: block; width: 100%; min-height: 44px; margin: 4px 0 12px; accent-color: var(--accent); }
    input[type="range"]:last-child { margin-bottom: 0; }
    .note { font-size: 13px; margin-top: 18px; }
    #error { color: #c22; }
    @media (prefers-color-scheme: dark) { :root { --bg: #000; --card: #1c1c1e; --text: #f5f5f7; --muted: #aaaab2; --line: #3a3a40; --accent: #0a84ff; } }
    @media (max-width: 350px) { main { padding: max(20px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left)); } .caption { flex-wrap: wrap; } }
    @media (max-height: 540px) { .preview-panel { position: static; } }
  </style>
</head>
<body>
<main>
  <header class="editor-toolbar"><h1>Frame your vehicle.</h1><button id="save-image" disabled>Save</button></header>
  <p id="save-status" role="status" aria-live="polite">Tap Save to keep your framing.</p>
  <p>Drag the photo to move it. Pinch or pull the corner to resize. See every change right in the widget.</p>
  <section class="preview-panel" aria-label="Interactive widget preview">
  ${preview.html}
  <div class="caption"><span>Live widget &middot; Sample data &middot; <output id="live-zoom">100%</output></span><div class="buttons"><button id="light" aria-pressed="${options.appearance === 'white'}">Light</button><button id="dark" aria-pressed="${options.appearance === 'dark'}">Dark</button></div></div>
  <div class="buttons mode"><button id="fit">Fit whole image</button><button id="fill">Fill frame</button></div>
  </section>
  <details><summary>Fine-tune size and position</summary>
  <div class="controls">
    <label for="zoom">Image size <output id="zoom-value"></output></label>
    <input id="zoom" type="range" min="0.5" max="${getMaximumImageZoom(sourceSize)}" step="0.01">
    <label for="x">Left / right <output id="x-value"></output></label>
    <input id="x" type="range" min="0" max="1" step="0.01">
    <label for="y">Up / down <output id="y-value"></output></label>
    <input id="y" type="range" min="0" max="1" step="0.01">
  </div>
  </details>
  <p class="note">Your photo stays in the widget's ${Math.round(preview.frame.width)} &times; ${Math.round(preview.frame.height)} point image area. Tap Save to apply your framing immediately. Closing without saving discards your latest adjustments. Nothing is uploaded.</p>
  <p id="error" role="alert" hidden>We couldn't load this image. Close the editor and choose another photo.</p>
  <img id="source" alt="" hidden>
</main>
<script>
  const source = document.getElementById('source');
  const canvas = document.getElementById('canvas');
  const context = canvas.getContext('2d');
  const frame = ${JSON.stringify(VEHICLE_IMAGE_SIZE)};
  const sourceSize = ${JSON.stringify(sourceSize)};
  const placement = ${getVehicleImagePlacement.toString()};
  const zoomAt = ${zoomVehicleImageAt.toString()};
  const state = ${JSON.stringify(initialCrop)};
  const controls = ['zoom', 'x', 'y'];
  let ready = false;
  let saving = false;
  let savedCrop = '';
  const saveButton = document.getElementById('save-image');
  const saveStatus = document.getElementById('save-status');
  function updateSaveButton() {
    const saved = savedCrop === JSON.stringify(state);
    saveButton.disabled = !ready || saving || saved;
    saveButton.textContent = saving ? 'Saving…' : saved ? 'Saved' : 'Save';
  }
  saveButton.onclick = () => {
    if (!ready || saving || savedCrop === JSON.stringify(state)) return;
    saving = true;
    saveStatus.textContent = 'Saving your vehicle image…';
    updateSaveButton();
    window.location.href = '${VEHICLE_IMAGE_SAVE_URL}' + encodeURIComponent(JSON.stringify({ ...state }));
  };
  window.vehicleImageSaveFinished = (success, message) => {
    saving = false;
    if (success) savedCrop = JSON.stringify(state);
    saveStatus.textContent = success ? 'Saved. You can close the editor or keep adjusting.' : message;
    updateSaveButton();
  };
  const pointers = new Map();
  const handle = document.getElementById('resize-image');
  // Cancel native scrolling only on the editing surfaces, not on the page or controls.
  [canvas, handle].forEach(target => {
    ['touchstart', 'touchmove'].forEach(type => target.addEventListener(type, event => {
      if (event.cancelable) event.preventDefault();
      event.stopPropagation();
    }, { passive: false, capture: true }));
  });
  let gesture;
  let resizing;
  function draw() {
    if (!ready) return;
    context.clearRect(0, 0, frame.width, frame.height);
    const rect = placement(sourceSize, frame, state);
    context.drawImage(source, rect.x, rect.y, rect.width, rect.height);
    document.getElementById('live-zoom').textContent = Math.round(state.zoom * 100) + '%';
    controls.forEach(key => {
      document.getElementById(key).value = state[key];
      document.getElementById(key + '-value').textContent = Math.round(state[key] * 100) + '%';
    });
    if (!saving && savedCrop !== JSON.stringify(state)) saveStatus.textContent = 'Tap Save to keep your framing.';
    updateSaveButton();
  }
  controls.forEach(key => {
    document.getElementById(key).addEventListener('input', event => {
      if (saving) { event.target.value = state[key]; return; }
      const value = Number(event.target.value);
      if (key === 'zoom') Object.assign(state, zoomAt(sourceSize, frame, state, value, { x: frame.width / 2, y: frame.height / 2 }));
      else state[key] = value;
      draw();
    });
  });
  document.getElementById('fit').onclick = () => { if (saving) return; Object.assign(state, { zoom: 1, x: 0.5, y: 0.5 }); draw(); };
  document.getElementById('fill').onclick = () => {
    if (saving) return;
    const fit = Math.min(frame.width / sourceSize.width, frame.height / sourceSize.height);
    const fill = Math.max(frame.width / sourceSize.width, frame.height / sourceSize.height);
    Object.assign(state, { zoom: fill / fit, x: 0.5, y: 0.5 }); draw();
  };
  ['light', 'dark'].forEach(mode => {
    document.getElementById(mode).onclick = () => {
      document.getElementById('preview').classList.toggle('dark', mode === 'dark');
      ['light', 'dark'].forEach(key => document.getElementById(key).setAttribute('aria-pressed', String(key === mode)));
    };
  });
  const point = event => ({ x: event.clientX, y: event.clientY });
  const midpoint = points => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 });
  const distance = points => Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y));
  function toFrame(value) {
    const bounds = canvas.getBoundingClientRect();
    return { x: (value.x - bounds.left) * frame.width / bounds.width, y: (value.y - bounds.top) * frame.height / bounds.height };
  }
  function pan(crop, dx, dy) {
    const rect = placement(sourceSize, frame, crop);
    return {
      ...crop,
      x: Math.abs(frame.width - rect.width) > 1 ? Math.max(0, Math.min(1, crop.x + dx / (frame.width - rect.width))) : crop.x,
      y: Math.abs(frame.height - rect.height) > 1 ? Math.max(0, Math.min(1, crop.y + dy / (frame.height - rect.height))) : crop.y,
    };
  }
  function beginGesture() {
    const points = [...pointers.values()];
    gesture = points.length ? {
      crop: { ...state },
      start: toFrame(points.length === 2 ? midpoint(points) : points[0]),
      distance: points.length === 2 ? distance(points) : 0,
    } : undefined;
    canvas.classList.toggle('dragging', points.length > 0);
  }
  canvas.addEventListener('pointerdown', event => {
    if (!ready || saving || resizing || pointers.size >= 2) return;
    event.preventDefault();
    pointers.set(event.pointerId, point(event));
    canvas.setPointerCapture(event.pointerId);
    beginGesture();
  });
  canvas.addEventListener('pointermove', event => {
    if (saving || !gesture || !pointers.has(event.pointerId)) return;
    event.preventDefault();
    pointers.set(event.pointerId, point(event));
    const points = [...pointers.values()];
    const current = toFrame(points.length === 2 ? midpoint(points) : points[0]);
    const crop = points.length === 2
      ? zoomAt(sourceSize, frame, gesture.crop, gesture.crop.zoom * distance(points) / gesture.distance, gesture.start)
      : gesture.crop;
    Object.assign(state, pan(crop, current.x - gesture.start.x, current.y - gesture.start.y));
    draw();
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => canvas.addEventListener(type, event => {
    if (!pointers.delete(event.pointerId)) return;
    beginGesture();
  }));
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    if (!ready || saving) return;
    Object.assign(state, zoomAt(sourceSize, frame, state, state.zoom * Math.exp(-event.deltaY * 0.002), toFrame(point(event))));
    draw();
  }, { passive: false });
  handle.addEventListener('pointerdown', event => {
    if (!ready || saving || resizing || pointers.size) return;
    event.preventDefault();
    resizing = { id: event.pointerId, start: point(event), crop: { ...state } };
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove', event => {
    if (saving || !resizing || resizing.id !== event.pointerId) return;
    event.preventDefault();
    const bounds = canvas.getBoundingClientRect();
    const delta = (event.clientX - resizing.start.x) / bounds.width + (event.clientY - resizing.start.y) / bounds.height;
    Object.assign(state, zoomAt(sourceSize, frame, resizing.crop, resizing.crop.zoom * Math.exp(delta), { x: frame.width / 2, y: frame.height / 2 }));
    draw();
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => handle.addEventListener(type, event => {
    if (resizing && resizing.id === event.pointerId) resizing = undefined;
  }));
  handle.addEventListener('keydown', event => {
    const grow = ['ArrowUp', 'ArrowRight', '+', '=', 'Enter', ' '].includes(event.key);
    const shrink = ['ArrowDown', 'ArrowLeft', '-', '_'].includes(event.key);
    if ((!grow && !shrink) || !ready || saving) return;
    event.preventDefault();
    Object.assign(state, zoomAt(sourceSize, frame, state, state.zoom * (grow ? 1.1 : 1 / 1.1), { x: frame.width / 2, y: frame.height / 2 }));
    draw();
  });
  window.vehicleImagePreviewReady = new Promise(resolve => {
    source.onerror = () => { document.getElementById('error').hidden = false; resolve(false); };
    source.onload = () => { ready = source.naturalWidth > 0; draw(); resolve(ready); };
    source.src = 'data:image/png;base64,${base64}';
  });
  window.getVehicleImageCrop = () => ready ? { ...state } : null;
  window.getVehicleImagePreviewAppearance = () => document.getElementById('preview').classList.contains('dark') ? 'dark' : 'white';
</script>
</body>
</html>`
}

async function editVehicleImage(
  image: Image,
  options: VehicleImagePreviewOptions,
  crop: VehicleImageCrop | undefined,
  onSave: (crop: VehicleImageCrop) => void,
  onStage: (stage: string) => void = () => {},
): Promise<void> {
  onStage('Preparing the live editor')
  const view = new WebView()
  onStage('Loading the live editor')
  await view.loadHTML(vehicleImageEditorHTML(Data.fromPNG(image).toBase64String(), image.size, crop, options))
  onStage('Starting the live editor')
  const ready = await view.evaluateJavaScript(VEHICLE_IMAGE_EDITOR_READY_SCRIPT, true)
  if (!ready) throw new Error('The image preview could not be loaded.')
  onStage('Showing the live editor')
  // Fullscreen avoids iOS's sheet-dismiss pan recognizer competing with image drags.
  let closed = false
  let feedback = Promise.resolve()
  let feedbackError: unknown
  // Intercept the editor's local Save action. No navigation or photo upload
  // occurs, and no JavaScript callback is left waiting when Close is tapped.
  view.shouldAllowRequest = (request) => {
    if (!request.url.startsWith(VEHICLE_IMAGE_SAVE_URL)) return false
    let success = false
    let message = ''
    try {
      if (request.url.length > 2048) throw new Error('Invalid image framing.')
      const crop = JSON.parse(decodeURIComponent(request.url.slice(VEHICLE_IMAGE_SAVE_URL.length)))
      if (!crop || !['zoom', 'x', 'y'].every((key) => typeof crop[key] === 'number' && Number.isFinite(crop[key]))) {
        throw new Error('Invalid image framing.')
      }
      onStage('Saving the vehicle image')
      onSave(normalizeVehicleImageCrop(image.size, crop))
      success = true
    } catch (error) {
      message = `Could not save: ${formatVehicleImageError(error)}. Your last saved image is still in use. Tap Save to retry.`
    }
    feedback = feedback
      .then(async () => {
        if (!closed)
          await view.evaluateJavaScript(`window.vehicleImageSaveFinished(${success}, ${JSON.stringify(message)})`)
      })
      .catch((error) => {
        if (!closed) feedbackError = error
      })
    return false
  }
  try {
    await view.present(true)
  } finally {
    closed = true
    await feedback
  }
  if (feedbackError) throw feedbackError
}

function imagePreviewOptions(bl: Bluelink): VehicleImagePreviewOptions {
  const settings = bl.getConfig()
  return {
    screenWidth: Math.min(Device.screenSize().width, Device.screenSize().height),
    appearance:
      settings.widgetAppearance === 'dark' || (settings.widgetAppearance === 'system' && Device.isUsingDarkAppearance())
        ? 'dark'
        : 'white',
    distanceUnit: settings.distanceUnit,
    electric: bl.supportsChargingFeatures(),
  }
}

export async function loadVehicleImageSettings(bl: Bluelink): Promise<void> {
  const car = bl.getCachedStatus().car
  const vehicleId = car.vin || car.id
  if (!vehicleId) {
    await confirm('Your vehicle is not ready yet', {
      message: 'Refresh your vehicle and try again.',
      includeCancel: false,
    })
    return
  }
  const current = getCustomVehicleImage(vehicleId)
  const option = await quickOptions(
    ['Choose from Photos', 'Choose from Files', 'Preview & Adjust Image', 'Restore Default Image'],
    {
      title: 'Custom Vehicle Image',
      message: 'Saved on this device for this vehicle and script profile. Nothing is uploaded.',
    },
  )
  if (!option) return
  let stage = 'Loading image settings'
  let imageUpdated = false
  try {
    const previewOptions = imagePreviewOptions(bl)
    if (option === 'Restore Default Image') {
      stage = 'Restoring the original vehicle image'
      if (
        await destructiveConfirm('Restore the default vehicle image?', {
          message: "Remove your custom photo and crop, and use Bluelocke's original model/trim/color picture again.",
          confirmButtonTitle: 'Restore Default',
        })
      ) {
        removeCustomVehicleImage(vehicleId)
        imageUpdated = true
        await confirm('Original vehicle image restored', {
          message: 'Close Settings to see the original vehicle picture. Widgets will show it on their next refresh.',
          includeCancel: false,
        })
      }
      return
    }
    let image: Image | undefined
    let crop: VehicleImageCrop | undefined
    if (option === 'Preview & Adjust Image') {
      stage = 'Loading the current vehicle image'
      const saved = getCustomVehicleImageSource(vehicleId)
      image = saved?.image || current || (await bl.getCarImage())
      crop = saved?.crop
    } else if (option === 'Choose from Photos') {
      stage = 'Choosing a photo'
      image = await Photos.fromLibrary()
    } else if (option === 'Choose from Files') {
      stage = 'Opening an image from Files'
      const paths = await DocumentPicker.open(['public.image'])
      const path = paths[0]
      if (!path) return
      await FileManager.iCloud().downloadFileFromiCloud(path)
      image = Image.fromFile(path)
      if (!image) throw new Error('The selected file is not a readable image.')
    }
    if (!image) return
    stage = 'Resizing the selected image'
    const source = prepareVehicleImage(image)
    await editVehicleImage(
      source,
      previewOptions,
      crop,
      (editedCrop) => {
        try {
          saveCustomVehicleImage(vehicleId, source, editedCrop)
          imageUpdated = true
        } catch (error) {
          try {
            bl.getLogger().log(`Vehicle image error - ${stage}: ${formatVehicleImageError(error)}`)
          } catch {
            // Keep the save error visible even if diagnostic storage fails.
          }
          throw error
        }
      },
      (value) => {
        stage = value
      },
    )
  } catch (error) {
    if (/cancel(?:led|ed)?/i.test(String(error))) return
    const detail = formatVehicleImageError(error)
    try {
      bl.getLogger().log(`Vehicle image error - ${stage}: ${detail}`)
    } catch (_loggingError) {
      // A logging/storage problem must not hide the original error.
    }
    await confirm(
      imageUpdated ? 'Your image was updated, but something went wrong' : 'We could not update your vehicle image',
      {
        message: `${imageUpdated ? 'Your image change was saved.' : 'Your previous image has not been changed.'}\n\nStep: ${stage}\nDetails: ${detail}\n\nIf this continues, share this message so we can identify the problem.`,
        includeCancel: false,
      },
    )
  }
}
