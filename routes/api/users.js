const express = require("express");
const Joi = require("joi");
const bcrypt = require("bcrypt");
const router = express.Router();
const { HttpError } = require("../../helpers/index");
const gravatar = require("gravatar");
const { User } = require("../../db/usersSchema");
const { generateToken, verifyToken, passportAuthenticate } = require("./auth");
const path = require("path");
const fs = require("fs/promises");
const multer = require("multer");

const tempDir = path.join(__dirname, "../", "../", "temp");
const avatrsDir = path.join(__dirname, "../", "../", "public", "avatars");

const multerConfig = multer.diskStorage({
  destination: tempDir,
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({
  storage: multerConfig,
});

const validateUser = (data) => {
  const schema = Joi.object({
    email: Joi.string()
      .email({ minDomainSegments: 2, tlds: { allow: ["com", "net"] } })
      .required(),
    password: Joi.string()
      .pattern(new RegExp("^[a-zA-Z0-9]{3,30}$"))
      .required()
      .min(7),
  });
  return schema.validate(data);
};

// POST /users/register
router.post("/register", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { error } = validateUser({ email, password });

    if (error) {
      throw HttpError(400, error.details[0].message);
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      throw HttpError(409, "Email in use");
    }
    const avatarURL = gravatar.url(email, { protocol: "https", s: "100" });
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      email,
      password: hashedPassword,
      avatarURL,
    });
    const token = generateToken(user);

    res.status(201).json({
      token: token,
      user: {
        email: user.email,
        subscription: "starter",
        avatarURL,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /users/login
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { error } = validateUser({ email, password });

    if (error) {
      throw HttpError(400, error.details[0].message);
    }

    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw HttpError(401, "Invalid credentials");
    }

    const token = generateToken(user);

    res.status(200).json({
      token: token,
      user: {
        email: user.email,
        subscription: "starter",
        avatarURL: user.avatarURL,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /users/logout
router.post("/logout", async (req, res, next) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const decodedToken = verifyToken(token);
    if (!decodedToken) {
      throw HttpError(401, "Token is invalid");
    }
    const user = await User.findOne({ _id: decodedToken.userId });
    if (!user) {
      throw HttpError(401, "Not authorized");
    }
    res.status(204).json({ message: "Successful Log Out" });
  } catch (error) {
    next(error);
  }
});

// GET /users/current
router.get("/current", passportAuthenticate, async (req, res, next) => {
  try {
    const user = req.user;
    const token = req.headers.authorization.split(" ")[1];

    if (!user) {
      throw HttpError(401, "Token is invalid");
    }

    res.status(200).json({
      token: token,
      user: {
        email: user.email,
        subscription: user.subscription,
        avatarURL: user.avatarURL,
      },
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /users
router.patch("/", passportAuthenticate, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { subscription } = req.body;

    const allowedSubscriptions = ["starter", "pro", "business"];
    if (!allowedSubscriptions.includes(subscription)) {
      throw HttpError(400, "Invalid subscription value");
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { subscription },
      { new: true }
    );

    if (!user) {
      throw HttpError(404, "User not found");
    }

    res.json({
      status: "success",
      code: 200,
      data: {
        email: user.email,
        subscription: user.subscription,
        avatarURL: user.avatarURL,
      },
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /users/avatars
router.patch(
  "/avatars",
  passportAuthenticate,
  upload.single("avatar"),
  async (req, res, next) => {
    try {
      const userId = req.user._id;

      const { path: tempUpload, originalname } = req.file;
      const resultUpload = path.join(avatrsDir, originalname);
      await fs.rename(tempUpload, resultUpload);

      const avatarURL = path.join("avatars", originalname);

      const user = await User.findByIdAndUpdate(
        userId,
        { avatarURL },
        { new: true }
      );

      if (!user) {
        throw HttpError(404, "User not found");
      }

      res.json({
        status: "success",
        code: 200,
        data: {
          email: user.email,
          subscription: user.subscription,
          avatarURL: user.avatarURL,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
