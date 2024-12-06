// content.js
const images = Array.from(document.querySelectorAll("img")).map((img) => img.src);
const videos = Array.from(document.querySelectorAll("video")).map((video) => video.src);

// Kiểm tra xem có thu thập được media hay không
console.log("Images found:", images);
console.log("Videos found:", videos);

// Gửi dữ liệu về extension
chrome.runtime.sendMessage({
    type: "content_data",
    images,
    videos,
});
