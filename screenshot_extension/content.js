const images = Array.from(document.querySelectorAll("img"))
  .map((img) => {
    if (img.currentSrc) {
      console.log("Using currentSrc:", img.currentSrc);
      return img.currentSrc;
    }
    if (img.src) {
      console.log("Using src:", img.src);
      return img.src;
    }
    if (img.srcset) {
      console.log("Processing srcset for:", img);
      const srcsetParts = img.srcset
        .split(",")
        .map((src) => src.trim().split(" ")[0]);
      console.log("Srcset parts:", srcsetParts);
      return srcsetParts[srcsetParts.length - 1];
    }
    console.log("No src, srcset, or currentSrc found for:", img);
    return null;
  })
  .filter(Boolean);

console.log("Images found:", images);

const videos = Array.from(document.querySelectorAll("video")).map(
  (video) => video.currentSrc || video.src
);

// Kiểm tra xem có thu thập được media hay không
console.log("Images found:", images);
console.log("Videos found:", videos);

// Gửi dữ liệu về extension
chrome.runtime.sendMessage({
  type: "content_data",
  images,
  videos,
});
