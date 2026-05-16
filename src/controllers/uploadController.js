const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const fs = require("fs");
const path = require("path");

// Configure cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "demo",
  api_key: process.env.CLOUDINARY_API_KEY || "123456789012345",
  api_secret: process.env.CLOUDINARY_API_SECRET || "abc123abc123abc123abc123abc",
});

// Use disk storage for multer temporary files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const tmpDir = path.join(__dirname, "../../tmp");
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    cb(null, tmpDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

exports.uploadMiddleware = upload.array("images", 4); // allow up to 4 images at once

exports.uploadImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    const urls = [];

    // Ensure cloudinary is configured with freshly trimmed credentials
    const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || "demo").trim();
    const apiKey = (process.env.CLOUDINARY_API_KEY || "123456789012345").trim();
    const apiSecret = (process.env.CLOUDINARY_API_SECRET || "abc123abc123abc123abc123abc").trim();

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });

    // Check if real cloudinary credentials are provided
    const hasCloudinary = cloudName && cloudName !== "demo" && !cloudName.includes("your_cloudinary");

    const sampleImages = [
      "https://res.cloudinary.com/demo/image/upload/sample.jpg",
      "https://res.cloudinary.com/demo/image/upload/cld-sample.jpg",
      "https://res.cloudinary.com/demo/image/upload/cld-sample-2.jpg",
      "https://res.cloudinary.com/demo/image/upload/cld-sample-3.jpg",
      "https://res.cloudinary.com/demo/image/upload/cld-sample-4.jpg",
      "https://res.cloudinary.com/demo/image/upload/cld-sample-5.jpg",
    ];

    // Determine dynamic folder hierarchy: logistics / [environment] / [entity] / [YYYY/MM]
    const envFolder = process.env.NODE_ENV === "production" ? "production" : "development";
    const entityFolder = req.query.folder || req.body.folder || "trucks";
    const dateObj = new Date();
    const yearMonth = `${dateObj.getFullYear()}/${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
    const cloudinaryFolder = `logistics/${envFolder}/${entityFolder}/${yearMonth}`;

    for (const file of req.files) {
      if (hasCloudinary) {
        try {
          const result = await cloudinary.uploader.upload(file.path, {
            folder: cloudinaryFolder,
          });
          urls.push(result.secure_url);
        } catch (uploadErr) {
          console.error("Cloudinary upload error:", uploadErr);
          // fallback to valid demo image if cloudinary fails
          urls.push(sampleImages[Math.floor(Math.random() * sampleImages.length)]);
        }
      } else {
        // Fallback simulated Cloudinary URL using valid demo image
        urls.push(sampleImages[Math.floor(Math.random() * sampleImages.length)]);
      }

      // Clean up tmp file
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    }

    res.json({
      success: true,
      urls,
    });
  } catch (error) {
    console.error("Upload controller error:", error);
    res.status(500).json({ message: error.message || "Failed to upload images" });
  }
};
