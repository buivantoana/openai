const $ = (...a) => document.querySelector(...a);

$("#capture").onclick = capture;
let url;
let url_callback;
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "status") {
    $("#status").style.display = "block";
    $("#status").innerText = msg.text;
    $("button").innerText = "Capturing...";
    $("button").setAttribute("disabled", "true");
  }
  if (msg.type === "done") {
    $("button").removeAttribute("disabled");
    $("button").innerText = "Capture Page";
    $("#capture-success").style.display = "block";
    $("#capture").style.display = "none";
  }
  if (msg.url_callback) {
    url_callback = msg.url_callback;
    // Đảm bảo msg chứa thuộc tính `url`
    chrome.tabs.create({ url: msg.url_callback });
  }
});
document.getElementById("capture-success").addEventListener("click", () => {
  if (savedUrl) {
    chrome.tabs.create({ url: url_callback }); // Mở URL đã lưu trong tab mới
  } else {
    console.error("No URL to open. Ensure the URL was received.");
  }
});
document.addEventListener("DOMContentLoaded", () => {
  const inputField = document.querySelector("input");

  // Lấy tab hiện tại
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      const currentUrl = tabs[0].url; // Lấy URL của tab hiện tại
      url = currentUrl;
      inputField.value = currentUrl; // Điền vào input
    }
  });
});
function capture() {
  chrome.runtime.sendMessage({ type: "capture", url });
}

const mediaContainer = document.getElementById("media-container");

// Hàm kiểm tra trạng thái đã hiển thị hay chưa
async function hasMediaBeenDisplayed(tabId) {
  return new Promise((resolve) => {
    chrome.storage.local.get([`media_displayed_${tabId}`], (result) => {
      resolve(Boolean(result[`media_displayed_${tabId}`]));
    });
  });
}

// Hàm lưu trạng thái hiển thị
async function markMediaAsDisplayed(tabId) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [`media_displayed_${tabId}`]: true }, () => {
      resolve();
    });
  });
}

// Hàm xóa trạng thái hiển thị (nếu cần reset khi đóng popup)
async function resetMediaDisplayStatus(tabId) {
  return new Promise((resolve) => {
    chrome.storage.local.remove([`media_displayed_${tabId}`], () => {
      resolve();
    });
  });
}

// Hàm kiểm tra xem đã hiển thị media chưa
async function shouldDisplayMedia(tabId) {
  return new Promise((resolve) => {
    chrome.storage.local.get([`displayed_${tabId}`], (result) => {
      resolve(!result[`displayed_${tabId}`]);
    });
  });
}

// Hàm tải media (hình ảnh và video)
async function fetchMedia() {
  mediaContainer.innerHTML = "<p>Loading media...</p>";

  // Lấy tab hiện tại
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    mediaContainer.innerHTML = "<p>No active tab found.</p>";
    return;
  }

  // Reset trạng thái hiển thị khi mở lại extension
  await chrome.storage.local.set({ [`displayed_${tab.id}`]: false });

  // Kiểm tra nếu đã hiển thị popup trước đó
  const display = await shouldDisplayMedia(tab.id);
  if (!display) {
    mediaContainer.innerHTML = "<p>Media already displayed for this tab.</p>";
    return;
  }

  // Kiểm tra xem content script có được thực thi lần nữa không
  try {
    console.log("Executing content script...");

    // Thực thi content script để thu thập media
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: function () {
        // Đảm bảo script thực thi tại trang
        const images = Array.from(document.querySelectorAll("img")).map(
          (img) => img.src
        );
        const videos = Array.from(document.querySelectorAll("video")).map(
          (video) => video.src
        );
        console.log("Images found:", images);
        console.log("Videos found:", videos);

        // Gửi dữ liệu về extension
        chrome.runtime.sendMessage({
          type: "content_data",
          images,
          videos,
        });
      },
    });

    console.log("Content script executed successfully.");
    await markMediaAsDisplayed(tab.id); // Lưu trạng thái hiển thị
  } catch (error) {
    console.error("Error executing content script:", error);
    mediaContainer.innerHTML = "<p>Failed to load media.</p>";
  }
}

// Lắng nghe tin nhắn từ content.js
chrome.runtime.onMessage.addListener((message) => {
  console.log("Received message:", message); // Thêm log để debug
  if (message.type === "content_data") {
    const { images, videos } = message;
    mediaContainer.innerHTML = "";

    // Hiển thị ảnh
    if (images.length > 0) {
      mediaContainer.innerHTML += `<h2>Images</h2>`;
      images.forEach((src) => {
        const img = document.createElement("img");
        img.src = src;
        mediaContainer.appendChild(img);
      });
    } else {
      mediaContainer.innerHTML += `<p>No images found.</p>`;
    }

    // Hiển thị video
    if (videos.length > 0) {
      mediaContainer.innerHTML += `<h2>Videos</h2>`;
      videos.forEach((src) => {
        const video = document.createElement("video");
        video.src = src;
        video.controls = true;
        mediaContainer.appendChild(video);
      });
    } else {
      mediaContainer.innerHTML += `<p>No videos found.</p>`;
    }
  }
});

// Tự động tải media khi mở popup
fetchMedia();

// Reset trạng thái khi popup bị đóng (không bắt buộc, chỉ dùng nếu bạn muốn làm mới trạng thái)
window.onunload = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) await resetMediaDisplayStatus(tab.id);
};
