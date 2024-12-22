// const { GoogleGenerativeAI } = require("@google/generative-ai");
// const fs = require("fs");

// // Access your API key as an environment variable (see "Set up your API key" above)
// const genAI = new GoogleGenerativeAI("AIzaSyC2dE9kSbxdWHNokG-hvqwn7RKUP4mRwGU");

// // Converts local file information to a GoogleGenerativeAI.Part object.
// function fileToGenerativePart(path, mimeType) {
//     return {
//         inlineData: {
//             data: Buffer.from(fs.readFileSync(path)).toString("base64"),
//             mimeType
//         },
//     };
// }

// async function run() {
//     // The Gemini 1.5 models are versatile and work with both text-only and multimodal prompts
//     const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

//     const prompt = "hãy lấy ra tiêu đề cùng với tóm tắt nội dung khoảng 100 từ nội dung trong hình ảnh trả về  kiểu object có {title:nội dung title ,description:nội dung description}";

//     const imageParts = [
//         fileToGenerativePart("./images/sandbox.crm.com_platform_integrations.png", "image/png"),
//     ];

//     const result = await model.generateContent([prompt, ...imageParts]);
//     const response = await result.response;
//     const text = response.text();
//     const regex = /({.*?})/s;
//     const match = text.match(regex);
//     if (match && match[0]) {
//         try {
//             // Làm sạch chuỗi JSON để loại bỏ các ký tự không cần thiết
//             let jsonString = match[0].replace(/```json|```/g, '').trim();  // Xóa dấu backtick và khoảng trắng thừa
//             const jsonObject = JSON.parse(jsonString);  // Chuyển chuỗi JSON thành object
//             console.log(jsonObject);
//         } catch (error) {
//             console.error('Lỗi khi phân tích cú pháp JSON:', error);
//         }
//     } else {
//         console.log('Không tìm thấy JSON trong chuỗi.');
//     }
// }

// run();

const express = require("express");
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(express.json({ limit: "100mb" }));

// Khởi tạo Google Generative AI
const genAI = new GoogleGenerativeAI("AIzaSyC2dE9kSbxdWHNokG-hvqwn7RKUP4mRwGU");

// Hàm tạo thư mục nếu chưa tồn tại
function ensureUploadsDir() {
  const uploadsDir = path.join(__dirname, "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
    console.log("Created uploads directory.");
  }
}

// Hàm chuyển file thành định dạng phù hợp với Google Generative AI
function fileToGenerativePart(filePath, mimeType) {
  return {
    inlineData: {
      data: fs.readFileSync(filePath).toString("base64"),
      mimeType,
    },
  };
}

// API upload và xử lý ảnh
app.post("/upload", async (req, res) => {
  const { image, url } = req.body;

  console.log("Received URL:", url);
  if (!image) {
    return res.status(400).json({ error: "No image data provided" });
  }

  // Tạo thư mục uploads nếu chưa tồn tại
  ensureUploadsDir();

  // Xử lý dữ liệu ảnh
  const base64Data = image.replace(/^data:image\/png;base64,/, "");
  const fileName = `screenshot_${Date.now()}.png`;
  const filePath = path.join(__dirname, "uploads", fileName);

  // Kiểm tra dữ liệu Base64
  if (!base64Data || base64Data.length < 10) {
    return res.status(400).json({ error: "Invalid image data provided" });
  }

  try {
    // Lưu ảnh vào thư mục uploads
    fs.writeFileSync(filePath, base64Data, "base64");
    console.log("Image saved:", filePath);

    // Gọi Google Generative AI để xử lý
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt =
      "Hãy lấy ra tiêu đề cùng với tóm tắt nội dung khoảng 5 câu với phong cách quảng cáo đọc nhấn mạnh từng câu từ nội dung trong hình ảnh. Trả về kiểu object có {title: nội dung title, description: nội dung description}";

    const imagePart = fileToGenerativePart(filePath, "image/png");
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    // Dọn dẹp file sau khi xử lý
    // if (fs.existsSync(filePath)) {
    //   fs.unlink(filePath, (err) => {
    //     if (err) {
    //       console.error("Error deleting file:", err);
    //     } else {
    //       console.log("File deleted:", filePath);
    //     }
    //   });
    // }

    // Phân tích kết quả trả về từ AI
    const regex = /({.*?})/s;
    const match = text.match(regex);
    if (match && match[0]) {
      const jsonString = match[0].replace(/```json|```/g, "").trim();
      const jsonObject = JSON.parse(jsonString);
      console.log(jsonObject);
      return res
        .status(200)
        .json({ message: "Processed successfully", data: jsonObject });
    } else {
      return res
        .status(200)
        .json({ message: "No valid JSON found in response." });
    }
  } catch (error) {
    // Dọn dẹp file nếu có lỗi
    if (fs.existsSync(filePath)) {
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error("Error deleting file:", err);
        } else {
          console.log("File deleted:", filePath);
        }
      });
    }

    console.error("Error processing image:", error);
    return res.status(500).json({ error: "Failed to process image." });
  }
});

// Start server
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
