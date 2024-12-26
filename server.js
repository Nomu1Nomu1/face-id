require('dotenv').config();
const express = require("express");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
const Sequelize = require("sequelize")
const DataTypes = require("sequelize");
const schedule = require('node-schedule');
const { type } = require('os');
const app = express();
const port = process.env.PORT || 3050;

const db = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
  host: process.env.DB_HOST,
  dialect: 'mysql'
})

const Data = db.define('logs', {
  name: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  img: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  is_valid: {
    type: DataTypes.ENUM('0', '1'),
    allowNull: false
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: false
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: false
  }
})

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "temp/");
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

let shoudlCapture = false;

schedule.scheduleJob('0 8 * * *', () => {
  console.log('Captured at 8 AM')
  shoudlCapture = true;
  resetCapture();
})

schedule.scheduleJob('0 16 * * *', () => {
  console.log('Captured at 4 PM')
  shoudlCapture = true;
  resetCapture();
})

function resetCapture() {
  setTimeout(() => {
    shoudlCapture = false;
  }, 10000)
}

const upload = multer({ storage: storage });

app.use(express.static("public"));
app.use('/images', express.static(path.join(__dirname, 'images')));

app.get("/should-capture", (req, res) => {
  res.json({ capture: shoudlCapture });
})

app.post("/upload", upload.single("image"), async (req, res) => {
  const { latitude, longitude } = req.body;
  
  const image = path.join(__dirname, "temp", req.file.originalname);

  const form = new FormData();
  form.append("file", fs.createReadStream(image));

  try {
    const response = await axios
      .post(process.env.ENDPOINT_FACE_RECOGNITION + "/find_face", form, {
        headers: {
          ...form.getHeaders(),
        },
      })
      .then((response) => {
        
        if (response.data.face_found_in_image) {
          Data.create({
            name: JSON.stringify(response.data.face_names),
            img: req.file.originalname,
            timeStamp: new Date(),
            is_valid: '0',
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude)
          });
        }
        
        fs.readdir("temp", (err, files) => {
          if (err) throw err;
          for (const file of files) {
            fs.unlink(path.join("temp", file), (err) => {
              if (err) throw err;
            });
          }
        });
        res.json(response.data);
      });
  } catch (error) {
    
    fs.readdir("temp", (err, files) => {
      if (err) throw err;
      for (const file of files) {
        fs.unlink(path.join("temp", file), (err) => {
          if (err) throw err;
        });
      }
    });
    res.status(500).send(error);
  }
});

app.get("/logs", async (req, res) => {
  try {
    const logs = [
      {
        id: 1,
        name: "John Doe",
        image: process.env.APP_URL + "/images/default.jpg",
        timestamp: new Date(),
        is_valid: '0'
      },
      {
        id: 2,
        name: "Jane Doe2",
        image: process.env.APP_URL + "/images/default.jpg",
        timestamp: new Date(),
        is_valid: '0'
      },
    ];
    
    res.json(logs);
  } catch (error) {
    res.status(500).send(error);
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});