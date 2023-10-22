const nodemailer = require("nodemailer");

function sendVerificationEmail(email, verificationToken) {
  const transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    auth: {
      user: "lulu.wiegand@ethereal.email",
      pass: "53nDtHFA6QYPcJSh3K",
    },
  });
  const verificationLink = `http://localhost:3000/auth/verify/${verificationToken}`;

  const mailOptions = {
    from: "your_email@gmail.com",
    to: email,
    subject: "Email Verification",
    text: `Click the following link to verify your email: ${verificationLink}`,
  };

  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        reject(error);
      } else {
        resolve(info.response);
      }
    });
  });
}

module.exports = {
  sendVerificationEmail,
};
