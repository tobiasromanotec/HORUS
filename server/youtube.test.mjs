import test from "node:test";
import assert from "node:assert/strict";
import { parseYouTubeUrl } from "./youtube.mjs";

test("YouTube links resolve to a single canonical video without tracking or player options", () => {
  for (const url of [
    "https://www.youtube.com/watch?v=M7lc1UVf-VE",
    "https://youtube.com/watch?v=M7lc1UVf-VE&t=60&list=ignored",
    "https://m.youtube.com/watch?v=M7lc1UVf-VE",
    "https://www.youtube.com/live/M7lc1UVf-VE?si=tracking",
    "https://youtu.be/M7lc1UVf-VE?si=tracking",
    "https://www.youtu.be/M7lc1UVf-VE/",
    "https://www.youtube.com/embed/M7lc1UVf-VE?autoplay=0",
    "https://www.youtube-nocookie.com/embed/M7lc1UVf-VE",
    "https://youtube.com/shorts/M7lc1UVf-VE",
    "  https://www.youtube.com/watch?v=M7lc1UVf-VE  ",
  ])
    assert.deepEqual(parseYouTubeUrl(url), {
      videoId: "M7lc1UVf-VE",
      url: "https://www.youtube.com/watch?v=M7lc1UVf-VE",
    }, url);
  assert.equal(parseYouTubeUrl(""), null);
  assert.equal(parseYouTubeUrl("   "), null);
});

test("YouTube parser rejects arbitrary origins, credentials, channel URLs and malformed IDs", () => {
  for (const value of [
    undefined, null, 123, [], {},
    "javascript:alert(1)", "//youtu.be/M7lc1UVf-VE",
    "http://youtu.be/M7lc1UVf-VE",
    "https://youtube.com.evil.example/watch?v=M7lc1UVf-VE",
    "https://evil.example/youtube.com/watch?v=M7lc1UVf-VE",
    "https://youtube.com@evil.example/watch?v=M7lc1UVf-VE",
    "https://user:password@youtube.com/watch?v=M7lc1UVf-VE",
    "https://youtu.be:8443/M7lc1UVf-VE",
    "https://www.youtube.com/@horus/live",
    "https://www.youtube.com/channel/UCabc/live",
    "https://studio.youtube.com/video/M7lc1UVf-VE/livestreaming",
    "https://www.youtube.com/redirect?q=https://example.com",
    "https://www.youtube.com/watch?v=M7lc1UVf-VE&v=another-id",
    "https://www.youtube.com/watch?v=short",
    "https://youtu.be/M7lc1UVf-VE/extra",
    "https://www.youtube-nocookie.com/watch?v=M7lc1UVf-VE",
    "https://www.youtube.com/watch?v=%3Cscript%3E",
    "https://www.youtube.com/watch?v=M7lc1UVf-VE\n",
    '<iframe src="https://www.youtube.com/embed/M7lc1UVf-VE"></iframe>',
    `https://youtu.be/M7lc1UVf-VE?si=${"a".repeat(2048)}`,
  ]) assert.throws(() => parseYouTubeUrl(value), /YouTube/, String(value));
});
