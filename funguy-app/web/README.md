# Mushroom Eye v2

A single-file webcam visual. Motion grows glassy blobs; sudden sounds --
onsets above the rolling loudness average -- shake the color channels apart;
sustained loudness bleeds the fungal palette away, speeds the color crawl,
and slowly swells the eye's lens wide open; all framed by a blinking eye.

## Run
Serve `index.html` over HTTPS or localhost (camera/mic require a secure
context), e.g.:

    npx serve .        # or: python3 -m http.server 8123

## Deploy

    npx vercel --prod

## Keys
- `p` / `o` - next / previous palette
- `0` - color grade on/off
- `m` / `f` - mirror / vertical flip

## Versions
- v2 (this folder): single file -- motion blobs, onset color shake, loudness
  color fade + lens widening, real background
- v1 (`../web-v1/`): grabbable 3D scan, 12-clone field, face rings, hand
  tracking, white void background
