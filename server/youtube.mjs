const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;
const youtubeHosts = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);
const embedHosts = new Set(["youtube-nocookie.com", "www.youtube-nocookie.com"]);

// Store only the video identity, never arbitrary iframe HTML or player options.
export function parseYouTubeUrl(value) {
  const invalid = () => new Error(
    "Pega un enlace HTTPS de un video o transmisión de YouTube (watch, live o youtu.be).",
  );
  if (typeof value !== "string" || value.length > 2048 || /[\u0000-\u001f]/.test(value))
    throw invalid();
  if (!value.trim()) return null;
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw invalid();
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port)
    throw invalid();

  let videoId;
  if (["youtu.be", "www.youtu.be"].includes(url.hostname)) {
    videoId = url.pathname.match(/^\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
  } else if (youtubeHosts.has(url.hostname)) {
    if (url.pathname === "/watch" && url.searchParams.getAll("v").length === 1)
      videoId = url.searchParams.get("v");
    else
      videoId = url.pathname.match(/^\/(?:live|embed|shorts)\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
  } else if (embedHosts.has(url.hostname)) {
    videoId = url.pathname.match(/^\/embed\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
  }
  if (!videoId || !videoIdPattern.test(videoId)) throw invalid();
  return { videoId, url: `https://www.youtube.com/watch?v=${videoId}` };
}
