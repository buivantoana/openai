let options = {
  FORMAT: "png",
  SCALE_FACTOR: 1.5,
  JPEG_QUALITY: 100,
};

let storage = {
  get: (item) => {
    return new Promise((res) => {
      chrome.storage.sync.get([item], (s) => res(s[item]));
    });
  },
  set: (item, val) => {
    return new Promise((res) => {
      chrome.storage.sync.set({ [item]: val }, (s) => res());
    });
  },
};

(async () => {
  options = { ...options, ...(await storage.get("settings")) };
  console.log(options);
})();

let DATA;
let data_url = {};
let url;
chrome.runtime.onMessage.addListener(async (msg, _, respond) => {
  console.log(msg);
  if (msg.type === "content_data") {
    chrome.runtime.sendMessage(msg);
    (data_url.image = msg.images), (data_url.video = msg.videos);
  }
  if (msg.type === "capture") {
    url = msg.url;
    options = { ...options, ...(await storage.get("settings")) };
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    capture(tab);
    respond();
  }
  if (msg.type === "getImage") {
    respond({ type: "image", data: DATA });
  }
});

async function capture(tab) {
  let l = createLogger("background", "action.onClicked", tab.id);
  l("Starting");

  try {
    // Reset device metrics và background color mỗi khi chụp ảnh
    await attach(tab.id, null, tab);
    l("Attached debugger");

    await enablePage(tab.id);
    l("Enabled debugger page");

    await setBg(tab.id, { color: { r: 0, g: 0, b: 0, a: 0 } }); // Set background color
    l("Set colorless background");

    const {
      contentSize: { width, height },
    } = await getSize(tab.id); // Lấy kích thước layout
    l("Got layout metrics", { width, height });

    await setSize(tab.id, { height, width }); // Set lại kích thước của tab
    l("Set layout metrics");

    await sleep(500); // Chờ một chút trước khi chụp

    l("Capturing screenshot");
    let data = await screenshot(tab.id); // Chụp ảnh
    l("Got screenshot, waiting", data);

    await sleep(500); // Chờ một chút sau khi chụp

    // Gọi API và gửi ảnh
    let url_callback = await callApiWithImage(data); // Gửi ảnh lên API
    console.log(url_callback);
    // Không cần phải dọn dẹp tab nữa vì không cần chuyển tab
    // Không cần phải phục hồi trạng thái tab ban đầu, tiếp tục chụp lần 2

    // Cập nhật DATA với ảnh mới
    DATA = data;

    l("Finished");

    chrome.runtime.sendMessage({ type: "done", url_callback });
  } catch (error) {
    l("Error occurred", error);
    console.error("Detailed error:", error); // In ra chi tiết lỗi để debug
    chrome.runtime.sendMessage({ type: "done" });
  }
}

async function callApiWithImage(imageDataBase64) {
  const apiUrl = "https://vp.zeezoo.mobi:8089/product/info"; // Thay đổi URL API của bạn ở đây
  const formData = new FormData();
  const base64Data = imageDataBase64.replace(/^data:image\/\w+;base64,/, "");
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length)
    .fill(0)
    .map((_, i) => byteCharacters.charCodeAt(i));
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: "image/png" });
  formData.append("image_files", blob, "screenshot.png");
  formData.append("product_url", url);
  formData.append("video_urls", JSON.stringify(data_url.video));
  formData.append("image_urls", JSON.stringify(data_url.image));

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        authorization: "Bearer dHRzb3BlbmFpeGluY2hhb2NhY2JhbmdtdjEyMzQ1Ng==",
      },
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("API call failed:", response.statusText);
    } else {
      console.log("Image sent successfully");
      return data.url_callback;
    }
  } catch (error) {
    console.error("Error during API call:", error);
    throw error;
  }
}

function clearSize(tabId) {
  return new Promise((resolve) => {
    chrome.debugger.sendCommand(
      {
        tabId: tabId,
      },
      "Emulation.clearDeviceMetricsOverride",
      resolve
    );
  });
}

function screenshot(tabId) {
  return new Promise((resolve, reject) => {
    let l = createLogger("background", "captureScreenshot", tabId);
    chrome.debugger.sendCommand(
      { tabId: tabId },
      "Page.captureScreenshot",
      {
        format: options.FORMAT,
        fromSurface: true,
        ...(options.FORMAT === "jpeg" ? { quality: options.JPEG_QUALITY } : {}),
      },
      (response) => {
        if (chrome.runtime.lastError) {
          l("Failed", chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          var dataType = typeof response.data;
          l("Success", response);
          let base_64_data = `data:image/${options.FORMAT};base64,${response.data}`;
          resolve(base_64_data);
        }
      }
    );

    l("Command sent");
  });
}

function setSize(tabId, { height, width }) {
  return new Promise((resolve) => {
    chrome.debugger.sendCommand(
      {
        tabId: tabId,
      },
      "Emulation.setDeviceMetricsOverride",
      {
        height: height,
        width: width,
        deviceScaleFactor: options.SCALE_FACTOR,
        mobile: false,
      },
      resolve
    );
  });
}

function getSize(tabId) {
  return new Promise((resolve) => {
    chrome.debugger.sendCommand(
      {
        tabId: tabId,
      },
      "Page.getLayoutMetrics",
      {},
      resolve
    );
  });
}

function setBg(tabId, bg) {
  return new Promise((resolve) => {
    chrome.debugger.sendCommand(
      { tabId: tabId },
      "Emulation.setDefaultBackgroundColorOverride",
      bg,
      resolve
    );
  });
}

function enablePage(tabId) {
  return new Promise((resolve) => {
    chrome.debugger.sendCommand(
      { tabId: tabId },
      "Page.enable",
      {},
      function () {
        resolve(tabId);
      }
    );
  });
}

function attach(tabId, changeInfo, tab) {
  return new Promise((resolve, reject) => {
    if (tab.status == "complete") {
      chrome.debugger.attach({ tabId: tabId }, "1.0", () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(tab || { id: tabId });
        }
      });
    }
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function log(where, what, status, tabId, details) {
  console.log(
    `[${what}] {${where}} [%o]: %o, ${details ? "%o" : ""}`,
    tabId,
    status,
    ...(details ? [details] : [])
  );
  if (where === "background" && what === "action.onClicked" && tabId) {
    try {
      chrome.runtime.sendMessage({ type: "status", text: status });
    } catch (_) {}
  }
}

function createLogger(where, what, tabId) {
  return (status, details) => {
    log(where, what, status, tabId, details);
  };
}
