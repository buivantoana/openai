document.getElementById("takeScreenshotBtn").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    chrome.tabs.sendMessage(activeTab.id, { action: "takeScreenshot" }, (response) => {
      const images = response.dataUrl;

      if (images.length === 0) {
        console.error("No images captured.");
        return;
      }

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      const firstImage = new Image();
      firstImage.onload = () => {
        canvas.width = firstImage.width;
        canvas.height = images.length * firstImage.height;

        let imagesLoaded = 0;

        const drawImageOnCanvas = (image, index) => {
          context.drawImage(image, 0, index * firstImage.height);
          imagesLoaded++;

          if (imagesLoaded === images.length) {
            // Convert canvas to a data URL
            const dataUrl = canvas.toDataURL("image/png");
            console.log(dataUrl)
            // Send the data to the Node.js API
            fetch("http://localhost:3000/upload", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ image: dataUrl }),
            })
              .then((response) => response.json())
              .then((data) => {
                console.log("Image uploaded successfully:", data);
              })
              .catch((error) => {
                console.error("Error uploading image:", error);
              });
          }
        };

        images.forEach((dataUrl, index) => {
          const image = new Image();
          image.onload = () => drawImageOnCanvas(image, index);
          image.src = dataUrl;
        });
      };

      firstImage.src = images[0];
    });
  });
});
